from uuid import UUID

from fastapi import APIRouter, Depends, Query, status

from app.api.deps import DbSession, Pagination, require_permission
from app.models import User
from app.models.enums import QuotationStatus
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.quotation import (
    QuotationCreate,
    QuotationListResponse,
    QuotationResponse,
    QuotationStatusUpdate,
    QuotationUpdate,
    QuotationVersionResponse,
)
from app.services.quotation import quotation_service

router = APIRouter()


@router.get("", response_model=PaginatedResponse[QuotationListResponse])
def list_quotations(
    db: DbSession,
    pagination: Pagination,
    current_user: User = Depends(require_permission("quotations:read")),
    status_filter: QuotationStatus | None = Query(None, alias="status"),
    customer_id: UUID | None = Query(None),
) -> PaginatedResponse[QuotationListResponse]:
    items, total = quotation_service.list(
        db,
        current_user,
        status=status_filter,
        customer_id=customer_id,
        **pagination,
    )
    return PaginatedResponse.build(
        [QuotationListResponse.model_validate(item) for item in items],
        total,
        pagination["page"],
        pagination["page_size"],
    )


@router.post("", response_model=QuotationResponse, status_code=status.HTTP_201_CREATED)
def create_quotation(
    payload: QuotationCreate,
    db: DbSession,
    current_user: User = Depends(require_permission("quotations:create")),
) -> QuotationResponse:
    return QuotationResponse.model_validate(quotation_service.create(db, current_user, payload))


@router.get("/{quotation_id}", response_model=QuotationResponse)
def get_quotation(
    quotation_id: UUID,
    db: DbSession,
    current_user: User = Depends(require_permission("quotations:read")),
) -> QuotationResponse:
    return QuotationResponse.model_validate(quotation_service.get(db, current_user, quotation_id))


@router.patch("/{quotation_id}", response_model=QuotationResponse)
def update_quotation(
    quotation_id: UUID,
    payload: QuotationUpdate,
    db: DbSession,
    current_user: User = Depends(require_permission("quotations:update")),
) -> QuotationResponse:
    return QuotationResponse.model_validate(quotation_service.update(db, current_user, quotation_id, payload))


@router.post("/{quotation_id}/status", response_model=QuotationResponse)
def change_quotation_status(
    quotation_id: UUID,
    payload: QuotationStatusUpdate,
    db: DbSession,
    current_user: User = Depends(require_permission("quotations:update")),
) -> QuotationResponse:
    return QuotationResponse.model_validate(quotation_service.change_status(db, current_user, quotation_id, payload))


@router.get("/{quotation_id}/versions", response_model=list[QuotationVersionResponse])
def list_quotation_versions(
    quotation_id: UUID,
    db: DbSession,
    current_user: User = Depends(require_permission("quotations:read")),
) -> list[QuotationVersionResponse]:
    return [QuotationVersionResponse.model_validate(item) for item in quotation_service.list_versions(db, current_user, quotation_id)]


@router.delete("/{quotation_id}", response_model=MessageResponse)
def delete_quotation(
    quotation_id: UUID,
    db: DbSession,
    current_user: User = Depends(require_permission("quotations:delete")),
) -> MessageResponse:
    quotation_service.delete(db, current_user, quotation_id)
    return MessageResponse(message="Quotation deleted")
