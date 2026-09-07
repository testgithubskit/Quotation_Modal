from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models import AuditLog


class CRUDAuditLog(CRUDBase[AuditLog]):
    def create_entry(
        self,
        db: Session,
        *,
        organization_id: UUID,
        user_id: UUID | None,
        action: str,
        entity_type: str,
        entity_id: str | None,
        old_data: dict | None = None,
        new_data: dict | None = None,
    ) -> AuditLog:
        return self.create(
            db,
            {
                "organization_id": organization_id,
                "user_id": user_id,
                "action": action,
                "entity_type": entity_type,
                "entity_id": entity_id,
                "old_data": old_data,
                "new_data": new_data,
            },
        )

    def list_for_entity(
        self,
        db: Session,
        organization_id: UUID,
        entity_type: str | None = None,
        entity_id: str | None = None,
    ) -> list[AuditLog]:
        stmt = select(AuditLog).where(AuditLog.organization_id == organization_id)
        if entity_type:
            stmt = stmt.where(AuditLog.entity_type == entity_type)
        if entity_id:
            stmt = stmt.where(AuditLog.entity_id == entity_id)
        stmt = stmt.order_by(AuditLog.created_at.desc())
        return list(db.scalars(stmt).all())


audit_log = CRUDAuditLog(AuditLog, search_fields=["action", "entity_type", "entity_id"])
