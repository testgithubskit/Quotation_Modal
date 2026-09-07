from decimal import Decimal

from fastapi.testclient import TestClient

from tests.conftest import auth_header, signup, unique_suffix


def test_customer_and_activity_crud(client: TestClient) -> None:
    admin = signup(client)
    headers = auth_header(admin["access_token"])
    suffix = unique_suffix()

    customer = client.post(
        "/api/v1/customers",
        headers=headers,
        json={
            "customer_code": f"C-{suffix[:6]}",
            "name": "NABL Client",
            "email": f"client-{suffix}@example.com",
            "phone": "9999999999",
            "tax_number": "GSTIN123",
            "address": "1 Lab Street",
        },
    )
    assert customer.status_code == 201, customer.text

    activity = client.post(
        "/api/v1/activities",
        headers=headers,
        json={
            "code": f"ACT-{suffix[:6]}",
            "name": "Water testing",
            "unit": "sample",
            "unit_price": "250.5000",
            "currency": "INR",
        },
    )
    assert activity.status_code == 201, activity.text
    assert Decimal(str(activity.json()["unit_price"])) == Decimal("250.5000")

    duplicate = client.post(
        "/api/v1/activities",
        headers=headers,
        json={
            "code": f"ACT-{suffix[:6]}",
            "name": "Duplicate",
            "unit_price": "1.00",
        },
    )
    assert duplicate.status_code == 409
