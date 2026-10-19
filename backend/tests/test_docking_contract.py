"""Vina API adapter contract and persistence failures; not engine validation."""
from pathlib import Path
import pytest
from test_regressions import api, client
from test_audit_regressions import ready_user

class Engine:
    files = []
    def __init__(self, **kwargs):
        assert kwargs['cpu'] == 1
    def set_receptor(self, path):
        self.files.append(path)
        assert Path(path).read_text() == 'receptor'
    def set_ligand_from_file(self, path):
        self.files.append(path)
    def compute_vina_maps(self, **kwargs): pass
    def dock(self, **kwargs): pass
    def energies(self, **kwargs):
        return [[-7.1, -8.2, 0.3, 1.1, 0.3]]

@pytest.mark.parametrize('save_failure', [False, True])
def test_energy_columns_save_and_cleanup(client, monkeypatch, save_failure):
    _, headers = ready_user(client)
    monkeypatch.setattr(api, 'VINA_AVAILABLE', True)
    monkeypatch.setattr(api, 'Vina', Engine, raising=False)
    monkeypatch.setattr(api, 'docking_jobs_store', {})
    Engine.files = []
    saved = []
    def save():
        saved.append(True)
        if save_failure:
            raise api.HTTPException(503, 'Storage unavailable')
    monkeypatch.setattr(api, '_db_save', save)
    r = client.post('/api/v1/docking/run', headers=headers, json={
        'target':'Test', 'receptor_pdbqt':'receptor', 'ligand_pdbqt':'ligand',
        'center_x':0, 'center_y':0, 'center_z':0,
    })
    assert saved == [True]
    assert all(not Path(p).exists() for p in Engine.files)
    if save_failure:
        assert r.status_code == 503
        assert api.docking_jobs_store == {}
        assert not any(e.get('type') == 'docking_completed' for e in api.activity_log)
    else:
        assert r.status_code == 200, r.text
        pose = r.json()['result']['poses'][0]
        assert pose['affinity_kcal_mol'] == -7.1
        assert pose['intermolecular_energy_kcal_mol'] == -8.2
        assert not any('rmsd' in k for k in pose)
        job = r.json()['job_id']
        assert client.get('/api/v1/docking/status/'+job, headers=headers).status_code == 200

@pytest.mark.parametrize('field,value', [('center_x','NaN'),('center_y','Infinity'),('size_x',0),('size_z',101)])
def test_invalid_box_rejected_before_engine(client, field, value):
    _, headers = ready_user(client)
    payload = {'target':'Test', 'receptor_pdbqt':'receptor', 'ligand_pdbqt':'ligand',
               'center_x':0, 'center_y':0, 'center_z':0}
    payload[field] = value
    assert client.post('/api/v1/docking/run', headers=headers, json=payload).status_code == 422
