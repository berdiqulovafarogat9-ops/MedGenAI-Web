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


def _valid_pdbqt(text: str) -> bool:
    if len(text) < 500:
        return False
    return any(line.startswith(("ATOM", "HETATM")) for line in text.splitlines())


def get_or_prepare_receptor(pdb_id: str) -> str:
    pdb_id = str(pdb_id or "").strip().upper()
    if len(pdb_id) != 4 or not pdb_id.isalnum():
        raise ValueError("Noto'g'ri PDB ID.")

    TARGET_DIR.mkdir(parents=True, exist_ok=True)
    output = TARGET_DIR / f"{pdb_id}.pdbqt"
    raw_path = TARGET_DIR / f"{pdb_id}.raw.pdb"
    clean_path = TARGET_DIR / f"{pdb_id}.clean.pdb"
    marker = TARGET_DIR / f"{pdb_id}.cleaned-v2.ok"

    # A previously prepared static PDBQT can act as a fail-safe if fresh
    # RCSB/Meeko preparation fails. Keep it in memory before replacing output.
    static_fallback = None
    if output.is_file() and output.stat().st_size > 500:
        candidate = output.read_text(encoding="utf-8", errors="replace")
        if _valid_pdbqt(candidate):
            if marker.is_file():
                return candidate
            static_fallback = candidate

    try:
        request = Request(
            f"https://files.rcsb.org/download/{pdb_id}.pdb",
            headers={"User-Agent": "MedGenAI-DrugDiscovery/1.0"},
        )
        with urlopen(request, timeout=25) as response:
            payload = response.read(MAX_PDB_BYTES + 1)
        if len(payload) > MAX_PDB_BYTES:
            raise RuntimeError("PDB fayli ruxsat etilgan hajmdan katta.")
        raw_text = payload.decode("utf-8", errors="replace")
        if not any(line.startswith(("ATOM  ", "HETATM")) for line in raw_text.splitlines()):
            raise RuntimeError("RCSB javobida atom koordinatalari topilmadi.")
        raw_path.write_text(raw_text, encoding="utf-8")

        cleaned_text = clean_pdb_for_docking(raw_text)
        atom_count = sum(1 for line in cleaned_text.splitlines() if line.startswith("ATOM  "))
        if atom_count < 20:
            raise RuntimeError(
                f"{pdb_id}: tozalashdan keyin standart aminokislota atomlari yetarli emas ({atom_count})."
            )
        clean_path.write_text(cleaned_text, encoding="utf-8")

        # Do not let a stale or static PDBQT be mistaken for fresh output.
        if output.exists():
            output.unlink()

        cli = shutil.which("mk_prepare_receptor.py")
        if cli:
            command = [cli]
        else:
            command = [sys.executable, "-m", "meeko.cli.mk_prepare_receptor"]
        command += [
            "--read_pdb", str(clean_path),
            "--write_pdbqt", str(output),
            "--allow_bad_res",
            "--default_altloc", "A",
        ]
        completed = subprocess.run(
            command, capture_output=True, text=True, timeout=180, check=False
        )
        if completed.returncode != 0 or not output.is_file():
            detail = (completed.stderr or completed.stdout or "Meeko receptor PDBQT yaratolmadi.")[-1600:]
            raise RuntimeError(f"Meeko receptor tayyorlash xatosi: {detail}")

        pdbqt_text = output.read_text(encoding="utf-8", errors="replace")
        if not _valid_pdbqt(pdbqt_text):
            raise RuntimeError("Meeko PDBQT chiqishida yaroqli atom yozuvlari topilmadi.")
        marker.write_text(
            "cleaned-standard-amino-acids; altloc-blank-or-A; meeko-allow_bad_res; default_altloc-A",
            encoding="utf-8",
        )
        return pdbqt_text

    except Exception as exc:
        if static_fallback is not None:
            # Restore the packaged/pre-existing PDBQT so subsequent calls can
            # use the fail-safe without repeating a failing online conversion.
            output.write_text(static_fallback, encoding="utf-8")
            marker.write_text("static-pdbqt-fallback", encoding="utf-8")
            return static_fallback
        if isinstance(exc, RuntimeError):
            raise RuntimeError(f"{pdb_id} receptor tayyorlash muvaffaqiyatsiz: {exc}") from exc
        raise RuntimeError(f"{pdb_id} receptor tayyorlash muvaffaqiyatsiz: {exc}") from exc
