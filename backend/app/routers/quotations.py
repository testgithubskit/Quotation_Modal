from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import select

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


def _serialize_quotation_list(db: DbSession, items: list) -> list[QuotationListResponse]:
    if not items:
        return []
    creator_ids = {q.created_by for q in items}
    creators = list(db.scalars(select(User).where(User.id.in_(creator_ids))).all())
    names_by_id = {u.id: u.full_name for u in creators}
    out: list[QuotationListResponse] = []
    for item in items:
        payload = QuotationListResponse.model_validate(item).model_dump()
        payload["created_by_name"] = names_by_id.get(item.created_by) or ""
        custom = item.custom_data or {}
        lineage = custom.get("_report_lineage") or {}
        payload["report_display_number"] = lineage.get("display_number") or item.quotation_number
        payload["report_revision"] = int(lineage.get("revision") or 1)
        superseded = custom.get("_superseded_by")
        payload["superseded_by"] = UUID(str(superseded)) if superseded else None
        out.append(QuotationListResponse.model_validate(payload))
    return out


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
        _serialize_quotation_list(db, items),
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


@router.post("/{quotation_id}/resubmit", response_model=QuotationResponse, status_code=status.HTTP_201_CREATED)
def resubmit_quotation(
    quotation_id: UUID,
    payload: QuotationCreate,
    db: DbSession,
    current_user: User = Depends(require_permission("quotations:create")),
) -> QuotationResponse:
    return QuotationResponse.model_validate(
        quotation_service.resubmit(db, current_user, quotation_id, payload)
    )


@router.get("/{quotation_id}", response_model=QuotationResponse)
def get_quotation(
    quotation_id: UUID,
    db: DbSession,
    current_user: User = Depends(require_permission("quotations:read")),
) -> QuotationResponse:
    return QuotationResponse.model_validate(quotation_service.get(db, current_user, quotation_id))


@router.put("/{quotation_id}", response_model=QuotationResponse)
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
