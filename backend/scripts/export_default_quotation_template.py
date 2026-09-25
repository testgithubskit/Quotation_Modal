#!/usr/bin/env python3
"""
Export a quotation template from the database into the org-wide blueprint file.
Each new organization receives a deep copy of that file on signup.

Run from the backend directory:
  python scripts/export_default_quotation_template.py --template-id <uuid>
  python scripts/export_default_quotation_template.py --org-code ACME --template-name "Default quotation"
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from uuid import UUID

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import select  # noqa: E402

from app.core.database import SessionLocal  # noqa: E402
from app.models import Organization, QuotationTemplate  # noqa: E402
from app.services.default_quotation_template import (  # noqa: E402
    blueprint_from_template,
    blueprint_path,
    save_blueprint,
)


def resolve_template(
    db,
    *,
    template_id: UUID | None,
    org_code: str | None,
    template_name: str | None,
) -> QuotationTemplate:
    if template_id is not None:
        row = db.get(QuotationTemplate, template_id)
        if row is None:
            raise SystemExit(f"Template not found: {template_id}")
        return row

    if not org_code or not template_name:
        raise SystemExit("Provide --template-id or both --org-code and --template-name")

    org = db.scalar(select(Organization).where(Organization.code == org_code.upper()))
    if org is None:
        raise SystemExit(f"Organization not found for code: {org_code}")

    row = db.scalar(
        select(QuotationTemplate).where(
            QuotationTemplate.organization_id == org.id,
            QuotationTemplate.name == template_name,
        )
    )
    if row is None:
        raise SystemExit(f"Template {template_name!r} not found for org {org_code}")
    return row


def main() -> None:
    parser = argparse.ArgumentParser(description="Export DB template to default_quotation_template.json")
    parser.add_argument("--template-id", type=UUID, default=None)
    parser.add_argument("--org-code", type=str, default=None)
    parser.add_argument("--template-name", type=str, default=None)
    args = parser.parse_args()

    db = SessionLocal()
    try:
        template = resolve_template(
            db,
            template_id=args.template_id,
            org_code=args.org_code,
            template_name=args.template_name,
        )
        blueprint = blueprint_from_template(template)
        save_blueprint(blueprint)
        print(f"Wrote blueprint to {blueprint_path()} from template {template.id} ({template.name})")
    finally:
        db.close()


if __name__ == "__main__":
    main()
