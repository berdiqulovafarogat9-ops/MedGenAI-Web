import copy
import pytest
from test_regressions import api, client
from test_audit_regressions import ready_user


def articles(*args):
    return [{'pmid':'12345','title':'DNA repair study','journal':'Test journal','publication_date':'2025','abstract':'DNA repair was investigated in this model. Further validation is needed.','url':'https://pubmed.ncbi.nlm.nih.gov/12345/'}]


@pytest.mark.parametrize('endpoint',['agent','autonomous'])
def test_research_report_and_graph_are_saved(client,monkeypatch,endpoint):
    username,headers=ready_user(client,'research_save')
    for name in ['reports_store','knowledge_entities_store','knowledge_relations_store']:
        monkeypatch.setattr(api,name,[])
    monkeypatch.setattr(api,'_pubmed_articles',articles)
    saved=[];monkeypatch.setattr(api,'_db_save',lambda:saved.append(True))
    response=client.post('/api/v1/research/'+endpoint,headers=headers,json={'query':'DNA repair','limit':2})
    assert response.status_code==200,response.text
    assert saved
    assert api.reports_store[0]['user']==username
    assert api.reports_store[0]['report']['evidence'][0]['pmid']=='12345'
    assert len(api.knowledge_entities_store)==2
    assert len(api.knowledge_relations_store)==1


@pytest.mark.parametrize('endpoint',['agent','autonomous'])
def test_research_failed_save_removes_only_own_new_objects(client,monkeypatch,endpoint):
    _,headers=ready_user(client,'research_failure')
    for name in ['reports_store','knowledge_entities_store','knowledge_relations_store']:
        monkeypatch.setattr(api,name,[])
    audit=copy.deepcopy(api.activity_log)
    monkeypatch.setattr(api,'_pubmed_articles',articles)
    unrelated={'id':'another-write','user':'someone_else'}
    def fail():
        api.reports_store.append(unrelated)
        raise api.HTTPException(503,'Storage unavailable')
    monkeypatch.setattr(api,'_db_save',fail)
    response=client.post('/api/v1/research/'+endpoint,headers=headers,json={'query':'DNA repair'})
    assert response.status_code==503
    assert api.reports_store==[unrelated]
    assert api.knowledge_entities_store==[];assert api.knowledge_relations_store==[]
    assert api.activity_log==audit


@pytest.mark.parametrize('payload',[{'query':'x','limit':0},{'query':'x','limit':21},{'query':'x'*3001},{'query':'x','focus':'x'*301}])
def test_research_limits_rejected_before_retrieval(client,monkeypatch,payload):
    _,headers=ready_user(client,'research_limits')
    def unexpected(*args):raise AssertionError('Must not query provider')
    monkeypatch.setattr(api,'_pubmed_articles',unexpected)
    assert client.post('/api/v1/research/agent',headers=headers,json=payload).status_code==422
