"""Small deterministic reference cases; not clinical or whole-engine validation."""
import pytest
from test_regressions import api


def test_translation_reference_and_rna_equivalence():
    for sequence in ['ATGGCTTAA', 'AUGGCUUAA', '>single\nATG GCT\tTAA']:
        result = api._translate_dna(sequence)
        assert result['protein'] == 'MA*'
        assert result['codon_count'] == 3
        assert result['stop_codons'] == 1
    assert api._translate_dna('AATGGCTTAA', 2)['protein'] == 'MA*'
    assert api._translate_dna('ATGNNNTAA')['protein'] == 'MX*'


@pytest.mark.parametrize('sequence', ['ATG!!!', 'protein', '>first\nATG\n>second\nTAA'])
def test_translation_rejects_non_nucleotide_or_multiple_records(sequence):
    with pytest.raises(api.HTTPException) as exc:
        api._translate_dna(sequence)
    assert exc.value.status_code == 400


def test_complement_and_orf_reference():
    assert api._reverse_complement('ATGCN', 'DNA') == 'NGCAT'
    assert api._reverse_complement('AUGCN', 'RNA') == 'NGCAU'
    frames = api._orf_summary('ATGGCTTAA', 'DNA')['open_reading_frames']
    assert {'strand': 'forward', 'frame': 1, 'start': 1, 'end': 9, 'codons': 3} in frames


def test_alignment_reference():
    result = api.bioinformatics_align(api.SequenceAlignRequest(sequence_a='ACGT', sequence_b='AGT'), {'username': 'fixture'})
    assert result['score'] == 1  # Three matches (+1 each), one gap (-2).
    assert result['alignment'] == {'sequence_a': 'ACGT', 'sequence_b': 'A-GT'}
    assert result['matches'] == 3
    assert result['comparable_positions'] == 3


def test_ethanol_reference_and_similarity_identity():
    molecule = api._molecule_descriptors('CCO')
    assert molecule['molecular_formula'] == 'C2H6O'
    assert molecule['molecular_weight'] == pytest.approx(46.069, abs=0.01)
    assert molecule['heavy_atoms'] == 3
    assert molecule['HBD'] == molecule['HBA'] == 1
    assert molecule['rings'] == 0
    assert api._tanimoto_similarity('CCO', 'OCC') == 1.0


@pytest.mark.parametrize('smiles', ['', ' ', 'not-a-smiles'])
def test_empty_or_invalid_molecule_rejected(smiles):
    with pytest.raises(ValueError):
        api._molecule_descriptors(smiles)
