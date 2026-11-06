"""Conservative PDB cleaner for protein-receptor docking preparation.

Keeps standard amino-acid ATOM records and resolves alternate locations by
retaining only the blank or A conformer. HETATM records are deliberately
excluded (water, ions, co-crystal ligands, etc.).
"""
STANDARD_AMINO_ACIDS = {
    "ALA", "ARG", "ASN", "ASP", "CYS", "GLN", "GLU", "GLY", "HIS", "ILE",
    "LEU", "LYS", "MET", "PHE", "PRO", "SER", "THR", "TRP", "TYR", "VAL",
}


def clean_pdb_for_docking(raw_pdb_text: str) -> str:
    cleaned_lines = []
    for line in str(raw_pdb_text or "").splitlines():
        record = line[:6].strip()
        if record == "ATOM":
            # PDB column 17 (zero-based index 16) is alternate-location ID.
            alt_loc = line[16] if len(line) > 16 else " "
            if alt_loc not in (" ", "A"):
                continue
            res_name = line[17:20].strip().upper() if len(line) >= 20 else ""
            if res_name in STANDARD_AMINO_ACIDS:
                # Normalize the retained conformer to a blank altLoc field.
                cleaned_lines.append(line[:16] + " " + line[17:])
        elif record in {"TER", "ENDMDL"}:
            cleaned_lines.append(line)
    cleaned_lines.append("END")
    return "\n".join(cleaned_lines) + "\n"
