from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, UnauthorizedError
from app.core.security import (
    TOKEN_TYPE_ACCESS,
    TOKEN_TYPE_REFRESH,
    TOKEN_TYPE_RESET,
    create_access_token,
    create_password_reset_token,
    create_refresh_token,
    decode_token_safe,
    hash_password,
    verify_password,
)
from app.core.seed import seed_roles_and_permissions
from app.crud import organization as organization_crud
from app.crud import role as role_crud
from app.crud import user as user_crud
from app.models import User
from app.models.enums import AuditAction, UserRoleName
from app.schemas.auth import LoginRequest, ResetPasswordRequest, SignupRequest, TokenResponse
from app.services.audit_log import audit_log_service


class AuthService:
    def signup(self, db: Session, payload: SignupRequest) -> TokenResponse:
        seed_roles_and_permissions(db)
        if organization_crud.get_by_code(db, payload.organization_code.upper()):
            raise ConflictError("Organization code already exists")
        if user_crud.get_by_email(db, payload.email):
            raise ConflictError("Email already registered")
        admin_role = role_crud.get_by_name(db, UserRoleName.ADMIN.value)
        if admin_role is None:
            raise ConflictError("System roles are not initialized")

        organization = organization_crud.create(
            db,
            {
                "name": payload.organization_name,
                "code": payload.organization_code.upper(),
                "email": payload.email,
                "phone": payload.phone,
                "custom_data": {},
            },
        )
        user = user_crud.create(
            db,
            {
                "organization_id": organization.id,
                "role_id": admin_role.id,
                "email": payload.email.lower(),
                "hashed_password": hash_password(payload.password),
                "full_name": payload.full_name,
                "phone": payload.phone,
                "is_active": True,
                "token_version": 0,
                "custom_data": {},
            },
        )
        audit_log_service.record(
            db,
            organization_id=organization.id,
            user_id=user.id,
            action=AuditAction.CREATE,
            entity_type="Organization",
            entity_id=organization.id,
            new_data={"name": organization.name, "code": organization.code},
        )
        db.commit()
        db.refresh(user)
        return self._issue_tokens(user)

    def login(self, db: Session, payload: LoginRequest) -> TokenResponse:
        user = user_crud.get_by_email(db, payload.email.lower())
        if user is None or not verify_password(payload.password, user.hashed_password):
            raise UnauthorizedError("Invalid email or password")
        if not user.is_active:
            raise UnauthorizedError("User account is inactive")
        audit_log_service.record(
            db,
            organization_id=user.organization_id,
            user_id=user.id,
            action=AuditAction.LOGIN,
            entity_type="User",
            entity_id=user.id,
        )
        db.commit()
        return self._issue_tokens(user)

    def refresh(self, db: Session, refresh_token: str) -> TokenResponse:
        user = self._user_from_token(db, refresh_token, TOKEN_TYPE_REFRESH)
        return self._issue_tokens(user)

    def logout(self, db: Session, user: User) -> None:
        user.token_version += 1
        db.add(user)
        audit_log_service.record(
            db,
            organization_id=user.organization_id,
            user_id=user.id,
            action=AuditAction.LOGOUT,
            entity_type="User",
            entity_id=user.id,
        )
        db.commit()

    def forgot_password(self, db: Session, email: str) -> str | None:
        user = user_crud.get_by_email(db, email.lower())
        if user is None or not user.is_active:
            return None
        token = create_password_reset_token(user.id, user.token_version)
        audit_log_service.record(
            db,
            organization_id=user.organization_id,
            user_id=user.id,
            action=AuditAction.PASSWORD_RESET,
            entity_type="User",
            entity_id=user.id,
            new_data={"requested": True},
        )
        db.commit()
        return token

    def reset_password(self, db: Session, payload: ResetPasswordRequest) -> None:
        user = self._user_from_token(db, payload.token, TOKEN_TYPE_RESET)
        user.hashed_password = hash_password(payload.new_password)
        user.token_version += 1
        db.add(user)
        audit_log_service.record(
            db,
            organization_id=user.organization_id,
            user_id=user.id,
            action=AuditAction.PASSWORD_RESET,
            entity_type="User",
            entity_id=user.id,
            new_data={"completed": True},
        )
        db.commit()

    def current_user_payload(self, user: User) -> dict:
        return {
            "id": user.id,
            "organization_id": user.organization_id,
            "role_id": user.role_id,
            "role_name": user.role.name if user.role else "",
            "email": user.email,
            "full_name": user.full_name,
            "phone": user.phone,
            "is_active": user.is_active,
            "permissions": user_crud.list_permissions(user),
            "created_at": user.created_at,
        }

    def _issue_tokens(self, user: User) -> TokenResponse:
        role_name = user.role.name if user.role else ""
        return TokenResponse(
            access_token=create_access_token(
                user.id, user.organization_id, user.token_version, role_name
            ),
            refresh_token=create_refresh_token(user.id, user.organization_id, user.token_version),
        )

    def _user_from_token(self, db: Session, token: str, expected_type: str) -> User:
        payload = decode_token_safe(token)
        if payload is None or payload.get("type") != expected_type:
            raise UnauthorizedError("Invalid or expired token")
        try:
            user_id = UUID(str(payload.get("sub")))
        except (TypeError, ValueError) as exc:
            raise UnauthorizedError("Invalid token") from exc
        user = user_crud.get_with_role(db, user_id)
        if user is None or not user.is_active:
            raise UnauthorizedError("Invalid token")
        if int(payload.get("ver", -1)) != user.token_version:
            raise UnauthorizedError("Token has been revoked")
        return user

    def user_from_access_token(self, db: Session, token: str) -> User:
        return self._user_from_token(db, token, TOKEN_TYPE_ACCESS)


auth_service = AuthService()
