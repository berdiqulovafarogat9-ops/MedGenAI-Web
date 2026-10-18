"""Knowledge graph reads, imports and mutations are private to each owner."""
import pytest
from test_regressions import api, client
from test_audit_regressions import ready_user

BASE = '/api/v1/knowledge'

@pytest.fixture()
def graph_users(client, monkeypatch):
    monkeypatch.setattr(api, 'knowledge_entities_store', [])
    monkeypatch.setattr(api, 'knowledge_relations_store', [])
    a, ha = ready_user(client, 'graph_alice')
    b, hb = ready_user(client, 'graph_bob')
    r = client.post(BASE+'/relations', headers=ha, json={
        'subject': 'secret molecule', 'relation': 'targets', 'object': 'private target',
        'evidence': 'confidential evidence'})
    assert r.status_code == 200
    return a, ha, b, hb

@pytest.mark.parametrize('path', ['/graph', '/export', '/stats', '/validate',
                                  '/evidence', '/neighborhood/secret%20molecule'])
def test_other_user_cannot_read_graph(client, graph_users, path):
    _, ha, _, hb = graph_users
    response = client.get(BASE+path, headers=hb)
    assert response.status_code == 200
    assert 'confidential evidence' not in response.text
    if path in ['/graph', '/export', '/neighborhood/secret%20molecule']:
        assert response.json()['entities'] == []
        assert response.json()['relations'] == []
    elif path == '/stats':
        assert response.json()['entities'] == 0
    elif path == '/validate':
        assert response.json()['entity_count'] == 0
    else:
        assert response.json()['evidence'] == []
    assert client.get(BASE+'/graph', headers=ha).json()['entity_count'] == 2


def test_search_paths_and_foreign_delete(client, graph_users):
    _, ha, _, hb = graph_users
    assert client.post(BASE+'/search', headers=hb, json={'query': 'secret'}).json()['entities'] == []
    payload = {'start': 'secret molecule', 'end': 'private target'}
    assert client.post(BASE+'/paths', headers=hb, json=payload).json()['paths'] == []
    assert client.post(BASE+'/paths', headers=ha, json=payload).json()['count'] == 1
    assert client.delete(BASE+'/entities/secret%20molecule', headers=hb).status_code == 404
    assert client.get(BASE+'/graph', headers=ha).json()['relation_count'] == 1


def test_same_ids_and_import_owner_spoofing(client, graph_users):
    a, ha, b, hb = graph_users
    payload = {'entities': [{'name': 'secret molecule', 'owner': a}],
               'relations': [{'subject': 'secret molecule', 'relation': 'targets',
                              'object': 'private target', 'owner': a}]}
    assert client.post(BASE+'/import', headers=hb, json=payload).status_code == 200
    graph = client.get(BASE+'/export', headers=hb).json()
    assert all(x['owner'] == b for x in graph['entities']+graph['relations'])
    assert client.delete(BASE+'/entities/secret%20molecule', headers=hb).status_code == 200
    assert client.get(BASE+'/graph', headers=ha).json()['entity_count'] == 2
    assert client.get(BASE+'/graph', headers=ha).json()['relation_count'] == 1


def test_legacy_rows_not_exposed_or_deleted(client, graph_users):
    _, ha, _, hb = graph_users
    legacy = {'id': 'legacy', 'name': 'legacy'}
    api.knowledge_entities_store.append(legacy)
    for h in (ha, hb):
        assert legacy not in client.get(BASE+'/export', headers=h).json()['entities']
        assert client.delete(BASE+'/entities/legacy', headers=h).status_code == 404
    assert legacy in api.knowledge_entities_store


def test_rename_keeps_graph_owner(client, graph_users):
    _, ha, _, hb = graph_users
    response = client.patch('/api/v1/account', headers=ha, json={'username': 'graph_renamed'})
    assert response.status_code == 200, response.text
    graph = client.get(BASE+'/graph', headers=ha).json()
    assert graph['entity_count'] == 2
    assert all(e['owner'] == 'graph_renamed' for e in graph['entities'])
    assert client.get(BASE+'/graph', headers=hb).json()['entity_count'] == 0


def test_api_key_stats_use_creator_scope(client, graph_users, monkeypatch):
    a, _, b, _ = graph_users
    monkeypatch.setattr(api, '_api_key_context', lambda request: {'created_by': b, 'organization_id': 'org'})
    assert api.public_knowledge_stats(None)['entities'] == 0
    monkeypatch.setattr(api, '_api_key_context', lambda request: {'created_by': a, 'organization_id': 'org'})
    assert api.public_knowledge_stats(None)['entities'] == 2


@pytest.mark.parametrize('function', ['research_agent', 'autonomous_research'])
def test_research_writes_owned_graph(client, graph_users, monkeypatch, function):
    a, _, b, _ = graph_users
    monkeypatch.setattr(api, '_pubmed_articles', lambda *args: [])
    monkeypatch.setattr(api, 'reports_store', [])
    for name in (a, b):
        getattr(api, function)(api.ResearchAgentRequest(query='same private question'),
                               {'username': name, 'role': 'student'})
    for name in (a, b):
        entities, _ = api._knowledge_scope(name)
        assert any(e['id'] == 'same private question' for e in entities)
