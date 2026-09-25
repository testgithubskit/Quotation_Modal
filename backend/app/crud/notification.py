from __future__ import annotations

from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.crud.base import CRUDBase
from app.models import Notification


class CRUDNotification(CRUDBase[Notification]):
    def count_unacknowledged(self, db: Session, organization_id: UUID, user_id: UUID) -> int:
        return int(
            db.scalar(
                select(func.count())
                .select_from(Notification)
                .where(
                    Notification.organization_id == organization_id,
                    Notification.user_id == user_id,
                    Notification.acknowledged_at.is_(None),
                )
            )
            or 0
        )


notification = CRUDNotification(Notification)
