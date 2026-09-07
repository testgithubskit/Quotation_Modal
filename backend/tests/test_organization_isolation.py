from fastapi.testclient import TestClient

from tests.conftest import auth_header, signup


def test_organization_isolation_for_customers(client: TestClient) -> None:
    org_a = signup(client)
    org_b = signup(client)

    created = client.post(
        "/api/v1/customers",
        headers=auth_header(org_a["access_token"]),
        json={"customer_code": "CUST-001", "name": "Acme Labs"},
    )
    assert created.status_code == 201
    customer_id = created.json()["id"]

    hidden = client.get(
        f"/api/v1/customers/{customer_id}",
        headers=auth_header(org_b["access_token"]),
    )
    assert hidden.status_code == 404

    listed = client.get("/api/v1/customers", headers=auth_header(org_b["access_token"]))
    assert listed.status_code == 200
    assert listed.json()["total"] == 0
