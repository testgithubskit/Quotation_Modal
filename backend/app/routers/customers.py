from uuid import UUID

from fastapi import APIRouter, Depends, File, UploadFile, status

from app.api.deps import DbSession, Pagination, require_permission
from app.core.exceptions import AppError
from app.models import User
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.customer import CustomerCreate, CustomerResponse, CustomerUpdate
from app.schemas.spreadsheet_import import (
    SpreadsheetConfirmRequest,
    SpreadsheetImportResponse,
    SpreadsheetPreviewResponse,
)
from app.services.catalog import customer_service
from app.services.catalog_import import catalog_import_service

router = APIRouter()


@router.get("", response_model=PaginatedResponse[CustomerResponse])
def list_customers(
    db: DbSession,
    pagination: Pagination,
    current_user: User = Depends(require_permission("customers:read")),
) -> PaginatedResponse[CustomerResponse]:
    items, total = customer_service.list(db, current_user, **pagination)
    return PaginatedResponse.build(
        [CustomerResponse.model_validate(item) for item in items],
        total,
        pagination["page"],
        pagination["page_size"],
    )


@router.post("/import/preview", response_model=SpreadsheetPreviewResponse)
async def preview_customers_import(
    db: DbSession,
    current_user: User = Depends(require_permission("customers:create")),
    file: UploadFile = File(...),
) -> SpreadsheetPreviewResponse:
    filename = file.filename or "upload.xlsx"
    data = await file.read()
    if not data:
        raise AppError("Empty file", status_code=400, code="empty_file")
    preview = catalog_import_service.preview_customers(db, current_user, data, filename)
    if not preview["rows"]:
        raise AppError(
            "No valid customer rows found (need Customer Name). Only columns already defined in the app are extracted.",
            status_code=400,
            code="empty_preview",
        )
    return SpreadsheetPreviewResponse(**preview)


@router.post("/import/confirm", response_model=SpreadsheetImportResponse)
def confirm_customers_import(
    payload: SpreadsheetConfirmRequest,
    db: DbSession,
    current_user: User = Depends(require_permission("customers:create")),
) -> SpreadsheetImportResponse:
    if not payload.rows:
        raise AppError("No rows to import", status_code=400, code="empty_import")
    result = catalog_import_service.confirm_customers(db, current_user, payload.rows)
    return SpreadsheetImportResponse.from_result(result, "Customers")


@router.delete("/all", response_model=MessageResponse)
def delete_all_customers(
    db: DbSession,
    current_user: User = Depends(require_permission("customers:delete")),
) -> MessageResponse:
    count = customer_service.delete_all(db, current_user)
    return MessageResponse(message=f"Deleted {count} customer{'s' if count != 1 else ''}")


@router.post("", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(
    payload: CustomerCreate,
    db: DbSession,
    current_user: User = Depends(require_permission("customers:create")),
) -> CustomerResponse:
    return CustomerResponse.model_validate(customer_service.create(db, current_user, payload))


@router.get("/{customer_id}", response_model=CustomerResponse)
def get_customer(
    customer_id: UUID,
    db: DbSession,
    current_user: User = Depends(require_permission("customers:read")),
) -> CustomerResponse:
    return CustomerResponse.model_validate(customer_service.get(db, current_user, customer_id))


@router.put("/{customer_id}", response_model=CustomerResponse)
def update_customer(
    customer_id: UUID,
    payload: CustomerUpdate,
    db: DbSession,
    current_user: User = Depends(require_permission("customers:update")),
) -> CustomerResponse:
    return CustomerResponse.model_validate(customer_service.update(db, current_user, customer_id, payload))


@router.delete("/{customer_id}", response_model=MessageResponse)
def delete_customer(
    customer_id: UUID,
    db: DbSession,
    current_user: User = Depends(require_permission("customers:delete")),
) -> MessageResponse:
    customer_service.delete(db, current_user, customer_id)
    return MessageResponse(message="Customer deleted")
