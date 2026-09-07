from fastapi.testclient import TestClient

from tests.conftest import auth_header, signup


def test_signup_login_me_logout_and_refresh(client: TestClient) -> None:
    tokens = signup(client)
    me = client.get("/api/v1/auth/me", headers=auth_header(tokens["access_token"]))
    assert me.status_code == 200
    body = me.json()
    assert body["role_name"] == "ADMIN"
    assert "users:create" in body["permissions"]

    login = client.post(
        "/api/v1/auth/login",
        json={"email": tokens["email"], "password": tokens["password"]},
    )
    assert login.status_code == 200

    refresh = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert refresh.status_code == 200

    logout = client.post("/api/v1/auth/logout", headers=auth_header(tokens["access_token"]))
    assert logout.status_code == 200
    revoked = client.get("/api/v1/auth/me", headers=auth_header(tokens["access_token"]))
    assert revoked.status_code == 401


def test_forgot_and_reset_password(client: TestClient) -> None:
    tokens = signup(client)
    forgot = client.post("/api/v1/auth/forgot-password", json={"email": tokens["email"]})
    assert forgot.status_code == 200
    message = forgot.json()["message"]
    assert "Reset token:" in message
    token = message.split("Reset token: ", 1)[1]
    reset = client.post(
        "/api/v1/auth/reset-password",
        json={"token": token, "new_password": "NewPassword123!"},
    )
    assert reset.status_code == 200
    old_login = client.post(
        "/api/v1/auth/login",
        json={"email": tokens["email"], "password": tokens["password"]},
    )
    assert old_login.status_code == 401
    new_login = client.post(
        "/api/v1/auth/login",
        json={"email": tokens["email"], "password": "NewPassword123!"},
    )
    assert new_login.status_code == 200


def test_user_cannot_create_users(client: TestClient) -> None:
    admin = signup(client)
    created = client.post(
        "/api/v1/users",
        headers=auth_header(admin["access_token"]),
        json={
            "email": f"user-{admin['organization_code'].lower()}@example.com",
            "password": "Password123!",
            "full_name": "Standard User",
            "role_name": "USER",
        },
    )
    assert created.status_code == 201
    login = client.post(
        "/api/v1/auth/login",
        json={"email": created.json()["email"], "password": "Password123!"},
    )
    assert login.status_code == 200
    forbidden = client.post(
        "/api/v1/users",
        headers=auth_header(login.json()["access_token"]),
        json={
            "email": "another@example.com",
            "password": "Password123!",
            "full_name": "Nope",
            "role_name": "USER",
        },
    )
    assert forbidden.status_code == 403
