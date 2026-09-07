from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import CustomFieldEntity, CustomFieldType
from app.schemas.common import ORMModel


class CustomFieldDefinitionCreate(BaseModel):
    entity_type: CustomFieldEntity
    field_key: str = Field(..., min_length=1, max_length=100, pattern=r"^[a-z][a-z0-9_]*$")
    field_label: str = Field(..., min_length=1, max_length=255)
    field_type: CustomFieldType
    is_required: bool = False
    is_visible: bool = True
    is_editable: bool = True
    display_order: int = 0
    default_value: Optional[str] = None
    options: Optional[dict] = None
    validation_rules: Optional[dict] = None


class CustomFieldDefinitionUpdate(BaseModel):
    field_label: Optional[str] = Field(None, min_length=1, max_length=255)
    field_type: Optional[CustomFieldType] = None
    is_required: Optional[bool] = None
    is_visible: Optional[bool] = None
    is_editable: Optional[bool] = None
    display_order: Optional[int] = None
    default_value: Optional[str] = None
    options: Optional[dict] = None
    validation_rules: Optional[dict] = None


class CustomFieldDefinitionResponse(ORMModel):
    id: UUID
    organization_id: UUID
    entity_type: CustomFieldEntity
    field_key: str
    field_label: str
    field_type: CustomFieldType
    is_required: bool
    is_visible: bool
    is_editable: bool
    display_order: int
    default_value: Optional[str]
    options: Optional[dict]
    validation_rules: Optional[dict]
    created_at: datetime
    updated_at: datetime
