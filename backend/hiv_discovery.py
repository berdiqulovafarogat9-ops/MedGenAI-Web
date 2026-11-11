"""Research-grade HIV ligand docking endpoints for MedGen AI.

Only the HIV-1 protease 1HSG is enabled for automatic small-molecule docking.
1RTD is deliberately listed as research-only: it is a catalytic RT/DNA/TTP/Mg
complex, not a nevirapine-bound structure, and the generic protein-only
receptor preparation would remove essential nucleic-acid/cofactor context.
"""
from pathlib import Path
import tempfile
import threading
import secrets
from datetime import datetime, timezone
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
    receptor_pdb: str
    best_pose_pdb: str
    hydrogen_bond_count: int
    hydrogen_bonds: list
    polar_contacts_estimate: int | None
    lipinski: LipinskiReport
    scientific_summary: str
    docking_box: dict
    engine: str
    warning: str




def _pdbqt_atoms(text: str) -> list[dict]:
    atoms = []
    for line in text.splitlines():
        if not line.startswith(("ATOM  ", "HETATM")):
            continue
        try:
            xyz = (float(line[30:38]), float(line[38:46]), float(line[46:54]))
        except (ValueError, IndexError):
            continue
        fields = line.split()
        atom_type = fields[-1].upper() if fields else ""
        atoms.append({
            "name": line[12:16].strip(), "residue": line[17:20].strip(),
            "chain": line[21:22].strip(), "resid": line[22:26].strip(),
            "type": atom_type, "xyz": xyz,
        })
    return atoms


def _verified_hydrogen_bonds(receptor_pdbqt: str, ligand_pdbqt: str) -> list[dict]:
    """Count donor-H...acceptor contacts using distance and D-H-A angle criteria."""
    import math

    receptor, ligand = _pdbqt_atoms(receptor_pdbqt), _pdbqt_atoms(ligand_pdbqt)
    donor_heavy_types = {"N", "NA", "O", "OA", "S", "SA"}
    acceptor_types = {"NA", "OA"}

    def donors(atoms):
        heavy = [a for a in atoms if a["type"] in donor_heavy_types]
        result = []
        for hydrogen in (a for a in atoms if a["type"] == "HD"):
            nearest = None
            nearest_distance = float("inf")
            for atom in heavy:
                d = math.dist(atom["xyz"], hydrogen["xyz"])
                if d < nearest_distance:
                    nearest, nearest_distance = atom, d
            if nearest is not None and nearest_distance <= 1.25:
                result.append((nearest, hydrogen))
        return result

    def label(atom):
        return ":".join(part for part in (atom["chain"], atom["residue"], atom["resid"], atom["name"]) if part)

    hits, seen = [], set()
    for donor_atoms, acceptor_atoms in ((donors(receptor), ligand), (donors(ligand), receptor)):
        for donor, hydrogen in donor_atoms:
            hx, hy, hz = hydrogen["xyz"]
            dx, dy, dz = donor["xyz"]
            v1 = (dx - hx, dy - hy, dz - hz)
            for acceptor in acceptor_atoms:
                if acceptor["type"] not in acceptor_types:
                    continue
                ax, ay, az = acceptor["xyz"]
                v2 = (ax - hx, ay - hy, az - hz)
                h_a = math.dist(hydrogen["xyz"], acceptor["xyz"])
                d_a = math.dist(donor["xyz"], acceptor["xyz"])
                if h_a > 2.6 or d_a > 3.5:
                    continue
                norm1 = math.sqrt(sum(v * v for v in v1))
                norm2 = math.sqrt(sum(v * v for v in v2))
                if not norm1 or not norm2:
                    continue
                cosine = max(-1.0, min(1.0, sum(a * b for a, b in zip(v1, v2)) / (norm1 * norm2)))
                angle = math.degrees(math.acos(cosine))
                if angle < 120.0:
                    continue
                key = (label(donor), label(acceptor))
                if key in seen:
                    continue
                seen.add(key)
                hits.append({
                    "donor": key[0], "acceptor": key[1],
                    "donor_acceptor_distance_angstrom": round(d_a, 3),
                    "hydrogen_acceptor_distance_angstrom": round(h_a, 3),
                    "donor_hydrogen_acceptor_angle_degrees": round(angle, 1),
                })
    return hits

def _pdbqt_to_pdb(text: str, *, first_model_only: bool = False) -> str:
    """Convert AutoDock PDBQT atom records to ordinary PDB for 3Dmol.js."""
    output = []
    in_first_model = True
    serial_fallback = 1
    element_map = {"A": "C", "C": "C", "N": "N", "NA": "N", "OA": "O", "O": "O", "SA": "S", "S": "S", "P": "P", "HD": "H", "F": "F", "CL": "CL", "BR": "BR", "I": "I"}
    for line in text.splitlines():
        if line.startswith("MODEL"):
            if first_model_only and output:
                in_first_model = False
            continue
        if line.startswith("ENDMDL"):
            if first_model_only:
                break
            continue
        if not in_first_model or not line.startswith(("ATOM  ", "HETATM")):
            continue
        try:
            serial = int(line[6:11].strip() or serial_fallback)
            atom_name = line[12:16]
            altloc = line[16:17] or " "
            resname = (line[17:20].strip() or "LIG")[:3]
            chain = line[21:22] or "A"
            resseq = int(line[22:26].strip() or 1)
            x, y, z = float(line[30:38]), float(line[38:46]), float(line[46:54])
            occupancy = float(line[54:60].strip() or 1.0) if len(line) >= 60 else 1.0
            bfactor = float(line[60:66].strip() or 0.0) if len(line) >= 66 else 0.0
        except (ValueError, IndexError):
            continue
        atom_type = line[77:79].strip().upper() if len(line) >= 79 else ""
        element = element_map.get(atom_type, "")
        if not element:
            letters = "".join(ch for ch in atom_name.strip() if ch.isalpha()).upper()
            element = letters[:1] or "C"
        output.append(
            f"{line[:6]:<6}{serial:5d} {atom_name:4s}{altloc[:1]}{resname:>3s} "
            f"{chain[:1]}{resseq:4d}    {x:8.3f}{y:8.3f}{z:8.3f}"
            f"{occupancy:6.2f}{bfactor:6.2f}          {element:>2s}  \n"
        )
        serial_fallback += 1
    if not output:
        raise RuntimeError("PDBQT ma'lumotidan 3D ko'rinish uchun atom koordinatalari olinmadi.")
    return "".join(output) + "END\n"

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
        "derived_from": f"RCSB {pdb_path.stem.removesuffix('.raw')} co-crystal ligand {ligand_resname}",
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
    jobs_store: dict | None = None,
    save_state: Callable | None = None,
    persist_completed: Callable | None = None,
    list_completed: Callable | None = None,
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

    # Async job API: the existing /docking endpoint remains backward-compatible.
    job_store = jobs_store if jobs_store is not None else {}
    job_lock = threading.RLock()
    max_queued_or_running_jobs = 8

    def _persist_jobs():
        if callable(save_state):
            save_state()

    @router.post("/docking/jobs")
    def create_docking_job(payload: LigandRequest, user=Depends(get_current_user)):
        role_guard(user)
        job_id = secrets.token_hex(12)
        with job_lock:
            pending = sum(
                1 for item in job_store.values()
                if item.get("status") in {"queued", "running"}
            )
            if pending >= max_queued_or_running_jobs:
                raise HTTPException(
                    status_code=429,
                    detail="Docking navbati to'la. Bir oz kutib, qayta urinib ko'ring.",
                )
            job_store[job_id] = {
                "job_id": job_id, "status": "queued", "user": user["username"], "user_id": str(user["user_id"]),
                "created_at": datetime.now(timezone.utc).isoformat(),
                "target_pdb": payload.target_pdb.upper(), "ligand_name": payload.name,
            }
        try:
            _persist_jobs()
        except Exception:
            with job_lock:
                job_store.pop(job_id, None)
            raise

        def _worker():
            with job_lock:
                job = job_store.get(job_id)
                if not job:
                    return
                job["status"] = "running"
                job["started_at"] = datetime.now(timezone.utc).isoformat()
            try:
                _persist_jobs()
                result = analyze_hiv_ligand(payload, user)
                serialized = result.model_dump() if hasattr(result, "model_dump") else result.dict()
                if callable(persist_completed):
                    persist_completed(user=user, payload=payload, result=serialized, job_id=job_id)
                with job_lock:
                    job["result"] = serialized
                    job["status"] = "completed"
                    job["persistence_status"] = "saved" if callable(persist_completed) else "not_configured"
                    job["completed_at"] = datetime.now(timezone.utc).isoformat()
            except HTTPException as exc:
                with job_lock:
                    job["status"] = "failed"
                    job["error"] = str(exc.detail)
                    job["completed_at"] = datetime.now(timezone.utc).isoformat()
            except Exception as exc:
                with job_lock:
                    job["status"] = "failed"
                    job["error"] = f"Docking yoki PostgreSQL persistence xatosi: {type(exc).__name__}"
                    job["completed_at"] = datetime.now(timezone.utc).isoformat()
            _persist_jobs()

        threading.Thread(target=_worker, name=f"hiv-docking-{job_id}", daemon=True).start()
        return {"job_id": job_id, "status": "queued", "poll_url": f"/api/v1/hiv-lab/docking/jobs/{job_id}"}

    @router.get("/docking/jobs/{job_id}")
    def get_docking_job(job_id: str, user=Depends(get_current_user)):
        role_guard(user)
        job = job_store.get(job_id)
        if not job:
            raise HTTPException(status_code=404, detail="Docking job topilmadi.")
        if job.get("user_id") != str(user.get("user_id")) and str(user.get("role", "")).upper() != "SUPER_ADMIN":
            raise HTTPException(status_code=403, detail="Bu docking vazifasiga ruxsat yo'q.")
        return {k: v for k, v in job.items() if k not in {"user", "user_id"}}

    @router.get("/docking/history")
    def get_docking_history(limit: int = 20, user=Depends(get_current_user)):
        role_guard(user)
        if not 1 <= limit <= 100:
            raise HTTPException(status_code=400, detail="Limit 1 dan 100 gacha bo‘lishi kerak.")
        if not callable(list_completed):
            raise HTTPException(status_code=503, detail="Docking history persistence sozlanmagan.")
        return {"items": list_completed(user=user, limit=limit)}

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
            receptor_pdb = _pdbqt_to_pdb(receptor_pdbqt)
            best_pose_pdb = _pdbqt_to_pdb(poses_pdbqt, first_model_only=True)
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
            hydrogen_bonds = _verified_hydrogen_bonds(receptor_pdbqt, first_pose) if first_pose else []
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
            receptor_pdb=receptor_pdb,
            best_pose_pdb=best_pose_pdb,
            hydrogen_bond_count=len(hydrogen_bonds),
            hydrogen_bonds=hydrogen_bonds,
            polar_contacts_estimate=polar_contacts,
            lipinski=lipinski,
            scientific_summary=summary,
            docking_box=grid,
            engine="AutoDock Vina",
            warning=(
                "Vina score — hisobiy docking natijasi, tajribada o'lchangan binding affinity emas. "
                "Polar contact soni taxminiy N/O atom masofasi bo'yicha. Vodorod bog'lari PDBQT polar "
                "gidrogenlari, donor-akseptor masofasi va D-H-A burchagi (>=120 daraja) bo'yicha geometrik "
                "saralanadi; bu energetik yoki eksperimental tasdiq emas. 1HSG proteaza monomeri/dimer "
                "konteksti va receptor protonatsiyasi "
                "natijaga ta'sir qilishi mumkin; eksperimental validatsiya talab etiladi."
            ),
        )

    return router
