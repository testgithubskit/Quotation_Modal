from math import ceil
from typing import Generic, TypeVar

from pydantic import BaseModel, ConfigDict, Field

T = TypeVar("T")


class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class MessageResponse(BaseModel):
    success: bool = True
    message: str


class PaginationParams(BaseModel):
    page: int = Field(1, ge=1)
    page_size: int | None = Field(None, ge=1)
    search: str | None = None
    sort_by: str = "created_at"
    sort_order: str = Field("desc", pattern="^(asc|desc)$")


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    pages: int

    @classmethod
    def build(cls, items: list[T], total: int, page: int = 1, page_size: int | None = None) -> "PaginatedResponse[T]":
        effective_size = page_size if page_size else (total or len(items) or 1)
        return cls(
            items=items,
            total=total,
            page=page,
            page_size=effective_size,
            pages=ceil(total / effective_size) if effective_size else 0,
        )
