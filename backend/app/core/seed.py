from sqlalchemy.orm import Session

from app.crud import permission as permission_crud
from app.crud import role as role_crud
from app.models import Permission, Role, RolePermission
from app.models.enums import UserRoleName

PERMISSIONS: list[tuple[str, str, str]] = [
    ("users:create", "Create users", "Create organization users"),
    ("users:read", "Read users", "View organization users"),
    ("users:update", "Update users", "Update organization users"),
    ("users:delete", "Delete users", "Delete organization users"),
    ("organizations:read", "Read organization", "View organization profile"),
    ("organizations:update", "Update organization", "Update organization profile"),
    ("roles:read", "Read roles", "View roles and permissions"),
    ("roles:update", "Update roles", "Update role permission mappings"),
    ("customers:create", "Create customers", "Create customers"),
    ("customers:read", "Read customers", "View customers"),
    ("customers:update", "Update customers", "Update customers"),
    ("customers:delete", "Delete customers", "Delete customers"),
    ("activities:create", "Create activities", "Create activities"),
    ("activities:read", "Read activities", "View activities"),
    ("activities:update", "Update activities", "Update activities"),
    ("activities:delete", "Delete activities", "Delete activities"),
    ("quotations:create", "Create quotations", "Create quotations"),
    ("quotations:read", "Read quotations", "View quotations"),
    ("quotations:update", "Update quotations", "Update quotations"),
    ("quotations:delete", "Delete quotations", "Delete quotations"),
    ("quotation_templates:create", "Create templates", "Create quotation templates"),
    ("quotation_templates:read", "Read templates", "View quotation templates"),
    ("quotation_templates:update", "Update templates", "Update quotation templates"),
    ("quotation_templates:delete", "Delete templates", "Delete quotation templates"),
    ("custom_fields:create", "Create custom fields", "Create custom field definitions"),
    ("custom_fields:read", "Read custom fields", "View custom field definitions"),
    ("custom_fields:update", "Update custom fields", "Update custom field definitions"),
    ("custom_fields:delete", "Delete custom fields", "Delete custom field definitions"),
    ("audit_logs:read", "Read audit logs", "View audit logs"),
]

ROLE_PERMISSIONS: dict[str, set[str] | None] = {
    UserRoleName.ADMIN.value: None,
    UserRoleName.SUPERVISOR.value: {
        "users:read",
        "organizations:read",
        "roles:read",
        "customers:create",
        "customers:read",
        "customers:update",
        "customers:delete",
        "activities:create",
        "activities:read",
        "activities:update",
        "activities:delete",
        "quotations:read",
        "quotations:update",
        "quotation_templates:create",
        "quotation_templates:read",
        "quotation_templates:update",
        "quotation_templates:delete",
        "custom_fields:create",
        "custom_fields:read",
        "custom_fields:update",
        "custom_fields:delete",
        "audit_logs:read",
    },
    UserRoleName.USER.value: {
        "organizations:read",
        "customers:read",
        "activities:read",
        "quotations:create",
        "quotations:read",
        "quotations:update",
        "quotation_templates:create",
        "quotation_templates:read",
        "quotation_templates:update",
        "quotation_templates:delete",
        "custom_fields:read",
        "roles:read",
    },
}


def seed_roles_and_permissions(db: Session) -> None:
    permission_map: dict[str, Permission] = {}
    for code, name, description in PERMISSIONS:
        existing = permission_crud.get_by_code(db, code)
        if existing is None:
            existing = permission_crud.create(db, {"code": code, "name": name, "description": description})
        permission_map[code] = existing

    for role_name, codes in ROLE_PERMISSIONS.items():
        role = role_crud.get_by_name(db, role_name)
        if role is None:
            role_crud.create(
                db,
                {
                    "name": role_name,
                    "description": f"System {role_name} role",
                    "is_system": True,
                },
            )
            role = role_crud.get_by_name(db, role_name)
        if role is None:
            continue
        assigned = {rp.permission.code for rp in role.role_permissions if rp.permission}
        target_codes = set(permission_map.keys()) if codes is None else codes
        for code in target_codes:
            if code not in assigned:
                db.add(RolePermission(role_id=role.id, permission_id=permission_map[code].id))
    db.flush()
