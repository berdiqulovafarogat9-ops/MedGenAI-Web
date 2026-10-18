"""Server-side assignment boundaries and dashboard ownership regressions."""
import pytest
from test_audit_regressions import ready_user
from test_regressions import api, client

BASE = '/api/v1/admin/academy/teaching-assignments'
OVERVIEW = '/api/v1/academy/professor/overview'


def admin(client):
    response = client.post('/api/v1/auth/login', json={'username': api.ADMIN_USERNAME, 'password': api.ADMIN_PASSWORD})
    assert response.status_code == 200
    api.user_profiles.setdefault(api.ADMIN_USERNAME, {}).update({
        'role': 'SUPER_ADMIN', 'full_name': 'Test Admin', 'email': 'admin@example.org', 'country': 'UZ',
        'region': 'Test', 'district': 'Test', 'city': 'Test',
        'birth_year': 2000, 'birth_month': 1, 'birth_day': 1})
    api.user_consents[api.ADMIN_USERNAME] = {'version': api.LEGAL_CONSENT_VERSION,
        **dict.fromkeys(['terms_accepted', 'privacy_accepted', 'data_processing_accepted', 'research_disclaimer_accepted'], True)}
    return {'Authorization' : 'Bearer ' + response.json()['access_token']}


def professor(client, name):
    username, headers = ready_user(client, name)
    api.user_profiles[username]['role'] = 'professor'
    return username, headers


def test_assignment_isolation_revocation_and_audit(client, monkeypatch):
    p1, h1 = professor(client, 'prof_one')
    p2, h2 = professor(client, 'prof_two')
    s1, _ = ready_user(client, 'student_one')
    s2, _ = ready_user(client, 'student_two')
    owner = admin(client)
    saved = []
    monkeypatch.setattr(api, '_db_save', lambda: saved.append(True))
    assert client.get(OVERVIEW, headers=h1).json()['students'] == []
    for p, s in [(p1, s1), (p2, s2)]:
        response = client.put(BASE + '/' + p, headers=owner, json={'students': [s, s]})
        assert response.status_code == 200, response.text
        assert response.json()['students'] == [s]
    for headers, expected in [(h1, s1), (h2, s2)]:
        response = client.get(OVERVIEW, headers=headers)
        assert response.status_code == 200, response.text
        assert [s['username'] for s in response.json()['students']] == [expected]
    overview = client.get(OVERVIEW, headers=owner)
    assert overview.status_code == 200, overview.text
    assert len(overview.json()['students']) == 2
    assert 'academy_progress' not in api.user_profiles[s1]
    listing = client.get(BASE, headers=owner)
    assert listing.status_code == 200
    assert len(listing.json()['professors']) == 2
    assert client.put(BASE + '/' + p1, headers=owner, json={'students': []}).status_code == 200
    assert client.get(OVERVIEW, headers=h1).json()['students'] == []
    assert len(saved) == 3
    assert api.activity_log[0]['previous'] == [s1]


def test_only_admin_can_assign_and_validation_is_atomic(client):
    p, prof = professor(client, 'professor_test')
    s, student = ready_user(client, 'student_test')
    owner = admin(client)
    for headers in [prof, student]:
        assert client.get(BASE, headers=headers).status_code == 403
        assert client.put(BASE + '/' + p, headers=headers, json={'students': [s]}).status_code == 403
    assert client.get(OVERVIEW, headers=student).status_code == 403
    assert client.put(BASE + '/' + p, headers=owner, json={'students': [s]}).status_code == 200
    for names in [[s, 'missing'], [p]]:
        assert client.put(BASE + '/' + p, headers=owner, json={'students': names}).status_code == 400
        assert api.user_profiles[p]['teaching_students'] == [s]
    api.user_profiles[s]['role_status'] = 'disabled'
    assert client.get(OVERVIEW, headers=prof).json()['students'] == []


@pytest.mark.parametrize('store', ['jobs', 'workflows', 'experiments', 'reports'])
def test_dashboard_counts_canonical_and_legacy_owners(client, monkeypatch, store):
    username, headers = ready_user(client)
    monkeypatch.setattr(api, store + '_store', [
        {'user': username}, {'username': username}, {'owner': username},
        {'user': 'someone_else'}, {'user': 'someone_else', 'username': username}, {}])
    response = client.get('/api/v1/dashboard/summary', headers=headers)
    assert response.status_code == 200
    assert response.json()['personal'][store] == 3


def test_profile_cannot_self_assign_and_username_change_preserves_grant(client):
    p, prof = professor(client, 'prof_rename')
    s, student = ready_user(client, 'before_rename')
    owner = admin(client)
    payload = {**api.user_profiles[p], 'teaching_students': [s]}
    response = client.put('/api/v1/profile', headers=prof, json=payload)
    assert response.status_code == 200, response.text
    assert api.user_profiles[p].get('teaching_students', []) == []
    assert client.put(BASE + '/' + p, headers=owner, json={'students': [s]}).status_code == 200
    response = client.patch('/api/v1/account', headers=student, json={'username': 'after_rename'})
    assert response.status_code == 200, response.text
    assert api.user_profiles[p]['teaching_students'] == ['after_rename']
