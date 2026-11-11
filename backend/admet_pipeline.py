"""RDKit-based, transparent in-silico descriptors for Discovery Wing.

This module does NOT claim to predict hepatotoxicity or CYP3A4 metabolism.
Those endpoints require validated, versioned predictive models or curated
experimental evidence. Until such a model is configured, they are explicitly
reported as not assessed rather than guessed.
"""
from __future__ import annotations


def calculate_admet_descriptors(smiles: str) -> dict:
    """Calculate reproducible 2D physicochemical descriptors with RDKit."""
    from rdkit import Chem
    from rdkit.Chem import Descriptors, Lipinski, Crippen, rdMolDescriptors

    text = str(smiles or "").strip()
    if not text or len(text) > 2000:
        raise ValueError("SMILES bo'sh yoki ruxsat etilgan uzunlikdan katta.")
    mol = Chem.MolFromSmiles(text)
    if mol is None:
        raise ValueError("Noto'g'ri SMILES formulasi.")

    mw = float(Descriptors.MolWt(mol))
    logp = float(Crippen.MolLogP(mol))
    hbd = int(Lipinski.NumHDonors(mol))
    hba = int(Lipinski.NumHAcceptors(mol))
    violations = int(mw > 500) + int(logp > 5) + int(hbd > 5) + int(hba > 10)

    return {
        "model": "RDKit physicochemical descriptors",
        "model_version": getattr(__import__("rdkit"), "__version__", "unknown"),
        "molecular_weight_g_mol": round(mw, 2),
        "logp": round(logp, 2),
        "hbd": hbd,
        "hba": hba,
        "lipinski_violations": violations,
        "lipinski_compliant": violations == 0,
        "tpsa_angstrom2": round(float(rdMolDescriptors.CalcTPSA(mol)), 2),
        "rotatable_bonds": int(Lipinski.NumRotatableBonds(mol)),
        "hepatotoxicity": {
            "status": "not_assessed",
            "result": None,
            "reason": "Validatsiyadan o'tgan hepatotoksiklik modeli ulanmagan.",
        },
        "cyp3a4": {
            "status": "not_assessed",
            "substrate_prediction": None,
            "inhibition_prediction": None,
            "reason": "CYP3A4 substrat/inhibitor bashorati uchun validatsiyalangan model ulanmagan.",
        },
        "limitations": [
            "Lipinski qoidasi toksiklik yoki klinik xavfsizlikni bashorat qilmaydi.",
            "MW, LogP, HBD va HBA — hisoblangan fizik-kimyoviy deskriptorlar.",
            "Hepatotoksiklik va CYP3A4 natijalari model ulanmaguncha chiqarilmaydi.",
        ],
    }
