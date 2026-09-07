from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import AppError, ConflictError, NotFoundError
from app.crud import activity as activity_crud
from app.crud import customer as customer_crud
from app.crud import quotation as quotation_crud
from app.crud import quotation_item as quotation_item_crud
from app.crud import quotation_template as quotation_template_crud
from app.crud import quotation_version as quotation_version_crud
from app.models import Quotation, QuotationItem, QuotationTemplate, QuotationVersion, User
from app.models.enums import AuditAction, CustomFieldEntity, QuotationStatus
from app.schemas.quotation import (
    QuotationCreate,
    QuotationItemCreate,
    QuotationStatusUpdate,
    QuotationTemplateCreate,
    QuotationTemplateUpdate,
    QuotationUpdate,
)
from app.services.audit_log import audit_log_service
from app.services.custom_field import validate_custom_data
from app.services.quotation_calculation import calculate_quotation_totals
from app.services.quotation_status import assert_editable, can_transition


def _decimal_str(value: Decimal | None) -> str:
    return str(value if value is not None else Decimal("0"))


class QuotationService:
    def list(self, db: Session, current_user: User, **params) -> tuple[list[Quotation], int]:
        extra = []
        status = params.pop("status", None)
        customer_id = params.pop("customer_id", None)
        if status:
            extra.append(Quotation.status == status)
        if customer_id:
            extra.append(Quotation.customer_id == customer_id)
        return quotation_crud.list_by_org(db, current_user.organization_id, extra_filters=extra or None, **params)

    def get(self, db: Session, current_user: User, quotation_id: UUID) -> Quotation:
        quotation = quotation_crud.get_by_org_with_items(db, current_user.organization_id, quotation_id)
        if quotation is None:
            raise NotFoundError("Quotation not found")
        return quotation

    def create(self, db: Session, current_user: User, payload: QuotationCreate) -> Quotation:
        customer = customer_crud.get_by_org(db, current_user.organization_id, payload.customer_id)
        if customer is None:
            raise NotFoundError("Customer not found")
        template = None
        if payload.quotation_template_id:
            template = quotation_template_crud.get_by_org(
                db, current_user.organization_id, payload.quotation_template_id
            )
            if template is None:
                raise NotFoundError("Quotation template not found")

        quotation_number = payload.quotation_number or self._generate_number(db, current_user.organization_id)
        if quotation_crud.get_by_number(db, current_user.organization_id, quotation_number):
            raise ConflictError("Quotation number already exists")

        custom_data = validate_custom_data(
            db, current_user.organization_id, CustomFieldEntity.QUOTATION, payload.custom_data
        )
        quotation = quotation_crud.create(
            db,
            {
                "organization_id": current_user.organization_id,
                "customer_id": customer.id,
                "quotation_template_id": template.id if template else None,
                "created_by": current_user.id,
                "quotation_number": quotation_number,
                "quotation_date": payload.quotation_date or datetime.now(timezone.utc),
                "validity_date": payload.validity_date,
                "status": QuotationStatus.DRAFT,
                "discount": payload.discount,
                "currency": payload.currency,
                "notes": payload.notes,
                "custom_data": custom_data,
            },
        )
        self._replace_items(db, current_user, quotation, payload.items)
        self._recalculate(db, quotation)
        self._snapshot(db, quotation, "Initial version")
        audit_log_service.record(
            db,
            organization_id=current_user.organization_id,
            user_id=current_user.id,
            action=AuditAction.CREATE,
            entity_type="Quotation",
            entity_id=quotation.id,
            new_data={"quotation_number": quotation.quotation_number},
        )
        db.commit()
        return self.get(db, current_user, quotation.id)

    def update(self, db: Session, current_user: User, quotation_id: UUID, payload: QuotationUpdate) -> Quotation:
        quotation = self.get(db, current_user, quotation_id)
        try:
            assert_editable(quotation.status)
        except ValueError as exc:
            raise AppError(str(exc), status_code=409, code="invalid_status") from exc

        data = payload.model_dump(exclude_unset=True)
        items = data.pop("items", None)
        if "customer_id" in data:
            customer = customer_crud.get_by_org(db, current_user.organization_id, data["customer_id"])
            if customer is None:
                raise NotFoundError("Customer not found")
        if "quotation_template_id" in data and data["quotation_template_id"]:
            template = quotation_template_crud.get_by_org(
                db, current_user.organization_id, data["quotation_template_id"]
            )
            if template is None:
                raise NotFoundError("Quotation template not found")
        if "custom_data" in data:
            data["custom_data"] = validate_custom_data(
                db,
                current_user.organization_id,
                CustomFieldEntity.QUOTATION,
                data["custom_data"],
                partial=True,
            )
        quotation = quotation_crud.update(db, quotation, data)
        if items is not None:
            self._replace_items(db, current_user, quotation, [QuotationItemCreate(**item) for item in items])
        self._recalculate(db, quotation)
        self._snapshot(db, quotation, "Quotation updated")
        audit_log_service.record(
            db,
            organization_id=current_user.organization_id,
            user_id=current_user.id,
            action=AuditAction.UPDATE,
            entity_type="Quotation",
            entity_id=quotation.id,
        )
        db.commit()
        return self.get(db, current_user, quotation.id)

    def change_status(
        self,
        db: Session,
        current_user: User,
        quotation_id: UUID,
        payload: QuotationStatusUpdate,
    ) -> Quotation:
        quotation = self.get(db, current_user, quotation_id)
        if not can_transition(quotation.status, payload.status):
            raise AppError(
                f"Cannot change status from {quotation.status.value} to {payload.status.value}",
                status_code=409,
                code="invalid_status_transition",
            )
        old_status = quotation.status.value
        quotation.status = payload.status
        db.add(quotation)
        self._snapshot(db, quotation, f"Status changed to {payload.status.value}")
        audit_log_service.record(
            db,
            organization_id=current_user.organization_id,
            user_id=current_user.id,
            action=AuditAction.STATUS_CHANGE,
            entity_type="Quotation",
            entity_id=quotation.id,
            old_data={"status": old_status},
            new_data={"status": payload.status.value},
        )
        db.commit()
        return self.get(db, current_user, quotation.id)

    def delete(self, db: Session, current_user: User, quotation_id: UUID) -> None:
        quotation = self.get(db, current_user, quotation_id)
        if quotation.status not in {QuotationStatus.DRAFT, QuotationStatus.CANCELLED}:
            raise AppError("Only draft or cancelled quotations can be deleted", status_code=409, code="invalid_status")
        quotation_crud.remove(db, quotation)
        audit_log_service.record(
            db,
            organization_id=current_user.organization_id,
            user_id=current_user.id,
            action=AuditAction.DELETE,
            entity_type="Quotation",
            entity_id=quotation_id,
        )
        db.commit()

    def list_versions(self, db: Session, current_user: User, quotation_id: UUID) -> list[QuotationVersion]:
        quotation = self.get(db, current_user, quotation_id)
        return list(quotation.versions)

    def _generate_number(self, db: Session, organization_id: UUID) -> str:
        year = datetime.now(timezone.utc).year
        seq = quotation_crud.next_sequence(db, organization_id)
        return f"QT-{year}-{seq:06d}"

    def _replace_items(
        self,
        db: Session,
        current_user: User,
        quotation: Quotation,
        items: list[QuotationItemCreate],
    ) -> None:
        for existing in list(quotation.items):
            quotation_item_crud.remove(db, existing)
        db.flush()
        for index, item in enumerate(items, start=1):
            activity = None
            description = item.description
            unit = item.unit
            unit_price = item.unit_price
            if item.activity_id:
                activity = activity_crud.get_by_org(db, current_user.organization_id, item.activity_id)
                if activity is None:
                    raise NotFoundError("Activity not found")
                description = description or activity.name
                unit = unit or activity.unit
                if unit_price is None:
                    unit_price = activity.unit_price
            if not description:
                raise AppError("Item description is required", status_code=422, code="validation_error")
            if unit_price is None:
                raise AppError("Item unit price is required", status_code=422, code="validation_error")
            custom_data = validate_custom_data(
                db,
                current_user.organization_id,
                CustomFieldEntity.QUOTATION_ITEM,
                item.custom_data,
            )
            quotation_item_crud.create(
                db,
                {
                    "quotation_id": quotation.id,
                    "activity_id": activity.id if activity else None,
                    "line_number": index,
                    "description": description,
                    "quantity": item.quantity,
                    "unit": unit or "unit",
                    "unit_price": unit_price,
                    "discount": item.discount,
                    "tax": item.tax,
                    "total": Decimal("0.00"),
                    "custom_data": custom_data,
                },
            )
        db.flush()
        db.expire(quotation, ["items"])

    def _recalculate(self, db: Session, quotation: Quotation) -> None:
        db.refresh(quotation)
        item_payloads = [
            {
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "discount": item.discount,
                "tax": item.tax,
            }
            for item in quotation.items
        ]
        try:
            totals = calculate_quotation_totals(item_payloads, quotation.discount)
        except ValueError as exc:
            raise AppError(str(exc), status_code=422, code="calculation_error") from exc
        for item, calculated in zip(quotation.items, totals["items"], strict=True):
            item.quantity = calculated["quantity"]
            item.unit_price = calculated["unit_price"]
            item.discount = calculated["discount"]
            item.tax = calculated["tax"]
            item.total = calculated["total"]
            db.add(item)
        quotation.subtotal = totals["subtotal"]
        quotation.tax = totals["tax"]
        quotation.total = totals["total"]
        db.flush()
        db.expire(quotation, ["items"])
        db.refresh(quotation)

    def _snapshot(self, db: Session, quotation: Quotation, change_summary: str) -> None:
        db.refresh(quotation)
        next_version = quotation_version_crud.latest_version_number(db, quotation.id) + 1
        snapshot = {
            "quotation_number": quotation.quotation_number,
            "status": quotation.status.value,
            "subtotal": _decimal_str(quotation.subtotal),
            "discount": _decimal_str(quotation.discount),
            "tax": _decimal_str(quotation.tax),
            "total": _decimal_str(quotation.total),
            "currency": quotation.currency,
            "notes": quotation.notes,
            "custom_data": quotation.custom_data,
            "items": [
                {
                    "activity_id": str(item.activity_id) if item.activity_id else None,
                    "description": item.description,
                    "quantity": _decimal_str(item.quantity),
                    "unit": item.unit,
                    "unit_price": _decimal_str(item.unit_price),
                    "discount": _decimal_str(item.discount),
                    "tax": _decimal_str(item.tax),
                    "total": _decimal_str(item.total),
                    "custom_data": item.custom_data,
                }
                for item in quotation.items
            ],
        }
        quotation_version_crud.create(
            db,
            {
                "quotation_id": quotation.id,
                "version_number": next_version,
                "snapshot_data": snapshot,
                "change_summary": change_summary,
            },
        )


class QuotationTemplateService:
    def list(self, db: Session, current_user: User, **params) -> tuple[list[QuotationTemplate], int]:
        return quotation_template_crud.list_by_org(db, current_user.organization_id, **params)

    def get(self, db: Session, current_user: User, template_id: UUID) -> QuotationTemplate:
        template = quotation_template_crud.get_by_org(db, current_user.organization_id, template_id)
        if template is None:
            raise NotFoundError("Quotation template not found")
        return template

    def create(self, db: Session, current_user: User, payload: QuotationTemplateCreate) -> QuotationTemplate:
        data = payload.model_dump()
        data["organization_id"] = current_user.organization_id
        data["custom_data"] = validate_custom_data(
            db,
            current_user.organization_id,
            CustomFieldEntity.QUOTATION_TEMPLATE,
            payload.custom_data,
        )
        template = quotation_template_crud.create(db, data)
        if template.is_default:
            self._clear_other_defaults(db, current_user.organization_id, template.id)
        audit_log_service.record(
            db,
            organization_id=current_user.organization_id,
            user_id=current_user.id,
            action=AuditAction.CREATE,
            entity_type="QuotationTemplate",
            entity_id=template.id,
            new_data={"name": template.name},
        )
        db.commit()
        db.refresh(template)
        return template

    def update(
        self,
        db: Session,
        current_user: User,
        template_id: UUID,
        payload: QuotationTemplateUpdate,
    ) -> QuotationTemplate:
        template = self.get(db, current_user, template_id)
        data = payload.model_dump(exclude_unset=True)
        if "custom_data" in data:
            data["custom_data"] = validate_custom_data(
                db,
                current_user.organization_id,
                CustomFieldEntity.QUOTATION_TEMPLATE,
                data["custom_data"],
                partial=True,
            )
        template = quotation_template_crud.update(db, template, data)
        if template.is_default:
            self._clear_other_defaults(db, current_user.organization_id, template.id)
        audit_log_service.record(
            db,
            organization_id=current_user.organization_id,
            user_id=current_user.id,
            action=AuditAction.UPDATE,
            entity_type="QuotationTemplate",
            entity_id=template.id,
        )
        db.commit()
        db.refresh(template)
        return template

    def delete(self, db: Session, current_user: User, template_id: UUID) -> None:
        template = self.get(db, current_user, template_id)
        quotation_template_crud.remove(db, template)
        audit_log_service.record(
            db,
            organization_id=current_user.organization_id,
            user_id=current_user.id,
            action=AuditAction.DELETE,
            entity_type="QuotationTemplate",
            entity_id=template_id,
        )
        db.commit()

    def _clear_other_defaults(self, db: Session, organization_id: UUID, keep_id: UUID) -> None:
        items, _ = quotation_template_crud.list_by_org(db, organization_id, page=1, page_size=100)
        for item in items:
            if item.id != keep_id and item.is_default:
                item.is_default = False
                db.add(item)


class CustomFieldService:
    def list(self, db: Session, current_user: User, **params) -> tuple[list, int]:
        from app.crud import custom_field as custom_field_crud
        from app.models import CustomFieldDefinition

        extra = []
        entity_type = params.pop("entity_type", None)
        if entity_type:
            extra.append(CustomFieldDefinition.entity_type == entity_type)
        return custom_field_crud.list_by_org(
            db, current_user.organization_id, extra_filters=extra or None, **params
        )

    def get(self, db: Session, current_user: User, field_id: UUID):
        from app.crud import custom_field as custom_field_crud

        field = custom_field_crud.get_by_org(db, current_user.organization_id, field_id)
        if field is None:
            raise NotFoundError("Custom field not found")
        return field

    def create(self, db: Session, current_user: User, payload):
        from app.crud import custom_field as custom_field_crud

        data = payload.model_dump()
        data["organization_id"] = current_user.organization_id
        field = custom_field_crud.create(db, data)
        audit_log_service.record(
            db,
            organization_id=current_user.organization_id,
            user_id=current_user.id,
            action=AuditAction.CREATE,
            entity_type="CustomFieldDefinition",
            entity_id=field.id,
            new_data={"field_key": field.field_key, "entity_type": field.entity_type.value},
        )
        db.commit()
        db.refresh(field)
        return field

    def update(self, db: Session, current_user: User, field_id: UUID, payload):
        from app.crud import custom_field as custom_field_crud

        field = self.get(db, current_user, field_id)
        field = custom_field_crud.update(db, field, payload.model_dump(exclude_unset=True))
        audit_log_service.record(
            db,
            organization_id=current_user.organization_id,
            user_id=current_user.id,
            action=AuditAction.UPDATE,
            entity_type="CustomFieldDefinition",
            entity_id=field.id,
        )
        db.commit()
        db.refresh(field)
        return field

    def delete(self, db: Session, current_user: User, field_id: UUID) -> None:
        from app.crud import custom_field as custom_field_crud

        field = self.get(db, current_user, field_id)
        custom_field_crud.remove(db, field)
        audit_log_service.record(
            db,
            organization_id=current_user.organization_id,
            user_id=current_user.id,
            action=AuditAction.DELETE,
            entity_type="CustomFieldDefinition",
            entity_id=field_id,
        )
        db.commit()


quotation_service = QuotationService()
quotation_template_service = QuotationTemplateService()
custom_field_service = CustomFieldService()
