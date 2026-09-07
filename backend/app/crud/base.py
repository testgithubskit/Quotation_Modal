from __future__ import annotations

from collections.abc import Sequence
from typing import Any, Generic, TypeVar
from uuid import UUID

from sqlalchemy import Select, asc, desc, func, or_, select
from sqlalchemy.orm import Session

from app.core.database import Base

ModelType = TypeVar("ModelType", bound=Base)


class CRUDBase(Generic[ModelType]):
    def __init__(self, model: type[ModelType], search_fields: Sequence[str] | None = None) -> None:
        self.model = model
        self.search_fields = list(search_fields or [])

    def get(self, db: Session, id: UUID) -> ModelType | None:
        return db.get(self.model, id)

    def get_by_org(self, db: Session, organization_id: UUID, id: UUID) -> ModelType | None:
        stmt = select(self.model).where(
            self.model.id == id,  # type: ignore[attr-defined]
            self.model.organization_id == organization_id,  # type: ignore[attr-defined]
        )
        return db.scalar(stmt)

    def _apply_search(self, stmt: Select, search: str | None) -> Select:
        if not search or not self.search_fields:
            return stmt
        pattern = f"%{search}%"
        clauses = [getattr(self.model, field).ilike(pattern) for field in self.search_fields]
        return stmt.where(or_(*clauses))

    def _apply_sort(self, stmt: Select, sort_by: str, sort_order: str) -> Select:
        column = getattr(self.model, sort_by, None) or getattr(self.model, "created_at", None)
        if column is None:
            return stmt
        return stmt.order_by(asc(column) if sort_order == "asc" else desc(column))

    def list_by_org(
        self,
        db: Session,
        organization_id: UUID,
        *,
        page: int = 1,
        page_size: int = 20,
        search: str | None = None,
        sort_by: str = "created_at",
        sort_order: str = "desc",
        extra_filters: list[Any] | None = None,
    ) -> tuple[list[ModelType], int]:
        stmt = select(self.model).where(self.model.organization_id == organization_id)  # type: ignore[attr-defined]
        count_stmt = select(func.count()).select_from(self.model).where(
            self.model.organization_id == organization_id  # type: ignore[attr-defined]
        )
        if extra_filters:
            stmt = stmt.where(*extra_filters)
            count_stmt = count_stmt.where(*extra_filters)
        stmt = self._apply_search(stmt, search)
        count_stmt = self._apply_search(count_stmt, search)
        total = db.scalar(count_stmt) or 0
        stmt = self._apply_sort(stmt, sort_by, sort_order)
        stmt = stmt.offset((page - 1) * page_size).limit(page_size)
        items = list(db.scalars(stmt).all())
        return items, total

    def create(self, db: Session, obj_in: dict[str, Any]) -> ModelType:
        db_obj = self.model(**obj_in)
        db.add(db_obj)
        db.flush()
        db.refresh(db_obj)
        return db_obj

    def update(self, db: Session, db_obj: ModelType, obj_in: dict[str, Any]) -> ModelType:
        for field, value in obj_in.items():
            if value is not None or field in obj_in:
                setattr(db_obj, field, value)
        db.add(db_obj)
        db.flush()
        db.refresh(db_obj)
        return db_obj

    def remove(self, db: Session, db_obj: ModelType) -> None:
        db.delete(db_obj)
        db.flush()
