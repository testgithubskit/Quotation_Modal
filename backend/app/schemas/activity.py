from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.schemas.common import ORMModel


class ActivityCreate(BaseModel):
    code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    unit: str = Field("unit", max_length=50)
    unit_price: Decimal = Field(..., ge=0)
    currency: str = Field("INR", min_length=3, max_length=3)
    is_active: bool = True
    custom_data: dict = Field(default_factory=dict)


class ActivityUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=50)
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    unit: Optional[str] = Field(None, max_length=50)
    unit_price: Optional[Decimal] = Field(None, ge=0)
    currency: Optional[str] = Field(None, min_length=3, max_length=3)
    is_active: Optional[bool] = None
    custom_data: Optional[dict] = None


class ActivityResponse(ORMModel):
    id: UUID
    organization_id: UUID
    code: str
    name: str
    description: Optional[str]
    unit: str
    unit_price: Decimal
    currency: str
    is_active: bool
    custom_data: dict
    created_at: datetime
    updated_at: datetime
