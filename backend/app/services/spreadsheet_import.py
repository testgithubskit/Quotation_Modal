"""Parse .xlsx / .csv uploads into row dicts (header-aware)."""

from __future__ import annotations

import csv
import io
import re
from html.parser import HTMLParser
from typing import Any

from openpyxl import load_workbook

from app.core.exceptions import AppError

HEADER_HINTS = (
    "sl.no",
    "sl no",
    "s.no",
    "sno",
    "particular",
    "activity code",
    "customer name",
    "code",
    "name",
    "specification",
    "description",
    "unit price",
    "proposed charge",
    "company",
    "email",
    "phone",
    "address",
    "cost",
)


def _cell_text(value: Any) -> str:
    if value is None:
        return ""
    return re.sub(r"\s+", " ", str(value)).strip()


def _looks_like_header_cell(text: str) -> bool:
    t = text.lower()
    return any(h in t or t == h for h in HEADER_HINTS)


def _find_header_row_index(matrix: list[list[Any]]) -> int:
    best_idx = 0
    best_score = -1
    scan = min(len(matrix), 30)
    for i in range(scan):
        row = matrix[i] or []
        texts = [_cell_text(c) for c in row if _cell_text(c)]
        if len(texts) < 2:
            continue
        score = 0
        for t in texts:
            if _looks_like_header_cell(t):
                score += 3
            elif 0 < len(t) < 40:
                score += 1
        joined = " | ".join(texts).lower()
        if "sl" in joined and "particular" in joined:
            score += 8
        if "activity" in joined and "code" in joined:
            score += 8
        if "customer" in joined and "name" in joined:
            score += 8
        if score > best_score:
            best_score = score
            best_idx = i
    return best_idx


def _matrix_to_objects(matrix: list[list[Any]]) -> list[dict[str, Any]]:
    if not matrix:
        return []
    header_idx = _find_header_row_index(matrix)
    header_row = matrix[header_idx] or []
    headers: list[str] = []
    seen: dict[str, int] = {}
    for i, h in enumerate(header_row):
        label = _cell_text(h) or f"Column_{i + 1}"
        if label not in seen:
            seen[label] = 0
            headers.append(label)
        else:
            seen[label] += 1
            headers.append(f"{label}_{seen[label]}")

    rows: list[dict[str, Any]] = []
    for r in range(header_idx + 1, len(matrix)):
        line = matrix[r] or []
        obj: dict[str, Any] = {}
        non_empty = 0
        for c, header in enumerate(headers):
            val = line[c] if c < len(line) else None
            if isinstance(val, (int, float)) and not isinstance(val, bool):
                text: Any = val
            else:
                text = _cell_text(val)
            obj[header] = text
            if text != "" and text is not None:
                non_empty += 1
        if non_empty == 0:
            continue
        first = _cell_text(obj.get(headers[0], ""))
        if _looks_like_header_cell(first) and any(
            _looks_like_header_cell(_cell_text(obj.get(h, ""))) for h in headers
        ):
            continue
        rows.append(obj)
    return rows


def _sheet_to_matrix(ws) -> list[list[Any]]:
    matrix: list[list[Any]] = []
    for row in ws.iter_rows(values_only=True):
        if row is None:
            continue
        values = list(row)
        if not any(v is not None and str(v).strip() != "" for v in values):
            continue
        matrix.append(values)
    return matrix


def _parse_html_spreadsheet(data: bytes) -> list[dict[str, Any]]:
    """Parse Excel HTML / SpreadsheetML exports (often saved as .xls by our app)."""
    text = None
    for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            text = data.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    if text is None:
        raise AppError("Could not decode HTML spreadsheet", status_code=400, code="invalid_spreadsheet")

    class _TableParser(HTMLParser):
        def __init__(self) -> None:
            super().__init__()
            self.in_td = False
            self.in_th = False
            self.current_cell = ""
            self.current_row: list[str] = []
            self.matrix: list[list[str]] = []
            self.in_table = 0

        def handle_starttag(self, tag, attrs):
            t = tag.lower()
            if t == "table":
                self.in_table += 1
            elif t in {"td", "th"} and self.in_table:
                self.in_td = t == "td"
                self.in_th = t == "th"
                self.current_cell = ""
                # expand colspan with empty fillers later via colspan attr
                self._colspan = 1
                for k, v in attrs:
                    if k.lower() == "colspan":
                        try:
                            self._colspan = max(1, int(v))
                        except ValueError:
                            self._colspan = 1

            elif t == "br" and (self.in_td or self.in_th):
                self.current_cell += "\n"

        def handle_endtag(self, tag):
            t = tag.lower()
            if t in {"td", "th"} and self.in_table and (self.in_td or self.in_th):
                cell = re.sub(r"\s+", " ", self.current_cell).strip()
                self.current_row.append(cell)
                for _ in range(getattr(self, "_colspan", 1) - 1):
                    self.current_row.append("")
                self.in_td = False
                self.in_th = False
                self.current_cell = ""
                self._colspan = 1
            elif t == "tr" and self.in_table:
                if any(c.strip() for c in self.current_row):
                    self.matrix.append(self.current_row)
                self.current_row = []
            elif t == "table" and self.in_table:
                self.in_table -= 1

        def handle_data(self, data_chunk):
            if self.in_td or self.in_th:
                self.current_cell += data_chunk

    parser = _TableParser()
    try:
        parser.feed(text)
        parser.close()
    except Exception as exc:  # noqa: BLE001
        raise AppError("Invalid HTML spreadsheet", status_code=400, code="invalid_spreadsheet") from exc

    if not parser.matrix:
        raise AppError("No table data found in spreadsheet", status_code=400, code="empty_spreadsheet")

    return [{**row, "_sheet": "Sheet1"} for row in _matrix_to_objects(parser.matrix)]


def _looks_like_html(data: bytes) -> bool:
    head = data.lstrip()[:200].lower()
    return (
        head.startswith(b"<!doctype html")
        or head.startswith(b"<html")
        or b"xmlns:x=\"urn:schemas-microsoft-com:office:excel\"" in head
        or (b"<table" in head and b"<tr" in head)
    )


def _parse_xlsx(data: bytes) -> list[dict[str, Any]]:
    try:
        wb = load_workbook(io.BytesIO(data), data_only=True, read_only=True)
    except Exception as exc:  # noqa: BLE001
        raise AppError("Invalid Excel file", status_code=400, code="invalid_spreadsheet") from exc
    all_rows: list[dict[str, Any]] = []
    try:
        for sheet_name in wb.sheetnames:
            ws = wb[sheet_name]
            matrix = _sheet_to_matrix(ws)
            for row in _matrix_to_objects(matrix):
                all_rows.append({**row, "_sheet": sheet_name.strip()})
    finally:
        wb.close()
    return all_rows


def _parse_xls(data: bytes) -> list[dict[str, Any]]:
    # Our own exports (and many Excel "Save as HTML") use .xls extension but are HTML.
    if _looks_like_html(data):
        return _parse_html_spreadsheet(data)

    try:
        import xlrd
    except ImportError as exc:
        raise AppError(
            "Server missing xlrd package for .xls files",
            status_code=500,
            code="missing_dependency",
        ) from exc
    try:
        book = xlrd.open_workbook(file_contents=data)
    except Exception as exc:  # noqa: BLE001
        # Last chance: HTML mislabeled as .xls
        if b"<table" in data[:4000].lower() or b"<html" in data[:4000].lower():
            return _parse_html_spreadsheet(data)
        raise AppError("Invalid .xls file", status_code=400, code="invalid_spreadsheet") from exc

    all_rows: list[dict[str, Any]] = []
    for sheet in book.sheets():
        matrix: list[list[Any]] = []
        for r in range(sheet.nrows):
            values = []
            for c in range(sheet.ncols):
                cell = sheet.cell(r, c)
                # xlrd date cells
                if cell.ctype == xlrd.XL_CELL_DATE:
                    try:
                        values.append(xlrd.xldate_as_datetime(cell.value, book.datemode))
                    except Exception:  # noqa: BLE001
                        values.append(cell.value)
                elif cell.ctype == xlrd.XL_CELL_EMPTY:
                    values.append(None)
                else:
                    values.append(cell.value)
            if any(v is not None and str(v).strip() != "" for v in values):
                matrix.append(values)
        for row in _matrix_to_objects(matrix):
            all_rows.append({**row, "_sheet": (sheet.name or "Sheet").strip()})
    return all_rows


def _parse_csv(data: bytes) -> list[dict[str, Any]]:
    text = None
    for encoding in ("utf-8-sig", "utf-8", "cp1252", "latin-1"):
        try:
            text = data.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    if text is None:
        raise AppError("Could not decode CSV file", status_code=400, code="invalid_spreadsheet")
    reader = csv.reader(io.StringIO(text))
    matrix = [list(row) for row in reader if any(str(c).strip() for c in row)]
    return [{**row, "_sheet": "Sheet1"} for row in _matrix_to_objects(matrix)]


def parse_spreadsheet_bytes(data: bytes, filename: str | None = None) -> list[dict[str, Any]]:
    name = (filename or "").lower()

    # Content-based detection first — exports often use .xls but are HTML
    if _looks_like_html(data):
        rows = _parse_html_spreadsheet(data)
    elif name.endswith(".csv"):
        rows = _parse_csv(data)
    elif name.endswith(".xlsx") or name.endswith(".xlsm"):
        rows = _parse_xlsx(data)
    elif name.endswith(".xls"):
        rows = _parse_xls(data)
    else:
        # Probe by content: xlsx (zip) / xls (OLE) / csv
        if data[:2] == b"PK":
            rows = _parse_xlsx(data)
        elif data[:8] == b"\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1":
            rows = _parse_xls(data)
        else:
            try:
                rows = _parse_xlsx(data)
            except AppError:
                try:
                    rows = _parse_xls(data)
                except AppError:
                    rows = _parse_csv(data)

    if not rows:
        raise AppError("No data rows found in spreadsheet", status_code=400, code="empty_spreadsheet")
    return rows


def pick(row: dict[str, Any], *keys: str) -> Any:
    lower_map = {str(k).strip().lower(): v for k, v in row.items() if k != "_sheet"}
    for key in keys:
        if key in row and row[key] not in (None, ""):
            return row[key]
        val = lower_map.get(key.lower())
        if val not in (None, ""):
            return val
    return ""


def slugify_field_key(label: str, existing: set[str] | None = None) -> str:
    base = re.sub(r"[^a-z0-9]+", "_", (label or "").lower()).strip("_") or "field"
    if not re.match(r"^[a-z]", base):
        base = f"f_{base}"
    key = base[:100]
    existing = existing or set()
    i = 1
    while key in existing:
        suffix = f"_{i}"
        key = f"{base[: 100 - len(suffix)]}{suffix}"
        i += 1
    return key


def is_empty(value: Any) -> bool:
    if value is None:
        return True
    if isinstance(value, str) and value.strip() == "":
        return True
    return False
