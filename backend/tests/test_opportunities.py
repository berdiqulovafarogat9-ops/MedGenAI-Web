from datetime import date,timedelta
import pytest
from test_regressions import api, client
from test_audit_regressions import ready_user
from test_teaching_access import admin,professor

@pytest.fixture(autouse=True)
def isolated(monkeypatch): monkeypatch.setattr(api,'opportunities_store',{})

def payload():
    return {'title':'Research scholarship','organization':'Test university',
        'description':'Research opportunity for eligible enrolled students.',
        'deadline':(date.today()+timedelta(days=10)).isoformat(),
        'source_url':'https://example.org/official-scholarship','language':'en'}

def test_professor_submission_requires_admin_review(client):
    _,teacher=professor(client,'opportunity_teacher')
    _,student=ready_user(client,'opportunity_student')
    created=client.post('/api/v1/opportunities',headers=teacher,json=payload())
    assert created.status_code==200,created.text
    item=created.json()['item'];assert item['status']=='pending'
    assert client.get('/api/v1/opportunities',headers=student).json()['items']==[]
    assert client.patch('/api/v1/opportunities/'+item['id']+'?publish=true',headers=teacher).status_code==403
    root=admin(client)
    assert client.patch('/api/v1/opportunities/'+item['id']+'?publish=true',headers=root).status_code==200
    listed=client.get('/api/v1/opportunities',headers=student).json()['items']
    assert len(listed)==1 and listed[0]['status']=='published'

def test_student_cannot_submit_and_invalid_links_rejected(client):
    _,student=ready_user(client,'opportunity_student')
    assert client.post('/api/v1/opportunities',headers=student,json=payload()).status_code==403
    _,teacher=professor(client,'opportunity_teacher')
    for value in ['javascript:alert(1)','http://example.org','https://user:pass@example.org']:
        data=payload();data['source_url']=value
        assert client.post('/api/v1/opportunities',headers=teacher,json=data).status_code==400

def test_failed_save_does_not_publish_or_retain_submission(client,monkeypatch):
    _,teacher=professor(client,'opportunity_teacher')
    def fail():raise api.HTTPException(503,'Unavailable')
    monkeypatch.setattr(api,'_db_save',fail)
    assert client.post('/api/v1/opportunities',headers=teacher,json=payload()).status_code==503
    assert api.opportunities_store=={}
