from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.crud.base import CRUDBase
from app.models import Activity, Customer, CustomFieldDefinition, Quotation, QuotationItem, QuotationTemplate, QuotationVersion
from app.models.enums import CustomFieldEntity


class CRUDCustomer(CRUDBase[Customer]):
    def get_by_code(self, db: Session, organization_id: UUID, customer_code: str) -> Customer | None:
        return db.scalar(
            select(Customer).where(
                Customer.organization_id == organization_id,
                Customer.customer_code == customer_code,
            )
        )


class CRUDActivity(CRUDBase[Activity]):
    def get_by_code(self, db: Session, organization_id: UUID, code: str) -> Activity | None:
        return db.scalar(
            select(Activity).where(
                Activity.organization_id == organization_id,
                Activity.code == code,
            )
        )


class CRUDQuotation(CRUDBase[Quotation]):
    def get_by_org_with_items(self, db: Session, organization_id: UUID, id: UUID) -> Quotation | None:
        return db.scalar(
            select(Quotation)
            .options(selectinload(Quotation.items), selectinload(Quotation.versions))
            .where(Quotation.organization_id == organization_id, Quotation.id == id)
        )

    def get_by_number(self, db: Session, organization_id: UUID, quotation_number: str) -> Quotation | None:
        return db.scalar(
            select(Quotation).where(
                Quotation.organization_id == organization_id,
                Quotation.quotation_number == quotation_number,
            )
        )

    def next_sequence(self, db: Session, organization_id: UUID) -> int:
        from sqlalchemy import func

        total = db.scalar(
            select(func.count()).select_from(Quotation).where(Quotation.organization_id == organization_id)
        )
        return int(total or 0) + 1


class CRUDQuotationItem(CRUDBase[QuotationItem]):
    pass


class CRUDQuotationVersion(CRUDBase[QuotationVersion]):
    def latest_version_number(self, db: Session, quotation_id: UUID) -> int:
        from sqlalchemy import func

        value = db.scalar(
            select(func.max(QuotationVersion.version_number)).where(
                QuotationVersion.quotation_id == quotation_id
            )
        )
        return int(value or 0)


class CRUDQuotationTemplate(CRUDBase[QuotationTemplate]):
    def get_default(self, db: Session, organization_id: UUID) -> QuotationTemplate | None:
        return db.scalar(
            select(QuotationTemplate).where(
                QuotationTemplate.organization_id == organization_id,
                QuotationTemplate.is_default.is_(True),
            )
        )


class CRUDCustomField(CRUDBase[CustomFieldDefinition]):
    def list_for_entity(
        self,
        db: Session,
        organization_id: UUID,
        entity_type: CustomFieldEntity,
    ) -> list[CustomFieldDefinition]:
        stmt = (
            select(CustomFieldDefinition)
            .where(
                CustomFieldDefinition.organization_id == organization_id,
                CustomFieldDefinition.entity_type == entity_type,
            )
            .order_by(CustomFieldDefinition.display_order, CustomFieldDefinition.field_key)
        )
        return list(db.scalars(stmt).all())


customer = CRUDCustomer(Customer, search_fields=["customer_code", "name", "email", "phone"])
activity = CRUDActivity(Activity, search_fields=["code", "name", "description"])
quotation = CRUDQuotation(Quotation, search_fields=["quotation_number", "notes"])
quotation_item = CRUDQuotationItem(QuotationItem)
quotation_version = CRUDQuotationVersion(QuotationVersion)
quotation_template = CRUDQuotationTemplate(QuotationTemplate, search_fields=["name", "description"])
custom_field = CRUDCustomField(CustomFieldDefinition, search_fields=["field_key", "field_label"])
