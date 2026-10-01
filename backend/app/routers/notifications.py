from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.deps import DbSession, Pagination, require_permission
from app.models import User
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.notification import NotificationAcknowledgeRequest, NotificationResponse
from app.services.notification import notification_service

router = APIRouter()


@router.get("", response_model=PaginatedResponse[NotificationResponse])
def list_notifications(
    db: DbSession,
    pagination: Pagination,
    current_user: User = Depends(require_permission("notifications:read")),
    unacknowledged_only: bool = Depends(lambda: False),
) -> PaginatedResponse[NotificationResponse]:
    items, total = notification_service.list_for_user(
        db,
        current_user,
        page=pagination["page"],
        page_size=pagination["page_size"],
        unacknowledged_only=unacknowledged_only,
    )
    return PaginatedResponse.build(
        [NotificationResponse.model_validate(item) for item in items],
        total,
        pagination["page"],
        pagination["page_size"],
    )


@router.get("/unread-count", response_model=dict)
def unread_notification_count(
    db: DbSession,
    current_user: User = Depends(require_permission("notifications:read")),
) -> dict:
    return {"count": notification_service.unacknowledged_count(db, current_user)}


@router.post("/acknowledge", response_model=MessageResponse)
def acknowledge_notifications(
    payload: NotificationAcknowledgeRequest,
    db: DbSession,
    current_user: User = Depends(require_permission("notifications:update")),
) -> MessageResponse:
    count = notification_service.acknowledge(db, current_user, payload.ids)
    return MessageResponse(message=f"Acknowledged {count} notification(s)")
