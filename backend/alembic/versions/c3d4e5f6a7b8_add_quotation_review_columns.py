"""add quotation review_remark and reviewed_at columns

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-09-25 15:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "c3d4e5f6a7b8"
down_revision: Union[str, Sequence[str], None] = "b2c3d4e5f6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("quotations", sa.Column("review_remark", sa.Text(), nullable=True))
    op.add_column(
        "quotations",
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
    )

    op.execute(
        """
        UPDATE quotations
        SET
            review_remark = NULLIF(custom_data #>> '{_last_review,remark}', ''),
            reviewed_at = CASE
                WHEN custom_data #>> '{_last_review,reviewed_at}' IS NOT NULL
                     AND custom_data #>> '{_last_review,reviewed_at}' <> ''
                THEN (custom_data #>> '{_last_review,reviewed_at}')::timestamptz
                ELSE NULL
            END
        WHERE custom_data ? '_last_review'
        """
    )

    op.execute(
        """
        UPDATE quotations
        SET custom_data = custom_data - '_last_review'
        WHERE custom_data ? '_last_review'
        """
    )


def downgrade() -> None:
    op.drop_column("quotations", "reviewed_at")
    op.drop_column("quotations", "review_remark")
