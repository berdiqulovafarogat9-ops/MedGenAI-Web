from types import SimpleNamespace
import copy
import pytest
from test_regressions import api, client, _register_and_login
from test_audit_regressions import ready_user


def test_location_can_be_saved_before_profile_completion(client):
    username, headers = _register_and_login(client, 'location_onboarding')
    response = client.post('/api/v1/security/location', headers=headers,
                           json={'location_lat': 0, 'location_lon': 0})
    assert response.status_code == 200, response.text
    assert api.user_profiles[username]['location_lat'] == 0
    assert api.user_profiles[username]['location_lon'] == 0


def test_location_failure_restores_profile_and_audit(client, monkeypatch):
    username, headers = _register_and_login(client, 'location_failure')
    profile = copy.deepcopy(api.user_profiles[username])
    events = copy.deepcopy(api.activity_log)
    def fail(): raise api.HTTPException(503, 'Storage unavailable')
    monkeypatch.setattr(api, '_db_save', fail)
    response = client.post('/api/v1/security/location', headers=headers,
                           json={'location_lat': 39.65, 'location_lon': 66.96})
    assert response.status_code == 503
    assert api.user_profiles[username] == profile
    assert api.activity_log == events


@pytest.mark.parametrize('language,word', [('uz','Parolingizni'),('en','password'),('ru','пароль')])
def test_assistant_respects_language(client, language, word):
    _, headers = ready_user(client, 'assistant_'+language)
    response = client.post('/api/v1/assistant/chat', headers=headers,
                           json={'message':'login', 'language':language})
    assert response.status_code == 200
    assert word in response.json()['answer']
    assert response.json()['language'] == language


def test_assistant_retrieval_keeps_original_question_and_source(client, monkeypatch):
    _, headers = ready_user(client, 'assistant_sources')
    queries=[]
    def retrieve(query, limit):
        queries.append(query)
        return [{'pmid':'123', 'title':'Original title','url':'https://pubmed.ncbi.nlm.nih.gov/123/'}]
    monkeypatch.setattr(api, '_pubmed_articles', retrieve)
    question='OIVni davolash haqida manbalar top'
    result=client.post('/api/v1/assistant/chat', headers=headers,
        json={'message':question,'language':'uz','search_evidence':True}).json()
    assert result['original_query']==question
    assert result['search_query']=='HIV treatment review'
    assert queries==['HIV treatment review']
    assert result['evidence'][0]['pmid']=='123'
    assert 'tavsiyasi emas' in result['answer']


def test_assistant_no_sources_does_not_claim_evidence(client, monkeypatch):
    _, headers = ready_user(client, 'assistant_empty')
    monkeypatch.setattr(api, '_pubmed_articles', lambda *args: [])
    result=client.post('/api/v1/assistant/chat',headers=headers,
        json={'message':'unmatched topic','language':'en','search_evidence':True}).json()
    assert result['evidence']==[]
    assert result['answer'].startswith('No PubMed sources')


def test_alphafold_existing_model_and_confidence(monkeypatch):
    import json
    calls=[]
    class Response:
        def __init__(self,body): self.body=body
        def __enter__(self): return self
        def __exit__(self,*args): pass
        def read(self,*args): return self.body
    def fetch(request, **kwargs):
        calls.append(request.full_url)
        if '/api/prediction/' in request.full_url:
            return Response(json.dumps([{'uniprotAccession':'P69905','entryId':'AF-P69905-F1',
                'pdbUrl':'https://alphafold.ebi.ac.uk/files/AF-P69905-F1-model_v6.pdb','globalMetricValue':98.06}]).encode())
        return Response(b'ATOM      1  N   VAL A   1      10.000  10.000  10.000\n')
    monkeypatch.setattr(api,'urlopen',fetch)
    result=api._alphafold_model('p69905')
    assert result['mean_plddt']==98.06
    assert result['model_type']=='predicted'
    assert len(calls)==2


def test_alphafold_rejects_unsafe_model_url(monkeypatch):
    import json
    class Response:
        def __enter__(self): return self
        def __exit__(self,*args): pass
        def read(self,*args): return json.dumps([{'uniprotAccession':'P69905','pdbUrl':'http://127.0.0.1/private'}]).encode()
    monkeypatch.setattr(api,'urlopen',lambda *a,**k:Response())
    with pytest.raises(api.HTTPException) as error: api._alphafold_model('P69905')
    assert error.value.status_code==502
