from app.models.enums import QuotationStatus

ALLOWED_TRANSITIONS: dict[QuotationStatus, set[QuotationStatus]] = {
    QuotationStatus.DRAFT: {QuotationStatus.SENT, QuotationStatus.CANCELLED},
    QuotationStatus.SENT: {
        QuotationStatus.ACCEPTED,
        QuotationStatus.REJECTED,
        QuotationStatus.EXPIRED,
        QuotationStatus.CANCELLED,
    },
    QuotationStatus.REJECTED: {QuotationStatus.SENT, QuotationStatus.CANCELLED},
    QuotationStatus.EXPIRED: {QuotationStatus.DRAFT, QuotationStatus.CANCELLED},
    QuotationStatus.ACCEPTED: set(),
    QuotationStatus.CANCELLED: set(),
}

EDITABLE_STATUSES = {QuotationStatus.DRAFT}


def can_transition(current: QuotationStatus, target: QuotationStatus) -> bool:
    if current == target:
        return True
    return target in ALLOWED_TRANSITIONS.get(current, set())


def assert_editable(status: QuotationStatus) -> None:
    if status not in EDITABLE_STATUSES:
        raise ValueError(f"Quotation in status {status.value} cannot be edited")
