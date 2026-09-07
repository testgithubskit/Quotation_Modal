from datetime import datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Index, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.enums import CustomFieldEntity, CustomFieldType, QuotationStatus
from app.models.mixins import TimestampMixin, UUIDPrimaryKeyMixin


class Organization(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "organizations"
    __table_args__ = (
        Index("ix_organizations_code", "code", unique=True),
        Index("ix_organizations_name", "name"),
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    website: Mapped[Optional[str]] = mapped_column(String(255))
    tax_number: Mapped[Optional[str]] = mapped_column(String(100))
    address: Mapped[Optional[str]] = mapped_column(Text)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    custom_data: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    users: Mapped[list["User"]] = relationship(back_populates="organization")
    customers: Mapped[list["Customer"]] = relationship(back_populates="organization")
    activities: Mapped[list["Activity"]] = relationship(back_populates="organization")
    quotations: Mapped[list["Quotation"]] = relationship(back_populates="organization")
    quotation_templates: Mapped[list["QuotationTemplate"]] = relationship(back_populates="organization")
    custom_field_definitions: Mapped[list["CustomFieldDefinition"]] = relationship(
        back_populates="organization"
    )
    audit_logs: Mapped[list["AuditLog"]] = relationship(back_populates="organization")


class Permission(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "permissions"
    __table_args__ = (Index("ix_permissions_code", "code", unique=True),)

    code: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)

    role_permissions: Mapped[list["RolePermission"]] = relationship(
        back_populates="permission",
        cascade="all, delete-orphan",
    )


class Role(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "roles"
    __table_args__ = (Index("ix_roles_name", "name", unique=True),)

    name: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    is_system: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    users: Mapped[list["User"]] = relationship(back_populates="role")
    role_permissions: Mapped[list["RolePermission"]] = relationship(
        back_populates="role",
        cascade="all, delete-orphan",
    )


class RolePermission(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "role_permissions"
    __table_args__ = (
        UniqueConstraint("role_id", "permission_id", name="uq_role_permissions_role_permission"),
        Index("ix_role_permissions_role_id", "role_id"),
        Index("ix_role_permissions_permission_id", "permission_id"),
    )

    role_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="CASCADE"),
        nullable=False,
    )
    permission_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("permissions.id", ondelete="CASCADE"),
        nullable=False,
    )

    role: Mapped["Role"] = relationship(back_populates="role_permissions")
    permission: Mapped["Permission"] = relationship(back_populates="role_permissions")


class User(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        Index("ix_users_email", "email", unique=True),
        Index("ix_users_organization_id", "organization_id"),
        Index("ix_users_role_id", "role_id"),
        Index("ix_users_organization_email", "organization_id", "email"),
    )

    organization_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    role_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("roles.id", ondelete="RESTRICT"),
        nullable=False,
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(512), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    token_version: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    custom_data: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    organization: Mapped["Organization"] = relationship(back_populates="users")
    role: Mapped["Role"] = relationship(back_populates="users")
    created_quotations: Mapped[list["Quotation"]] = relationship(
        back_populates="created_by_user",
        foreign_keys="Quotation.created_by",
    )
    audit_logs: Mapped[list["AuditLog"]] = relationship(back_populates="user")


class Customer(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "customers"
    __table_args__ = (
        UniqueConstraint("organization_id", "customer_code", name="uq_customers_org_code"),
        Index("ix_customers_organization_id", "organization_id"),
        Index("ix_customers_email", "email"),
        Index("ix_customers_name", "name"),
    )

    organization_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    customer_code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255))
    phone: Mapped[Optional[str]] = mapped_column(String(50))
    website: Mapped[Optional[str]] = mapped_column(String(255))
    tax_number: Mapped[Optional[str]] = mapped_column(String(100))
    address: Mapped[Optional[str]] = mapped_column(Text)
    notes: Mapped[Optional[str]] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    custom_data: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    organization: Mapped["Organization"] = relationship(back_populates="customers")
    quotations: Mapped[list["Quotation"]] = relationship(back_populates="customer")


class Activity(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "activities"
    __table_args__ = (
        UniqueConstraint("organization_id", "code", name="uq_activities_org_code"),
        Index("ix_activities_organization_id", "organization_id"),
        Index("ix_activities_name", "name"),
    )

    organization_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    unit: Mapped[str] = mapped_column(String(50), nullable=False, default="unit")
    unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    custom_data: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    organization: Mapped["Organization"] = relationship(back_populates="activities")
    quotation_items: Mapped[list["QuotationItem"]] = relationship(back_populates="activity")


class QuotationTemplate(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "quotation_templates"
    __table_args__ = (
        UniqueConstraint("organization_id", "name", name="uq_quotation_templates_org_name"),
        Index("ix_quotation_templates_organization_id", "organization_id"),
    )

    organization_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_standard: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    template_data: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)
    custom_data: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    organization: Mapped["Organization"] = relationship(back_populates="quotation_templates")
    quotations: Mapped[list["Quotation"]] = relationship(back_populates="quotation_template")


class Quotation(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "quotations"
    __table_args__ = (
        UniqueConstraint("organization_id", "quotation_number", name="uq_quotations_org_number"),
        Index("ix_quotations_organization_id", "organization_id"),
        Index("ix_quotations_customer_id", "customer_id"),
        Index("ix_quotations_status", "status"),
        Index("ix_quotations_created_by", "created_by"),
        Index("ix_quotations_quotation_date", "quotation_date"),
    )

    organization_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    customer_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("customers.id", ondelete="RESTRICT"),
        nullable=False,
    )
    quotation_template_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("quotation_templates.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_by: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    quotation_number: Mapped[str] = mapped_column(String(50), nullable=False)
    quotation_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    validity_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[QuotationStatus] = mapped_column(
        Enum(QuotationStatus, name="quotation_status"),
        default=QuotationStatus.DRAFT,
        nullable=False,
    )
    subtotal: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    discount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    tax: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    total: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="INR")
    notes: Mapped[Optional[str]] = mapped_column(Text)
    custom_data: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    organization: Mapped["Organization"] = relationship(back_populates="quotations")
    customer: Mapped["Customer"] = relationship(back_populates="quotations")
    quotation_template: Mapped[Optional["QuotationTemplate"]] = relationship(back_populates="quotations")
    created_by_user: Mapped["User"] = relationship(
        back_populates="created_quotations",
        foreign_keys=[created_by],
    )
    items: Mapped[list["QuotationItem"]] = relationship(
        back_populates="quotation",
        cascade="all, delete-orphan",
        order_by="QuotationItem.line_number",
    )
    versions: Mapped[list["QuotationVersion"]] = relationship(
        back_populates="quotation",
        cascade="all, delete-orphan",
        order_by="QuotationVersion.version_number",
    )


class QuotationItem(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "quotation_items"
    __table_args__ = (
        Index("ix_quotation_items_quotation_id", "quotation_id"),
        Index("ix_quotation_items_activity_id", "activity_id"),
    )

    quotation_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("quotations.id", ondelete="CASCADE"),
        nullable=False,
    )
    activity_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("activities.id", ondelete="SET NULL"),
        nullable=True,
    )
    line_number: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    quantity: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    unit: Mapped[str] = mapped_column(String(50), nullable=False)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(14, 4), nullable=False)
    discount: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    tax: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    total: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0.00"), nullable=False)
    custom_data: Mapped[dict] = mapped_column(JSONB, default=dict, nullable=False)

    quotation: Mapped["Quotation"] = relationship(back_populates="items")
    activity: Mapped[Optional["Activity"]] = relationship(back_populates="quotation_items")


class QuotationVersion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "quotation_versions"
    __table_args__ = (
        UniqueConstraint("quotation_id", "version_number", name="uq_quotation_versions_number"),
        Index("ix_quotation_versions_quotation_id", "quotation_id"),
    )

    quotation_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("quotations.id", ondelete="CASCADE"),
        nullable=False,
    )
    version_number: Mapped[int] = mapped_column(Integer, nullable=False)
    snapshot_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    change_summary: Mapped[Optional[str]] = mapped_column(Text)

    quotation: Mapped["Quotation"] = relationship(back_populates="versions")


class CustomFieldDefinition(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "custom_field_definitions"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "entity_type",
            "field_key",
            name="uq_custom_fields_org_entity_key",
        ),
        Index("ix_custom_field_definitions_organization_id", "organization_id"),
        Index("ix_custom_field_definitions_entity_type", "entity_type"),
    )

    organization_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    entity_type: Mapped[CustomFieldEntity] = mapped_column(
        Enum(CustomFieldEntity, name="custom_field_entity"),
        nullable=False,
    )
    field_key: Mapped[str] = mapped_column(String(100), nullable=False)
    field_label: Mapped[str] = mapped_column(String(255), nullable=False)
    field_type: Mapped[CustomFieldType] = mapped_column(
        Enum(CustomFieldType, name="custom_field_type"),
        nullable=False,
    )
    is_required: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_editable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    default_value: Mapped[Optional[str]] = mapped_column(Text)
    options: Mapped[Optional[dict]] = mapped_column(JSONB)
    validation_rules: Mapped[Optional[dict]] = mapped_column(JSONB)

    organization: Mapped["Organization"] = relationship(back_populates="custom_field_definitions")


class AuditLog(UUIDPrimaryKeyMixin, Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_logs_organization_id", "organization_id"),
        Index("ix_audit_logs_user_id", "user_id"),
        Index("ix_audit_logs_entity", "entity_type", "entity_id"),
        Index("ix_audit_logs_created_at", "created_at"),
    )

    organization_id: Mapped[UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[Optional[UUID]] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[Optional[str]] = mapped_column(String(64))
    old_data: Mapped[Optional[dict]] = mapped_column(JSONB)
    new_data: Mapped[Optional[dict]] = mapped_column(JSONB)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    organization: Mapped["Organization"] = relationship(back_populates="audit_logs")
    user: Mapped[Optional["User"]] = relationship(back_populates="audit_logs")
