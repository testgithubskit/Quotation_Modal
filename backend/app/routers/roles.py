from uuid import UUID

from fastapi import APIRouter, Depends

from app.api.deps import DbSession, require_permission
from app.models import User
from app.schemas.user import PermissionResponse, RoleResponse, RoleUpdate
from app.services.identity import role_service

router = APIRouter()


def _role_response(role) -> RoleResponse:
    permissions = [
        PermissionResponse.model_validate(rp.permission)
        for rp in role.role_permissions
        if rp.permission
    ]
    return RoleResponse(
        id=role.id,
        name=role.name,
        description=role.description,
        is_system=role.is_system,
        permissions=permissions,
        created_at=role.created_at,
        updated_at=role.updated_at,
    )


@router.get("", response_model=list[RoleResponse])
def list_roles(
    db: DbSession,
    current_user: User = Depends(require_permission("roles:read")),
) -> list[RoleResponse]:
    return [_role_response(role) for role in role_service.list_roles(db)]


@router.get("/{role_id}", response_model=RoleResponse)
def get_role(
    role_id: UUID,
    db: DbSession,
    current_user: User = Depends(require_permission("roles:read")),
) -> RoleResponse:
    return _role_response(role_service.get(db, role_id))


@router.put("/{role_id}", response_model=RoleResponse)
def update_role(
    role_id: UUID,
    payload: RoleUpdate,
    db: DbSession,
    current_user: User = Depends(require_permission("roles:update")),
) -> RoleResponse:
    return _role_response(role_service.update(db, current_user, role_id, payload))
