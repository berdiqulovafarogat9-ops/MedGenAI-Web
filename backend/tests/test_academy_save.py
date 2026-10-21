import copy
import pytest
from test_regressions import api, client
from test_audit_regressions import ready_user

@pytest.mark.parametrize('route',['/api/v1/academy/assessment/submit','/api/v1/academy/v2/assessment/submit'])
@pytest.mark.parametrize('existing',[False,True])
def test_assessment_storage_failure_restores_progress_and_retry(client,monkeypatch,route,existing):
    name,headers=ready_user(client,'academy_save')
    api.user_profiles[name]['academic_status']='approved'
    payload={'course':1,'subject_id':'Anatomy','assessment_type':'theory','answers':{'completion':1}}
    if existing:
        api.user_profiles[name]['academy_progress']={'1:Anatomy':{'theory':{'score':0,'passed':False,'attempts':2,'updated_at':'earlier'}}}
    before=copy.deepcopy(api.user_profiles[name])
    save=api._db_save
    def fail():raise api.HTTPException(503,'Storage unavailable')
    monkeypatch.setattr(api,'_db_save',fail)
    response=client.post(route,headers=headers,json=payload)
    assert response.status_code==503,response.text
    assert api.user_profiles[name]==before
    monkeypatch.setattr(api,'_db_save',save)
    response=client.post(route,headers=headers,json=payload)
    assert response.status_code==200,response.text
    record=response.json()['progress']['theory']
    assert record['score']==100
    assert record['attempts']==(3 if existing else 1)


def test_failed_assessment_preserves_unrelated_progress(monkeypatch):
    monkeypatch.setattr(api,'user_profiles',{'student':{}})
    def fail():
        api.user_profiles['student']['academy_progress']['1:Anatomy']['quiz']={'score':80}
        raise api.HTTPException(503,'Storage unavailable')
    monkeypatch.setattr(api,'_db_save',fail)
    with pytest.raises(api.HTTPException):api._save_academy_assessment('student',1,'Anatomy','theory',100)
    assert api.user_profiles['student']['academy_progress']=={'1:Anatomy':{'quiz':{'score':80}}}
