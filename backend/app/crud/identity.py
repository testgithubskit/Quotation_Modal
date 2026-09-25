from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.crud.base import CRUDBase
from app.models import Organization, Permission, Role, RolePermission, User
from app.models.enums import UserRoleName


class CRUDOrganization(CRUDBase[Organization]):
    def get_by_code(self, db: Session, code: str) -> Organization | None:
        return db.scalar(select(Organization).where(Organization.code == code))


class CRUDUser(CRUDBase[User]):
    def get_by_email(self, db: Session, email: str) -> User | None:
        return db.scalar(
            select(User)
            .options(selectinload(User.role).selectinload(Role.role_permissions).selectinload(RolePermission.permission))
            .where(User.email == email)
        )

    def get_with_role(self, db: Session, user_id: UUID) -> User | None:
        return db.scalar(
            select(User)
            .options(
                selectinload(User.organization),
                selectinload(User.role).selectinload(Role.role_permissions).selectinload(RolePermission.permission),
            )
            .where(User.id == user_id)
        )

    def list_admins_by_org(self, db: Session, organization_id: UUID) -> list[User]:
        stmt = (
            select(User)
            .join(Role, User.role_id == Role.id)
            .where(
                User.organization_id == organization_id,
                User.is_active.is_(True),
                Role.name == UserRoleName.ADMIN.value,
            )
        )
        return list(db.scalars(stmt).all())

    def list_by_org(self, db: Session, organization_id, **kwargs):
        kwargs.setdefault("sort_by", "created_at")
        items, total = super().list_by_org(db, organization_id, **kwargs)
        ids = [item.id for item in items]
        if not ids:
            return items, total
        loaded = list(
            db.scalars(
                select(User).options(selectinload(User.role)).where(User.id.in_(ids))
            ).all()
        )
        by_id = {user.id: user for user in loaded}
        return [by_id[item.id] for item in items if item.id in by_id], total

    def list_permissions(self, user: User) -> list[str]:
        if not user.role:
            return []
        return [rp.permission.code for rp in user.role.role_permissions if rp.permission]


class CRUDRole(CRUDBase[Role]):
    def get_by_name(self, db: Session, name: str) -> Role | None:
        return db.scalar(
            select(Role)
            .options(selectinload(Role.role_permissions).selectinload(RolePermission.permission))
            .where(Role.name == name)
        )

    def list_all(self, db: Session) -> list[Role]:
        stmt = (
            select(Role)
            .options(selectinload(Role.role_permissions).selectinload(RolePermission.permission))
            .order_by(Role.name)
        )
        return list(db.scalars(stmt).all())


class CRUDPermission(CRUDBase[Permission]):
    def get_by_code(self, db: Session, code: str) -> Permission | None:
        return db.scalar(select(Permission).where(Permission.code == code))

    def list_all(self, db: Session) -> list[Permission]:
        return list(db.scalars(select(Permission).order_by(Permission.code)).all())

    def list_by_ids(self, db: Session, ids: list[UUID]) -> list[Permission]:
        if not ids:
            return []
        return list(db.scalars(select(Permission).where(Permission.id.in_(ids))).all())


organization = CRUDOrganization(Organization, search_fields=["name", "code", "email"])
user = CRUDUser(User, search_fields=["email", "full_name"])
role = CRUDRole(Role, search_fields=["name"])
permission = CRUDPermission(Permission, search_fields=["code", "name"])
