"""Curated protein targets for the MedGen AI research-stage docking workspace.

PDB identifiers and biological annotations are cross-checked against RCSB PDB.
Grid boxes supplied in the initial project brief are retained only as unvalidated
suggestions; they must be checked against the selected structure/chain/ligand.
"""
from copy import deepcopy

CANCER_HIV_TARGETS = {
    "HIV_1_PROTEASE": {
        "pdb_id": "1HSG",
        "disease": "OIV-1 infeksiyasi",
        "target_name": "HIV-1 retrovirus proteazasi (homodimer)",
        "description": "Aspartil proteaza; katalitik qoldiqlar Asp25 va Asp25' (ikkinchi zanjir). 1HSG kristall strukturasi proteaza-inhibitor kompleksi.",
        "organism": "Human immunodeficiency virus 1",
        "structure_method": "X-ray diffraction",
        "mutation_status": "Depozit qilingan strukturada mutatsiya qayd etilmagan",
        "co_crystal_ligand": "L-735,524 (MK1)",
        "standard_inhibitor": "Indinavir / Ritonavir (ma'lumot uchun; 1HSG ichidagi ligand emas)",
        "grid_box": {
            "center_x": 16.0, "center_y": 25.0, "center_z": 4.0,
            "size_x": 20.0, "size_y": 20.0, "size_z": 20.0,
            "validated": False,
            "note": "Loyiha briefidan olingan taklif koordinatalari; 1HSG koordinata tizimi va faol ligand bilan tekshirilmagan."
        },
        "rcsb_url": "https://www.rcsb.org/structure/1HSG",
        "pdb_download_url": "https://files.rcsb.org/download/1HSG.pdb",
    },
    "EGFR_KINASE_WT": {
        "pdb_id": "8A27",
        "disease": "EGFR bilan bog'liq o'smalar; strukturaviy tadqiqot",
        "target_name": "EGFR tirozin kinaza domeni",
        "description": "8A27 — EGFR kinaza domenining kristall strukturasi. RCSB yozuvida depozit qilingan oqsil WT; bu PDB L858R/T790M mutant strukturasi sifatida talqin qilinmasligi kerak.",
        "organism": "Homo sapiens",
        "structure_method": "X-ray diffraction",
        "mutation_status": "RCSB yozuvida mutatsiya yo'q (WT)",
        "co_crystal_ligand": "KY9",
        "standard_inhibitor": "Gefitinib / Osimertinib (taqqoslash uchun; 8A27 co-crystal ligandi emas)",
        "grid_box": {
            "center_x": -1.5, "center_y": -48.0, "center_z": -14.0,
            "size_x": 22.0, "size_y": 22.0, "size_z": 22.0,
            "validated": False,
            "note": "Loyiha briefidan olingan taklif koordinatalari; 8A27 KY9 ligand cho'ntagiga mosligi tekshirilmagan."
        },
        "rcsb_url": "https://www.rcsb.org/structure/8A27",
        "pdb_download_url": "https://files.rcsb.org/download/8A27.pdb",
    },
    "KRAS_G12D": {
        "pdb_id": "9XB0",
        "supplied_pdb_id": "7LGI",
        "disease": "KRAS G12D bilan bog'liq o'smalar, jumladan pankreatik adenokarsinoma",
        "target_name": "KRAS G12D/Y96S mutant GTPaza",
        "description": "9XB0 — KRAS-G12D/Y96S ning MRTX1133 bilan kompleks kristall strukturasi. Dastlab taklif qilingan 7LGI esa WT GDP-KRas bilan promazine uchun NMR/HADDOCK modeli; G12D mutant strukturasi emas.",
        "organism": "Homo sapiens",
        "structure_method": "X-ray diffraction",
        "mutation_status": "G12D/Y96S",
        "co_crystal_ligand": "MRTX1133",
        "standard_inhibitor": "MRTX1133 (strukturada co-crystal ligand)",
        "grid_box": None,
        "grid_box_note": "9XB0 uchun qidiruv qutisi co-crystal ligand koordinatalaridan hisoblanishi yoki foydalanuvchi tomonidan tasdiqlanishi kerak.",
        "rcsb_url": "https://www.rcsb.org/structure/9XB0",
        "pdb_download_url": "https://files.rcsb.org/download/9XB0.pdb",
    },
}


# PDB-ID alias used by the Discovery Wing docking API.
CANCER_HIV_TARGETS["8A27"] = deepcopy(CANCER_HIV_TARGETS["EGFR_KINASE_WT"])


def get_target(target_id: str):
    key = str(target_id or "").strip().upper()
    if key not in CANCER_HIV_TARGETS:
        raise KeyError(key)
    return deepcopy(CANCER_HIV_TARGETS[key])


def list_targets():
    return [{"target_id": key, **deepcopy(value)} for key, value in CANCER_HIV_TARGETS.items()]
