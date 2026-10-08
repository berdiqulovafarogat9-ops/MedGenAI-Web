"""MedGen AI Phase 1 academic extensions.
Backward-compatible routes layered on top of the existing Phase 1 core.
"""
from datetime import datetime, timezone
from typing import Any
from fastapi import Depends, HTTPException
from pydantic import BaseModel

try:
    from . import main as core
except ImportError:
    import main as core


class LessonCompletionRequest(BaseModel):
    course: int
    subject_id: str
    lesson_id: str
    completed: bool = True


class AssessmentExtensionRequest(BaseModel):
    course: int
    subject_id: str
    assessment_type: str
    answers: dict[str, int] = {}


def _progress(username: str):
    return core._academy_progress(username)


def _subject(course: int, subject_id: str):
    return core._academy_subject(course, subject_id)


def _now():
    return datetime.now(timezone.utc).isoformat()


@core.app.post("/api/v1/academy/lesson/complete")
def academy_lesson_complete(data: LessonCompletionRequest, user=Depends(core.get_current_user)):
    subject = _subject(data.course, data.subject_id)
    lesson_ids = {
        f"{data.course}-{data.subject_id}-theory-1",
        f"{data.course}-{data.subject_id}-theory-2",
        f"{data.course}-{data.subject_id}-theory-3",
        f"{data.course}-{data.subject_id}-practice-1",
        f"{data.course}-{data.subject_id}-practice-2",
        f"{data.course}-{data.subject_id}-practice-3",
    }
    if data.lesson_id not in lesson_ids:
        raise HTTPException(status_code=404, detail="Lesson not found.")
    p = _progress(user["username"])
    lessons = p.setdefault("_lessons", {})
    key = f"{data.course}:{data.subject_id}:{data.lesson_id}"
    lessons[key] = {"completed": bool(data.completed), "updated_at": _now()}
    core._db_save()
    return {
        "status": "saved",
        "course": data.course,
        "subject_id": data.subject_id,
        "lesson_id": data.lesson_id,
        "completed": bool(data.completed),
        "subject": subject,
    }


@core.app.get("/api/v1/academy/academic-record")
def academy_academic_record(user=Depends(core.get_current_user)):
    ap = core._academy_profile(user["username"])
    p = _progress(user["username"])
    course = int(ap.get("year", 1))
    subjects = []
    lessons = p.get("_lessons", {})
    for sid, name, objective in core.ACADEMY_COURSES[course]["subjects"]:
        rec = p.get(core._academy_key(course, sid), {})
        done = [
            k for k, v in lessons.items()
            if k.startswith(f"{course}:{sid}:") and v.get("completed")
        ]
        subjects.append({
            "subject_id": sid,
            "subject": name,
            "objective": objective,
            "lessons_completed": len(done),
            "assessments": {k: v for k, v in rec.items()},
        })
    return {
        "status": "ok",
        "student": user["username"],
        "academic_profile": ap,
        "course": course,
        "course_title": core.ACADEMY_COURSES[course]["title"],
        "subjects": subjects,
        "record_version": "academy-v2",
    }


@core.app.get("/api/v1/academy/professor/overview")
def academy_professor_overview(user=Depends(core.get_current_user)):
    role = str(user.get("role", "")).lower()
    if role not in {"professor", "super_admin"} and user.get("role") != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Professor or Super Admin access required.")
    rows = []
    for username, profile in core.user_profiles.items():
        if username.startswith("__") or str(profile.get("role", "")).lower() != "student":
            continue
        ap = profile.get("academic_profile") or {}
        rows.append({
            "username": username,
            "full_name": profile.get("full_name", ""),
            "university": ap.get("university", ""),
            "faculty": ap.get("faculty", ""),
            "major": ap.get("major", ""),
            "year": ap.get("year", 1),
            "group": ap.get("group", ""),
            "student_id": ap.get("student_id", ""),
            "progress": _progress(username),
        })
    return {"status": "ok", "count": len(rows), "students": rows[:500]}


@core.app.get("/api/v1/academy/final-audit")
def academy_final_audit(user=Depends(core.get_current_user)):
    role = str(user.get("role", "")).lower()
    if role not in {"student", "professor", "super_admin"} and user.get("role") != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Academy access required.")
    ap = core._academy_profile(user["username"])
    p = _progress(user["username"])
    course = int(ap.get("year", 1))
    required = ["theory", "practice", "quiz", "case", "skills", "osce", "exam"]
    subject_results = []
    for sid, name, _ in core.ACADEMY_COURSES[course]["subjects"]:
        rec = p.get(core._academy_key(course, sid), {})
        passed = {x: bool(rec.get(x, {}).get("passed")) for x in required}
        subject_results.append({
            "subject_id": sid,
            "subject": name,
            "passed": passed,
            "complete": all(passed.values()),
        })
    return {
        "status": "ok",
        "phase": 1,
        "course": course,
        "assessment_requirements": required,
        "subjects": subject_results,
        "academic_record_available": True,
        "lesson_tracking_available": True,
        "professor_overview_available": True,
        "promotion_rule": "No three-question shortcut; all required subject components must be passed.",
        "official_promotion_note": "Platform eligibility does not replace the university's official academic decision.",
    }


@core.app.get("/api/v1/academy/v2/subject/{course}/{subject_id:path}")
def academy_subject_v2(course: int, subject_id: str, user=Depends(core.get_current_user)):
    subject = _subject(course, subject_id)
    bank = core._academy_question_bank(course, subject)
    return {
        "status": "ok",
        "course": course,
        "subject": subject,
        "modules": {
            "theory": [{"id": f"{course}-{subject_id}-theory-{i}", "title": title}
                       for i, title in enumerate(["Core concepts", "Mechanisms and integration", "Evidence and safety"], 1)],
            "practice": [{"id": f"{course}-{subject_id}-practice-{i}", "title": title}
                         for i, title in enumerate(["Guided practice", "Application exercise", "Integration exercise"], 1)],
            "quiz": {"items": [{"id": q["id"], "question": q["question"], "options": q["options"]} for q in bank["quiz"]], "passing_score": 70},
            "case": {"items": [{"id": q["id"], "scenario": q["scenario"], "prompt": q["prompt"], "options": q["options"]} for q in bank["case"]], "passing_score": 70},
            "skills": {"items": bank.get("skills", []), "passing_score": 70},
            "osce": {"items": bank.get("osce", []), "passing_score": 70},
            "exam": {"items": [{"id": q["id"], "question": q["question"], "options": q["options"]} for q in bank["exam"]], "passing_score": 70},
        },
    }


@core.app.post("/api/v1/academy/v2/assessment/submit")
def academy_assessment_v2(data: AssessmentExtensionRequest, user=Depends(core.get_current_user)):
    allowed = {"theory", "practice", "quiz", "case", "skills", "osce", "exam"}
    if data.assessment_type not in allowed:
        raise HTTPException(status_code=400, detail="Invalid assessment type.")
    subject = _subject(data.course, data.subject_id)
    bank = core._academy_question_bank(data.course, subject)
    if data.assessment_type in {"theory", "practice"}:
        score = 100 if data.answers.get("completion") == 1 else 0
        total = 1
    elif data.assessment_type == "skills":
        items = bank.get("skills", [])
        total = len(items)
        score = round(sum(1 for q in items if data.answers.get(q["id"]) == 1) * 100 / total) if total else 0
    elif data.assessment_type == "osce":
        items = bank.get("osce", [])
        total = len(items)
        score = round(sum(1 for q in items if data.answers.get(q["id"]) == 1) * 100 / total) if total else 0
    else:
        items = bank["case"] if data.assessment_type == "case" else bank["exam"] if data.assessment_type == "exam" else bank["quiz"]
        total = len(items)
        score = round(sum(1 for q in items if data.answers.get(q["id"]) == q["answer"]) * 100 / total) if total else 0
    rec = _progress(user["username"]).setdefault(core._academy_key(data.course, data.subject_id), {})
    old = rec.get(data.assessment_type, {})
    rec[data.assessment_type] = {
        "score": score,
        "passed": score >= 70,
        "attempts": int(old.get("attempts", 0)) + 1,
        "updated_at": _now(),
    }
    core._db_save()
    return {"status": "recorded", "score": score, "passed": score >= 70, "total": total, "assessment_type": data.assessment_type, "progress": rec}


@core.app.get("/api/v1/academy/v2/dashboard")
def academy_dashboard_v2(user=Depends(core.get_current_user)):
    ap = core._academy_profile(user["username"])
    p = _progress(user["username"])
    course = int(ap.get("year", 1))
    required = ["theory", "practice", "quiz", "case", "skills", "osce", "exam"]
    subjects = []
    for sid, name, objective in core.ACADEMY_COURSES[course]["subjects"]:
        rec = p.get(core._academy_key(course, sid), {})
        passed = [x for x in required if rec.get(x, {}).get("passed")]
        subjects.append({
            "id": sid,
            "name": name,
            "objective": objective,
            "completed_assessments": passed,
            "complete": len(passed) == len(required),
            "record": rec,
        })
    complete = sum(1 for x in subjects if x["complete"])
    return {
        "status": "ok",
        "course": course,
        "course_title": core.ACADEMY_COURSES[course]["title"],
        "overall_progress": round(complete * 100 / len(subjects)) if subjects else 0,
        "required_components": required,
        "subjects": subjects,
        "academic_profile": ap,
    }
