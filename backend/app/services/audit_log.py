from __future__ import annotations

from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.crud import audit_log as audit_log_crud
from app.models import AuditLog
from app.models.enums import AuditAction


class AuditLogService:
    def record(
        self,
        db: Session,
        *,
        organization_id: UUID,
        user_id: UUID | None,
        action: AuditAction | str,
        entity_type: str,
        entity_id: UUID | str | None,
        old_data: dict[str, Any] | None = None,
        new_data: dict[str, Any] | None = None,
    ) -> AuditLog:
        action_value = action.value if isinstance(action, AuditAction) else action
        return audit_log_crud.create_entry(
            db,
            organization_id=organization_id,
            user_id=user_id,
            action=action_value,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            old_data=old_data,
            new_data=new_data,
        )

    def list(
        self,
        db: Session,
        organization_id: UUID,
        *,
        page: int,
        page_size: int,
        search: str | None,
        sort_by: str,
        sort_order: str,
        extra_filters: list | None = None,
    ) -> tuple[list[AuditLog], int]:
        return audit_log_crud.list_by_org(
            db,
            organization_id,
            page=page,
            page_size=page_size,
            search=search,
            sort_by=sort_by,
            sort_order=sort_order,
            extra_filters=extra_filters,
        )


audit_log_service = AuditLogService()
