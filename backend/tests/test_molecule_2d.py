import xml.etree.ElementTree as ET
from test_regressions import api, client
from test_audit_regressions import ready_user

def test_real_svg_rendering_and_invalid_smiles(client):
    _,headers=ready_user(client,'molecule_svg')
    response=client.post('/api/v1/molecules/2d',headers=headers,json={'smiles':'CCO','width':400,'height':300})
    assert response.status_code==200,response.text
    data=response.json()
    assert ET.fromstring(data['svg']).tag=='{http://www.w3.org/2000/svg}svg'
    assert data['canonical_smiles']=='CCO'
    assert client.post('/api/v1/molecules/2d',headers=headers,json={'smiles':'invalid'}).status_code==400
