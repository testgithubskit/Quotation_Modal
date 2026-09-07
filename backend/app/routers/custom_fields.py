from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import DbSession, Pagination, require_permission
from app.models import User
from app.models.enums import CustomFieldEntity
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.custom_field import (
    CustomFieldDefinitionCreate,
    CustomFieldDefinitionResponse,
    CustomFieldDefinitionUpdate,
)
from app.services.quotation import custom_field_service

router = APIRouter()


@router.get("", response_model=PaginatedResponse[CustomFieldDefinitionResponse])
def list_custom_fields(
    db: DbSession,
    pagination: Pagination,
    current_user: User = Depends(require_permission("custom_fields:read")),
    entity_type: CustomFieldEntity | None = Query(None),
) -> PaginatedResponse[CustomFieldDefinitionResponse]:
    items, total = custom_field_service.list(db, current_user, entity_type=entity_type, **pagination)
    return PaginatedResponse.build(
        [CustomFieldDefinitionResponse.model_validate(item) for item in items],
        total,
        pagination["page"],
        pagination["page_size"],
    )


@router.post("", response_model=CustomFieldDefinitionResponse, status_code=status.HTTP_201_CREATED)
def create_custom_field(
    payload: CustomFieldDefinitionCreate,
    db: DbSession,
    current_user: User = Depends(require_permission("custom_fields:create")),
) -> CustomFieldDefinitionResponse:
    return CustomFieldDefinitionResponse.model_validate(custom_field_service.create(db, current_user, payload))


@router.get("/{field_id}", response_model=CustomFieldDefinitionResponse)
def get_custom_field(
    field_id: UUID,
    db: DbSession,
    current_user: User = Depends(require_permission("custom_fields:read")),
) -> CustomFieldDefinitionResponse:
    return CustomFieldDefinitionResponse.model_validate(custom_field_service.get(db, current_user, field_id))


@router.patch("/{field_id}", response_model=CustomFieldDefinitionResponse)
def update_custom_field(
    field_id: UUID,
    payload: CustomFieldDefinitionUpdate,
    db: DbSession,
    current_user: User = Depends(require_permission("custom_fields:update")),
) -> CustomFieldDefinitionResponse:
    return CustomFieldDefinitionResponse.model_validate(
        custom_field_service.update(db, current_user, field_id, payload)
    )


@router.delete("/{field_id}", response_model=MessageResponse)
def delete_custom_field(
    field_id: UUID,
    db: DbSession,
    current_user: User = Depends(require_permission("custom_fields:delete")),
) -> MessageResponse:
    custom_field_service.delete(db, current_user, field_id)
    return MessageResponse(message="Custom field deleted")
