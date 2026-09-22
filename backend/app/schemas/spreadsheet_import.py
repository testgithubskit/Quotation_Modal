from typing import Any

from pydantic import BaseModel, Field


class SpreadsheetImportErrorItem(BaseModel):
    row: int
    message: str


class SpreadsheetImportColumn(BaseModel):
    key: str
    title: str
    required: bool = False
    type: str | None = None
    width: int | None = None


class SpreadsheetPreviewResponse(BaseModel):
    columns: list[SpreadsheetImportColumn] = Field(default_factory=list)
    rows: list[dict[str, Any]] = Field(default_factory=list)
    total: int = 0


class SpreadsheetConfirmRequest(BaseModel):
    rows: list[dict[str, Any]] = Field(default_factory=list)


class SpreadsheetImportResponse(BaseModel):
    created: int = 0
    updated: int = 0
    skipped: int = 0
    fields_created: int = 0
    errors: list[SpreadsheetImportErrorItem] = Field(default_factory=list)
    message: str = ""

    @classmethod
    def from_result(cls, result: dict[str, Any], entity_label: str) -> "SpreadsheetImportResponse":
        created = int(result.get("created") or 0)
        updated = int(result.get("updated") or 0)
        skipped = int(result.get("skipped") or 0)
        fields_created = int(result.get("fields_created") or 0)
        errors = [
            SpreadsheetImportErrorItem(row=e["row"], message=e["message"])
            for e in (result.get("errors") or [])
            if isinstance(e, dict)
        ]
        parts = [
            f"{created} created",
            f"{updated} updated (new/empty columns only)",
            f"{skipped} skipped (duplicate)",
        ]
        if errors:
            parts.append(f"{len(errors)} row error(s)")
        return cls(
            created=created,
            updated=updated,
            skipped=skipped,
            fields_created=fields_created,
            errors=errors,
            message=f"{entity_label} import: " + ", ".join(parts),
        )
