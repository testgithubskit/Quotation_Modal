from uuid import UUID

from fastapi import APIRouter, Depends, status

from app.api.deps import DbSession, Pagination, require_permission
from app.models import User
from app.schemas.common import MessageResponse, PaginatedResponse
from app.schemas.customer import CustomerCreate, CustomerResponse, CustomerUpdate
from app.services.catalog import customer_service

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
