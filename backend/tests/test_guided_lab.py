import copy
import pytest
from test_regressions import api, client
from test_audit_regressions import ready_user


def create(client,headers,payload=None):
    return client.post('/api/v1/lab/pipeline',headers=headers,json=payload or {'target':'Learning example','sequence':'ATGC','ligand_smiles':'CCO','steps':['sequence_analysis','molecular_analysis','report']})


def test_guided_lab_computes_and_appears_in_own_history(client):
    name,headers=ready_user(client,'lab_guided')
    response=create(client,headers);assert response.status_code==200,response.text
    experiment=response.json()['experiment'];eid=experiment['id']
    result=client.post(f'/api/v1/lab/experiments/{eid}/execute',headers=headers)
    assert result.status_code==200,result.text
    data=result.json()['experiment'];assert data['status']=='completed'
    steps={x['step']:x for x in data['results']['steps']}
    assert steps['sequence_analysis']['result']['gc_content_percent']==50
    assert steps['molecular_analysis']['result']['molecular_formula']=='C2H6O'
    assert steps['molecular_analysis']['result']['molecular_weight']==pytest.approx(46.069)
    report=client.post('/api/v1/scientific/reports',headers=headers,json={'experiment_id':eid})
    assert report.status_code==200,report.text
    assert eid in [x['id'] for x in client.get('/api/v1/experiments',headers=headers).json()['experiments']]
    _,other=ready_user(client,'lab_other')
    assert client.post(f'/api/v1/lab/experiments/{eid}/execute',headers=other).status_code==403
    assert eid not in [x['id'] for x in client.get('/api/v1/experiments',headers=other).json()['experiments']]


@pytest.mark.parametrize('payload',[{'target':'empty'},{'target':'bad','sequence':'ATG!'},{'target':'bad','ligand_smiles':'invalid'},{'target':'bad','pdb_id':'12345'}])
def test_invalid_lab_input_creates_no_experiment(client,payload):
    _,headers=ready_user(client,'lab_bad')
    before=copy.deepcopy(api.experiments_store)
    assert create(client,headers,payload).status_code==400
    assert api.experiments_store==before


def test_lab_storage_failure_rolls_back_each_stage(client,monkeypatch):
    _,headers=ready_user(client,'lab_storage')
    def fail():raise api.HTTPException(503,'Storage unavailable')
    original_save=api._db_save
    before=copy.deepcopy(api.experiments_store);audit=copy.deepcopy(api.activity_log)
    monkeypatch.setattr(api,'_db_save',fail)
    assert create(client,headers).status_code==503
    assert api.experiments_store==before;assert api.activity_log==audit
    monkeypatch.setattr(api,'_db_save',original_save)
    eid=create(client,headers).json()['experiment']['id']
    before=copy.deepcopy(api.experiments_store);audit=copy.deepcopy(api.activity_log)
    monkeypatch.setattr(api,'_db_save',fail)
    assert client.post(f'/api/v1/lab/experiments/{eid}/execute',headers=headers).status_code==503
    assert api.experiments_store==before;assert api.activity_log==audit
    reports=copy.deepcopy(api.reports_store)
    assert client.post('/api/v1/scientific/reports',headers=headers,json={'experiment_id':eid}).status_code==503
    assert api.reports_store==reports;assert api.activity_log==audit


def test_legacy_empty_steps_cannot_claim_completed(client):
    _,headers=ready_user(client,'lab_legacy')
    eid=create(client,headers).json()['experiment']['id']
    item=next(e for e in api.experiments_store if e['id']==eid)
    item['results']['steps']=[]
    response=client.post(f'/api/v1/lab/experiments/{eid}/execute',headers=headers)
    assert response.status_code==409
    assert item['status']=='ready'
