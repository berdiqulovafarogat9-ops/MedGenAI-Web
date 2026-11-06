"""Conservative PDB cleaner for protein-receptor docking preparation."""
STANDARD_AMINO_ACIDS = {
    "ALA", "ARG", "ASN", "ASP", "CYS", "GLN", "GLU", "GLY", "HIS", "ILE",
    "LEU", "LYS", "MET", "PHE", "PRO", "SER", "THR", "TRP", "TYR", "VAL",
}


def clean_pdb_for_docking(raw_pdb_text: str) -> str:
    """Keep only ATOM records for standard amino acids and structural terminators.

    HETATM records (water, ions, co-crystal ligands, EDO, nitrate, etc.) are
    deliberately excluded. Non-standard residues such as CMET are excluded
    rather than silently treated as standard amino acids.
    """
    cleaned_lines = []
    for line in str(raw_pdb_text or "").splitlines():
        record = line[:6].strip()
        if record == "ATOM":
            residue_name = line[17:20].strip().upper() if len(line) >= 20 else ""
            if residue_name in STANDARD_AMINO_ACIDS:
                cleaned_lines.append(line)
        elif record in {"TER", "ENDMDL"}:
            cleaned_lines.append(line)
    cleaned_lines.append("END")
    return "\n".join(cleaned_lines) + "\n"
