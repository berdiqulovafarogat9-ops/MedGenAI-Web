"""Retired school features cannot be recreated through direct API calls."""
from copy import deepcopy

import pytest

from test_regressions import api, client
from test_audit_regressions import ready_user


@pytest.mark.parametrize('role', ['school_student', 'school_teacher'])
def test_school_roles_cannot_register_or_be_requested(client, role):
    response = client.post('/api/v1/auth/register', json={
        'username': 'retired_school', 'password': 'School-Test-Password-123!',
        'full_name': 'Test User', 'email': 'test@example.org', 'role': role,
        'school_name': 'Old School', 'class_name': '7A',
    })
    assert response.status_code == 400
    assert 'retired_school' not in api.user_accounts
    _, headers = ready_user(client, 'role_requester')
    assert client.post('/api/v1/roles/request', headers=headers, json={'role': role}).status_code == 400


def test_school_routes_removed_without_deleting_archived_records(client):
    _, headers = ready_user(client, 'retirement_reader')
    names = ['school_invitations_store', 'school_directory_store',
             'school_assignments_store', 'school_submissions_store']
    before = {name: deepcopy(getattr(api, name)) for name in names}
    paths = ['/api/v1/admin/school-invitations', '/api/v1/admin/school-management',
             '/api/v1/admin/school-management/example', '/api/v1/admin/school-invitations/revoke',
             '/api/v1/school/assignments', '/api/v1/school/assignments/example/submit',
             '/api/v1/school/submissions', '/api/v1/education/generate-assessment',
             '/api/v1/education/assessment-drafts']
    schema = api.app.openapi()['paths']
    for path in paths:
        assert path not in schema
        for method in ['GET', 'POST', 'PATCH']:
            response = client.request(method, path, headers=headers, json={})
            assert response.status_code == 404, (path, response.text)
    assert before == {name: getattr(api, name) for name in names}


def test_admin_cannot_approve_stale_school_role_request(client):
    request = {'id': 'archived-request', 'username': 'old_school_user',
               'role': 'school_teacher', 'status': 'PENDING'}
    api.role_requests_store.append(request)
    with pytest.raises(api.HTTPException) as exc:
        api.admin_approve_role('archived-request', True, {'username': 'admin', 'role': 'SUPER_ADMIN'})
    assert exc.value.status_code == 400
    assert request['status'] == 'PENDING'
    assert 'old_school_user' not in api.user_profiles
