import pytest
from test_regressions import api, client
from test_audit_regressions import ready_user

@pytest.mark.parametrize('field,value', [('center_x','oops'),('center_y',None),('size_x',0),('size_y',101),('center_z','NaN'),('exhaustiveness',1.5),('n_poses',21)])
def test_docking_invalid_fields_do_not_execute(client,monkeypatch,field,value):
    _,headers=ready_user(client,'job_invalid')
    monkeypatch.setattr(api,'jobs_store',[])
    def unexpected(*args):raise AssertionError('Invalid input reached engine')
    monkeypatch.setattr(api,'_execute_prepared_docking',unexpected)
    payload={'target':'test','receptor_pdbqt':'test','ligand_pdbqt':'test',field:value}
    r=client.post('/api/v1/jobs',headers=headers,json={'job_type':'DOCKING','input':payload})
    assert r.status_code==422,r.text
    assert field in r.json()['detail']
    assert api.jobs_store==[]

def test_job_save_failure_retry_and_ownership(client,monkeypatch):
    name,headers=ready_user(client,'job_save')
    _,other=ready_user(client,'job_other')
    legacy={'id':'legacy'};unrelated={'id':'other','user':'other'}
    monkeypatch.setattr(api,'jobs_store',[legacy])
    original=api._db_save
    def fail():
        api.jobs_store.append(unrelated)
        raise api.HTTPException(503,'Storage unavailable')
    monkeypatch.setattr(api,'_db_save',fail)
    payload={'job_type':'MOLECULAR','input':{'smiles':'CCO'}}
    assert client.post('/api/v1/jobs',headers=headers,json=payload).status_code==503
    assert api.jobs_store==[legacy,unrelated]
    monkeypatch.setattr(api,'_db_save',original)
    r=client.post('/api/v1/jobs',headers=headers,json=payload)
    assert r.status_code==200,r.text
    assert r.json()['status']=='completed'
    assert client.get('/api/v1/jobs',headers=headers).json()['count']==1
    assert client.get('/api/v1/jobs',headers=other).json()['count']==0


@pytest.mark.parametrize('save_fails',[False,True])
def test_docking_job_saves_once_and_rolls_back_together(client,monkeypatch,save_fails):
    name,headers=ready_user(client,'job_atomic')
    monkeypatch.setattr(api,'jobs_store',[])
    monkeypatch.setattr(api,'docking_jobs_store',{})
    monkeypatch.setattr(api,'activity_log',[])
    def compute(data,user,*,persist=True):
        assert persist is False
        return {'job_id':'docking-test','result':{'status':'completed','target':data.target,'user':name}}
    monkeypatch.setattr(api,'_execute_prepared_docking',compute)
    saves=[]
    def save():
        saves.append(1)
        assert len(api.jobs_store)==1
        assert 'docking-test' in api.docking_jobs_store
        assert len(api.activity_log)==1
        if save_fails:
            api.activity_log.append({'type':'unrelated'})
            raise api.HTTPException(503,'Storage unavailable')
    monkeypatch.setattr(api,'_db_save',save)
    payload={'job_type':'DOCKING','input':{'target':'target','receptor_pdbqt':'r','ligand_pdbqt':'l'}}
    r=client.post('/api/v1/jobs',headers=headers,json=payload)
    assert len(saves)==1
    assert r.status_code==(503 if save_fails else 200),r.text
    if save_fails:
        assert api.jobs_store==[]
        assert api.docking_jobs_store=={}
        assert api.activity_log==[{'type':'unrelated'}]
    else:
        assert r.json()['result']['job_id']=='docking-test'
