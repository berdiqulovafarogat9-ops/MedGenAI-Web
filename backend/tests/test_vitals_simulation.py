"""Clinical vitals simulation replay regression tests."""
import pytest
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
BACKEND = ROOT / "backend"
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(BACKEND))

os.environ.setdefault("MEDGEN_ADMIN_PASSWORD", "ci-test-only-password")
os.environ.setdefault("MEDGEN_SECRET_KEY", "ci-test-only-secret-key")

import main as api  # noqa: E402


def test_jasur_required_actions_stabilize_in_deterministic_order():
    result = api._vit_replay("anaphylaxis_jasur", [
        {"id": "epi_thigh", "t": 0},
        {"id": "oxygen_high", "t": 1},
        {"id": "crystalloid_bolus", "t": 2},
    ], 0)

    assert result["stab_s"] == 2
    assert result["req_done"] == result["req_total"] == 3
    assert result["harm_used"] == 0
    assert result["diag_ok"] is True
    assert result["st"]["hr"] <= 100
    assert result["st"]["sbp"] >= 100
    assert result["st"]["dbp"] >= 60
    assert result["st"]["spo2"] >= 94
    assert 12 <= result["st"]["rr"] <= 20


def test_repeated_action_is_counted_once_and_audited():
    result = api._vit_replay("anaphylaxis_jasur", [
        {"id": "epi_thigh", "t": 0},
        {"id": "epi_thigh", "t": 1},
        {"id": "oxygen_high", "t": 2},
        {"id": "crystalloid_bolus", "t": 3},
    ], 0)

    duplicates = [item for item in result["audit"] if item["type"] == "duplicate"]
    assert len(duplicates) == 1
    assert duplicates[0]["t"] == 1
    assert result["req_done"] == 3
    assert result["harm_used"] == 0


def test_out_of_order_action_log_is_replayed_by_timestamp():
    ordered = [
        {"id": "epi_thigh", "t": 0},
        {"id": "oxygen_high", "t": 1},
        {"id": "crystalloid_bolus", "t": 2},
    ]
    shuffled = [ordered[2], ordered[0], ordered[1]]

    expected = api._vit_replay("anaphylaxis_jasur", ordered, 0)
    actual = api._vit_replay("anaphylaxis_jasur", shuffled, 0)

    assert actual["stab_s"] == expected["stab_s"]
    assert actual["st"] == expected["st"]
    assert actual["req_done"] == expected["req_done"]


def test_untreated_anaphylaxis_does_not_receive_stabilization_points():
    result = api._vit_replay("anaphylaxis_jasur", [], 0)

    assert result["stab_s"] is None
    assert result["stab_pts"] == 0
    assert result["req_done"] == 0
    assert result["req_total"] == 3
    assert result["harm_used"] == 0

def test_action_timestamp_at_terminal_boundary_is_rejected():
    # The client accepts actions only for elapsed seconds 0..179.
    # t=180 is the terminal boundary, not an actionable simulation second.
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        api.VitalsLogItem.model_validate({"id": "epi_thigh", "t": api.VITALS_MAX_SECONDS})


def test_last_actionable_second_is_accepted():
    item = api.VitalsLogItem.model_validate({
        "id": "epi_thigh", "t": api.VITALS_MAX_SECONDS - 1
    })
    assert item.t == api.VITALS_MAX_SECONDS - 1

def test_manual_early_finish_replays_only_through_the_stop_second():
    result = api._vit_replay("anaphylaxis_jasur", [
        {"id": "epi_thigh", "t": 0},
    ], 0, elapsed_seconds=2)

    # The client has applied deterioration for seconds 0 and 1, then stopped
    # during second 2. The server must not simulate the remaining 178 seconds.
    assert result["seconds_used"] == 2
    assert result["stab_s"] is None
    assert result["st"]["hr"] == 107.1
    assert result["st"]["sbp"] == 99.4
    assert result["st"]["dbp"] == pytest.approx(59.6)


def test_manual_early_finish_includes_actions_at_the_stop_second():
    result = api._vit_replay("anaphylaxis_jasur", [
        {"id": "epi_thigh", "t": 0},
        {"id": "oxygen_high", "t": 1},
        {"id": "crystalloid_bolus", "t": 2},
    ], 0, elapsed_seconds=2)

    assert result["stab_s"] == 2
    assert result["req_done"] == 3

def test_immediate_finish_does_not_apply_a_deterioration_tick():
    result = api._vit_replay("anaphylaxis_jasur", [
        {"id": "epi_thigh", "t": 0},
    ], 0, elapsed_seconds=0)

    assert result["seconds_used"] == 0
    assert result["stab_s"] is None
    assert result["st"]["hr"] == 107
    assert result["st"]["sbp"] == 100
    assert result["st"]["dbp"] == 60
    assert result["st"]["spo2"] == 90
    assert result["st"]["rr"] == 27


def test_report_timeline_rejects_actions_after_stop_time():
    from fastapi import HTTPException

    actions = [api.VitalsLogItem(id="epi_thigh", t=3)]
    with pytest.raises(HTTPException) as exc:
        api._vit_validate_report_timeline(actions, elapsed_seconds=2)
    assert exc.value.status_code == 400


def test_report_timeline_rejects_actions_after_stabilization():
    from fastapi import HTTPException

    actions = [
        api.VitalsLogItem(id="epi_thigh", t=0),
        api.VitalsLogItem(id="oxygen_high", t=1),
        api.VitalsLogItem(id="crystalloid_bolus", t=2),
        api.VitalsLogItem(id="some_action", t=3),
    ]
    with pytest.raises(HTTPException) as exc:
        api._vit_validate_report_timeline(actions, elapsed_seconds=5, stabilized_at=2)
    assert exc.value.status_code == 400


def test_report_timeline_accepts_actions_at_stop_and_stabilization_second():
    actions = [
        api.VitalsLogItem(id="epi_thigh", t=0),
        api.VitalsLogItem(id="oxygen_high", t=1),
        api.VitalsLogItem(id="crystalloid_bolus", t=2),
    ]
    api._vit_validate_report_timeline(actions, elapsed_seconds=2, stabilized_at=2)
