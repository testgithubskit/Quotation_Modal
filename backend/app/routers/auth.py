from fastapi import APIRouter, status

from app.api.deps import CurrentUser, DbSession
from app.core.config import get_settings
from app.schemas.auth import (
    CurrentUserResponse,
    ForgotPasswordRequest,
    LoginRequest,
    RefreshTokenRequest,
    ResetPasswordRequest,
    SignupRequest,
    TokenResponse,
)
from app.schemas.common import MessageResponse
from app.services.auth import auth_service

router = APIRouter()
settings = get_settings()


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(payload: SignupRequest, db: DbSession) -> TokenResponse:
    return auth_service.signup(db, payload)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: DbSession) -> TokenResponse:
    return auth_service.login(db, payload)


@router.post("/refresh", response_model=TokenResponse)
def refresh(payload: RefreshTokenRequest, db: DbSession) -> TokenResponse:
    return auth_service.refresh(db, payload.refresh_token)


@router.post("/logout", response_model=MessageResponse)
def logout(db: DbSession, current_user: CurrentUser) -> MessageResponse:
    auth_service.logout(db, current_user)
    return MessageResponse(message="Logged out successfully")


@router.get("/me", response_model=CurrentUserResponse)
def me(current_user: CurrentUser) -> CurrentUserResponse:
    return CurrentUserResponse.model_validate(auth_service.current_user_payload(current_user))


@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(payload: ForgotPasswordRequest, db: DbSession) -> MessageResponse:
    token = auth_service.forgot_password(db, payload.email)
    message = "If the account exists, a password reset token has been issued"
    if token and settings.debug:
        return MessageResponse(message=f"{message}. Reset token: {token}")
    return MessageResponse(message=message)


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(payload: ResetPasswordRequest, db: DbSession) -> MessageResponse:
    auth_service.reset_password(db, payload)
    return MessageResponse(message="Password has been reset")
