from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field

from app.models.enums import NotificationKind, QuotationStatus
from app.schemas.common import ORMModel


class NotificationResponse(ORMModel):
    id: UUID
    organization_id: UUID
    user_id: UUID
    quotation_id: UUID
    kind: NotificationKind
    message: Optional[str] = None
    acknowledged_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    quotation_number: Optional[str] = None
    customer_name: Optional[str] = None
    submitted_by_name: Optional[str] = None
    submitted_at: Optional[datetime] = None
    quotation_status: Optional[QuotationStatus] = None
    review_remark: Optional[str] = None
    reviewed_at: Optional[datetime] = None


class NotificationAcknowledgeRequest(BaseModel):
    ids: list[UUID] = Field(default_factory=list)
