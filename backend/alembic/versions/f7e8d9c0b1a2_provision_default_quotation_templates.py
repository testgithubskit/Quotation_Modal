"""provision default quotation template for orgs without one

Revision ID: f7e8d9c0b1a2
Revises: a1b2c3d4e5f6
Create Date: 2026-09-25 12:00:00.000000
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
from sqlalchemy.orm import Session

revision: str = "f7e8d9c0b1a2"
down_revision: Union[str, Sequence[str], None] = "a1b2c3d4e5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    from sqlalchemy import select

    from app.models import Organization
    from app.services.default_quotation_template import provision_default_template_for_organization

    bind = op.get_bind()
    session = Session(bind=bind)
    try:
        org_ids = session.scalars(select(Organization.id)).all()
        for org_id in org_ids:
            provision_default_template_for_organization(session, org_id)
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def downgrade() -> None:
    pass
