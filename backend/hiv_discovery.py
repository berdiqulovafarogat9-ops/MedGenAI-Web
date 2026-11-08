"""Research-grade HIV ligand docking endpoints for MedGen AI.

Only the HIV-1 protease 1HSG is enabled for automatic small-molecule docking.
1RTD is deliberately listed as research-only: it is a catalytic RT/DNA/TTP/Mg
complex, not a nevirapine-bound structure, and the generic protein-only
receptor preparation would remove essential nucleic-acid/cofactor context.
"""
from pathlib import Path
import tempfile
from typing import Callable, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field


HIV_TARGETS = {
    "1HSG": {
        "name": "HIV-1 Protease (homodimer)",
        "resolution": "2.00 Å",
        "active_site": ["ASP25 (Chain A)", "ASP25 (Chain B)", "GLY27", "ILE50"],
        "co_crystal_ligand": "MK1 (L-735,524)",
        "docking_enabled": True,
        "scientific_note": "X-ray structure of HIV-1 protease with co-crystallized inhibitor MK1.",
    },
    "1RTD": {
        "name": "HIV-1 Reverse Transcriptase (catalytic complex)",
        "resolution": "3.20 Å",
        "active_site": ["ASP110", "ASP185", "ASP186"],
        "co_crystal_ligand": "TTP and Mg2+; DNA template/primer also present",
        "docking_enabled": False,
        "scientific_note": (
            "Research-only. This is a catalytic RT–DNA–TTP–Mg complex, not a "
            "nevirapine-bound structure. The generic protein-only receptor "
            "preparation removes nucleic acids and is not suitable for validated "
            "polymerase-site docking."
        ),
    },
}


class LigandRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    smiles: str = Field(min_length=1, max_length=2000)
    target_pdb: str = Field(default="1HSG", min_length=4, max_length=4)
    exhaustiveness: int = Field(default=8, ge=1, le=64)
    n_poses: int = Field(default=3, ge=1, le=10)


class LipinskiReport(BaseModel):
    mw: float
    logp: float
    hbd: int
    hba: int
    violations: int
    is_drug_like: bool


class DockingResult(BaseModel):
    target_name: str
    target_pdb: str
    ligand_name: str
    affinity_kcal_mol: float
    poses: list
    poses_pdbqt: str
    polar_contacts_estimate: int | None
    lipinski: LipinskiReport
    scientific_summary: str
    docking_box: dict
    engine: str
    warning: str


def _co_crystal_box(pdb_path: Path, ligand_resname: str = "MK1") -> dict:
    """Derive a reproducible search box from the deposited co-crystal ligand."""
    if not pdb_path.is_file():
        raise RuntimeError("RCSB original PDB fayli topilmadi; grid hisoblab bo'lmadi.")
    coords = []
    for line in pdb_path.read_text(encoding="utf-8", errors="replace").splitlines():
        if not line.startswith("HETATM") or line[17:20].strip() != ligand_resname:
            continue
        altloc = line[16:17]
        if altloc not in (" ", "A"):
            continue
        try:
            coords.append((float(line[30:38]), float(line[38:46]), float(line[46:54])))
        except ValueError:
            continue
    if len(coords) < 8:
        raise RuntimeError(
            f"{ligand_resname} co-crystal ligand atomlari yetarli emas; "
            "avtomatik docking grid xavfsiz aniqlanmadi."
        )
    mins = [min(p[i] for p in coords) for i in range(3)]
    maxs = [max(p[i] for p in coords) for i in range(3)]
    center = [(mins[i] + maxs[i]) / 2.0 for i in range(3)]
    # 6 Å margin on each side; bounded to Vina's practical search-box limit.
    size = [min(30.0, max(20.0, maxs[i] - mins[i] + 12.0)) for i in range(3)]
    return {
        "center": [round(v, 3) for v in center],
        "size": [round(v, 3) for v in size],
        "derived_from": f"RCSB {pdb_path.stem} co-crystal ligand {ligand_resname}",
        "ligand_atom_count": len(coords),
    }


def create_hiv_router(
    *,
    get_current_user: Callable,
    role_guard: Callable,
    vina_class,
    vina_available: bool,
    prepare_ligand: Callable,
    prepare_receptor: Callable,
    polar_contact_estimator: Callable,
    target_dir: Path,
) -> APIRouter:
    router = APIRouter(prefix="/api/v1/hiv-lab", tags=["HIV Drug Discovery"])

    @router.get("/targets")
    def list_hiv_targets(user=Depends(get_current_user)):
        role_guard(user)
        return {
            "status": "ok",
            "targets": [{"pdb_id": key, **value} for key, value in HIV_TARGETS.items()],
            "notice": "Faqat ilmiy jihatdan mos receptor va tekshirilgan grid mavjud targetlar docking uchun yoqiladi.",
        }

    @router.post("/docking", response_model=DockingResult)
    def analyze_hiv_ligand(payload: LigandRequest, user=Depends(get_current_user)):
        role_guard(user)
        pdb_id = payload.target_pdb.upper()
        target = HIV_TARGETS.get(pdb_id)
        if target is None:
            raise HTTPException(status_code=400, detail="Noma'lum OIV nishoni. 1HSG yoki 1RTD ni tanlang.")
        if not target["docking_enabled"]:
            raise HTTPException(
                status_code=409,
                detail=target["scientific_note"],
            )
        if not vina_available or vina_class is None:
            raise HTTPException(status_code=503, detail="AutoDock Vina ushbu API deploymentida mavjud emas.")

        # Real RDKit descriptors only. Never replace failed calculations with guessed values.
        try:
            from rdkit import Chem
            from rdkit.Chem import Descriptors, Lipinski

            mol = Chem.MolFromSmiles(payload.smiles.strip())
            if mol is None:
                raise ValueError("Noto'g'ri SMILES formulasi.")
            mw = round(float(Descriptors.MolWt(mol)), 2)
            logp = round(float(Descriptors.MolLogP(mol)), 2)
            hbd = int(Lipinski.NumHDonors(mol))
            hba = int(Lipinski.NumHAcceptors(mol))
            violations = sum((mw > 500, logp > 5, hbd > 5, hba > 10))
            lipinski = LipinskiReport(
                mw=mw, logp=logp, hbd=hbd, hba=hba,
                violations=int(violations), is_drug_like=bool(violations == 0),
            )
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc))
        except Exception as exc:
            raise HTTPException(status_code=503, detail=f"RDKit hisoblash xatosi: {type(exc).__name__}")

        try:
            ligand_pdbqt = prepare_ligand(payload.smiles, payload.name)
        except (ValueError, RuntimeError) as exc:
            raise HTTPException(status_code=422, detail=str(exc))

        try:
            receptor_pdbqt = prepare_receptor(pdb_id)
            grid = _co_crystal_box(Path(target_dir) / f"{pdb_id}.raw.pdb", "MK1")
        except Exception as exc:
            raise HTTPException(status_code=503, detail=f"Receptor/grid tayyorlash xatosi: {exc}")

        receptor_file = ligand_file = None
        try:
            receptor_file = tempfile.NamedTemporaryFile("w", suffix=".pdbqt", delete=False)
            ligand_file = tempfile.NamedTemporaryFile("w", suffix=".pdbqt", delete=False)
            receptor_file.write(receptor_pdbqt)
            ligand_file.write(ligand_pdbqt)
            receptor_file.close()
            ligand_file.close()

            engine = vina_class(sf_name="vina", verbosity=0, cpu=1)
            engine.set_receptor(receptor_file.name)
            engine.set_ligand_from_file(ligand_file.name)
            engine.compute_vina_maps(center=grid["center"], box_size=grid["size"])
            engine.dock(exhaustiveness=payload.exhaustiveness, n_poses=payload.n_poses)
            energies = engine.energies(n_poses=payload.n_poses)
            poses_pdbqt = engine.poses(n_poses=payload.n_poses)
            energy_columns = [
                "affinity_kcal_mol", "intermolecular_energy_kcal_mol",
                "intramolecular_energy_kcal_mol", "torsional_energy_kcal_mol",
                "best_pose_intramolecular_energy_kcal_mol",
            ]
            poses = [
                {key: round(float(value), 3) for key, value in zip(energy_columns, row)}
                for row in energies
            ]
            if not poses:
                raise RuntimeError("AutoDock Vina hech qanday pose qaytarmadi.")
            first_pose = poses_pdbqt.split("ENDMDL", 1)[0] if isinstance(poses_pdbqt, str) else ""
            polar_contacts = polar_contact_estimator(receptor_pdbqt, first_pose) if first_pose else None
        except Exception as exc:
            raise HTTPException(status_code=422, detail=f"AutoDock Vina docking bajarilmadi: {exc}")
        finally:
            for handle in (receptor_file, ligand_file):
                if handle is not None:
                    try:
                        Path(handle.name).unlink(missing_ok=True)
                    except Exception:
                        pass

        best = poses[0]["affinity_kcal_mol"]
        summary = (
            f"{payload.name}: {target['name']} ({pdb_id}) uchun AutoDock Vina hisoblagan "
            f"eng yaxshi docking score {best:.2f} kcal/mol. "
            f"Lipinski Rule of Five: {lipinski.violations} ta buzilish."
        )
        return DockingResult(
            target_name=target["name"],
            target_pdb=pdb_id,
            ligand_name=payload.name,
            affinity_kcal_mol=best,
            poses=poses,
            poses_pdbqt=poses_pdbqt,
            polar_contacts_estimate=polar_contacts,
            lipinski=lipinski,
            scientific_summary=summary,
            docking_box=grid,
            engine="AutoDock Vina",
            warning=(
                "Vina score — hisobiy docking natijasi, tajribada o'lchangan binding affinity emas. "
                "Polar contact soni taxminiy N/O atom masofasi bo'yicha; haqiqiy vodorod bog'i "
                "geometriyasi emas. 1HSG proteaza monomeri/dimer konteksti va receptor protonatsiyasi "
                "natijaga ta'sir qilishi mumkin; eksperimental validatsiya talab etiladi."
            ),
        )

    return router
