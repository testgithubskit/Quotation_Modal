from typing import Any

from pydantic import BaseModel, Field


class PdfRenderRequest(BaseModel):
    html: str = Field(..., min_length=1)
    page_size: str = "A4"
    orientation: str = "portrait"
    margins: dict[str, Any] | None = None
    filename: str | None = None
