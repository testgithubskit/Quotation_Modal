from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field

from app.schemas.common import ORMModel


class CustomerCreate(BaseModel):
    customer_code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    tax_number: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = True
    custom_data: dict = Field(default_factory=dict)


class CustomerUpdate(BaseModel):
    customer_code: Optional[str] = Field(None, min_length=1, max_length=50)
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    website: Optional[str] = None
    tax_number: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None
    custom_data: Optional[dict] = None


class CustomerResponse(ORMModel):
    id: UUID
    organization_id: UUID
    customer_code: str
    name: str
    email: Optional[str]
    phone: Optional[str]
    website: Optional[str]
    tax_number: Optional[str]
    address: Optional[str]
    notes: Optional[str]
    is_active: bool
    custom_data: dict
    created_at: datetime
    updated_at: datetime
