"""Unit-level revision protection; real PostgreSQL coverage is separate."""
from types import SimpleNamespace
from unittest.mock import MagicMock
import pytest
from fastapi import HTTPException
from test_regressions import api

@pytest.fixture
def connection(monkeypatch):
    conn=MagicMock()
    conn.__enter__.return_value=conn
    conn.execute.return_value.fetchone.return_value=(7,)
    monkeypatch.setattr(api,'PERSISTENCE_ENABLED',True)
    monkeypatch.setattr(api,'_state_revision',7)
    monkeypatch.setattr(api,'psycopg',SimpleNamespace(connect=lambda *a,**k:conn))
    monkeypatch.setattr(api,'_persistent_stores',lambda:{'user_profiles':{'alice':{'bio':'test'}}})
    return conn

@pytest.mark.parametrize('row', [(8,),None,('7',),(True,)])
def test_stale_missing_or_invalid_revision_never_writes(connection,row):
    connection.execute.return_value.fetchone.return_value=row
    with pytest.raises(HTTPException) as e:api._db_save()
    assert e.value.status_code==503
    assert connection.execute.call_count==1
    connection.commit.assert_not_called()
    assert api._state_revision==7

def test_success_advances_revision_only_after_commit(connection):
    def commit():assert api._state_revision==7
    connection.commit.side_effect=commit
    api._db_save()
    connection.commit.assert_called_once()
    assert api._state_revision==8

@pytest.mark.parametrize('stage',['write','commit'])
def test_failed_write_or_commit_keeps_local_revision(connection,stage):
    if stage=='write':
        first=connection.execute.return_value
        connection.execute.side_effect=[first,OSError('write failed')]
    else:connection.commit.side_effect=OSError('commit failed')
    with pytest.raises(HTTPException):api._db_save()
    assert api._state_revision==7
    # The psycopg connection context receives the error and rolls the transaction back.
    assert connection.__exit__.call_args.args[0] is OSError
