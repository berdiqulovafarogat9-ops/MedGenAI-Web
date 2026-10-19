"""Readiness failures must reach cross-origin clients, including Learning Hub."""
import pytest
from test_regressions import api, client, _register_and_login
from test_audit_regressions import ready_user

ORIGIN='https://medgen-web.onrender.com'

@pytest.mark.parametrize('gate', ['profile', 'consent'])
def test_hub_readiness_error_is_readable_by_browser(client, gate):
    if gate == 'profile':
        _, headers = _register_and_login(client, 'cors_profile')
        expected = 'PROFILE_INCOMPLETE'
    else:
        username, headers = ready_user(client, 'cors_consent')
        api.user_consents.pop(username)
        expected = 'LEGAL_CONSENT_REQUIRED'
    headers['Origin'] = ORIGIN
    response = client.get('/api/v1/learning-hub/progress', headers=headers)
    assert response.status_code == 403
    assert response.json()['detail'] == expected
    assert response.headers.get('access-control-allow-origin') == ORIGIN


def test_cors_does_not_grant_untrusted_origin(client):
    _, headers = _register_and_login(client, 'cors_untrusted')
    headers['Origin'] = 'https://untrusted.invalid'
    response = client.get('/api/v1/learning-hub/progress', headers=headers)
    assert response.status_code == 403
    assert 'access-control-allow-origin' not in response.headers
