"""add notifications table

Revision ID: b2c3d4e5f6a7
Revises: f7e8d9c0b1a2
Create Date: 2026-09-25 14:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b2c3d4e5f6a7"
down_revision: Union[str, Sequence[str], None] = "f7e8d9c0b1a2"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

notification_kind = postgresql.ENUM(
    "REPORT_SUBMITTED",
    "REPORT_ACCEPTED",
    "REPORT_REJECTED",
    name="notification_kind",
    create_type=False,
)


def upgrade() -> None:
    notification_kind.create(op.get_bind(), checkfirst=True)
    op.create_table(
        "notifications",
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("organization_id", sa.UUID(), nullable=False),
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("quotation_id", sa.UUID(), nullable=False),
        sa.Column("kind", notification_kind, nullable=False),
        sa.Column("message", sa.Text(), nullable=True),
        sa.Column("acknowledged_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["organization_id"], ["organizations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["quotation_id"], ["quotations.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_notifications_organization_id", "notifications", ["organization_id"])
    op.create_index("ix_notifications_user_id", "notifications", ["user_id"])
    op.create_index("ix_notifications_quotation_id", "notifications", ["quotation_id"])
    op.create_index("ix_notifications_acknowledged_at", "notifications", ["acknowledged_at"])


def downgrade() -> None:
    op.drop_index("ix_notifications_acknowledged_at", table_name="notifications")
    op.drop_index("ix_notifications_quotation_id", table_name="notifications")
    op.drop_index("ix_notifications_user_id", table_name="notifications")
    op.drop_index("ix_notifications_organization_id", table_name="notifications")
    op.drop_table("notifications")
    notification_kind.drop(op.get_bind(), checkfirst=True)
