"""MedGen AI Phase 1 academic extensions.
Backward-compatible routes layered on top of the existing Phase 1 core.
"""
from datetime import datetime, timezone
from typing import Any
from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field

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


class TeachingAssignmentRequest(BaseModel):
    students: list[str] = Field(max_length=500)


def _active_role(profile, role):
    return profile.get("role") == role and profile.get("role_status", "active") == "active"


@core.app.get("/api/v1/admin/academy/teaching-assignments")
def teaching_assignments(user=Depends(core.get_current_user)):
    core.require_super_admin(user)
    professors, students = [], []
    for username, profile in core.user_profiles.items():
        if username.startswith("__"):
            continue
        item = {"username": username, "full_name": profile.get("full_name", "")}
        if _active_role(profile, "professor"):
            professors.append({**item, "students": profile.get("teaching_students", [])})
        elif _active_role(profile, "student"):
            students.append(item)
    return {"professors": professors, "students": students}


@core.app.put("/api/v1/admin/academy/teaching-assignments/{professor}")
def update_teaching_assignments(professor: str, data: TeachingAssignmentRequest,
                                user=Depends(core.get_current_user)):
    core.require_super_admin(user)
    profile = core.user_profiles.get(professor, {})
    if not _active_role(profile, "professor"):
        raise HTTPException(400, "Active professor required.")
    students = sorted(set(data.students))
    if any(not _active_role(core.user_profiles.get(name, {}), "student") for name in students):
        raise HTTPException(400, "All assignments must reference active students.")
    previous = list(profile.get("teaching_students", []))
    profile["teaching_students"] = students
    core.activity_log.insert(0, {"type": "teaching_assignments_updated",
        "username": user["username"], "professor": professor,
        "previous": previous, "students": students, "at": _now()})
    core._db_save()
    return {"status": "saved", "professor": professor, "students": students}


@core.app.get("/api/v1/academy/professor/overview")
def academy_professor_overview(user=Depends(core.get_current_user)):
    role = str(user.get("role", "")).lower()
    if role not in {"professor", "super_admin"} and user.get("role") != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Professor or Super Admin access required.")
    allowed = set(core.user_profiles.get(user["username"], {}).get("teaching_students", []))
    rows = []
    for username, profile in core.user_profiles.items():
        if username.startswith("__") or str(profile.get("role", "")).lower() != "student":
            continue
        if role == "professor" and username not in allowed:
            continue
        if not _active_role(profile, "student"):
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
            "progress": profile.get("academy_progress", {}),
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
    rec = core._save_academy_assessment(user["username"], data.course, data.subject_id, data.assessment_type, score)
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


# C-stage virtual-patient assessment persistence and leaderboard.
# Additive routes: existing Academy endpoints and records remain unchanged.
class VirtualPatientResultRequest(BaseModel):
    case_id: str = Field(min_length=2, max_length=40)
    case_name: str = Field(min_length=2, max_length=160)
    score: int = Field(ge=0, le=100)
    diagnosis_correct: bool
    first_action_seconds: int | None = Field(default=None, ge=0, le=180)
    actions: list[dict[str, Any]] = Field(default_factory=list, max_length=30)
    errors: list[str] = Field(default_factory=list, max_length=30)
    tab_switch_penalties: int = Field(default=0, ge=0, le=50)
    completed_at: str = Field(min_length=10, max_length=60)
    reason: str = Field(min_length=2, max_length=120)


def _virtual_patient_table():
    if not core.PERSISTENCE_ENABLED or core.psycopg is None:
        raise HTTPException(status_code=503, detail="Persistent database is not configured; result remains local to this browser.")
    with core.psycopg.connect(core.DATABASE_URL) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS student_leaderboard (
                id BIGSERIAL PRIMARY KEY,
                username TEXT NOT NULL,
                case_id TEXT NOT NULL,
                case_name TEXT NOT NULL,
                score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
                diagnosis_correct BOOLEAN NOT NULL,
                first_action_seconds INTEGER,
                tab_switch_penalties INTEGER NOT NULL DEFAULT 0,
                result_json JSONB NOT NULL DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)
        conn.execute("CREATE INDEX IF NOT EXISTS idx_student_leaderboard_score ON student_leaderboard(score DESC, created_at DESC)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_student_leaderboard_username ON student_leaderboard(username, created_at DESC)")
        conn.commit()


@core.app.post("/api/v1/academy/virtual-patient/result")
def save_virtual_patient_result(data: VirtualPatientResultRequest, user=Depends(core.get_current_user)):
    if data.case_id not in {"anaphylaxis", "mi", "pneumonia"}:
        raise HTTPException(status_code=400, detail="Unknown virtual-patient case.")
    if data.first_action_seconds is not None and data.first_action_seconds > 180:
        raise HTTPException(status_code=400, detail="First action time must be within the 3-minute exam.")
    # Sanitize the JSON payload size and avoid trusting a client-provided username.
    payload = data.model_dump(mode="json")
    payload["actions"] = payload["actions"][:30]
    payload["errors"] = [str(e)[:300] for e in payload["errors"][:30]]
    _virtual_patient_table()
    try:
        with core.psycopg.connect(core.DATABASE_URL) as conn:
            row = conn.execute("""
                INSERT INTO student_leaderboard
                    (username, case_id, case_name, score, diagnosis_correct,
                     first_action_seconds, tab_switch_penalties, result_json)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s::jsonb)
                RETURNING id, created_at
            """, (user["username"], data.case_id, data.case_name, data.score,
                  data.diagnosis_correct, data.first_action_seconds,
                  data.tab_switch_penalties, core.json.dumps(payload, ensure_ascii=False))).fetchone()
            conn.commit()
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Could not save assessment to the database.") from exc
    return {"status":"saved", "result_id":row[0], "username":user["username"],
            "created_at":row[1].isoformat(), "score":data.score}


@core.app.get("/api/v1/academy/virtual-patient/leaderboard")
def virtual_patient_leaderboard(limit: int = 10, user=Depends(core.get_current_user)):
    limit = max(1, min(int(limit), 50))
    _virtual_patient_table()
    with core.psycopg.connect(core.DATABASE_URL) as conn:
        rows = conn.execute("""
            SELECT username, MAX(score) AS best_score, COUNT(*) AS attempts,
                   MAX(created_at) AS last_attempt
            FROM student_leaderboard
            GROUP BY username
            ORDER BY best_score DESC, attempts DESC, last_attempt DESC
            LIMIT %s
        """, (limit,)).fetchall()
    return {"status":"ok", "count":len(rows), "items":[
        {"rank":i+1,"username":row[0],"best_score":row[1],"attempts":row[2],
         "last_attempt":row[3].isoformat()} for i,row in enumerate(rows)
    ]}
