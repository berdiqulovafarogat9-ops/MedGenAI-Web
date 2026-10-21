"""Scientific workflows must not manufacture successful or durable results."""
import pytest
from test_regressions import api, client
from test_audit_regressions import ready_user


@pytest.mark.parametrize('inputs', [
    {}, {'sequence': '   '}, {'sequence': 'ATG123!'},
    {'sequence': '>first\nATG\n>second\nCCC'},
    {'ligand_smiles': 'not-smiles'},
    {'sequence': 'ATGC', 'similarity_library': ['CCO']},
    {'ligand_smiles': 'CCO', 'similarity_library': ['CCO', 'invalid']},
])
def test_invalid_workflow_never_publishes_experiment(client, monkeypatch, inputs):
    _, headers = ready_user(client, 'workflow_invalid')
    monkeypatch.setattr(api, 'experiments_store', [])
    response = client.post('/api/v1/scientific/workflow', headers=headers,
                           json={'target': 'reference', **inputs})
    assert response.status_code == 400, response.text
    assert api.experiments_store == []


def test_fasta_and_similarity_are_analyzed_without_dropping_inputs(client, monkeypatch):
    _, headers = ready_user(client, 'workflow_valid')
    monkeypatch.setattr(api, 'experiments_store', [])
    response = client.post('/api/v1/scientific/workflow', headers=headers, json={
        'target': 'reference', 'sequence': '>example\nAT GC',
        'ligand_smiles': 'CCO', 'similarity_library': ['OCC', 'CC'],
    })
    assert response.status_code == 200, response.text
    result = response.json()
    assert result['sequence']['sequence'] == 'ATGC'
    assert result['sequence']['length'] == 4
    assert result['sequence']['analysis']['gc_content_percent'] == 50
    assert result['sequence']['truncated'] is False
    assert len(result['similarity']) == 2
    assert result['similarity'][0]['similarity'] == 1
    assert len(api.experiments_store) == 1


def test_failed_save_cannot_leak_into_history_or_later_save(client, monkeypatch):
    _, headers = ready_user(client, 'workflow_save')
    original = {'id': 'previous', 'user': 'another'}
    monkeypatch.setattr(api, 'experiments_store', [original])
    def fail():
        raise api.HTTPException(status_code=503, detail='Storage unavailable')
    monkeypatch.setattr(api, '_db_save', fail)
    response = client.post('/api/v1/scientific/workflow', headers=headers,
                           json={'target': 'reference', 'sequence': 'ATGC'})
    assert response.status_code == 503
    assert api.experiments_store == [original]
    assert api.experiments_store[0] is original


def test_oversized_library_is_rejected_not_silently_truncated(client):
    _, headers = ready_user(client, 'workflow_limit')
    response = client.post('/api/v1/scientific/workflow', headers=headers,
        json={'target': 'reference', 'ligand_smiles': 'CCO', 'similarity_library': ['CC'] * 201})
    assert response.status_code == 422
