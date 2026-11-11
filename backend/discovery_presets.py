"""Curated Discovery Wing target and ligand presets.

Target metadata is sourced from RCSB PDB; drug SMILES are sourced from PubChem.
Docking availability is deliberately separate from a target being selectable:
a target is enabled only after receptor preparation and a ligand-derived grid
have been validated for that exact structure.
"""

TARGET_PRESETS = {
    "1HSG": {
        "pdb_id": "1HSG",
        "target_id": "HIV_1_PROTEASE",
        "name_uz": "OIV-1 proteazasi",
        "name_en": "HIV-1 protease",
        "disease_area": "OIV",
        "organism": "Human immunodeficiency virus 1",
        "co_crystal_ligand": "MK1",
        "resolution_angstrom": 2.0,
        "selectable": True,
        "docking_enabled": True,
        "status": "validated_existing_workflow",
        "warning": "Docking natijasi eksperimental bog'lanish energiyasi emas.",
        "rcsb_url": "https://www.rcsb.org/structure/1HSG",
        "pdb_url": "https://files.rcsb.org/download/1HSG.pdb",
    },
    "8A27": {
        "pdb_id": "8A27",
        "target_id": "EGFR_KINASE_WT",
        "name_uz": "EGFR tirozin kinaza (WT)",
        "name_en": "EGFR kinase domain (wild type)",
        "disease_area": "Onkologiya",
        "organism": "Homo sapiens",
        "co_crystal_ligand": "KY9",
        "resolution_angstrom": 1.07,
        "selectable": True,
        "docking_enabled": False,
        "status": "requires_receptor_and_grid_validation",
        "warning": "RCSB 8A27 WT EGFR strukturasi; KY9 co-crystal ligandidan grid hosil qilinib, receptor tayyorlash validatsiyasidan keyingina docking yoqiladi.",
        "rcsb_url": "https://www.rcsb.org/structure/8A27",
        "pdb_url": "https://files.rcsb.org/download/8A27.pdb",
    },
    "1RTD": {
        "pdb_id": "1RTD",
        "target_id": "HIV_1_REVERSE_TRANSCRIPTASE",
        "name_uz": "OIV-1 revers transkriptazasi",
        "name_en": "HIV-1 reverse transcriptase catalytic complex",
        "disease_area": "OIV",
        "organism": "Human immunodeficiency virus 1",
        "co_crystal_ligand": "TTP + Mg2+; DNA primer/template",
        "resolution_angstrom": 3.2,
        "selectable": True,
        "docking_enabled": False,
        "status": "research_only",
        "warning": "1RTD tarkibida DNA, TTP va Mg2+ mavjud. Oddiy protein-only receptor tayyorlash katalitik muhitni yo'qotadi; shu sabab standart docking o'chirilgan.",
        "rcsb_url": "https://www.rcsb.org/structure/1RTD",
        "pdb_url": "https://files.rcsb.org/download/1RTD.pdb",
    },
}

# PubChem isomeric SMILES; preserve stereochemistry for chiral medicines.
LIGAND_PRESETS = {
    "indinavir": {
        "name": "Indinavir",
        "smiles": "CC(C)(C)NC(=O)[C@@H]1CN(CCN1C[C@H](C[C@@H](CC2=CC=CC=C2)C(=O)N[C@@H]3[C@@H](CC4=CC=CC=C34)O)O)CC5=CN=CC=C5",
        "pubchem_cid": 5362440,
        "source": "PubChem",
        "target_suggestion": "1HSG",
    },
    "darunavir": {
        "name": "Darunavir",
        "smiles": "CC(C)CN(C[C@H]([C@H](CC1=CC=CC=C1)NC(=O)O[C@H]2CO[C@@H]3[C@H]2CCO3)O)S(=O)(=O)C4=CC=C(C=C4)N",
        "pubchem_cid": 213039,
        "source": "PubChem",
        "target_suggestion": "1HSG",
    },
    "aspirin": {
        "name": "Aspirin",
        "smiles": "CC(=O)OC1=CC=CC=C1C(=O)O",
        "pubchem_cid": 2244,
        "source": "PubChem",
        "target_suggestion": None,
    },
}


def list_target_presets():
    return [dict(value) for value in TARGET_PRESETS.values()]


def list_ligand_presets():
    return [
        {key: value for key, value in item.items() if key != "smiles"}
        | {"preset_id": preset_id, "smiles": item["smiles"]}
        for preset_id, item in LIGAND_PRESETS.items()
    ]


def get_ligand_preset(preset_id: str):
    key = str(preset_id or "").strip().lower()
    if key not in LIGAND_PRESETS:
        raise KeyError(key)
    return dict(LIGAND_PRESETS[key])
