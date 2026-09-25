from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.api.deps import DbSession, require_permission
from app.models import User
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.notification import NotificationAcknowledgeRequest, NotificationResponse
from app.services.notification import notification_service

router = APIRouter()


@router.get("", response_model=PaginatedResponse[NotificationResponse])
def list_notifications(
    db: DbSession,
    current_user: User = Depends(require_permission("notifications:read")),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    unacknowledged_only: bool = Query(False),
) -> PaginatedResponse[NotificationResponse]:
    items, total = notification_service.list_for_user(
        db,
        current_user,
        page=page,
        page_size=page_size,
        unacknowledged_only=unacknowledged_only,
    )
    return PaginatedResponse.build(
        [NotificationResponse.model_validate(item) for item in items],
        total,
        page,
        page_size,
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
