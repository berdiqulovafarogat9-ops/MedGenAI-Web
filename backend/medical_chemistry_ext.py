"""Medical Chemistry learning extension: authenticated, server-validated assessments."""
from datetime import datetime, timezone
from fastapi import Depends, HTTPException
from pydantic import BaseModel, Field

try:
    from . import main as core
except ImportError:
    import main as core

CHEMISTRY_QUESTIONS = [
    {"id":"chem-clin-001","topic":"Bufer tizimlari","question":"Qonda pH pasayganda bikarbonat bufer tizimining asosiy vazifasi qaysi?","scenario":"Bemorning arterial qonida metabolik atsidoz belgilari kuzatildi.","options":["H+ ionlarini bog‘lash va pH pasayishini cheklash","Kislorodni gemoglobindan ajratish","Glyukozani glikogenga aylantirish","Xolesterinni parchalash"],"answer":0,"explanation":"HCO3− vodorod ionlarini bog‘lab H2CO3 hosil qiladi; tizim pH o‘zgarishini yumshatadi."},
    {"id":"chem-clin-002","topic":"Gemoglobin va gem","question":"Gem tarkibidagi temirning kislorod bilan qaytar bog‘lanishi uchun qaysi oksidlanish darajasi zarur?","scenario":"Gemoglobin kislorodni o‘pkadan to‘qimalarga tashiydi.","options":["Fe2+","Fe3+","Fe4+","Metall temir Fe0"],"answer":0,"explanation":"Normal gemoglobinda temir Fe2+ holatida bo‘ladi; Fe3+ metgemoglobin kislorod tashishda samarali qatnashmaydi."},
    {"id":"chem-clin-003","topic":"Lipidlar","question":"Ateroskleroz xavfi bilan ko‘proq bog‘liq lipoprotein qaysi?","scenario":"Lipidogrammada LDL xolesterin yuqori.","options":["LDL","HDL","Xilomikron","Albumin"],"answer":0,"explanation":"LDL xolesterinni periferik to‘qimalarga tashiydi; uning ortishi ateroskleroz xavfi bilan bog‘liq."},
    {"id":"chem-clin-004","topic":"Purинlar almashinuvi","question":"Podagrada bo‘g‘imlarda to‘planadigan kristallar qaysi modda bilan bog‘liq?","scenario":"Bemorning bosh barmoq bo‘g‘imida keskin og‘riq va shish bor; siydik kislotasi yuqori.","options":["Natriy urat","Kalsiy oksalat","Bilirubin","Kreatin"],"answer":0,"explanation":"Giperurikemiyada mononatriy urat kristallari bo‘g‘imlarda to‘planishi mumkin."},
    {"id":"chem-clin-005","topic":"Aspirin va esterlar","question":"Aspirinning asosiy farmakologik ta’siri qaysi fermentni qaytmas atsetillash bilan bog‘liq?","scenario":"Aspirin trombotsitlar agregatsiyasini kamaytirish uchun qo‘llanadi.","options":["Siklooksigenaza (COX)","Alfa-amilaza","Katalaza","Laktatdegidrogenaza"],"answer":0,"explanation":"Aspirin COX-1/COX-2 ni atsetillaydi; trombotsitlarda tromboksan A2 sintezi kamayadi."},
    {"id":"chem-clin-006","topic":"Oqsillar va aminokislotalar","question":"Biuret reaksiyasida binafsha rang paydo bo‘lishi nimani ko‘rsatadi?","scenario":"Laboratoriya talabasiga noma’lum eritmada oqsil bor-yo‘qligini aniqlash topshirildi.","options":["Peptid bog‘lari mavjudligini","Glyukoza borligini","Xlorid ionlarini","To‘yinmagan lipidlarni"],"answer":0,"explanation":"Ishqoriy muhitda Cu2+ ionlari peptid bog‘lari bilan kompleks hosil qilib binafsha rang beradi."}
]

class ChemistryAnswer(BaseModel):
    question_id: str = Field(min_length=5, max_length=40)
    selected_index: int = Field(ge=0, le=10)

@core.app.get("/api/v1/chemistry/clinical-question")
def chemistry_clinical_question(index: int = 0, user=Depends(core.get_current_user)):
    if index < 0 or index >= len(CHEMISTRY_QUESTIONS):
        raise HTTPException(status_code=404, detail="Savol topilmadi.")
    q = CHEMISTRY_QUESTIONS[index]
    return {"status":"ok","index":index,"total":len(CHEMISTRY_QUESTIONS),
            "question":{k:v for k,v in q.items() if k not in {"answer","explanation"}}}

@core.app.post("/api/v1/chemistry/clinical-submit")
def chemistry_clinical_submit(data: ChemistryAnswer, user=Depends(core.get_current_user)):
    q = next((item for item in CHEMISTRY_QUESTIONS if item["id"] == data.question_id), None)
    if q is None:
        raise HTTPException(status_code=404, detail="Savol topilmadi.")
    profile = core.user_profiles.setdefault(user["username"], {})
    attempts = profile.setdefault("chemistry_attempts", {})
    previous = attempts.get(q["id"])
    correct = data.selected_index == q["answer"]
    awarded = bool(correct and not (previous or {}).get("points_awarded"))
    if awarded:
        profile["chemistry_points"] = int(profile.get("chemistry_points", 0)) + 10
    attempts[q["id"]] = {
        "selected_index": data.selected_index,
        "is_correct": correct,
        "points_awarded": bool((previous or {}).get("points_awarded") or awarded),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    core._db_save()
    return {"status":"recorded","correct":correct,"awarded_points":10 if awarded else 0,
            "total_points":int(profile.get("chemistry_points",0)),
            "correct_index":q["answer"],"explanation":q["explanation"]}
