from fastapi.testclient import TestClient

from tests.conftest import auth_header, signup, unique_suffix


def test_custom_fields_are_metadata_driven(client: TestClient) -> None:
    admin = signup(client)
    headers = auth_header(admin["access_token"])
    created = client.post(
        "/api/v1/custom-fields",
        headers=headers,
        json={
            "entity_type": "CUSTOMER",
            "field_key": "accreditation",
            "field_label": "Accreditation",
            "field_type": "SELECT",
            "is_required": True,
            "is_visible": True,
            "is_editable": True,
            "display_order": 1,
            "options": {"values": ["NABL", "ISO"]},
        },
    )
    assert created.status_code == 201, created.text

    missing = client.post(
        "/api/v1/customers",
        headers=headers,
        json={"customer_code": f"C-{unique_suffix()[:6]}", "name": "Needs Field"},
    )
    assert missing.status_code == 422

    ok = client.post(
        "/api/v1/customers",
        headers=headers,
        json={
            "customer_code": f"C-{unique_suffix()[:6]}",
            "name": "Accredited Client",
            "custom_data": {"accreditation": "NABL"},
        },
    )
    assert ok.status_code == 201, ok.text
    assert ok.json()["custom_data"]["accreditation"] == "NABL"
