from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import QuotationStatus
from app.schemas.common import ORMModel


class QuotationItemCreate(BaseModel):
    activity_id: Optional[UUID] = None
    description: Optional[str] = None
    quantity: Decimal = Field(..., gt=0)
    unit: Optional[str] = None
    unit_price: Optional[Decimal] = Field(None, ge=0)
    discount: Decimal = Field(Decimal("0.00"), ge=0)
    tax: Decimal = Field(Decimal("0.00"), ge=0)
    custom_data: dict = Field(default_factory=dict)


class QuotationItemUpdate(BaseModel):
    activity_id: Optional[UUID] = None
    description: Optional[str] = None
    quantity: Optional[Decimal] = Field(None, gt=0)
    unit: Optional[str] = None
    unit_price: Optional[Decimal] = Field(None, ge=0)
    discount: Optional[Decimal] = Field(None, ge=0)
    tax: Optional[Decimal] = Field(None, ge=0)
    custom_data: Optional[dict] = None


class QuotationItemResponse(ORMModel):
    id: UUID
    quotation_id: UUID
    activity_id: Optional[UUID]
    line_number: int
    description: str
    quantity: Decimal
    unit: str
    unit_price: Decimal
    discount: Decimal
    tax: Decimal
    total: Decimal
    custom_data: dict
    created_at: datetime
    updated_at: datetime


class QuotationCreate(BaseModel):
    customer_id: UUID
    quotation_template_id: Optional[UUID] = None
    quotation_number: Optional[str] = Field(None, max_length=50)
    quotation_date: Optional[datetime] = None
    validity_date: Optional[datetime] = None
    discount: Decimal = Field(Decimal("0.00"), ge=0)
    currency: str = Field("INR", min_length=3, max_length=3)
    notes: Optional[str] = None
    custom_data: dict = Field(default_factory=dict)
    items: list[QuotationItemCreate] = Field(default_factory=list)


class QuotationUpdate(BaseModel):
    customer_id: Optional[UUID] = None
    quotation_template_id: Optional[UUID] = None
    quotation_date: Optional[datetime] = None
    validity_date: Optional[datetime] = None
    discount: Optional[Decimal] = Field(None, ge=0)
    currency: Optional[str] = Field(None, min_length=3, max_length=3)
    notes: Optional[str] = None
    custom_data: Optional[dict] = None
    items: Optional[list[QuotationItemCreate]] = None


class QuotationStatusUpdate(BaseModel):
    status: QuotationStatus


class QuotationResponse(ORMModel):
    id: UUID
    organization_id: UUID
    customer_id: UUID
    quotation_template_id: Optional[UUID]
    created_by: UUID
    quotation_number: str
    quotation_date: datetime
    validity_date: Optional[datetime]
    status: QuotationStatus
    subtotal: Decimal
    discount: Decimal
    tax: Decimal
    total: Decimal
    currency: str
    notes: Optional[str]
    custom_data: dict
    items: list[QuotationItemResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class QuotationListResponse(ORMModel):
    id: UUID
    organization_id: UUID
    customer_id: UUID
    quotation_number: str
    quotation_date: datetime
    validity_date: Optional[datetime]
    status: QuotationStatus
    subtotal: Decimal
    discount: Decimal
    tax: Decimal
    total: Decimal
    currency: str
    created_by: UUID
    created_at: datetime


class QuotationVersionResponse(ORMModel):
    id: UUID
    quotation_id: UUID
    version_number: int
    snapshot_data: dict
    change_summary: Optional[str]
    created_at: datetime
    updated_at: datetime


class QuotationTemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    is_default: bool = False
    is_standard: bool = False
    template_data: dict = Field(default_factory=dict)
    custom_data: dict = Field(default_factory=dict)


class QuotationTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    is_default: Optional[bool] = None
    is_standard: Optional[bool] = None
    template_data: Optional[dict] = None
    custom_data: Optional[dict] = None


class QuotationTemplateResponse(ORMModel):
    id: UUID
    organization_id: UUID
    name: str
    description: Optional[str]
    is_default: bool
    is_standard: bool
    template_data: dict
    custom_data: dict
    created_at: datetime
    updated_at: datetime
