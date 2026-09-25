import enum


class UserRoleName(str, enum.Enum):
    ADMIN = "ADMIN"
    USER = "USER"


class QuotationStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    SENT = "SENT"
    ACCEPTED = "ACCEPTED"
    REJECTED = "REJECTED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"


class CustomFieldEntity(str, enum.Enum):
    CUSTOMER = "CUSTOMER"
    ACTIVITY = "ACTIVITY"
    USER = "USER"
    ORGANIZATION = "ORGANIZATION"
    QUOTATION = "QUOTATION"
    QUOTATION_ITEM = "QUOTATION_ITEM"
    QUOTATION_TEMPLATE = "QUOTATION_TEMPLATE"


class CustomFieldType(str, enum.Enum):
    TEXT = "TEXT"
    TEXTAREA = "TEXTAREA"
    NUMBER = "NUMBER"
    DECIMAL = "DECIMAL"
    BOOLEAN = "BOOLEAN"
    DATE = "DATE"
    DATETIME = "DATETIME"
    SELECT = "SELECT"
    MULTISELECT = "MULTISELECT"
    EMAIL = "EMAIL"
    URL = "URL"


class NotificationKind(str, enum.Enum):
    REPORT_SUBMITTED = "REPORT_SUBMITTED"
    REPORT_ACCEPTED = "REPORT_ACCEPTED"
    REPORT_REJECTED = "REPORT_REJECTED"


class AuditAction(str, enum.Enum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    DELETE = "DELETE"
    LOGIN = "LOGIN"
    LOGOUT = "LOGOUT"
    STATUS_CHANGE = "STATUS_CHANGE"
    PASSWORD_RESET = "PASSWORD_RESET"
