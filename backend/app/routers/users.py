from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.api.deps import DbSession, Pagination, require_permission
from app.models import User
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.user import UserCreate, UserResponse, UserUpdate
from app.services.identity import user_service

router = APIRouter()


def _to_response(user) -> UserResponse:
    return UserResponse(
        id=user.id,
        organization_id=user.organization_id,
        role_id=user.role_id,
        role_name=user.role.name if user.role else "",
        email=user.email,
        full_name=user.full_name,
        phone=user.phone,
        is_active=user.is_active,
        custom_data=user.custom_data or {},
        created_at=user.created_at,
        updated_at=user.updated_at,
    )


@router.get("", response_model=PaginatedResponse[UserResponse])
def list_users(
    db: DbSession,
    pagination: Pagination,
    current_user: User = Depends(require_permission("users:read")),
) -> PaginatedResponse[UserResponse]:
    items, total = user_service.list(db, current_user, **pagination)
    return PaginatedResponse.build([_to_response(item) for item in items], total, pagination["page"], pagination["page_size"])


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: DbSession,
    current_user: User = Depends(require_permission("users:create")),
) -> UserResponse:
    return _to_response(user_service.create(db, current_user, payload))


@router.get("/{user_id}", response_model=UserResponse)
def get_user(
    user_id: UUID,
    db: DbSession,
    current_user: User = Depends(require_permission("users:read")),
) -> UserResponse:
    return _to_response(user_service.get(db, current_user, user_id))


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: UUID,
    payload: UserUpdate,
    db: DbSession,
    current_user: User = Depends(require_permission("users:update")),
) -> UserResponse:
    return _to_response(user_service.update(db, current_user, user_id, payload))


@router.delete("/{user_id}", response_model=MessageResponse)
def delete_user(
    user_id: UUID,
    db: DbSession,
    current_user: User = Depends(require_permission("users:delete")),
) -> MessageResponse:
    user_service.delete(db, current_user, user_id)
    return MessageResponse(message="User deleted")
