"""Regression tests for core profile, consent, and middleware behavior."""
import importlib
import os
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(BACKEND))

os.environ.setdefault("MEDGEN_ADMIN_PASSWORD", "ci-test-only-password")
os.environ.setdefault("MEDGEN_SECRET_KEY", "ci-test-only-secret-key")

import main as api  # noqa: E402


@pytest.fixture()
def client():
    # Reset process-local state to make each test independent.
    for name in (
        "tokens", "token_created_at", "revoked_tokens", "user_accounts",
        "user_profiles", "user_consents", "login_attempts", "activity_log",
        "role_requests_store",
    ):
        value = getattr(api, name, None)
        if hasattr(value, "clear"):
            value.clear()
    with TestClient(api.app) as test_client:
        yield test_client


def _register_and_login(client, username="regression_student"):
    response = client.post("/api/v1/auth/register", json={
        "username": username,
        "password": "Long-Test-Password-123!",
        "full_name": "Regression Student",
        "email": f"{username}@example.org",
        "role": "student",
    })
    # Some deployments may intentionally disable public registration.
    if response.status_code not in (200, 201):
        pytest.skip(f"Registration unavailable in this configuration: {response.status_code}")
    login = client.post("/api/v1/auth/login", json={
        "username": username,
        "password": "Long-Test-Password-123!",
    })
    assert login.status_code == 200, login.text
    token = login.json().get("access_token") or login.json().get("token")
    assert token
    return username, {"Authorization": f"Bearer {token}"}


def test_health_endpoint_is_public(client):
    response = client.get("/api/v1/health/live")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_profile_update_preserves_server_managed_fields(client):
    username, headers = _register_and_login(client)
    api.user_profiles[username].update({
        "role": "student",
        "approved_roles": ["student"],
        "role_status": "active",
        "academic_profile": {"university": "Test University", "year": 2},
        "education_preferences": {"mode": "GLOBAL", "country_code": "INTL"},
    })
    payload = {
        "full_name": "Regression Student",
        "email": "student@example.org",
        "organization": "Test University",
        "country": "Uzbekistan",
        "region": "Tashkent",
        "district": "Yunusabad",
        "city": "Tashkent",
        "birth_year": 2000,
        "birth_month": 1,
        "birth_day": 15,
        "research_interests": "",
        "bio": "",
        "avatar": "",
    }
    response = client.put("/api/v1/profile", json=payload, headers=headers)
    assert response.status_code == 200, response.text
    profile = response.json()["profile"]
    assert profile["role"] == "student"
    assert profile["approved_roles"] == ["student"]
    assert profile["role_status"] == "active"
    assert profile["academic_profile"]["university"] == "Test University"
    assert profile["education_preferences"]["country_code"] == "INTL"


def test_consent_is_saved_to_persistent_store(client, monkeypatch):
    username, headers = _register_and_login(client, username="consent_student")
    saved = []
    monkeypatch.setattr(api, "_db_save", lambda: saved.append(True))
    response = client.post("/api/v1/legal/consent", headers=headers, json={
        "terms_accepted": True,
        "privacy_accepted": True,
        "data_processing_accepted": True,
        "research_disclaimer_accepted": True,
    })
    assert response.status_code == 200, response.text
    assert api.user_consents[username]["terms_accepted"] is True
    assert saved, "Consent handler must invoke the persistence layer"


def test_incomplete_profile_middleware_returns_json_not_server_error(client):
    username, headers = _register_and_login(client, username="incomplete_student")
    api.user_profiles[username] = {"full_name": "Incomplete"}
    response = client.get("/api/v1/molecules/analyze", headers=headers)
    # The guard should return the documented readiness response, not NameError.
    assert response.status_code == 403
    assert response.json()["detail"] == "PROFILE_INCOMPLETE"


def test_required_frontend_origins_survive_custom_cors_setting():
    origins = api._build_allowed_cors_origins("https://custom.example.org")
    assert "https://medgen-web.onrender.com" in origins
    assert "https://medgenai-web-1.onrender.com" in origins
    assert "https://custom.example.org" in origins
    assert "http://localhost:3000" not in origins


def test_login_accepts_username_with_different_case(client):
    username, _ = _register_and_login(client, username="CaseStudent")
    response = client.post("/api/v1/auth/login", json={
        "username": username.lower(),
        "password": "Long-Test-Password-123!",
    })
    assert response.status_code == 200, response.text
    assert response.json().get("access_token")


def test_registration_invalid_academic_year_does_not_create_partial_account(client):
    response = client.post("/api/v1/auth/register", json={
        "username": "partial_student",
        "password": "Long-Test-Password-123!",
        "full_name": "Partial Student",
        "email": "partial@example.org",
        "role": "student",
        "academic_year": 7,
    })
    assert response.status_code == 400
    assert "partial_student" not in api.user_accounts
    assert "partial_student" not in api.user_profiles


def test_registration_rejects_username_case_collision(client):
    first = client.post("/api/v1/auth/register", json={
        "username": "UniqueStudent",
        "password": "Long-Test-Password-123!",
        "full_name": "Unique Student",
        "email": "unique@example.org",
        "role": "student",
    })
    if first.status_code not in (200, 201):
        pytest.skip(f"Registration unavailable in this configuration: {first.status_code}")
    second = client.post("/api/v1/auth/register", json={
        "username": "uniquestudent",
        "password": "Long-Test-Password-123!",
        "full_name": "Duplicate Student",
        "email": "duplicate@example.org",
        "role": "student",
    })
    assert second.status_code == 409
