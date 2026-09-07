from fastapi import APIRouter, Depends

from app.api.deps import DbSession, require_permission
from app.models import User
from app.crud import permission as permission_crud
from app.schemas.user import PermissionResponse

router = APIRouter()


@router.get("", response_model=list[PermissionResponse])
def list_permissions(
    db: DbSession,
    current_user: User = Depends(require_permission("roles:read")),
) -> list[PermissionResponse]:
    return [PermissionResponse.model_validate(item) for item in permission_crud.list_all(db)]
