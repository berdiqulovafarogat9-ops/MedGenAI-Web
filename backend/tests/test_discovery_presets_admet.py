from backend.discovery_presets import (
    TARGET_PRESETS,
    get_ligand_preset,
    list_ligand_presets,
    list_target_presets,
)
from backend.admet_pipeline import calculate_admet_descriptors


def test_required_target_presets_are_present_and_scientifically_gated():
    assert {"1HSG", "8A27", "1RTD"} <= set(TARGET_PRESETS)
    assert TARGET_PRESETS["1HSG"]["docking_enabled"] is True
    assert TARGET_PRESETS["8A27"]["docking_enabled"] is True
    assert TARGET_PRESETS["1RTD"]["docking_enabled"] is False
    assert TARGET_PRESETS["8A27"]["co_crystal_ligand"] == "KY9"
    assert "DNA" in TARGET_PRESETS["1RTD"]["warning"]


def test_drug_presets_have_valid_smiles_and_stereochemistry():
    from rdkit import Chem

    expected = {"indinavir", "darunavir", "aspirin"}
    assert expected == {item["preset_id"] for item in list_ligand_presets()}
    for preset_id in expected:
        preset = get_ligand_preset(preset_id)
        mol = Chem.MolFromSmiles(preset["smiles"])
        assert mol is not None
        assert mol.GetNumHeavyAtoms() > 0
    assert Chem.FindMolChiralCenters(
        Chem.MolFromSmiles(get_ligand_preset("indinavir")["smiles"]),
        includeUnassigned=True,
    )


def test_admet_descriptors_are_real_and_toxicity_is_not_fabricated():
    result = calculate_admet_descriptors("CC(=O)OC1=CC=CC=C1C(=O)O")
    assert result["molecular_weight_g_mol"] > 100
    assert isinstance(result["logp"], float)
    assert result["hbd"] >= 0
    assert result["hba"] >= 0
    assert result["lipinski_compliant"] is True
    assert result["hepatotoxicity"]["status"] == "not_assessed"
    assert result["hepatotoxicity"]["result"] is None
    assert result["cyp3a4"]["status"] == "not_assessed"


def test_admet_rejects_invalid_smiles():
    import pytest

    with pytest.raises(ValueError):
        calculate_admet_descriptors("this-is-not-smiles")
