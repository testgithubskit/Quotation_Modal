from datetime import datetime, timedelta, timezone
from typing import Any, Optional
from uuid import UUID

from jose import JWTError, jwt
from pwdlib import PasswordHash

from app.core.config import get_settings

password_hash = PasswordHash.recommended()
settings = get_settings()

TOKEN_TYPE_ACCESS = "access"
TOKEN_TYPE_REFRESH = "refresh"
TOKEN_TYPE_RESET = "password_reset"


def hash_password(password: str) -> str:
    return password_hash.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return password_hash.verify(plain_password, hashed_password)


def _create_token(
    *,
    subject: str,
    token_type: str,
    expires_delta: timedelta,
    extra: Optional[dict[str, Any]] = None,
) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "iat": int(now.timestamp()),
        "exp": int((now + expires_delta).timestamp()),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_access_token(
    user_id: UUID,
    organization_id: UUID,
    token_version: int,
    role_name: str,
) -> str:
    return _create_token(
        subject=str(user_id),
        token_type=TOKEN_TYPE_ACCESS,
        expires_delta=timedelta(minutes=settings.access_token_expire_minutes),
        extra={
            "org_id": str(organization_id),
            "role": role_name,
            "ver": token_version,
        },
    )


def create_refresh_token(
    user_id: UUID,
    organization_id: UUID,
    token_version: int,
) -> str:
    return _create_token(
        subject=str(user_id),
        token_type=TOKEN_TYPE_REFRESH,
        expires_delta=timedelta(days=settings.refresh_token_expire_days),
        extra={
            "org_id": str(organization_id),
            "ver": token_version,
        },
    )


def create_password_reset_token(user_id: UUID, token_version: int) -> str:
    return _create_token(
        subject=str(user_id),
        token_type=TOKEN_TYPE_RESET,
        expires_delta=timedelta(minutes=settings.password_reset_expire_minutes),
        extra={"ver": token_version},
    )


def decode_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])


def decode_token_safe(token: str) -> Optional[dict[str, Any]]:
    try:
        return decode_token(token)
    except JWTError:
        return None
