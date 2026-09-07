from collections.abc import Generator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.core.database import engine
from app.main import app


@pytest.fixture(scope="session")
def client() -> Generator[TestClient, None, None]:
    try:
        with engine.connect() as connection:
            connection.exec_driver_sql("SELECT 1")
    except OperationalError as exc:
        pytest.skip(f"PostgreSQL is not available: {exc}")
    with TestClient(app) as test_client:
        yield test_client


def unique_suffix() -> str:
    return uuid4().hex[:10]


def signup(client: TestClient, role_org: str | None = None) -> dict:
    suffix = unique_suffix()
    payload = {
        "organization_name": f"Org {suffix}",
        "organization_code": f"ORG{suffix[:8]}".upper(),
        "email": f"admin-{suffix}@example.com",
        "password": "Password123!",
        "full_name": "Admin User",
    }
    if role_org:
        payload["organization_code"] = role_org
    response = client.post("/api/v1/auth/signup", json=payload)
    assert response.status_code == 201, response.text
    tokens = response.json()
    tokens["email"] = payload["email"]
    tokens["password"] = payload["password"]
    tokens["organization_code"] = payload["organization_code"]
    return tokens


def auth_header(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}
