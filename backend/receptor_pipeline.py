"""Server-side receptor preparation and cache for AutoDock Vina.

PDB structures are downloaded from the official RCSB endpoint and prepared
with Meeko's mk_prepare_receptor CLI. Generated PDBQT files are cached in
backend/targets/<PDB_ID>.pdbqt; no user file upload is required.
"""
from pathlib import Path
import shutil
import subprocess
import sys
from urllib.request import Request, urlopen

TARGET_DIR = Path(__file__).resolve().parent / "targets"
MAX_PDB_BYTES = 30 * 1024 * 1024


def get_or_prepare_receptor(pdb_id: str) -> str:
    pdb_id = str(pdb_id or "").strip().upper()
    if len(pdb_id) != 4 or not pdb_id.isalnum():
        raise ValueError("Noto'g'ri PDB ID.")
    TARGET_DIR.mkdir(parents=True, exist_ok=True)
    output = TARGET_DIR / f"{pdb_id}.pdbqt"
    if output.is_file() and output.stat().st_size > 500:
        return output.read_text(encoding="utf-8")

    pdb_path = TARGET_DIR / f"{pdb_id}.pdb"
    if not pdb_path.is_file() or pdb_path.stat().st_size < 500:
        request = Request(
            f"https://files.rcsb.org/download/{pdb_id}.pdb",
            headers={"User-Agent": "MedGenAI-DrugDiscovery/1.0"},
        )
        try:
            with urlopen(request, timeout=25) as response:
                payload = response.read(MAX_PDB_BYTES + 1)
            if len(payload) > MAX_PDB_BYTES or not payload.startswith((b"HEADER", b"TITLE", b"COMPND", b"ATOM", b"REMARK")):
                raise RuntimeError("RCSB dan yaroqli PDB strukturasi olinmadi.")
            pdb_path.write_bytes(payload)
        except Exception as exc:
            raise RuntimeError(f"{pdb_id} PDB strukturasini RCSB dan olish muvaffaqiyatsiz: {exc}") from exc

    cli = shutil.which("mk_prepare_receptor.py")
    if cli:
        command = [cli, "--read_pdb", str(pdb_path), "--write_pdbqt", str(output), "--allow_bad_res"]
    else:
        command = [sys.executable, "-m", "meeko.cli.mk_prepare_receptor",
                   "--read_pdb", str(pdb_path), "--write_pdbqt", str(output), "--allow_bad_res"]
    try:
        completed = subprocess.run(command, capture_output=True, text=True, timeout=180, check=False)
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(f"{pdb_id} receptor tayyorlash vaqti tugadi.") from exc
    if completed.returncode != 0 or not output.is_file() or output.stat().st_size < 500:
        detail = (completed.stderr or completed.stdout or "Meeko receptor PDBQT yaratolmadi.")[-1200:]
        raise RuntimeError(f"{pdb_id} receptor tayyorlash xatosi: {detail}")
    return output.read_text(encoding="utf-8")
