from decimal import Decimal

from fastapi.testclient import TestClient

from tests.conftest import auth_header, signup, unique_suffix


def _setup(client: TestClient) -> tuple[dict, dict, dict]:
    admin = signup(client)
    headers = auth_header(admin["access_token"])
    suffix = unique_suffix()
    customer = client.post(
        "/api/v1/customers",
        headers=headers,
        json={"customer_code": f"C-{suffix[:6]}", "name": "Quote Customer"},
    )
    activity = client.post(
        "/api/v1/activities",
        headers=headers,
        json={
            "code": f"A-{suffix[:6]}",
            "name": "Sample analysis",
            "unit": "test",
            "unit_price": "100.00",
        },
    )
    return headers, customer.json(), activity.json()


def test_quotation_calculations_and_frozen_activity_price(client: TestClient) -> None:
    headers, customer, activity = _setup(client)
    created = client.post(
        "/api/v1/quotations",
        headers=headers,
        json={
            "customer_id": customer["id"],
            "discount": "5.00",
            "items": [
                {
                    "activity_id": activity["id"],
                    "quantity": "2",
                    "discount": "10.00",
                    "tax": "18.00",
                }
            ],
        },
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert Decimal(str(body["subtotal"])) == Decimal("200.00")
    assert Decimal(str(body["tax"])) == Decimal("18.00")
    assert Decimal(str(body["total"])) == Decimal("203.00")
    assert Decimal(str(body["items"][0]["unit_price"])) == Decimal("100.00")

    updated_activity = client.patch(
        f"/api/v1/activities/{activity['id']}",
        headers=headers,
        json={"unit_price": "999.00"},
    )
    assert updated_activity.status_code == 200
    fetched = client.get(f"/api/v1/quotations/{body['id']}", headers=headers)
    assert Decimal(str(fetched.json()["items"][0]["unit_price"])) == Decimal("100.00")


def test_invalid_quotation_status_transition(client: TestClient) -> None:
    headers, customer, activity = _setup(client)
    created = client.post(
        "/api/v1/quotations",
        headers=headers,
        json={
            "customer_id": customer["id"],
            "items": [{"activity_id": activity["id"], "quantity": "1"}],
        },
    )
    quotation_id = created.json()["id"]
    # Try to change directly from DRAFT to ACCEPTED (invalid transition)
    invalid = client.post(
        f"/api/v1/quotations/{quotation_id}/status",
        headers=headers,
        json={"status": "ACCEPTED"},
    )
    assert invalid.status_code == 409
