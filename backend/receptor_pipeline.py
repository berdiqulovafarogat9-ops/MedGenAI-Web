"""Download, clean, prepare, and cache receptor PDBQT files for AutoDock Vina."""
from pathlib import Path
import shutil
import subprocess
import sys
from urllib.request import Request, urlopen

try:
    from .receptor_cleaner import clean_pdb_for_docking
except ImportError:
    from receptor_cleaner import clean_pdb_for_docking

TARGET_DIR = Path(__file__).resolve().parent / "targets"
MAX_PDB_BYTES = 30 * 1024 * 1024


def get_or_prepare_receptor(pdb_id: str) -> str:
    pdb_id = str(pdb_id or "").strip().upper()
    if len(pdb_id) != 4 or not pdb_id.isalnum():
        raise ValueError("Noto'g'ri PDB ID.")

    TARGET_DIR.mkdir(parents=True, exist_ok=True)
    output = TARGET_DIR / f"{pdb_id}.pdbqt"
    raw_path = TARGET_DIR / f"{pdb_id}.raw.pdb"
    clean_path = TARGET_DIR / f"{pdb_id}.clean.pdb"

    # Reuse only a non-empty PDBQT created from the current cleaner pipeline.
    if output.is_file() and output.stat().st_size > 500:
        return output.read_text(encoding="utf-8")

    request = Request(
        f"https://files.rcsb.org/download/{pdb_id}.pdb",
        headers={"User-Agent": "MedGenAI-DrugDiscovery/1.0"},
    )
    try:
        with urlopen(request, timeout=25) as response:
            payload = response.read(MAX_PDB_BYTES + 1)
        if len(payload) > MAX_PDB_BYTES:
            raise RuntimeError("PDB fayli ruxsat etilgan hajmdan katta.")
        raw_text = payload.decode("utf-8", errors="replace")
        if not any(line.startswith(("ATOM  ", "HETATM")) for line in raw_text.splitlines()):
            raise RuntimeError("RCSB javobida atom koordinatalari topilmadi.")
        raw_path.write_text(raw_text, encoding="utf-8")
    except Exception as exc:
        raise RuntimeError(f"{pdb_id} PDB strukturasini RCSB dan olish muvaffaqiyatsiz: {exc}") from exc

    cleaned_text = clean_pdb_for_docking(raw_text)
    atom_count = sum(1 for line in cleaned_text.splitlines() if line.startswith("ATOM  "))
    if atom_count < 20:
        raise RuntimeError(
            f"{pdb_id}: tozalashdan keyin standart aminokislota atomlari yetarli emas ({atom_count})."
        )
    clean_path.write_text(cleaned_text, encoding="utf-8")

    # Do not allow a stale output file to make a failed conversion look successful.
    if output.exists():
        output.unlink()

    cli = shutil.which("mk_prepare_receptor.py")
    if cli:
        command = [
            cli, "--read_pdb", str(clean_path), "--write_pdbqt", str(output),
            "--allow_bad_res",
        ]
    else:
        command = [
            sys.executable, "-m", "meeko.cli.mk_prepare_receptor",
            "--read_pdb", str(clean_path), "--write_pdbqt", str(output),
            "--allow_bad_res",
        ]
    try:
        completed = subprocess.run(
            command, capture_output=True, text=True, timeout=180, check=False
        )
    except subprocess.TimeoutExpired as exc:
        raise RuntimeError(f"{pdb_id} receptor tayyorlash vaqti tugadi.") from exc

    if completed.returncode != 0 or not output.is_file() or output.stat().st_size < 500:
        detail = (completed.stderr or completed.stdout or "Meeko receptor PDBQT yaratolmadi.")[-1600:]
        raise RuntimeError(f"{pdb_id} tozalangan receptorni Meeko orqali tayyorlash xatosi: {detail}")

    pdbqt_text = output.read_text(encoding="utf-8", errors="replace")
    if not any(line.startswith(("ATOM", "HETATM")) for line in pdbqt_text.splitlines()):
        output.unlink(missing_ok=True)
        raise RuntimeError(f"{pdb_id}: Meeko PDBQT chiqishida atomlar topilmadi.")
    return pdbqt_text
