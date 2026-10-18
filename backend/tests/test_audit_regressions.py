"""HTTP regressions for the initial MedGen audit; no production services used."""
import pytest
from test_regressions import api, client, _register_and_login


def ready_user(client, username="audit_student"):
    username, headers = _register_and_login(client, username)
    api.user_profiles[username].update({
        "country": "UZ", "region": "Test", "district": "Test", "city": "Test",
        "birth_year": 2000, "birth_month": 1, "birth_day": 1,
        "academic_profile": {"university": "Test", "faculty": "Test", "major": "Test", "group": "Test", "year": 1},
    })
    api.user_consents[username] = {"version": api.LEGAL_CONSENT_VERSION,
        **dict.fromkeys(["terms_accepted", "privacy_accepted", "data_processing_accepted", "research_disclaimer_accepted"], True)}
    return username, headers


@pytest.mark.parametrize("method,path,payload", [
    ("GET", "/api/v1/academy/v2/subject/1/Anatomy", None),
    ("POST", "/api/v1/academy/v2/assessment/submit", {"course": 1, "subject_id": "Anatomy", "assessment_type": "theory", "answers": {"completion": 1}}),
    ("POST", "/api/v1/academy/lesson/complete", {"course": 1, "subject_id": "Anatomy", "lesson_id": "1-Anatomy-theory-1"}),
])
def test_extension_learning_requires_academic_approval(client, method, path, payload):
    username, headers = ready_user(client)
    response = client.request(method, path, headers=headers, json=payload)
    assert response.status_code == 403, response.text
    assert response.json()["detail"] == "ACADEMIC_APPROVAL_REQUIRED"
    assert not api.user_profiles[username].get("academy_progress")
    api.user_profiles[username]["academic_status"] = "approved"
    assert client.request(method, path, headers=headers, json=payload).status_code == 200


def test_knowledge_paths_works_with_docker_import_mode(client, monkeypatch):
    username, headers = ready_user(client)
    monkeypatch.setattr(api, "knowledge_entities_store", [{"id": "a", "owner": username}, {"id": "b", "owner": username}])
    monkeypatch.setattr(api, "knowledge_relations_store", [{"subject": "a", "object": "b", "relation": "targets", "owner": username}])
    response = client.post("/api/v1/knowledge/paths", headers=headers, json={"start": "a", "end": "b"})
    assert response.status_code == 200
    assert response.json()["paths"] == [["a", "b"]]


def test_scientific_workflow_saved_and_isolated(client, monkeypatch):
    username, headers = ready_user(client)
    monkeypatch.setattr(api, "experiments_store", [])
    saved = []
    monkeypatch.setattr(api, "_db_save", lambda: saved.append(True))
    response = client.post("/api/v1/scientific/workflow", headers=headers,
        json={"target": "test", "sequence": "ATGC", "ligand_smiles": "CCO"})
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["molecule"]["canonical_smiles"] == "CCO"
    experiment_id = result["experiment_id"]
    detail = client.get(f"/api/v1/experiments/{experiment_id}", headers=headers)
    assert detail.status_code == 200
    assert detail.json()["user"] == username
    assert detail.json()["results"]["experiment_id"] == experiment_id
    assert client.get("/api/v1/experiments", headers=headers).json()["count"] == 1
    _, other = ready_user(client, "other_student")
    assert client.get(f"/api/v1/experiments/{experiment_id}", headers=other).status_code == 403
    assert client.get("/api/v1/experiments", headers=other).json()["count"] == 0
    assert saved


@pytest.mark.parametrize("role", sorted(api.ALLOWED_USER_ROLES))
def test_each_role_keeps_server_dashboard_identity_and_cannot_read_admin(client, role):
    username = "audit_" + role
    registration = client.post("/api/v1/auth/register", json={
        "username": username, "password": "Audit-Test-Password-123!", "full_name": "Audit Test",
        "email": username + "@example.org", "role": role, "school_name": "Test School", "class_name": "7A",
    })
    assert registration.status_code == 200
    if role.startswith("school_"):
        # School approval is simulated only in this isolated test process.
        assert api.user_profiles[username]["role_status"] == "pending"
        api.user_profiles[username].update(role_status="active", school_status="approved")
    login = client.post("/api/v1/auth/login", json={"username": username, "password": "Audit-Test-Password-123!"})
    assert login.status_code == 200
    headers = {"Authorization": "Bearer " + login.json()["access_token"]}
    assert client.get("/api/v1/auth/me", headers=headers).json()["role"] == role
    assert client.get("/api/v1/dashboard/summary", headers=headers).json()["role"] == role
    assert client.get("/api/v1/admin/users", headers=headers).status_code == 403
    assert client.post("/api/v1/auth/logout", headers=headers).status_code == 200
    assert client.get("/api/v1/auth/me", headers=headers).status_code == 401


def test_owner_admin_access(client):
    response = client.post("/api/v1/auth/login", json={"username": api.ADMIN_USERNAME, "password": api.ADMIN_PASSWORD})
    assert response.status_code == 200
    headers = {"Authorization": "Bearer " + response.json()["access_token"]}
    assert client.get("/api/v1/auth/me", headers=headers).json()["role"] == "SUPER_ADMIN"
    assert client.get("/api/v1/admin/users", headers=headers).status_code == 200
