from __future__ import annotations

from uuid import UUID

from sqlalchemy import delete
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.exceptions import AppError, ConflictError, NotFoundError
from app.crud import activity as activity_crud
from app.crud import customer as customer_crud
from app.models import Activity, Customer, User
from app.models.enums import AuditAction, CustomFieldEntity
from app.schemas.activity import ActivityCreate, ActivityUpdate
from app.schemas.customer import CustomerCreate, CustomerUpdate
from app.services.audit_log import audit_log_service
from app.services.custom_field import validate_custom_data


class CustomerService:
    def list(self, db: Session, current_user: User, **params) -> tuple[list[Customer], int]:
        return customer_crud.list_by_org(db, current_user.organization_id, **params)

    def get(self, db: Session, current_user: User, customer_id: UUID) -> Customer:
        customer = customer_crud.get_by_org(db, current_user.organization_id, customer_id)
        if customer is None:
            raise NotFoundError("Customer not found")
        return customer

    def create(self, db: Session, current_user: User, payload: CustomerCreate) -> Customer:
        if customer_crud.get_by_code(db, current_user.organization_id, payload.customer_code):
            raise ConflictError("Customer code already exists")
        data = payload.model_dump()
        data["organization_id"] = current_user.organization_id
        data["custom_data"] = validate_custom_data(
            db, current_user.organization_id, CustomFieldEntity.CUSTOMER, payload.custom_data
        )
        customer = customer_crud.create(db, data)
        audit_log_service.record(
            db,
            organization_id=current_user.organization_id,
            user_id=current_user.id,
            action=AuditAction.CREATE,
            entity_type="Customer",
            entity_id=customer.id,
            new_data={"customer_code": customer.customer_code, "name": customer.name},
        )
        db.commit()
        db.refresh(customer)
        return customer

    def update(self, db: Session, current_user: User, customer_id: UUID, payload: CustomerUpdate) -> Customer:
        customer = self.get(db, current_user, customer_id)
        data = payload.model_dump(exclude_unset=True)
        if "customer_code" in data:
            existing = customer_crud.get_by_code(db, current_user.organization_id, data["customer_code"])
            if existing and existing.id != customer.id:
                raise ConflictError("Customer code already exists")
        if "custom_data" in data:
            data["custom_data"] = validate_custom_data(
                db,
                current_user.organization_id,
                CustomFieldEntity.CUSTOMER,
                data["custom_data"],
                partial=True,
            )
        customer = customer_crud.update(db, customer, data)
        audit_log_service.record(
            db,
            organization_id=current_user.organization_id,
            user_id=current_user.id,
            action=AuditAction.UPDATE,
            entity_type="Customer",
            entity_id=customer.id,
        )
        db.commit()
        db.refresh(customer)
        return customer

    def delete(self, db: Session, current_user: User, customer_id: UUID) -> None:
        customer = self.get(db, current_user, customer_id)
        customer_crud.remove(db, customer)
        audit_log_service.record(
            db,
            organization_id=current_user.organization_id,
            user_id=current_user.id,
            action=AuditAction.DELETE,
            entity_type="Customer",
            entity_id=customer_id,
        )
        db.commit()

    def delete_all(self, db: Session, current_user: User) -> int:
        org_id = current_user.organization_id
        try:
            result = db.execute(delete(Customer).where(Customer.organization_id == org_id))
            deleted = int(result.rowcount or 0)
            if deleted:
                audit_log_service.record(
                    db,
                    organization_id=org_id,
                    user_id=current_user.id,
                    action=AuditAction.DELETE,
                    entity_type="Customer",
                    entity_id=None,
                    new_data={"bulk_delete": True, "count": deleted},
                )
            db.commit()
            return deleted
        except IntegrityError as exc:
            db.rollback()
            raise AppError(
                "Cannot delete all customers while quotations still reference them. "
                "Remove or reassign those reports first.",
                status_code=409,
                code="customers_in_use",
            ) from exc


class ActivityService:
    def list(self, db: Session, current_user: User, **params) -> tuple[list[Activity], int]:
        return activity_crud.list_by_org(db, current_user.organization_id, **params)

    def get(self, db: Session, current_user: User, activity_id: UUID) -> Activity:
        activity = activity_crud.get_by_org(db, current_user.organization_id, activity_id)
        if activity is None:
            raise NotFoundError("Activity not found")
        return activity

    def create(self, db: Session, current_user: User, payload: ActivityCreate) -> Activity:
        if activity_crud.get_by_code(db, current_user.organization_id, payload.code):
            raise ConflictError("Activity code already exists")
        data = payload.model_dump()
        data["organization_id"] = current_user.organization_id
        data["custom_data"] = validate_custom_data(
            db, current_user.organization_id, CustomFieldEntity.ACTIVITY, payload.custom_data
        )
        activity = activity_crud.create(db, data)
        audit_log_service.record(
            db,
            organization_id=current_user.organization_id,
            user_id=current_user.id,
            action=AuditAction.CREATE,
            entity_type="Activity",
            entity_id=activity.id,
            new_data={"code": activity.code, "name": activity.name},
        )
        db.commit()
        db.refresh(activity)
        return activity

    def update(self, db: Session, current_user: User, activity_id: UUID, payload: ActivityUpdate) -> Activity:
        activity = self.get(db, current_user, activity_id)
        data = payload.model_dump(exclude_unset=True)
        if "code" in data:
            existing = activity_crud.get_by_code(db, current_user.organization_id, data["code"])
            if existing and existing.id != activity.id:
                raise ConflictError("Activity code already exists")
        if "custom_data" in data:
            data["custom_data"] = validate_custom_data(
                db,
                current_user.organization_id,
                CustomFieldEntity.ACTIVITY,
                data["custom_data"],
                partial=True,
            )
        activity = activity_crud.update(db, activity, data)
        audit_log_service.record(
            db,
            organization_id=current_user.organization_id,
            user_id=current_user.id,
            action=AuditAction.UPDATE,
            entity_type="Activity",
            entity_id=activity.id,
        )
        db.commit()
        db.refresh(activity)
        return activity

    def delete(self, db: Session, current_user: User, activity_id: UUID) -> None:
        activity = self.get(db, current_user, activity_id)
        activity_crud.remove(db, activity)
        audit_log_service.record(
            db,
            organization_id=current_user.organization_id,
            user_id=current_user.id,
            action=AuditAction.DELETE,
            entity_type="Activity",
            entity_id=activity_id,
        )
        db.commit()

    def delete_all(self, db: Session, current_user: User) -> int:
        org_id = current_user.organization_id
        result = db.execute(delete(Activity).where(Activity.organization_id == org_id))
        deleted = int(result.rowcount or 0)
        if deleted:
            audit_log_service.record(
                db,
                organization_id=org_id,
                user_id=current_user.id,
                action=AuditAction.DELETE,
                entity_type="Activity",
                entity_id=None,
                new_data={"bulk_delete": True, "count": deleted},
            )
        db.commit()
        return deleted


customer_service = CustomerService()
activity_service = ActivityService()
