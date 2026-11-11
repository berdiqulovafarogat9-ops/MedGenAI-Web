"""Scientific contract tests for the HIV docking target and grid derivation."""
from pathlib import Path

import pytest

from backend.hiv_discovery import HIV_TARGETS, _co_crystal_box, _pdbqt_to_pdb, _verified_hydrogen_bonds


def _hetatm(serial, atom, residue, x, y, z, altloc=" "):
    return (
        f"HETATM{serial:5d} {atom:<4s}{altloc}{residue:>3s} A{101:4d}    "
        f"{x:8.3f}{y:8.3f}{z:8.3f}{1.00:6.2f}{20.00:6.2f}          C\n"
    )


def test_only_scientifically_supported_hiv_target_is_enabled():
    assert HIV_TARGETS["1HSG"]["docking_enabled"] is True
    assert HIV_TARGETS["1RTD"]["docking_enabled"] is False


def test_grid_is_derived_from_co_crystal_ligand_coordinates(tmp_path):
    pdb = tmp_path / "1HSG.raw.pdb"
    lines = [
        _hetatm(i + 1, "C1", "MK1", 10 + i, 20 + i * 0.5, -2 + i * 0.25)
        for i in range(8)
    ]
    # An unrelated ligand must not contaminate the MK1 search box.
    lines.append(_hetatm(99, "C1", "HOH", 999, 999, 999))
    pdb.write_text("".join(lines), encoding="utf-8")

    box = _co_crystal_box(pdb, "MK1")
    assert box["ligand_atom_count"] == 8
    assert box["center"] == [13.5, 21.75, -1.125]
    assert box["derived_from"] == "RCSB 1HSG co-crystal ligand MK1"
    assert all(20.0 <= size <= 30.0 for size in box["size"])


def test_grid_ignores_non_primary_altloc_and_rejects_missing_ligand(tmp_path):
    pdb = tmp_path / "missing.raw.pdb"
    pdb.write_text(
        "".join(_hetatm(i + 1, "C1", "MK1", i, i, i, altloc="B") for i in range(10)),
        encoding="utf-8",
    )
    with pytest.raises(RuntimeError, match="co-crystal ligand"):
        _co_crystal_box(pdb, "MK1")


def test_pdbqt_conversion_produces_pdb_atoms_for_3d_viewer():
    atom = (
        f"ATOM  {1:5d} {'CA':<4s} GLY A{1:4d}    "
        f"{1.25:8.3f}{-2.5:8.3f}{3.75:8.3f}{1.0:6.2f}{0.0:6.2f}"
        f"          {'C':>2s}  C\n"
    )
    pdb = _pdbqt_to_pdb(atom)
    assert pdb.startswith("ATOM  ")
    assert pdb.rstrip().endswith("END")
    assert float(pdb[30:38]) == 1.25
    assert float(pdb[38:46]) == -2.5
    assert pdb[76:78].strip() == "C"


def test_pdbqt_conversion_selects_only_first_docking_pose():
    first = (
        f"ATOM  {1:5d} {'C1':<4s} LIG A{1:4d}    "
        f"{1.0:8.3f}{2.0:8.3f}{3.0:8.3f}{1.0:6.2f}{0.0:6.2f}"
        f"          {'C':>2s}  C\n"
    )
    second = first.replace(f"{1.0:8.3f}", f"{99.0:8.3f}")
    pdb = _pdbqt_to_pdb("MODEL 1\n" + first + "ENDMDL\nMODEL 2\n" + second + "ENDMDL\n", first_model_only=True)
    assert "  1.000" in pdb
    assert " 99.000" not in pdb


def _pdbqt_atom(serial, atom_name, residue, chain, x, y, z, atom_type):
    return (
        f"ATOM  {serial:5d} {atom_name:<4s} {residue:>3s} {chain}{1:4d}    "
        f"{x:8.3f}{y:8.3f}{z:8.3f}{1.0:6.2f}{0.0:6.2f}    {0.0:6.3f} {atom_type}\n"
    )


def test_hydrogen_bonds_require_distance_and_donor_angle_geometry():
    receptor = (
        _pdbqt_atom(1, "ND1", "HIS", "A", 0.0, 0.0, 0.0, "N")
        + _pdbqt_atom(2, "HD1", "HIS", "A", 1.0, 0.0, 0.0, "HD")
    )
    aligned_acceptor = _pdbqt_atom(3, "O1", "LIG", "L", 2.8, 0.0, 0.0, "OA")
    bent_acceptor = _pdbqt_atom(3, "O1", "LIG", "L", 1.0, 2.0, 0.0, "OA")

    aligned = _verified_hydrogen_bonds(receptor, aligned_acceptor)
    bent = _verified_hydrogen_bonds(receptor, bent_acceptor)
    assert len(aligned) == 1
    assert aligned[0]["donor_hydrogen_acceptor_angle_degrees"] == 180.0
    assert bent == []
