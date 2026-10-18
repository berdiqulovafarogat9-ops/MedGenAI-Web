"""Opt-in real PostgreSQL checks in a private temporary schema on localhost only.
Run with MEDGEN_TEST_DATABASE_URL; no production DATABASE_URL is used.
"""
import os
import uuid
import pytest
from fastapi import HTTPException
from test_regressions import api

@pytest.fixture
def postgres(monkeypatch):
    url=os.getenv('MEDGEN_TEST_DATABASE_URL')
    if not url:pytest.skip('MEDGEN_TEST_DATABASE_URL not configured')
    psycopg=pytest.importorskip('psycopg')
    from psycopg.conninfo import conninfo_to_dict,make_conninfo
    args=conninfo_to_dict(url)
    if args.get('host') not in {'localhost','127.0.0.1','::1'}:
        pytest.fail('Integration tests require an explicit localhost database')
    schema='medgen_test_'+uuid.uuid4().hex
    with psycopg.connect(url,autocommit=True) as conn:
        conn.execute('CREATE SCHEMA '+schema)
    scoped=make_conninfo(url,options='-csearch_path='+schema)
    monkeypatch.setattr(api,'psycopg',psycopg)
    monkeypatch.setattr(api,'DATABASE_URL',scoped)
    monkeypatch.setattr(api,'PERSISTENCE_ENABLED',True)
    monkeypatch.setattr(api,'_state_revision',0)
    stores={'user_profiles':{},'activity_log':[]}
    monkeypatch.setattr(api,'_persistent_stores',lambda:stores)
    try:
        api._db_load()
        yield psycopg,scoped,stores
    finally:
        with psycopg.connect(url,autocommit=True) as conn:
            conn.execute('DROP SCHEMA '+schema+' CASCADE')


def test_real_restore_and_stale_writer_rejection(postgres):
    pg,url,stores=postgres
    stores['user_profiles']['alice']={'learning_hub_attempts':[{'score':4}]}
    api._db_save()
    stores['user_profiles'].clear()
    api._db_load()
    assert stores['user_profiles']['alice']['learning_hub_attempts']==[{'score':4}]
    with pg.connect(url) as conn:
        conn.execute("UPDATE medgen_state SET state_value='2'::jsonb WHERE state_key='__revision'")
    stores['user_profiles']['alice']['learning_hub_attempts']=[]
    with pytest.raises(HTTPException):api._db_save()
    with pg.connect(url) as conn:
        value=conn.execute("SELECT state_value FROM medgen_state WHERE state_key='user_profiles'").fetchone()[0]
    assert value['alice']['learning_hub_attempts']==[{'score':4}]


def test_real_mid_snapshot_failure_rolls_back(postgres):
    pg,url,stores=postgres
    stores['user_profiles']['alice']={'bio':'before'}
    api._db_save()
    with pg.connect(url) as conn:
        conn.execute("ALTER TABLE medgen_state ADD CONSTRAINT reject_events CHECK (state_key <> 'activity_log' OR state_value = '[]'::jsonb)")
    stores['user_profiles']['alice']['bio']='unsaved'
    stores['activity_log'].append({'event':'rejected'})
    with pytest.raises(HTTPException):api._db_save()
    with pg.connect(url) as conn:
        rows=dict(conn.execute('SELECT state_key,state_value FROM medgen_state').fetchall())
    assert rows['user_profiles']['alice']['bio']=='before'
    assert rows['__revision']==1
