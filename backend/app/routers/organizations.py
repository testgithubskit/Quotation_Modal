from fastapi import APIRouter, Depends

from app.api.deps import DbSession, require_permission
from app.models import User
from app.schemas.organization import OrganizationResponse, OrganizationUpdate
from app.services.identity import organization_service

router = APIRouter()


@router.get("/me", response_model=OrganizationResponse)
def get_my_organization(
    db: DbSession,
    current_user: User = Depends(require_permission("organizations:read")),
) -> OrganizationResponse:
    return OrganizationResponse.model_validate(organization_service.get(db, current_user.organization_id))


@router.put("/me", response_model=OrganizationResponse)
def update_my_organization(
    payload: OrganizationUpdate,
    db: DbSession,
    current_user: User = Depends(require_permission("organizations:update")),
) -> OrganizationResponse:
    return OrganizationResponse.model_validate(organization_service.update(db, current_user, payload))
