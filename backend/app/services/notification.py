from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.crud import notification as notification_crud, user as user_crud
from app.models import Customer, Notification, Quotation, User
from app.models.enums import NotificationKind, UserRoleName


class NotificationService:
    def list_for_user(
        self,
        db: Session,
        current_user: User,
        *,
        page: int = 1,
        page_size: int | None = 50,
        unacknowledged_only: bool = False,
    ) -> tuple[list[dict], int]:
        stmt = (
            select(Notification)
            .where(
                Notification.organization_id == current_user.organization_id,
                Notification.user_id == current_user.id,
            )
            .options(
                selectinload(Notification.quotation).selectinload(Quotation.created_by_user),
            )
            .order_by(Notification.created_at.desc())
        )
        if unacknowledged_only:
            stmt = stmt.where(Notification.acknowledged_at.is_(None))

        count_stmt = select(Notification.id).where(
            Notification.organization_id == current_user.organization_id,
            Notification.user_id == current_user.id,
        )
        if unacknowledged_only:
            count_stmt = count_stmt.where(Notification.acknowledged_at.is_(None))
        total = len(list(db.scalars(count_stmt).all()))

        if page_size is not None:
            stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        rows = list(db.scalars(stmt).all())

        customer_ids = {n.quotation.customer_id for n in rows if n.quotation}
        customers = {}
        if customer_ids:
            for c in db.scalars(select(Customer).where(Customer.id.in_(customer_ids))).all():
                customers[c.id] = c

        out: list[dict] = []
        for n in rows:
            q = n.quotation
            cust = customers.get(q.customer_id) if q else None
            submitter = q.created_by_user if q else None
            display_number = q.quotation_number if q else None
            if q:
                lineage = (q.custom_data or {}).get("_report_lineage") or {}
                display_number = lineage.get("display_number") or q.quotation_number
            out.append(
                {
                    "id": n.id,
                    "organization_id": n.organization_id,
                    "user_id": n.user_id,
                    "quotation_id": n.quotation_id,
                    "kind": n.kind,
                    "message": n.message,
                    "acknowledged_at": n.acknowledged_at,
                    "created_at": n.created_at,
                    "updated_at": n.updated_at,
                    "quotation_number": display_number,
                    "customer_name": cust.name if cust else None,
                    "submitted_by_name": submitter.full_name if submitter else None,
                    "submitted_at": q.created_at if q else None,
                    "quotation_status": q.status if q else None,
                    "review_remark": q.review_remark if q else None,
                    "reviewed_at": q.reviewed_at if q else None,
                }
            )
        return out, total

    def unacknowledged_count(self, db: Session, current_user: User) -> int:
        return notification_crud.count_unacknowledged(
            db, current_user.organization_id, current_user.id
        )

    def acknowledge(
        self,
        db: Session,
        current_user: User,
        notification_ids: list[UUID],
    ) -> int:
        if not notification_ids:
            return 0
        now = datetime.now(timezone.utc)
        updated = 0
        for nid in notification_ids:
            row = db.scalar(
                select(Notification).where(
                    Notification.id == nid,
                    Notification.organization_id == current_user.organization_id,
                    Notification.user_id == current_user.id,
                )
            )
            if row is None:
                continue
            if row.acknowledged_at is None:
                row.acknowledged_at = now
                db.add(row)
                updated += 1
        db.commit()
        return updated

    def notify_admins_report_submitted(
        self,
        db: Session,
        *,
        organization_id: UUID,
        quotation: Quotation,
        submitter: User,
    ) -> None:
        admins = user_crud.list_admins_by_org(db, organization_id)
        for admin in admins:
            if admin.id == submitter.id:
                continue
            notification_crud.create(
                db,
                {
                    "organization_id": organization_id,
                    "user_id": admin.id,
                    "quotation_id": quotation.id,
                    "kind": NotificationKind.REPORT_SUBMITTED,
                    "message": f"Report {quotation.quotation_number} submitted by {submitter.full_name}",
                },
            )

    def notify_submitter_review(
        self,
        db: Session,
        *,
        organization_id: UUID,
        quotation: Quotation,
        kind: NotificationKind,
        message: str | None,
    ) -> None:
        notification_crud.create(
            db,
            {
                "organization_id": organization_id,
                "user_id": quotation.created_by,
                "quotation_id": quotation.id,
                "kind": kind,
                "message": message,
            },
        )


notification_service = NotificationService()
