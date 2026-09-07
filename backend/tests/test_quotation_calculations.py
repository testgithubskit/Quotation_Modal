from decimal import Decimal

from app.services.quotation_calculation import calculate_item_total, calculate_quotation_totals


def test_item_total_quantity_times_price_minus_discount_plus_tax() -> None:
    result = calculate_item_total(
        quantity="2",
        unit_price="10.50",
        discount="1.00",
        tax="1.50",
    )
    assert result["line_subtotal"] == Decimal("21.00")
    assert result["total"] == Decimal("21.50")


def test_quotation_totals_use_decimal_not_float() -> None:
    totals = calculate_quotation_totals(
        [
            {"quantity": "2", "unit_price": "100.00", "discount": "10.00", "tax": "18.00"},
            {"quantity": "1", "unit_price": "50.00", "discount": "0", "tax": "9.00"},
        ],
        header_discount="5.00",
    )
    assert totals["subtotal"] == Decimal("250.00")
    assert totals["item_discount_total"] == Decimal("10.00")
    assert totals["discount"] == Decimal("5.00")
    assert totals["tax"] == Decimal("27.00")
    assert totals["total"] == Decimal("262.00")
    assert isinstance(totals["total"], Decimal)


def test_discount_cannot_exceed_subtotal() -> None:
    try:
        calculate_quotation_totals(
            [{"quantity": "1", "unit_price": "10.00", "discount": "0", "tax": "0"}],
            header_discount="20.00",
        )
    except ValueError as exc:
        assert "discount" in str(exc).lower()
    else:
        raise AssertionError("Expected discount validation to fail")
