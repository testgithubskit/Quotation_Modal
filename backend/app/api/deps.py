from collections.abc import Callable
from typing import Annotated

from fastapi import Depends, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.crud import user as user_crud
from app.models import User
from app.services.auth import auth_service

bearer_scheme = HTTPBearer(auto_error=False)


def get_pagination(
    search: str | None = Query(None),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc", pattern="^(asc|desc)$"),
) -> dict:
    """List filters only — pagination is handled by the client. Returns all matching rows."""
    return {
        "page": 1,
        "page_size": None,
        "search": search,
        "sort_by": sort_by,
        "sort_order": sort_order,
    }


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise UnauthorizedError("Not authenticated")
    return auth_service.user_from_access_token(db, credentials.credentials)


def get_current_active_user(current_user: Annotated[User, Depends(get_current_user)]) -> User:
    if not current_user.is_active:
        raise UnauthorizedError("User account is inactive")
    return current_user


def require_role(*roles: str) -> Callable:
    def dependency(current_user: Annotated[User, Depends(get_current_active_user)]) -> User:
        role_name = current_user.role.name if current_user.role else ""
        if role_name not in roles:
            raise ForbiddenError("Insufficient role")
        return current_user

    return dependency


def require_permission(*codes: str) -> Callable:
    def dependency(current_user: Annotated[User, Depends(get_current_active_user)]) -> User:
        permissions = set(user_crud.list_permissions(current_user))
        if not any(code in permissions for code in codes):
            raise ForbiddenError("Insufficient permissions")
        return current_user

    return dependency


CurrentUser = Annotated[User, Depends(get_current_active_user)]
DbSession = Annotated[Session, Depends(get_db)]
Pagination = Annotated[dict, Depends(get_pagination)]
