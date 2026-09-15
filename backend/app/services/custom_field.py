from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import AppError
from app.crud import custom_field as custom_field_crud
from app.models import CustomFieldDefinition
from app.models.enums import CustomFieldEntity, CustomFieldType


def validate_custom_data(
    db: Session,
    organization_id: UUID,
    entity_type: CustomFieldEntity,
    custom_data: dict[str, Any] | None,
    *,
    partial: bool = False,
    allow_unknown: bool = False,
) -> dict[str, Any]:
    definitions = custom_field_crud.list_for_entity(db, organization_id, entity_type)
    data = dict(custom_data or {})
    validated: dict[str, Any] = {}

    definition_keys = {item.field_key for item in definitions}
    unknown = set(data.keys()) - definition_keys
    if unknown and not allow_unknown:
        raise AppError(f"Unknown custom fields: {', '.join(sorted(unknown))}", status_code=422, code="invalid_custom_field")

    for definition in definitions:
        if definition.field_key in data:
            value = data[definition.field_key]
        elif partial:
            continue
        else:
            value = _coerce_default(definition)

        if definition.is_required and (value is None or value == ""):
            raise AppError(
                f"Custom field '{definition.field_label}' is required",
                status_code=422,
                code="required_custom_field",
            )
        if value is None or value == "":
            if definition.field_key in data or not partial:
                validated[definition.field_key] = None
            continue
        validated[definition.field_key] = _validate_value(definition, value)

    # Keep free-form metadata (e.g. quotation reportDocument) when allowed.
    if allow_unknown:
        for key in unknown:
            validated[key] = data[key]

    return validated


def _coerce_default(definition: CustomFieldDefinition) -> Any:
    if definition.default_value in (None, ""):
        return None
    return definition.default_value


def _validate_value(definition: CustomFieldDefinition, value: Any) -> Any:
    rules = definition.validation_rules or {}
    field_type = definition.field_type

    if field_type in {CustomFieldType.TEXT, CustomFieldType.TEXTAREA, CustomFieldType.EMAIL, CustomFieldType.URL}:
        text = str(value)
        min_len = rules.get("min_length")
        max_len = rules.get("max_length")
        if min_len is not None and len(text) < int(min_len):
            raise AppError(f"{definition.field_label} is too short", status_code=422, code="invalid_custom_field")
        if max_len is not None and len(text) > int(max_len):
            raise AppError(f"{definition.field_label} is too long", status_code=422, code="invalid_custom_field")
        if field_type == CustomFieldType.EMAIL and "@" not in text:
            raise AppError(f"{definition.field_label} must be an email", status_code=422, code="invalid_custom_field")
        return text

    if field_type in {CustomFieldType.NUMBER, CustomFieldType.DECIMAL}:
        try:
            number = Decimal(str(value))
        except (InvalidOperation, ValueError) as exc:
            raise AppError(f"{definition.field_label} must be numeric", status_code=422, code="invalid_custom_field") from exc
        minimum = rules.get("min")
        maximum = rules.get("max")
        if minimum is not None and number < Decimal(str(minimum)):
            raise AppError(f"{definition.field_label} is below minimum", status_code=422, code="invalid_custom_field")
        if maximum is not None and number > Decimal(str(maximum)):
            raise AppError(f"{definition.field_label} is above maximum", status_code=422, code="invalid_custom_field")
        return float(number) if field_type == CustomFieldType.DECIMAL else int(number)

    if field_type == CustomFieldType.BOOLEAN:
        if isinstance(value, bool):
            return value
        if str(value).lower() in {"true", "1", "yes"}:
            return True
        if str(value).lower() in {"false", "0", "no"}:
            return False
        raise AppError(f"{definition.field_label} must be boolean", status_code=422, code="invalid_custom_field")

    if field_type in {CustomFieldType.DATE, CustomFieldType.DATETIME}:
        if isinstance(value, (datetime, date)):
            return value.isoformat()
        return str(value)

    if field_type == CustomFieldType.SELECT:
        options = _option_values(definition)
        if options and str(value) not in options:
            raise AppError(f"{definition.field_label} has an invalid option", status_code=422, code="invalid_custom_field")
        return str(value)

    if field_type == CustomFieldType.MULTISELECT:
        values = value if isinstance(value, list) else [value]
        options = _option_values(definition)
        coerced = [str(item) for item in values]
        if options and any(item not in options for item in coerced):
            raise AppError(f"{definition.field_label} has an invalid option", status_code=422, code="invalid_custom_field")
        return coerced

    return value


def _option_values(definition: CustomFieldDefinition) -> set[str]:
    options = definition.options or {}
    values = options.get("values") or options.get("choices") or []
    return {str(item) for item in values}
