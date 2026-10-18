import uuid
import pytest
from fastapi import HTTPException
from test_regressions import api, client
from test_audit_regressions import ready_user

BASE='/api/v1/learning-hub'

def payload(activity='theory'):
    key=api.HUB_ANSWER_KEYS[activity]
    return {'attempt_id':str(uuid.uuid4()),'activity':activity,'answers':key[:],
            'question_ids':list(range(len(key))),'version':1}

@pytest.mark.parametrize('activity', ['quick','theory','clinical','molecule'])
def test_grading_replay_and_user_isolation(client, activity):
    _, h=ready_user(client,'hub_alice')
    _, other=ready_user(client,'hub_bob')
    p=payload(activity)
    p['answers'][0]=(p['answers'][0]+1)%3
    p['score']=999
    r=client.post(BASE+'/attempts',headers=h,json=p)
    assert r.status_code==200, r.text
    assert r.json()['attempt']['score']==len(p['answers'])-1
    assert client.post(BASE+'/attempts',headers=h,json=p).json()==r.json()
    progress=client.get(BASE+'/progress',headers=h).json()
    assert len(progress['attempts'])==1
    assert progress['official_credit'] is False
    assert client.get(BASE+'/progress',headers=other).json()['attempts']==[]
    p['answers'][0]=2 if p['answers'][0]!=2 else 0
    assert client.post(BASE+'/attempts',headers=h,json=p).status_code==409

@pytest.mark.parametrize('field,value', [('answers',[0]),('answers',[9]*5),
    ('question_ids',[0]*5),('activity','unknown'),('version',2),('answers',[True]*5)])
def test_invalid_attempt_rejected(client,field,value):
    _,h=ready_user(client)
    p=payload();p[field]=value
    assert client.post(BASE+'/attempts',headers=h,json=p).status_code in (400,422)
    assert client.get(BASE+'/progress',headers=h).json()['attempts']==[]

def test_save_failure_does_not_create_false_success_on_retry(client,monkeypatch):
    _,h=ready_user(client)
    def fail():raise HTTPException(status_code=503,detail='unavailable')
    monkeypatch.setattr(api,'_db_save',fail)
    p=payload()
    for _ in range(2):
        assert client.post(BASE+'/attempts',headers=h,json=p).status_code==503
        assert client.get(BASE+'/progress',headers=h).json()['attempts']==[]
    monkeypatch.setattr(api,'_db_save',lambda:None)
    assert client.post(BASE+'/attempts',headers=h,json=p).status_code==200

def test_shuffled_question_order(client):
    _,h=ready_user(client)
    p=payload('molecule');p['question_ids'].reverse();p['answers'].reverse()
    assert client.post(BASE+'/attempts',headers=h,json=p).json()['attempt']['score']==5

def test_auth_required(client):
    assert client.get(BASE+'/progress').status_code in (401,403)
    assert client.post(BASE+'/attempts',json=payload()).status_code in (401,403)

@pytest.mark.parametrize('activity', ['organ','lesson_cell','lesson_blood','lesson_heart','lesson_dna','lesson_micro'])
def test_remaining_scored_activities(client,activity):
    _,h=ready_user(client)
    p=payload(activity)
    r=client.post(BASE+'/attempts',headers=h,json=p)
    assert r.status_code==200, r.text
    assert r.json()['attempt']['percent']==100

def test_partial_organ_result(client):
    _,h=ready_user(client)
    p=payload('organ');p['answers']=[1,-1,-1,-1,-1]
    r=client.post(BASE+'/attempts',headers=h,json=p)
    assert r.json()['attempt']['score']==1
    assert r.json()['attempt']['total']==5

def test_language_reading_is_ungraded_private_and_retryable(client,monkeypatch):
    _,h=ready_user(client,'reader')
    _,other=ready_user(client,'other_reader')
    p={'language':'en','track':'medical'}
    def fail():raise HTTPException(status_code=503,detail='unavailable')
    monkeypatch.setattr(api,'_db_save',fail)
    assert client.post(BASE+'/readings',headers=h,json=p).status_code==503
    assert client.get(BASE+'/progress',headers=h).json()['readings']=={}
    monkeypatch.setattr(api,'_db_save',lambda:None)
    assert client.post(BASE+'/readings',headers=h,json=p).json()['reading']['self_reported'] is True
    assert list(client.get(BASE+'/progress',headers=h).json()['readings'])==['en:medical']
    assert client.get(BASE+'/progress',headers=other).json()['readings']=={}
    assert client.post(BASE+'/readings',headers=h,json={'language':'bogus','track':'medical'}).status_code==400
