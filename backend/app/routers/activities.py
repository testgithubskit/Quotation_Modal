from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.api.deps import DbSession, Pagination, require_permission
from app.models import User
from app.schemas.activity import ActivityCreate, ActivityResponse, ActivityUpdate
from app.schemas.common import MessageResponse, PaginatedResponse
from app.services.catalog import activity_service

router = APIRouter()


@router.get("", response_model=PaginatedResponse[ActivityResponse])
def list_activities(
    db: DbSession,
    pagination: Pagination,
    current_user: User = Depends(require_permission("activities:read")),
) -> PaginatedResponse[ActivityResponse]:
    items, total = activity_service.list(db, current_user, **pagination)
    return PaginatedResponse.build(
        [ActivityResponse.model_validate(item) for item in items],
        total,
        pagination["page"],
        pagination["page_size"],
    )


@router.post("", response_model=ActivityResponse, status_code=status.HTTP_201_CREATED)
def create_activity(
    payload: ActivityCreate,
    db: DbSession,
    current_user: User = Depends(require_permission("activities:create")),
) -> ActivityResponse:
    return ActivityResponse.model_validate(activity_service.create(db, current_user, payload))


@router.get("/{activity_id}", response_model=ActivityResponse)
def get_activity(
    activity_id: UUID,
    db: DbSession,
    current_user: User = Depends(require_permission("activities:read")),
) -> ActivityResponse:
    return ActivityResponse.model_validate(activity_service.get(db, current_user, activity_id))


@router.put("/{activity_id}", response_model=ActivityResponse)
def update_activity(
    activity_id: UUID,
    payload: ActivityUpdate,
    db: DbSession,
    current_user: User = Depends(require_permission("activities:update")),
) -> ActivityResponse:
    return ActivityResponse.model_validate(activity_service.update(db, current_user, activity_id, payload))


@router.delete("/{activity_id}", response_model=MessageResponse)
def delete_activity(
    activity_id: UUID,
    db: DbSession,
    current_user: User = Depends(require_permission("activities:delete")),
) -> MessageResponse:
    activity_service.delete(db, current_user, activity_id)
    return MessageResponse(message="Activity deleted")
