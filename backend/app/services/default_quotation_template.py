"""Clone the shared blueprint quotation template into a new organization (independent copy)."""

from __future__ import annotations

import json
from copy import deepcopy
from pathlib import Path
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.crud import quotation_template as quotation_template_crud
from app.models import QuotationTemplate

_BLUEPRINT_PATH = Path(__file__).resolve().parent.parent / "data" / "default_quotation_template.json"


def blueprint_path() -> Path:
    return _BLUEPRINT_PATH


def load_blueprint() -> dict:
    if not _BLUEPRINT_PATH.is_file():
        raise FileNotFoundError(f"Default template blueprint not found: {_BLUEPRINT_PATH}")
    with _BLUEPRINT_PATH.open(encoding="utf-8") as handle:
        data = json.load(handle)
    if not isinstance(data, dict) or not isinstance(data.get("template_data"), dict):
        raise ValueError("Invalid default_quotation_template.json structure")
    return data


def save_blueprint(blueprint: dict) -> None:
    """Persist blueprint JSON (used by export script / admin tooling)."""
    if not isinstance(blueprint, dict) or not isinstance(blueprint.get("template_data"), dict):
        raise ValueError("Blueprint must include template_data object")
    _BLUEPRINT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _BLUEPRINT_PATH.open("w", encoding="utf-8") as handle:
        json.dump(blueprint, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def organization_template_count(db: Session, organization_id: UUID) -> int:
    return int(
        db.scalar(
            select(func.count())
            .select_from(QuotationTemplate)
            .where(QuotationTemplate.organization_id == organization_id)
        )
        or 0
    )


def provision_default_template_for_organization(db: Session, organization_id: UUID) -> QuotationTemplate | None:
    """
    Insert one default template for the org by deep-copying the file blueprint.
    Skips if the org already has any template (idempotent for retries).
    """
    if organization_template_count(db, organization_id) > 0:
        return quotation_template_crud.get_default(db, organization_id)

    blueprint = load_blueprint()
    template_data = deepcopy(blueprint.get("template_data") or {})
    custom_data = deepcopy(blueprint.get("custom_data") or {})

    name = str(blueprint.get("name") or "Default quotation").strip() or "Default quotation"
    description = blueprint.get("description")

    created = quotation_template_crud.create(
        db,
        {
            "organization_id": organization_id,
            "name": name[:255],
            "description": description,
            "is_default": True,
            "is_standard": False,
            "template_data": template_data,
            "custom_data": custom_data,
        },
    )
    db.flush()
    return created


def blueprint_from_template(template: QuotationTemplate) -> dict:
    """Build a blueprint dict from an existing DB template (for export)."""
    return {
        "name": template.name,
        "description": template.description,
        "template_data": deepcopy(template.template_data or {}),
        "custom_data": deepcopy(template.custom_data or {}),
    }
