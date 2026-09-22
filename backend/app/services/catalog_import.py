"""Bulk import activities / customers from spreadsheet uploads."""

from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation
from typing import Any
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.crud import activity as activity_crud
from app.crud import custom_field as custom_field_crud
from app.crud import customer as customer_crud
from app.models import CustomFieldDefinition, Customer, User
from app.models.enums import AuditAction, CustomFieldEntity
from app.services.audit_log import audit_log_service
from app.services.custom_field import validate_custom_data
from app.services.spreadsheet_import import (
    is_empty,
    parse_spreadsheet_bytes,
    pick,
)

ACTIVITY_CODE_ALIASES = (
    "Activity Code",
    "activity_code",
    "code",
    "Code",
)
ACTIVITY_NAME_ALIASES = (
    "Specification",
    "Specifications",
    "Activity Name",
    "name",
    "Name",
    "Item",
)
ACTIVITY_DESC_ALIASES = (
    "Particulars",
    "particulars",
    "description",
    "Description",
    "Scope of Calibration",
)
ACTIVITY_UNIT_ALIASES = ("unit", "Unit")
ACTIVITY_PRICE_ALIASES = (
    "Cost",
    "cost",
    "unit_price",
    "Unit Price",
    "Proposed Charges 2023",
    "Proposed Charges",
    "Charges April 2020",
    "Charges",
    "Rate",
    "Price",
)

CUSTOMER_NAME_ALIASES = ("name", "Name", "Customer Name")
CUSTOMER_COMPANY_ALIASES = ("company", "Company", "Company Name", "notes")
CUSTOMER_EMAIL_ALIASES = ("email", "Email")
CUSTOMER_PHONE_ALIASES = ("phone", "Phone", "Mobile", "mobile")
CUSTOMER_ADDRESS_ALIASES = ("address", "Address")


def _to_decimal(value: Any) -> Decimal:
    if value is None or value == "":
        return Decimal("0")
    if isinstance(value, Decimal):
        return value
    if isinstance(value, (int, float)):
        return Decimal(str(value))
    text = str(value).replace(",", "").replace("₹", "").strip()
    try:
        return Decimal(text)
    except (InvalidOperation, ValueError):
        return Decimal("0")


def _str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def _slug_code(value: str, prefix: str = "ITEM") -> str:
    base = re.sub(r"[^A-Za-z0-9]+", "-", (value or "").strip()).strip("-").upper()
    if not base:
        base = prefix
    return base[:50]


def _map_custom_values(row: dict[str, Any], fields: list[CustomFieldDefinition]) -> dict[str, Any]:
    """Only map registered custom fields — ignore unknown spreadsheet columns."""
    out: dict[str, Any] = {}
    lower_row = {str(k).strip().lower(): v for k, v in row.items() if k != "_sheet"}
    for field in fields:
        val = pick(row, field.field_label, field.field_key)
        if is_empty(val):
            val = lower_row.get(field.field_label.strip().lower(), "")
        if is_empty(val):
            val = lower_row.get(field.field_key.lower(), "")
        if not is_empty(val):
            out[field.field_key] = _str(val) if not isinstance(val, (int, float, bool)) else val
    return out


def _merge_fill_empty_custom(existing: dict | None, incoming: dict) -> tuple[dict, bool]:
    merged = dict(existing or {})
    changed = False
    for key, value in incoming.items():
        if is_empty(value):
            continue
        cur = merged.get(key)
        if is_empty(cur):
            merged[key] = value
            changed = True
    return merged, changed


def _field_empty(value: Any, *, numeric: bool = False) -> bool:
    if is_empty(value):
        return True
    if numeric:
        try:
            return Decimal(str(value)) == 0
        except Exception:  # noqa: BLE001
            return False
    return False


def _serialize_decimal(value: Any) -> float:
    try:
        return float(Decimal(str(value or 0)))
    except Exception:  # noqa: BLE001
        return 0.0


class SpreadsheetImportResult(dict):
    @classmethod
    def empty(cls) -> "SpreadsheetImportResult":
        return cls(created=0, updated=0, skipped=0, errors=[], fields_created=0)


class CatalogImportService:
    # ── Preview (parse + map known columns only) ─────────────────────────────

    def preview_activities(
        self,
        db: Session,
        current_user: User,
        file_bytes: bytes,
        filename: str,
    ) -> dict[str, Any]:
        raw_rows = parse_spreadsheet_bytes(file_bytes, filename)
        fields = custom_field_crud.list_for_entity(
            db, current_user.organization_id, CustomFieldEntity.ACTIVITY
        )
        preview_rows: list[dict[str, Any]] = []
        for index, row in enumerate(raw_rows):
            code = _str(pick(row, *ACTIVITY_CODE_ALIASES))
            if not code:
                continue
            lower = code.lower()
            if "sl.no" in lower or lower in {"sl no", "s.no", "sno", "code", "activity code"}:
                continue

            name = _str(pick(row, *ACTIVITY_NAME_ALIASES)) or code
            description = _str(pick(row, *ACTIVITY_DESC_ALIASES))
            unit = _str(pick(row, *ACTIVITY_UNIT_ALIASES)) or "Nos"
            unit_price = _to_decimal(pick(row, *ACTIVITY_PRICE_ALIASES))
            custom = _map_custom_values(row, fields)

            mapped: dict[str, Any] = {
                "_key": f"act-{index}",
                "code": code[:50],
                "name": name[:255],
                "description": description,
                "unit": unit[:50] if unit else "Nos",
                "unit_price": _serialize_decimal(unit_price),
            }
            mapped.update(custom)
            preview_rows.append(mapped)

        columns = [
            {"key": "code", "title": "Activity Code", "required": True, "width": 140},
            {"key": "name", "title": "Name / Specification", "required": False, "width": 160},
            {"key": "description", "title": "Description / Particulars", "required": False, "width": 200},
            {"key": "unit", "title": "Unit", "required": False, "width": 90},
            {"key": "unit_price", "title": "Cost / Unit Price", "required": False, "type": "number", "width": 120},
            *[
                {
                    "key": f.field_key,
                    "title": f.field_label,
                    "required": bool(f.is_required),
                    "width": 140,
                }
                for f in fields
            ],
        ]
        return {"columns": columns, "rows": preview_rows, "total": len(preview_rows)}

    def preview_customers(
        self,
        db: Session,
        current_user: User,
        file_bytes: bytes,
        filename: str,
    ) -> dict[str, Any]:
        raw_rows = parse_spreadsheet_bytes(file_bytes, filename)
        fields = custom_field_crud.list_for_entity(
            db, current_user.organization_id, CustomFieldEntity.CUSTOMER
        )
        preview_rows: list[dict[str, Any]] = []
        for index, row in enumerate(raw_rows):
            name = _str(pick(row, *CUSTOMER_NAME_ALIASES))
            if not name:
                continue
            custom = _map_custom_values(row, fields)
            mapped: dict[str, Any] = {
                "_key": f"cust-{index}",
                "name": name[:255],
                "company": _str(pick(row, *CUSTOMER_COMPANY_ALIASES)),
                "email": _str(pick(row, *CUSTOMER_EMAIL_ALIASES)),
                "phone": _str(pick(row, *CUSTOMER_PHONE_ALIASES)),
                "address": _str(pick(row, *CUSTOMER_ADDRESS_ALIASES)),
            }
            mapped.update(custom)
            preview_rows.append(mapped)

        columns = [
            {"key": "name", "title": "Customer Name", "required": True, "width": 160},
            {"key": "company", "title": "Company Name", "required": False, "width": 160},
            {"key": "email", "title": "Email", "required": False, "width": 160},
            {"key": "phone", "title": "Phone", "required": False, "width": 120},
            {"key": "address", "title": "Address", "required": False, "width": 180},
            *[
                {
                    "key": f.field_key,
                    "title": f.field_label,
                    "required": bool(f.is_required),
                    "width": 140,
                }
                for f in fields
            ],
        ]
        return {"columns": columns, "rows": preview_rows, "total": len(preview_rows)}

    # ── Confirm (apply selected preview rows) ────────────────────────────────

    def confirm_activities(
        self,
        db: Session,
        current_user: User,
        rows: list[dict[str, Any]],
    ) -> SpreadsheetImportResult:
        fields = custom_field_crud.list_for_entity(
            db, current_user.organization_id, CustomFieldEntity.ACTIVITY
        )
        field_keys = {f.field_key for f in fields}
        result = SpreadsheetImportResult.empty()
        org_id = current_user.organization_id

        for index, row in enumerate(rows or [], start=1):
            try:
                code = _str(row.get("code"))
                if not code:
                    continue
                name = _str(row.get("name")) or code
                description = _str(row.get("description")) or None
                unit = _str(row.get("unit")) or "Nos"
                unit_price = _to_decimal(row.get("unit_price"))
                custom_incoming = {
                    k: row[k]
                    for k in field_keys
                    if k in row and not is_empty(row.get(k))
                }

                existing = activity_crud.get_by_code(db, org_id, code[:50])
                if existing is None:
                    custom_data = validate_custom_data(
                        db, org_id, CustomFieldEntity.ACTIVITY, custom_incoming, partial=True
                    )
                    activity = activity_crud.create(
                        db,
                        {
                            "organization_id": org_id,
                            "code": code[:50],
                            "name": name[:255],
                            "description": description,
                            "unit": unit[:50],
                            "unit_price": unit_price,
                            "currency": "INR",
                            "is_active": True,
                            "custom_data": custom_data,
                        },
                    )
                    audit_log_service.record(
                        db,
                        organization_id=org_id,
                        user_id=current_user.id,
                        action=AuditAction.CREATE,
                        entity_type="Activity",
                        entity_id=activity.id,
                        new_data={"code": activity.code, "source": "spreadsheet_import"},
                    )
                    result["created"] += 1
                    continue

                patch: dict[str, Any] = {}
                if _field_empty(existing.name) and name:
                    patch["name"] = name[:255]
                if _field_empty(existing.description) and description:
                    patch["description"] = description
                if _field_empty(existing.unit) and unit:
                    patch["unit"] = unit[:50]
                if _field_empty(existing.unit_price, numeric=True) and unit_price > 0:
                    patch["unit_price"] = unit_price

                incoming_validated = validate_custom_data(
                    db, org_id, CustomFieldEntity.ACTIVITY, custom_incoming, partial=True
                )
                merged_custom, custom_changed = _merge_fill_empty_custom(
                    existing.custom_data, incoming_validated
                )
                if custom_changed:
                    patch["custom_data"] = merged_custom

                if not patch:
                    result["skipped"] += 1
                    continue

                activity_crud.update(db, existing, patch)
                audit_log_service.record(
                    db,
                    organization_id=org_id,
                    user_id=current_user.id,
                    action=AuditAction.UPDATE,
                    entity_type="Activity",
                    entity_id=existing.id,
                    new_data={"code": existing.code, "source": "spreadsheet_import_fill"},
                )
                result["updated"] += 1
            except Exception as exc:  # noqa: BLE001
                result["errors"].append({"row": index, "message": str(exc)})

        db.commit()
        return result

    def confirm_customers(
        self,
        db: Session,
        current_user: User,
        rows: list[dict[str, Any]],
    ) -> SpreadsheetImportResult:
        fields = custom_field_crud.list_for_entity(
            db, current_user.organization_id, CustomFieldEntity.CUSTOMER
        )
        field_keys = {f.field_key for f in fields}
        result = SpreadsheetImportResult.empty()
        org_id = current_user.organization_id

        for index, row in enumerate(rows or [], start=1):
            try:
                name = _str(row.get("name"))
                if not name:
                    continue
                company = _str(row.get("company")) or None
                email = _str(row.get("email")) or None
                phone = _str(row.get("phone")) or None
                address = _str(row.get("address")) or None
                custom_incoming = {
                    k: row[k]
                    for k in field_keys
                    if k in row and not is_empty(row.get(k))
                }

                existing = db.scalar(
                    select(Customer).where(
                        Customer.organization_id == org_id,
                        func.lower(Customer.name) == name.lower(),
                    )
                )

                if existing is None:
                    custom_data = validate_custom_data(
                        db, org_id, CustomFieldEntity.CUSTOMER, custom_incoming, partial=True
                    )
                    code = _slug_code(name, "CUST")
                    base = code
                    n = 0
                    while customer_crud.get_by_code(db, org_id, code):
                        n += 1
                        code = f"{base[:40]}-{n}"[:50]
                    customer = customer_crud.create(
                        db,
                        {
                            "organization_id": org_id,
                            "customer_code": code,
                            "name": name[:255],
                            "notes": company,
                            "email": email,
                            "phone": phone,
                            "address": address,
                            "is_active": True,
                            "custom_data": custom_data,
                        },
                    )
                    audit_log_service.record(
                        db,
                        organization_id=org_id,
                        user_id=current_user.id,
                        action=AuditAction.CREATE,
                        entity_type="Customer",
                        entity_id=customer.id,
                        new_data={"name": customer.name, "source": "spreadsheet_import"},
                    )
                    result["created"] += 1
                    continue

                patch: dict[str, Any] = {}
                if _field_empty(existing.notes) and company:
                    patch["notes"] = company
                if _field_empty(existing.email) and email:
                    patch["email"] = email
                if _field_empty(existing.phone) and phone:
                    patch["phone"] = phone
                if _field_empty(existing.address) and address:
                    patch["address"] = address

                incoming_validated = validate_custom_data(
                    db, org_id, CustomFieldEntity.CUSTOMER, custom_incoming, partial=True
                )
                merged_custom, custom_changed = _merge_fill_empty_custom(
                    existing.custom_data, incoming_validated
                )
                if custom_changed:
                    patch["custom_data"] = merged_custom

                if not patch:
                    result["skipped"] += 1
                    continue

                customer_crud.update(db, existing, patch)
                audit_log_service.record(
                    db,
                    organization_id=org_id,
                    user_id=current_user.id,
                    action=AuditAction.UPDATE,
                    entity_type="Customer",
                    entity_id=existing.id,
                    new_data={"name": existing.name, "source": "spreadsheet_import_fill"},
                )
                result["updated"] += 1
            except Exception as exc:  # noqa: BLE001
                result["errors"].append({"row": index, "message": str(exc)})

        db.commit()
        return result


catalog_import_service = CatalogImportService()
