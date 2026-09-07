from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.api.deps import DbSession, Pagination, require_permission
from app.models import User
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.quotation import QuotationTemplateCreate, QuotationTemplateResponse, QuotationTemplateUpdate
from app.services.quotation import quotation_template_service

router = APIRouter()


@router.get("", response_model=PaginatedResponse[QuotationTemplateResponse])
def list_templates(
    db: DbSession,
    pagination: Pagination,
    current_user: User = Depends(require_permission("quotation_templates:read")),
) -> PaginatedResponse[QuotationTemplateResponse]:
    items, total = quotation_template_service.list(db, current_user, **pagination)
    return PaginatedResponse.build(
        [QuotationTemplateResponse.model_validate(item) for item in items],
        total,
        pagination["page"],
        pagination["page_size"],
    )


@router.post("", response_model=QuotationTemplateResponse, status_code=status.HTTP_201_CREATED)
def create_template(
    payload: QuotationTemplateCreate,
    db: DbSession,
    current_user: User = Depends(require_permission("quotation_templates:create")),
) -> QuotationTemplateResponse:
    return QuotationTemplateResponse.model_validate(quotation_template_service.create(db, current_user, payload))


@router.get("/{template_id}", response_model=QuotationTemplateResponse)
def get_template(
    template_id: UUID,
    db: DbSession,
    current_user: User = Depends(require_permission("quotation_templates:read")),
) -> QuotationTemplateResponse:
    return QuotationTemplateResponse.model_validate(quotation_template_service.get(db, current_user, template_id))


@router.patch("/{template_id}", response_model=QuotationTemplateResponse)
def update_template(
    template_id: UUID,
    payload: QuotationTemplateUpdate,
    db: DbSession,
    current_user: User = Depends(require_permission("quotation_templates:update")),
) -> QuotationTemplateResponse:
    return QuotationTemplateResponse.model_validate(
        quotation_template_service.update(db, current_user, template_id, payload)
    )


@router.delete("/{template_id}", response_model=MessageResponse)
def delete_template(
    template_id: UUID,
    db: DbSession,
    current_user: User = Depends(require_permission("quotation_templates:delete")),
) -> MessageResponse:
    quotation_template_service.delete(db, current_user, template_id)
    return MessageResponse(message="Quotation template deleted")
