"""Database failures must not masquerade as successful durable storage."""
from types import SimpleNamespace

import pytest
from fastapi import HTTPException
from test_regressions import api, client
from test_audit_regressions import ready_user


def broken_database(monkeypatch):
    def connect(*args, **kwargs):
        raise OSError('private connection details')
    monkeypatch.setattr(api, 'PERSISTENCE_ENABLED', True)
    monkeypatch.setattr(api, 'psycopg', SimpleNamespace(connect=connect))


def test_save_failure_returns_service_unavailable(monkeypatch):
    broken_database(monkeypatch)
    with pytest.raises(HTTPException) as error:
        api._db_save()
    assert error.value.status_code == 503
    assert 'private connection details' not in error.value.detail


def test_startup_does_not_ignore_database_failure(monkeypatch):
    broken_database(monkeypatch)
    with pytest.raises(RuntimeError, match='restore'):
        api.load_persisted_state()


def test_configured_database_requires_driver(monkeypatch):
    monkeypatch.setattr(api, 'DATABASE_URL', 'postgresql://configured')
    monkeypatch.setattr(api, 'psycopg', None)
    monkeypatch.setattr(api, 'PERSISTENCE_ENABLED', False)
    with pytest.raises(RuntimeError, match='driver'):
        api.load_persisted_state()


def test_invalid_snapshot_does_not_partially_replace_state(monkeypatch):
    rows = [('user_accounts', {'restored': {}}), ('user_profiles', [])]
    class Connection:
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def execute(self, *args): return self
        def fetchall(self): return rows
    monkeypatch.setattr(api, 'PERSISTENCE_ENABLED', True)
    monkeypatch.setattr(api, '_db_init', lambda: None)
    monkeypatch.setattr(api, 'psycopg', SimpleNamespace(connect=lambda *a, **k: Connection()))
    monkeypatch.setattr(api, 'user_accounts', {'original': {}})
    with pytest.raises(RuntimeError, match='restore'):
        api._db_load()
    assert api.user_accounts == {'original': {}}


def test_http_write_does_not_report_success_on_database_failure(client, monkeypatch):
    _, headers = ready_user(client, 'persistence_test')
    broken_database(monkeypatch)
    response = client.post('/api/v1/security/identity/request',
                           headers=headers, json={'method': 'DOCUMENT_PROVIDER'})
    assert response.status_code == 503
    assert 'private connection details' not in response.text


def test_valid_snapshot_restores_containers_in_place(monkeypatch):
    accounts = {'old': {}}
    events = []
    class Connection:
        def __enter__(self): return self
        def __exit__(self, *args): pass
        def execute(self, *args): return self
        def fetchall(self):
            return [('user_accounts', {'restored': {'role': 'student'}}),
                    ('activity_log', [{'type': 'restored'}])]
    monkeypatch.setattr(api, 'PERSISTENCE_ENABLED', True)
    monkeypatch.setattr(api, '_db_init', lambda: None)
    monkeypatch.setattr(api, 'psycopg', SimpleNamespace(connect=lambda *a, **k: Connection()))
    monkeypatch.setattr(api, 'user_accounts', accounts)
    monkeypatch.setattr(api, 'activity_log', events)
    api._db_load()
    assert api.user_accounts is accounts
    assert accounts == {'restored': {'role': 'student'}}
    assert api.activity_log is events
    assert events == [{'type': 'restored'}]
