from __future__ import annotations

from uuid import UUID

from sqlalchemy.orm import Session

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.core.security import hash_password
from app.crud import organization as organization_crud
from app.crud import role as role_crud
from app.crud import user as user_crud
from app.models import Organization, Role, User
from app.models.enums import AuditAction, CustomFieldEntity, UserRoleName
from app.schemas.organization import OrganizationUpdate
from app.schemas.user import RoleUpdate, UserCreate, UserUpdate
from app.services.audit_log import audit_log_service
from app.services.custom_field import validate_custom_data


class OrganizationService:
    def get(self, db: Session, organization_id: UUID) -> Organization:
        organization = organization_crud.get(db, organization_id)
        if organization is None:
            raise NotFoundError("Organization not found")
        return organization

    def update(self, db: Session, current_user: User, payload: OrganizationUpdate) -> Organization:
        organization = self.get(db, current_user.organization_id)
        data = payload.model_dump(exclude_unset=True)
        if "custom_data" in data:
            data["custom_data"] = validate_custom_data(
                db,
                current_user.organization_id,
                CustomFieldEntity.ORGANIZATION,
                data["custom_data"],
                partial=True,
            )
        old = {"name": organization.name}
        organization = organization_crud.update(db, organization, data)
        audit_log_service.record(
            db,
            organization_id=organization.id,
            user_id=current_user.id,
            action=AuditAction.UPDATE,
            entity_type="Organization",
            entity_id=organization.id,
            old_data=old,
            new_data={"name": organization.name},
        )
        db.commit()
        db.refresh(organization)
        return organization


class UserService:
    def list(
        self,
        db: Session,
        current_user: User,
        *,
        page: int = 1,
        page_size: int | None = None,
        search: str | None,
        sort_by: str,
        sort_order: str,
    ) -> tuple[list[User], int]:
        return user_crud.list_by_org(
            db,
            current_user.organization_id,
            page=page,
            page_size=page_size,
            search=search,
            sort_by=sort_by,
            sort_order=sort_order,
        )

    def get(self, db: Session, current_user: User, user_id: UUID) -> User:
        user = user_crud.get_by_org(db, current_user.organization_id, user_id)
        if user is None:
            raise NotFoundError("User not found")
        user = user_crud.get_with_role(db, user.id)
        if user is None:
            raise NotFoundError("User not found")
        return user

    def create(self, db: Session, current_user: User, payload: UserCreate) -> User:
        if current_user.role.name != UserRoleName.ADMIN.value:
            raise ForbiddenError("Only admins can create users")
        if user_crud.get_by_email(db, payload.email.lower()):
            raise ConflictError("Email already registered")
        role = role_crud.get_by_name(db, payload.role_name)
        if role is None:
            raise NotFoundError("Role not found")
        custom_data = validate_custom_data(
            db,
            current_user.organization_id,
            CustomFieldEntity.USER,
            payload.custom_data,
        )
        user = user_crud.create(
            db,
            {
                "organization_id": current_user.organization_id,
                "role_id": role.id,
                "email": payload.email.lower(),
                "hashed_password": hash_password(payload.password),
                "full_name": payload.full_name,
                "phone": payload.phone,
                "is_active": payload.is_active,
                "token_version": 0,
                "custom_data": custom_data,
            },
        )
        audit_log_service.record(
            db,
            organization_id=current_user.organization_id,
            user_id=current_user.id,
            action=AuditAction.CREATE,
            entity_type="User",
            entity_id=user.id,
            new_data={"email": user.email, "role": payload.role_name},
        )
        db.commit()
        db.refresh(user)
        return self.get(db, current_user, user.id)

    def update(self, db: Session, current_user: User, user_id: UUID, payload: UserUpdate) -> User:
        user = self.get(db, current_user, user_id)
        data = payload.model_dump(exclude_unset=True)
        if "role_name" in data:
            if current_user.role.name != UserRoleName.ADMIN.value:
                raise ForbiddenError("Only admins can change roles")
            role = role_crud.get_by_name(db, data.pop("role_name"))
            if role is None:
                raise NotFoundError("Role not found")
            data["role_id"] = role.id
        if "password" in data:
            data["hashed_password"] = hash_password(data.pop("password"))
            data["token_version"] = user.token_version + 1
        if "custom_data" in data:
            data["custom_data"] = validate_custom_data(
                db,
                current_user.organization_id,
                CustomFieldEntity.USER,
                data["custom_data"],
                partial=True,
            )
        user = user_crud.update(db, user, data)
        audit_log_service.record(
            db,
            organization_id=current_user.organization_id,
            user_id=current_user.id,
            action=AuditAction.UPDATE,
            entity_type="User",
            entity_id=user.id,
        )
        db.commit()
        return self.get(db, current_user, user.id)

    def delete(self, db: Session, current_user: User, user_id: UUID) -> None:
        if current_user.id == user_id:
            raise ForbiddenError("You cannot delete your own account")
        user = self.get(db, current_user, user_id)
        user_crud.remove(db, user)
        audit_log_service.record(
            db,
            organization_id=current_user.organization_id,
            user_id=current_user.id,
            action=AuditAction.DELETE,
            entity_type="User",
            entity_id=user_id,
        )
        db.commit()


class RoleService:
    def list_roles(self, db: Session) -> list[Role]:
        return role_crud.list_all(db)

    def get(self, db: Session, role_id: UUID) -> Role:
        role = role_crud.get(db, role_id)
        if role is None:
            raise NotFoundError("Role not found")
        loaded = role_crud.get_by_name(db, role.name)
        if loaded is None:
            raise NotFoundError("Role not found")
        return loaded

    def update(self, db: Session, current_user: User, role_id: UUID, payload: RoleUpdate) -> Role:
        if current_user.role.name != UserRoleName.ADMIN.value:
            raise ForbiddenError("Only admins can update roles")
        from app.crud import permission as permission_crud
        from app.models import RolePermission

        role = self.get(db, role_id)
        data = payload.model_dump(exclude_unset=True)
        permission_ids = data.pop("permission_ids", None)
        if "description" in data:
            role.description = data["description"]
        if permission_ids is not None:
            if role.is_system and role.name == UserRoleName.ADMIN.value:
                raise ForbiddenError("Admin role permissions cannot be reduced")
            permissions = permission_crud.list_by_ids(db, permission_ids)
            if len(permissions) != len(set(permission_ids)):
                raise NotFoundError("One or more permissions were not found")
            role.role_permissions.clear()
            db.flush()
            for permission in permissions:
                db.add(RolePermission(role_id=role.id, permission_id=permission.id))
        db.add(role)
        db.commit()
        return self.get(db, role.id)


organization_service = OrganizationService()
user_service = UserService()
role_service = RoleService()
