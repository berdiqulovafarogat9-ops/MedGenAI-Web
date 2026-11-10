import pytest
from test_regressions import api
from test_audit_regressions import ready_user


@pytest.mark.parametrize(
    ("subject_id", "quiz_terms", "exam_terms"),
    [
        ("CHEM-SAMPI-1", ("bikarbonat", "peptid", "xolesterin"), ("respirator", "ferment", "gemoglobin")),
        ("BIO-SAMPI-1", ("xromosoma", "barr", "leishmania"), ("crossing-over", "geteroplazmiya", "plasmodium")),
    ],
)
def test_curated_chemistry_and_biology_have_distinct_quiz_and_exam_banks(
    client, subject_id, quiz_terms, exam_terms
):
    username, headers = ready_user(client, "academy_curated_bank")
    api.user_profiles[username]["academic_status"] = "approved"

    quiz_response = client.post(
        "/api/v1/academy/assessment/start",
        headers=headers,
        json={"course": 1, "subject_id": subject_id, "assessment_type": "quiz"},
    )
    assert quiz_response.status_code == 200, quiz_response.text
    quiz_items = quiz_response.json()["items"]
    assert len(quiz_items) == 5
    assert all(len(item["options"]) == 4 for item in quiz_items)
    bank = api._academy_question_bank(1, api._academy_subject(1, subject_id))
    assert all(0 <= item["answer"] < len(item["options"]) for item in bank["quiz"])
    quiz_text = " ".join(item["question"].lower() for item in quiz_items)
    assert any(term in quiz_text for term in quiz_terms)
    assert not any(item["question"].startswith("Which statement best describes") for item in quiz_items)

    exam_response = client.post(
        "/api/v1/academy/assessment/start",
        headers=headers,
        json={"course": 1, "subject_id": subject_id, "assessment_type": "theory_exam"},
    )
    assert exam_response.status_code == 200, exam_response.text
    exam_items = exam_response.json()["items"]
    assert len(exam_items) == 10
    assert all(len(item["options"]) == 4 for item in exam_items)
    assert all(0 <= item["answer"] < len(item["options"]) for item in bank["exam"])
    exam_text = " ".join(item["question"].lower() for item in exam_items)
    assert any(term in exam_text for term in exam_terms)
    assert {item["question"] for item in quiz_items}.isdisjoint(
        {item["question"] for item in exam_items}
    )
