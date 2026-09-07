from decimal import Decimal, ROUND_HALF_UP
from typing import Any

MONEY = Decimal("0.01")
RATE = Decimal("0.0001")


def to_decimal(value: Any, quantize: Decimal = MONEY) -> Decimal:
    if value is None:
        return Decimal("0").quantize(quantize)
    if isinstance(value, Decimal):
        amount = value
    else:
        amount = Decimal(str(value))
    return amount.quantize(quantize, rounding=ROUND_HALF_UP)


def calculate_item_total(
    quantity: Any,
    unit_price: Any,
    discount: Any = 0,
    tax: Any = 0,
) -> dict[str, Decimal]:
    qty = to_decimal(quantity, RATE)
    price = to_decimal(unit_price, RATE)
    item_discount = to_decimal(discount)
    item_tax = to_decimal(tax)
    line_subtotal = to_decimal(qty * price)
    if item_discount > line_subtotal:
        raise ValueError("Item discount cannot exceed line subtotal")
    line_total = to_decimal(line_subtotal - item_discount + item_tax)
    return {
        "quantity": qty,
        "unit_price": price,
        "discount": item_discount,
        "tax": item_tax,
        "line_subtotal": line_subtotal,
        "total": line_total,
    }


def calculate_quotation_totals(
    items: list[dict[str, Any]],
    header_discount: Any = 0,
) -> dict[str, Decimal]:
    subtotal = Decimal("0.00")
    item_discount_total = Decimal("0.00")
    tax_total = Decimal("0.00")
    calculated_items: list[dict[str, Decimal]] = []

    for item in items:
        calculated = calculate_item_total(
            item.get("quantity"),
            item.get("unit_price"),
            item.get("discount", 0),
            item.get("tax", 0),
        )
        subtotal += calculated["line_subtotal"]
        item_discount_total += calculated["discount"]
        tax_total += calculated["tax"]
        calculated_items.append(calculated)

    header_discount_amount = to_decimal(header_discount)
    total_discount = to_decimal(item_discount_total + header_discount_amount)
    taxable_base = to_decimal(subtotal - total_discount)
    if taxable_base < 0:
        raise ValueError("Total discount cannot exceed quotation subtotal")
    final_total = to_decimal(taxable_base + tax_total)
    return {
        "items": calculated_items,  # type: ignore[dict-item]
        "subtotal": to_decimal(subtotal),
        "item_discount_total": to_decimal(item_discount_total),
        "header_discount": header_discount_amount,
        "discount": header_discount_amount,
        "tax": to_decimal(tax_total),
        "total": final_total,
    }
