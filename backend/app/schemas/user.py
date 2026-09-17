from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import ORMModel


class PermissionResponse(ORMModel):
    id: UUID
    code: str
    name: str
    description: Optional[str]
    created_at: datetime


class RoleCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=50)
    description: Optional[str] = None
    permission_ids: list[UUID] = Field(default_factory=list)


class RoleUpdate(BaseModel):
    description: Optional[str] = None
    permission_ids: Optional[list[UUID]] = None


class RoleResponse(ORMModel):
    id: UUID
    name: str
    description: Optional[str]
    is_system: bool
    permissions: list[PermissionResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=2, max_length=255)
    phone: Optional[str] = None
    role_name: str = Field(..., pattern="^(ADMIN|USER)$")
    is_active: bool = True
    custom_data: dict = Field(default_factory=dict)


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=255)
    phone: Optional[str] = None
    role_name: Optional[str] = Field(None, pattern="^(ADMIN|USER)$")
    is_active: Optional[bool] = None
    custom_data: Optional[dict] = None
    password: Optional[str] = Field(None, min_length=8, max_length=128)


class UserResponse(ORMModel):
    id: UUID
    organization_id: UUID
    role_id: UUID
    role_name: str
    email: EmailStr
    full_name: str
    phone: Optional[str]
    is_active: bool
    custom_data: dict
    created_at: datetime
    updated_at: datetime
