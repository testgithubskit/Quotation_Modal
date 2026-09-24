from datetime import datetime
from typing import Optional
from uuid import UUID

from app.schemas.common import ORMModel


class AuditLogResponse(ORMModel):
    id: UUID
    organization_id: UUID
    user_id: Optional[UUID]
    action: str
    entity_type: str
    entity_id: Optional[str]
    old_data: Optional[dict]
    new_data: Optional[dict]
    actor_name: Optional[str] = None
    actor_email: Optional[str] = None
    created_at: datetime
