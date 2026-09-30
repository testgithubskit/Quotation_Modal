"""add quotations.reviewed_by column

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-09-30 10:20:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "d4e5f6a7b8c9"
down_revision: Union[str, Sequence[str], None] = "c3d4e5f6a7b8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "quotations",
        sa.Column("reviewed_by", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_quotations_reviewed_by_users",
        "quotations",
        "users",
        ["reviewed_by"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index("ix_quotations_reviewed_by", "quotations", ["reviewed_by"])


def downgrade() -> None:
    op.drop_index("ix_quotations_reviewed_by", table_name="quotations")
    op.drop_constraint("fk_quotations_reviewed_by_users", "quotations", type_="foreignkey")
    op.drop_column("quotations", "reviewed_by")
