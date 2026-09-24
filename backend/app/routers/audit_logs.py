from fastapi import APIRouter, Depends, Query
from sqlalchemy import and_, or_

from app.api.deps import DbSession, Pagination, require_permission
from app.models import User
from app.models import AuditLog
from app.schemas.audit_log import AuditLogResponse
from app.schemas.common import PaginatedResponse
from app.services.audit_log import audit_log_service

router = APIRouter()

ORG_ACTIVITY = or_(
    AuditLog.action.in_(("LOGIN", "LOGOUT")),
    and_(AuditLog.entity_type == "QuotationTemplate", AuditLog.action.in_(("CREATE", "UPDATE"))),
    and_(AuditLog.entity_type == "User", AuditLog.action.in_(("CREATE", "UPDATE"))),
)


def _serialize(item: AuditLog) -> AuditLogResponse:
    actor = item.user
    payload = AuditLogResponse.model_validate(item).model_dump()
    payload["actor_name"] = actor.full_name if actor else None
    payload["actor_email"] = actor.email if actor else None
    return AuditLogResponse.model_validate(payload)


@router.get("", response_model=PaginatedResponse[AuditLogResponse])
def list_audit_logs(
    db: DbSession,
    pagination: Pagination,
    current_user: User = Depends(require_permission("audit_logs:read")),
    entity_type: str | None = Query(None),
    entity_id: str | None = Query(None),
    scope: str | None = Query(None, description="org = login, logout, template and user changes"),
) -> PaginatedResponse[AuditLogResponse]:
    extra = []
    if entity_type:
        extra.append(AuditLog.entity_type == entity_type)
    if entity_id:
        extra.append(AuditLog.entity_id == entity_id)
    if scope == "org":
        extra.append(ORG_ACTIVITY)
    items, total = audit_log_service.list(
        db,
        current_user.organization_id,
        extra_filters=extra or None,
        **pagination,
    )
    return PaginatedResponse.build(
        [_serialize(item) for item in items],
        total,
        pagination["page"],
        pagination["page_size"],
    )
