"""RDKit + Meeko ligand preparation for AutoDock Vina.

This module prepares ligand PDBQT only. Receptor preparation is a separate
structure-processing step and must not be confused with ligand preparation.
"""
from rdkit import Chem
from rdkit.Chem import AllChem


def prepare_ligand_from_smiles(smiles_str: str, ligand_name: str = "drug_candidate") -> str:
    smiles = str(smiles_str or "").strip()
    if not smiles or len(smiles) > 2000:
        raise ValueError("SMILES bo'sh yoki ruxsat etilgan uzunlikdan katta.")
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError("Noto'g'ri SMILES formulasi kiritildi.")
    if mol.GetNumHeavyAtoms() > 70:
        raise ValueError("Ligand 70 dan ortiq og'ir atomga ega; bu laboratoriya limiti.")
    mol = Chem.AddHs(mol)
    params = AllChem.ETKDGv3()
    params.randomSeed = 42
    if AllChem.EmbedMolecule(mol, params) != 0:
        raise RuntimeError("RDKit 3D konformatsiya yarata olmadi.")
    try:
        AllChem.MMFFOptimizeMolecule(mol, maxIters=300)
    except Exception as exc:
        raise RuntimeError("MMFF94 geometriya optimallashtirishi bajarilmadi.") from exc

    try:
        from meeko import MoleculePreparation, PDBQTWriterLegacy
        setups = MoleculePreparation().prepare(mol)
        if not setups:
            raise RuntimeError("Meeko ligand setup yaratmadi.")
        pdbqt, success, error = PDBQTWriterLegacy.write_string(setups[0])
        if not success:
            raise RuntimeError(str(error or "Meeko PDBQT yozolmadi."))
        return pdbqt
    except ImportError:
        # Compatibility path for older Meeko releases used by the current API.
        from meeko import MoleculePreparation
        prep = MoleculePreparation()
        prep.prepare(mol)
        writer = getattr(prep, "write_pdbqt_string", None)
        if not callable(writer):
            raise RuntimeError("O'rnatilgan Meeko versiyasi PDBQT writer API sini qo'llamaydi.")
        return writer()
