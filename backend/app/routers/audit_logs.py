from fastapi import APIRouter, Depends, Query

from app.api.deps import DbSession, Pagination, require_permission
from app.models import User
from app.models import AuditLog
from app.schemas.audit_log import AuditLogResponse
from app.schemas.common import PaginatedResponse
from app.services.audit_log import audit_log_service

router = APIRouter()


@router.get("", response_model=PaginatedResponse[AuditLogResponse])
def list_audit_logs(
    db: DbSession,
    pagination: Pagination,
    current_user: User = Depends(require_permission("audit_logs:read")),
    entity_type: str | None = Query(None),
    entity_id: str | None = Query(None),
) -> PaginatedResponse[AuditLogResponse]:
    extra = []
    if entity_type:
        extra.append(AuditLog.entity_type == entity_type)
    if entity_id:
        extra.append(AuditLog.entity_id == entity_id)
    items, total = audit_log_service.list(
        db,
        current_user.organization_id,
        extra_filters=extra or None,
        **pagination,
    )
    return PaginatedResponse.build(
        [AuditLogResponse.model_validate(item) for item in items],
        total,
        pagination["page"],
        pagination["page_size"],
    )
