from datetime import datetime, timezone
import hashlib
import json
import xml.etree.ElementTree as ET
import os
import secrets
import re
from typing import Any
from urllib.parse import quote
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel
from rdkit import Chem, DataStructs
from rdkit.Chem import AllChem, Descriptors, Lipinski, QED, rdMolDescriptors

try:
    from vina import Vina
    VINA_AVAILABLE = True
except Exception:
    VINA_AVAILABLE = False


# =========================================================
# APP
# =========================================================

app = FastAPI(
    title="MedGen AI API",
    version="1.1.0",
    docs_url="/api/docs",
)


# =========================================================
# CORS
# =========================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://medgenai-web-1.onrender.com",
        "https://medgenai-web.onrender.com",
        "http://localhost:8080",
        "http://127.0.0.1:8080",
    ],
    allow_credentials=True,
    allow_methods=[
        "GET",
        "POST",
        "PUT",
        "PATCH",
        "DELETE",
        "OPTIONS",
    ],
    allow_headers=["*"],
)


# =========================================================
# SECURITY
# =========================================================

security = HTTPBearer(auto_error=False)

ADMIN_USERNAME = os.getenv(
    "MEDGEN_ADMIN_USERNAME",
    "admin",
)

ADMIN_PASSWORD = os.getenv("MEDGEN_ADMIN_PASSWORD")
if not ADMIN_PASSWORD:
    if os.getenv("RENDER"):
        raise RuntimeError("MEDGEN_ADMIN_PASSWORD is required in production.")
    ADMIN_PASSWORD = "MedGenAI-Admin-2026"

SECRET_KEY = os.getenv("MEDGEN_SECRET_KEY")
if not SECRET_KEY:
    if os.getenv("RENDER"):
        raise RuntimeError("MEDGEN_SECRET_KEY is required in production.")
    SECRET_KEY = secrets.token_urlsafe(32)

TOKEN_TTL_SECONDS = int(os.getenv("MEDGEN_TOKEN_TTL_SECONDS", "28800"))

tokens = {}
token_created_at = {}
login_attempts = {}
LOGIN_WINDOW_SECONDS = int(os.getenv("MEDGEN_LOGIN_WINDOW_SECONDS", "300"))
LOGIN_MAX_ATTEMPTS = int(os.getenv("MEDGEN_LOGIN_MAX_ATTEMPTS", "8"))
user_profiles = {}
user_accounts = {}
user_consents = {}
activity_log = []
jobs_store = []
docking_jobs_store = {}
workflows_store = []
reports_store = []
experiments_store = []


# =========================================================
# MODELS
# =========================================================

class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    full_name: str
    email: str
    phone: str = ""
    country: str = ""
    organization: str = ""


class AccountUpdateRequest(BaseModel):
    username: str | None = None
    phone: str | None = None
    email: str | None = None


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str


class ProfileRequest(BaseModel):
    full_name: str = ""
    email: str = ""
    organization: str = ""
    country: str = ""
    birth_year: int | None = None
    birth_month: int | None = None
    birth_day: int | None = None
    research_interests: str = ""
    bio: str = ""
    avatar: str = ""


class ConsentRequest(BaseModel):
    terms_accepted: bool
    privacy_accepted: bool
    data_processing_accepted: bool
    research_disclaimer_accepted: bool


class MoleculeRequest(BaseModel):
    smiles: str


class JobRequest(BaseModel):
    job_type: str
    input: dict[str, Any] = {}


class ResearchRequest(BaseModel):
    query: str
    limit: int = 10


class WorkflowRequest(BaseModel):
    workflow_type: str
    input: dict[str, Any] = {}


class ExperimentRequest(BaseModel):
    name: str = ""
    workflow_type: str = "drug_discovery"
    target: str = ""
    input: dict[str, Any] = {}
    parameters: dict[str, Any] = {}
    results: dict[str, Any] = {}
    status: str = "completed"


class ExperimentUpdateRequest(BaseModel):
    status: str | None = None
    parameters: dict[str, Any] | None = None
    results: dict[str, Any] | None = None


class DiscoveryRequest(BaseModel):
    target: str


class SequenceRequest(BaseModel):
    sequence: str
    sequence_type: str = "AUTO"


# =========================================================
# AUTH FUNCTIONS
# =========================================================

def validate_password(password: str):
    if len(password) < 8 or not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters and contain letters and numbers.")


def validate_username(username: str):
    if not re.fullmatch(r"[A-Za-z0-9_.-]{3,32}", username):
        raise HTTPException(status_code=400, detail="Username must be 3-32 characters.")


def make_password_hash(password: str) -> str:
    return hashlib.sha256((SECRET_KEY + ":" + password).encode()).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    return secrets.compare_digest(make_password_hash(password), password_hash)


def make_token(username: str) -> str:
    raw = (
        f"{username}:"
        f"{datetime.now(timezone.utc).timestamp()}:"
        f"{secrets.token_hex(16)}:"
        f"{SECRET_KEY}"
    )

    return hashlib.sha256(
        raw.encode()
    ).hexdigest()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(
        security
    ),
):
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
        )

    username = tokens.get(credentials.credentials)
    created_at = token_created_at.get(credentials.credentials)

    if not username or not created_at:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    try:
        created_dt = datetime.fromisoformat(created_at)
        age = (datetime.now(timezone.utc) - created_dt).total_seconds()
    except (TypeError, ValueError):
        tokens.pop(credentials.credentials, None)
        token_created_at.pop(credentials.credentials, None)
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    if age > TOKEN_TTL_SECONDS:
        tokens.pop(credentials.credentials, None)
        token_created_at.pop(credentials.credentials, None)
        raise HTTPException(status_code=401, detail="Token expired")

    return {
        "username": username,
        "role": (
            "SUPER_ADMIN"
            if username == ADMIN_USERNAME
            else "USER"
        ),
    }


# =========================================================
# HEALTH
# =========================================================

@app.get("/api/v1/health/live")
def health_live():
    return {
        "status": "ok",
        "service": "medgen-api",
        "version": "1.1.0",
        "timestamp": datetime.now(
            timezone.utc
        ).isoformat(),
    }


# =========================================================
# AUTH
# =========================================================

@app.post("/api/v1/auth/login")
def login(data: LoginRequest):
    now = datetime.now(timezone.utc)
    key = data.username.strip().lower()
    attempts = login_attempts.get(key, [])
    attempts = [t for t in attempts if (now - t).total_seconds() < LOGIN_WINDOW_SECONDS]

    if len(attempts) >= LOGIN_MAX_ATTEMPTS:
        raise HTTPException(status_code=429, detail="Too many login attempts. Try again later.")

    registered = user_accounts.get(data.username)
    valid_registered = registered and verify_password(data.password, registered["password_hash"])
    valid_admin = data.username == ADMIN_USERNAME and data.password == ADMIN_PASSWORD
    if not valid_registered and not valid_admin:
        attempts.append(now)
        login_attempts[key] = attempts
        raise HTTPException(status_code=401, detail="Invalid username or password")

    login_attempts.pop(key, None)
    token = make_token(data.username)
    tokens[token] = data.username
    token_created_at[token] = now.isoformat()
    activity_log.insert(0, {"type": "login", "username": data.username, "at": now.isoformat()})
    return {"access_token": token, "token_type": "bearer"}


@app.post("/api/v1/auth/register")
def register(data: RegisterRequest):
    username = data.username.strip()
    validate_username(username)
    validate_password(data.password)
    if username.lower() == ADMIN_USERNAME.lower() or username in user_accounts:
        raise HTTPException(status_code=409, detail="Username already exists.")
    email = data.email.strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Valid email is required.")
    user_accounts[username] = {
        "username": username,
        "password_hash": make_password_hash(data.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    user_profiles[username] = {
        "full_name": data.full_name.strip(), "email": email, "phone": data.phone.strip(),
        "country": data.country.strip(), "organization": data.organization.strip(),
        "birth_year": None, "birth_month": None, "birth_day": None,
        "research_interests": "", "bio": "", "avatar": "",
    }
    return {"status": "registered", "username": username}


@app.get("/api/v1/auth/me")
def me(
    user=Depends(get_current_user),
):
    profile = user_profiles.get(user["username"], {})
    consent = user_consents.get(user["username"], {})
    return {
        **user,
        "profile": profile,
        "consent": consent,
        "profile_complete": bool(profile.get("full_name")),
        "consent_complete": all([
            consent.get("terms_accepted", False),
            consent.get("privacy_accepted", False),
            consent.get("data_processing_accepted", False),
            consent.get("research_disclaimer_accepted", False),
        ]),
    }


@app.post("/api/v1/auth/logout")
def logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if credentials:
        username = tokens.pop(credentials.credentials, None)
        token_created_at.pop(credentials.credentials, None)
        if username:
            activity_log.insert(0, {
                "type": "logout",
                "username": username,
                "at": datetime.now(timezone.utc).isoformat(),
            })
    return {"status": "logged_out"}


@app.get("/api/v1/account")
def account(user=Depends(get_current_user)):
    profile = user_profiles.get(user["username"], {})
    return {"username": user["username"], "email": profile.get("email", ""), "phone": profile.get("phone", ""), "role": user["role"]}


@app.patch("/api/v1/account")
def update_account(data: AccountUpdateRequest, user=Depends(get_current_user)):
    current = user["username"]
    if data.username is not None:
        new_username = data.username.strip()
        validate_username(new_username)
        if new_username != current and (new_username.lower() == ADMIN_USERNAME.lower() or new_username in user_accounts or new_username in tokens.values()):
            raise HTTPException(status_code=409, detail="Username already exists.")
        if new_username != current:
            if current in user_accounts:
                user_accounts[new_username] = user_accounts.pop(current)
                user_accounts[new_username]["username"] = new_username
            if current in user_profiles:
                user_profiles[new_username] = user_profiles.pop(current)
            for token, owner in list(tokens.items()):
                if owner == current:
                    tokens[token] = new_username
            current = new_username
    profile = user_profiles.setdefault(current, {})
    if data.phone is not None:
        profile["phone"] = data.phone.strip()
    if data.email is not None:
        email = data.email.strip().lower()
        if "@" not in email:
            raise HTTPException(status_code=400, detail="Valid email is required.")
        profile["email"] = email
    return {"status": "updated", "username": current, "email": profile.get("email", ""), "phone": profile.get("phone", "")}


@app.post("/api/v1/account/password")
def change_password(data: PasswordChangeRequest, user=Depends(get_current_user)):
    account = user_accounts.get(user["username"])
    if not account:
        raise HTTPException(status_code=400, detail="Password change requires a registered account.")
    if not verify_password(data.current_password, account["password_hash"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect.")
    validate_password(data.new_password)
    account["password_hash"] = make_password_hash(data.new_password)
    for token, owner in list(tokens.items()):
        if owner == user["username"]:
            tokens.pop(token, None)
            token_created_at.pop(token, None)
    return {"status": "updated", "message": "Password changed. Please sign in again."}


@app.get("/api/v1/profile")
def get_profile(user=Depends(get_current_user)):
    return {
        "username": user["username"],
        "role": user["role"],
        "profile": user_profiles.get(user["username"], {}),
    }


@app.put("/api/v1/profile")
def update_profile(
    data: ProfileRequest,
    user=Depends(get_current_user),
):
    if not data.full_name.strip():
        raise HTTPException(status_code=400, detail="To‘liq ism majburiy.")
    if not data.email.strip() or "@" not in data.email:
        raise HTTPException(status_code=400, detail="To‘g‘ri email manzili majburiy.")
    if not data.country.strip():
        raise HTTPException(status_code=400, detail="Mamlakat majburiy.")
    if data.birth_year is None or data.birth_month is None or data.birth_day is None:
        raise HTTPException(status_code=400, detail="Tug‘ilgan yil, oy va kun majburiy.")
    if data.birth_month is not None and not 1 <= data.birth_month <= 12:
        raise HTTPException(
            status_code=400,
            detail="Tug‘ilgan oy 1 dan 12 gacha bo‘lishi kerak.",
        )

    if data.birth_day is not None and not 1 <= data.birth_day <= 31:
        raise HTTPException(
            status_code=400,
            detail="Tug‘ilgan kun 1 dan 31 gacha bo‘lishi kerak.",
        )

    if data.birth_year is not None and not 1900 <= data.birth_year <= 2100:
        raise HTTPException(
            status_code=400,
            detail="Tug‘ilgan yil noto‘g‘ri.",
        )

    profile = data.model_dump()
    user_profiles[user["username"]] = profile

    activity_log.insert(
        0,
        {
            "type": "profile_updated",
            "username": user["username"],
            "at": datetime.now(timezone.utc).isoformat(),
        },
    )

    return {
        "status": "saved",
        "username": user["username"],
        "profile": profile,
    }


@app.get("/api/v1/legal/documents")
def legal_documents():
    return {
        "version": "1.0",
        "terms": {
            "title": "MedGen AI Ommaviy Oferta va Foydalanish Shartlari",
            "text": "MedGen AI ilmiy tadqiqot va hisoblash platformasi. Platformadagi natijalar tadqiqot va ishlab chiqish maqsadida taqdim etiladi. Ular mustaqil ilmiy ekspertiza, klinik tashxis yoki davolash bo‘yicha ko‘rsatma o‘rnini bosmaydi."
        },
        "privacy": {
            "title": "Maxfiylik siyosati",
            "text": "Platforma hisob, xavfsizlik va ilmiy ish jarayonlarini yuritish uchun zarur bo‘lgan ma’lumotlarni qayta ishlashi mumkin. Foydalanuvchi profilidagi ixtiyoriy ma’lumotlar foydalanuvchi tomonidan kiritiladi."
        },
        "data_processing": {
            "title": "Ma’lumotlarni qayta ishlashga rozilik",
            "text": "Foydalanuvchi platforma funksiyalarini ishlatish uchun yuborgan ma’lumotlarini autentifikatsiya, ilmiy workflow va xizmat xavfsizligi doirasida qayta ishlashga rozilik beradi."
        },
        "research_disclaimer": {
            "title": "Ilmiy natijalar bo‘yicha ogohlantirish",
            "text": "Hisoblash natijalari eksperimental yoki klinik tasdiq emas. Dori, tashxis yoki davolash qarorlari faqat tegishli malakali mutaxassislar tomonidan mustaqil baholanishi kerak."
        }
    }


@app.post("/api/v1/legal/consent")
def save_consent(data: ConsentRequest, user=Depends(get_current_user)):
    if not all([
        data.terms_accepted,
        data.privacy_accepted,
        data.data_processing_accepted,
        data.research_disclaimer_accepted,
    ]):
        raise HTTPException(status_code=400, detail="All required agreements must be accepted.")
    consent = {**data.model_dump(), "version": "1.0", "accepted_at": datetime.now(timezone.utc).isoformat()}
    user_consents[user["username"]] = consent
    activity_log.insert(0, {"type": "consent", "username": user["username"], "at": consent["accepted_at"]})
    return {"status": "accepted", "consent": consent}


# =========================================================
# MOLECULAR ANALYSIS
# =========================================================

@app.post("/api/v1/molecules/analyze")
def molecule_analyze(
    data: MoleculeRequest,
    user=Depends(get_current_user),
):
    smiles = data.smiles.strip()
    if not smiles:
        raise HTTPException(status_code=400, detail="SMILES is required")

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise HTTPException(status_code=400, detail="Invalid SMILES")

    descriptors = {
        "molecular_formula": rdMolDescriptors.CalcMolFormula(mol),
        "molecular_weight": round(Descriptors.MolWt(mol), 4),
        "exact_molecular_weight": round(Descriptors.ExactMolWt(mol), 4),
        "logP": round(Descriptors.MolLogP(mol), 4),
        "TPSA": round(Descriptors.TPSA(mol), 4),
        "HBD": int(Lipinski.NumHDonors(mol)),
        "HBA": int(Lipinski.NumHAcceptors(mol)),
        "rotatable_bonds": int(Lipinski.NumRotatableBonds(mol)),
        "ring_count": int(Lipinski.RingCount(mol)),
        "aromatic_rings": int(Lipinski.NumAromaticRings(mol)),
        "heavy_atoms": int(mol.GetNumHeavyAtoms()),
        "formal_charge": int(Chem.GetFormalCharge(mol)),
        "fraction_csp3": round(Lipinski.FractionCSP3(mol), 4),
        "QED": round(QED.qed(mol), 4),
    }
    checks = {
        "MW_le_500": descriptors["molecular_weight"] <= 500,
        "HBD_le_5": descriptors["HBD"] <= 5,
        "HBA_le_10": descriptors["HBA"] <= 10,
        "LogP_le_5": descriptors["logP"] <= 5,
    }
    return {
        "status": "completed",
        "module": "Molecular Analysis",
        "smiles": Chem.MolToSmiles(mol),
        "user": user["username"],
        "analysis": descriptors,
        "lipinski_rule_of_5": {
            "checks": checks,
            "violations": sum(1 for x in checks.values() if not x),
            "pass": sum(1 for x in checks.values() if x) >= 3,
        },
        "engine": "RDKit",
        "message": "Real molecular descriptors calculated with RDKit.",
    }

# =========================================================
# BIOINFORMATICS
# =========================================================

def detect_sequence_type(
    sequence: str,
) -> str:

    clean = (
        sequence
        .upper()
        .replace(" ", "")
        .replace("\n", "")
        .replace("\r", "")
    )

    if not clean:
        return "UNKNOWN"

    dna_chars = set("ACGTN")
    rna_chars = set("ACGUN")

    chars = set(clean)

    if chars.issubset(dna_chars):
        return "DNA"

    if chars.issubset(rna_chars):
        return "RNA"

    return "PROTEIN"


@app.post(
    "/api/v1/bioinformatics/analyze"
)
def bioinformatics_analyze(
    data: SequenceRequest,
    user=Depends(get_current_user),
):

    sequence = (
        data.sequence
        .upper()
        .replace(" ", "")
        .replace("\n", "")
        .replace("\r", "")
    )

    if not sequence:
        raise HTTPException(
            status_code=400,
            detail="Sequence is required",
        )

    detected_type = detect_sequence_type(
        sequence
    )

    requested_type = (
        data.sequence_type.upper()
    )

    if requested_type != "AUTO":
        detected_type = requested_type

    a_count = sequence.count("A")
    c_count = sequence.count("C")
    g_count = sequence.count("G")
    t_count = sequence.count("T")
    u_count = sequence.count("U")

    gc_count = g_count + c_count
    at_count = a_count + t_count

    length = len(sequence)

    gc_content = (
        round(
            (gc_count / length) * 100,
            2,
        )
        if length
        else 0
    )

    at_content = (
        round(
            (at_count / length) * 100,
            2,
        )
        if length
        else 0
    )

    return {
        "status": "completed",
        "module": "Bioinformatics",
        "user": user["username"],
        "sequence_type": detected_type,
        "length": length,
        "composition": {
            "A": a_count,
            "C": c_count,
            "G": g_count,
            "T": t_count,
            "U": u_count,
        },
        "gc_content_percent": gc_content,
        "at_content_percent": at_content,
        "message": (
            "Sequence analysis completed."
        ),
    }


@app.post(
    "/api/v1/workflows/bioinformatics"
)
def bioinformatics_workflow(
    data: SequenceRequest,
    user=Depends(get_current_user),
):

    return bioinformatics_analyze(
        data,
        user,
    )


# =========================================================
# PDB / STRUCTURE
# =========================================================

@app.get(
    "/api/v1/pdb/structures/{pdb_id}"
)
def pdb_structure(
    pdb_id: str,
    user=Depends(get_current_user),
):

    pdb_id = (
        pdb_id
        .strip()
        .upper()
    )

    if len(pdb_id) != 4:
        raise HTTPException(
            status_code=400,
            detail="PDB ID must contain 4 characters.",
        )

    url = (
        "https://data.rcsb.org/rest/v1/core/entry/"
        + quote(pdb_id)
    )

    try:

        request = Request(
            url,
            headers={
                "User-Agent": "MedGenAI/1.1"
            },
        )

        with urlopen(
            request,
            timeout=15,
        ) as response:

            raw = (
                response
                .read()
                .decode("utf-8")
            )

        data = json.loads(raw)

    except HTTPError as exc:

        if exc.code == 404:
            raise HTTPException(
                status_code=404,
                detail=(
                    f"PDB structure "
                    f"{pdb_id} not found."
                ),
            )

        raise HTTPException(
            status_code=502,
            detail=(
                "RCSB PDB service returned "
                "an error."
            ),
        )

    except (
        URLError,
        TimeoutError,
    ):

        raise HTTPException(
            status_code=503,
            detail=(
                "Unable to connect "
                "to RCSB PDB."
            ),
        )

    entry = data.get(
        "struct",
        {},
    )

    rcsb_id = data.get(
        "rcsb_id",
        pdb_id,
    )

    return {
        "status": "completed",
        "module": "PDB & Structure",
        "user": user["username"],
        "pdb_id": rcsb_id,
        "title": entry.get(
            "title"
        ),
        "source": (
            "RCSB Protein Data Bank"
        ),
        "data": data,
    }


# =========================================================
# JOBS
# =========================================================

@app.get("/api/v1/jobs")
def list_jobs(user=Depends(get_current_user)):
    items = [j for j in jobs_store if j["user"] == user["username"]]
    return {"jobs": items, "count": len(items), "user": user["username"]}


@app.post("/api/v1/jobs")
def create_job(
    data: JobRequest,
    user=Depends(get_current_user),
):

    job = {
        "id": secrets.token_hex(8),
        "status": "submitted",
        "job_type": data.job_type,
        "input": data.input,
        "user": user["username"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    jobs_store.insert(0, job)
    return job


# =========================================================
# REPORTS
# =========================================================

@app.get("/api/v1/reports")
def reports(user=Depends(get_current_user)):
    items = [r for r in reports_store if r["user"] == user["username"]]
    return {"reports": items, "count": len(items), "user": user["username"]}


# =========================================================
# WORKFLOWS
# =========================================================

@app.post("/api/v1/workflows")
def create_workflow(
    data: WorkflowRequest,
    user=Depends(get_current_user),
):

    workflow = {
        "id": secrets.token_hex(8),
        "status": "submitted",
        "workflow_type": data.workflow_type,
        "input": data.input,
        "user": user["username"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    workflows_store.insert(0, workflow)
    return workflow


@app.get("/api/v1/workflows")
def list_workflows(user=Depends(get_current_user)):
    items = [w for w in workflows_store if w["user"] == user["username"]]
    return {"workflows": items, "count": len(items), "user": user["username"]}


# =========================================================
# DRUG DISCOVERY
# =========================================================

@app.post(
    "/api/v1/discovery/sessions"
)
def discovery_session(
    data: DiscoveryRequest,
    user=Depends(get_current_user),
):

    return {
        "status": "created",
        "target": data.target,
        "user": user["username"],
        "message": (
            "Drug Discovery session "
            "created."
        ),
    }


# =========================================================
# REPRODUCIBLE EXPERIMENTS
# =========================================================

@app.post("/api/v1/experiments")
def create_experiment(
    data: ExperimentRequest,
    user=Depends(get_current_user),
):
    target = data.target.strip()
    if data.workflow_type == "drug_discovery" and not target:
        raise HTTPException(status_code=400, detail="Target is required for drug discovery experiments")

    now = datetime.now(timezone.utc).isoformat()
    experiment = {
        "id": secrets.token_hex(10),
        "name": data.name.strip() or f"{data.workflow_type.replace('_', ' ').title()} Experiment",
        "workflow_type": data.workflow_type.strip() or "drug_discovery",
        "target": target,
        "status": data.status.strip() or "completed",
        "input": data.input,
        "parameters": data.parameters,
        "results": data.results,
        "user": user["username"],
        "created_at": now,
        "updated_at": now,
        "reproducibility": {
            "api_version": app.version,
            "rdkit_available": True,
            "docking_engine_available": VINA_AVAILABLE,
        },
    }
    experiments_store.insert(0, experiment)
    activity_log.insert(0, {
        "type": "experiment_created",
        "username": user["username"],
        "experiment_id": experiment["id"],
        "workflow_type": experiment["workflow_type"],
        "target": target,
        "at": now,
    })
    return experiment


@app.get("/api/v1/experiments")
def list_experiments(user=Depends(get_current_user)):
    items = [e for e in experiments_store if e["user"] == user["username"]]
    return {"experiments": items, "count": len(items), "user": user["username"]}


@app.get("/api/v1/experiments/{experiment_id}")
def get_experiment(experiment_id: str, user=Depends(get_current_user)):
    experiment = next((e for e in experiments_store if e["id"] == experiment_id), None)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if experiment["user"] != user["username"] and user["role"] != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Access denied")
    return experiment


@app.patch("/api/v1/experiments/{experiment_id}")
def update_experiment(
    experiment_id: str,
    data: ExperimentUpdateRequest,
    user=Depends(get_current_user),
):
    experiment = next((e for e in experiments_store if e["id"] == experiment_id), None)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if experiment["user"] != user["username"] and user["role"] != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Access denied")

    if data.status is not None:
        experiment["status"] = data.status.strip() or experiment["status"]
    if data.parameters is not None:
        experiment["parameters"] = data.parameters
    if data.results is not None:
        experiment["results"] = data.results
    experiment["updated_at"] = datetime.now(timezone.utc).isoformat()
    activity_log.insert(0, {
        "type": "experiment_updated",
        "username": user["username"],
        "experiment_id": experiment_id,
        "status": experiment["status"],
        "at": experiment["updated_at"],
    })
    return experiment


# =========================================================
# RESEARCH
# =========================================================

def normalize_pubmed_query(query: str) -> str:
    q = query.strip()
    replacements = {
        "o‘pka saratoni": "lung cancer",
        "o'pka saratoni": "lung cancer",
        "o'pka": "lung",
        "o‘pka": "lung",
        "saraton": "cancer",
        "mutatsiyalari": "mutations",
        "mutatsiyasi": "mutation",
        "mutatsiya": "mutation",
        "oqsil": "protein",
        "oqsili": "protein",
        "geni": "gene",
        "genlar": "genes",
        "dori": "drug",
        "davolash": "treatment",
        "hujayra": "cell",
    }
    low = q.lower()
    for uz, en in replacements.items():
        low = low.replace(uz, en)
    return low

@app.post(
    "/api/v1/research/search"
)
def research_search(
    data: ResearchRequest,
    user=Depends(get_current_user),
):
    query = data.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Research query is required")
    limit = max(1, min(data.limit, 20))
    url = (
        "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
        "?db=pubmed&term=" + quote(query) +
        "&retmax=" + str(limit) + "&retmode=xml"
    )
    try:
        req = Request(url, headers={"User-Agent": "MedGenAI/1.0"})
        with urlopen(req, timeout=15) as response:
            root = ET.fromstring(response.read())
        pmids = [x.text for x in root.findall(".//Id") if x.text]
        results = []
        if pmids:
            fetch = (
                "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
                "?db=pubmed&id=" + ",".join(pmids) + "&retmode=xml"
            )
            req = Request(fetch, headers={"User-Agent": "MedGenAI/1.0"})
            with urlopen(req, timeout=15) as response:
                articles = ET.fromstring(response.read())
            for article in articles.findall(".//PubmedArticle"):
                node = article.find(".//ArticleTitle")
                title = "".join(node.itertext()) if node is not None else ""
                results.append({
                    "pmid": article.findtext(".//PMID") or "",
                    "title": title,
                    "journal": article.findtext(".//Journal/Title") or "",
                    "publication_date": (
                        article.findtext(".//PubDate/Year")
                        or article.findtext(".//PubDate/MedlineDate")
                        or ""
                    ),
                    "source": "PubMed",
                })
    except (URLError, TimeoutError, ET.ParseError):
        raise HTTPException(status_code=503, detail="PubMed service unavailable")
    return {
        "status": "completed",
        "module": "Scientific Research",
        "query": query,
        "limit": limit,
        "count": len(results),
        "results": results,
        "user": user["username"],
        "source": "NCBI PubMed E-utilities",
    }


# =========================================================
# PUBMED ARTICLE DETAILS
# =========================================================

@app.get("/api/v1/research/pubmed/{pmid}")
def pubmed_article(pmid: str, user=Depends(get_current_user)):
    pmid = pmid.strip()
    if not pmid.isdigit():
        raise HTTPException(status_code=400, detail="PMID must be numeric")
    url = (
        "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
        "?db=pubmed&id=" + quote(pmid) + "&retmode=xml&rettype=abstract"
    )
    try:
        req = Request(url, headers={"User-Agent": "MedGenAI/1.0"})
        with urlopen(req, timeout=15) as response:
            root = ET.fromstring(response.read())
    except (URLError, TimeoutError, ET.ParseError):
        raise HTTPException(status_code=503, detail="PubMed service unavailable")
    article = root.find(".//PubmedArticle")
    if article is None:
        raise HTTPException(status_code=404, detail="PubMed article not found")
    title_node = article.find(".//ArticleTitle")
    abstract_nodes = article.findall(".//Abstract/AbstractText")
    abstract = " ".join("".join(x.itertext()) for x in abstract_nodes)
    return {
        "status": "completed",
        "module": "Scientific Research",
        "pmid": pmid,
        "title": "".join(title_node.itertext()) if title_node is not None else "",
        "abstract": abstract,
        "journal": article.findtext(".//Journal/Title") or "",
        "source": "PubMed",
        "pubmed_url": "https://pubmed.ncbi.nlm.nih.gov/" + pmid + "/",
        "user": user["username"],
    }


# =========================================================
# DRUG DISCOVERY PIPELINE
# =========================================================

class ScreeningRequest(BaseModel):
    target: str
    molecules: list[str] = []


class LibraryFilterRequest(BaseModel):
    target: str = ""
    molecules: list[str] = []
    max_molecular_weight: float = 500.0
    max_logp: float = 5.0
    max_hbd: int = 5
    max_hba: int = 10
    min_qed: float = 0.0


def calculate_molecule_score(smiles: str) -> dict:
    """
    RDKit-based development screening.
    This validates the molecule and calculates real molecular
    properties and a Morgan fingerprint. It is NOT docking,
    binding-affinity prediction, or ADMET prediction.
    """
    smiles = smiles.strip()
    if not smiles:
        raise HTTPException(status_code=400, detail="SMILES cannot be empty")

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise HTTPException(status_code=400, detail=f"Invalid SMILES: {smiles}")

    canonical_smiles = Chem.MolToSmiles(mol)
    mw = Descriptors.MolWt(mol)
    logp = Descriptors.MolLogP(mol)
    tpsa = Descriptors.TPSA(mol)
    hbd = Lipinski.NumHDonors(mol)
    hba = Lipinski.NumHAcceptors(mol)
    rings = Lipinski.RingCount(mol)
    rotatable = Lipinski.NumRotatableBonds(mol)
    qed = QED.qed(mol)

    fpgen = AllChem.GetMorganGenerator(radius=2, fpSize=2048)
    fingerprint = fpgen.GetFingerprint(mol)
    fingerprint_bits = int(fingerprint.GetNumOnBits())

    checks = {
        "MW_le_500": mw <= 500,
        "HBD_le_5": hbd <= 5,
        "HBA_le_10": hba <= 10,
        "LogP_le_5": logp <= 5,
    }
    passed = sum(1 for value in checks.values() if value)

    property_score = round(
        (passed / 4) * 70
        + min(qed, 1.0) * 20
        + min(rings, 5) * 2,
        2,
    )

    return {
        "score": property_score,
        "canonical_smiles": canonical_smiles,
        "molecular_formula": rdMolDescriptors.CalcMolFormula(mol),
        "molecular_weight": round(mw, 4),
        "logP": round(logp, 4),
        "TPSA": round(tpsa, 4),
        "HBD": int(hbd),
        "HBA": int(hba),
        "rotatable_bonds": int(rotatable),
        "ring_count": int(rings),
        "QED": round(qed, 4),
        "heavy_atoms": int(mol.GetNumHeavyAtoms()),
        "formal_charge": int(Chem.GetFormalCharge(mol)),
        "fingerprint": {
            "type": "Morgan",
            "radius": 2,
            "size": 2048,
            "on_bits": fingerprint_bits,
        },
        "lipinski_rule_of_5": {
            "checks": checks,
            "violations": 4 - passed,
            "pass": passed == 4,
        },
        "screening_basis": "RDKit property-based development screening",
    }


@app.post("/api/v1/discovery/filter")
def discovery_filter(
    data: LibraryFilterRequest,
    user=Depends(get_current_user),
):
    if not data.molecules:
        raise HTTPException(status_code=400, detail="At least one molecule is required")

    passed = []
    rejected = []
    for smiles in data.molecules:
        try:
            analysis = calculate_molecule_score(smiles)
        except HTTPException as exc:
            rejected.append({"smiles": smiles, "reason": exc.detail})
            continue

        reasons = []
        if analysis["molecular_weight"] > data.max_molecular_weight:
            reasons.append("molecular_weight")
        if analysis["logP"] > data.max_logp:
            reasons.append("logP")
        if analysis["HBD"] > data.max_hbd:
            reasons.append("HBD")
        if analysis["HBA"] > data.max_hba:
            reasons.append("HBA")
        if analysis["QED"] < data.min_qed:
            reasons.append("QED")

        item = {"smiles": smiles, **analysis}
        if reasons:
            item["filter_failures"] = reasons
            rejected.append(item)
        else:
            item["filter_pass"] = True
            passed.append(item)

    return {
        "status": "completed",
        "module": "Drug Discovery",
        "workflow": "molecule_library_filtering",
        "target": data.target.strip(),
        "input_count": len(data.molecules),
        "passed_count": len(passed),
        "rejected_count": len(rejected),
        "passed": passed,
        "rejected": rejected,
        "filters": {
            "max_molecular_weight": data.max_molecular_weight,
            "max_logp": data.max_logp,
            "max_hbd": data.max_hbd,
            "max_hba": data.max_hba,
            "min_qed": data.min_qed,
        },
        "user": user["username"],
    }


@app.post(
    "/api/v1/discovery/screen"
)
def discovery_screen(
    data: ScreeningRequest,
    user=Depends(get_current_user),
):

    if not data.target.strip():
        raise HTTPException(
            status_code=400,
            detail="Target is required",
        )

    if not data.molecules:
        raise HTTPException(
            status_code=400,
            detail="At least one molecule is required",
        )

    results = []

    for smiles in data.molecules:

        analysis = calculate_molecule_score(
            smiles
        )

        results.append({
            "smiles": smiles,
            **analysis,
        })

    results.sort(
        key=lambda item: item["score"],
        reverse=True,
    )

    for index, item in enumerate(
        results,
        start=1,
    ):
        item["rank"] = index

    return {
        "status": "completed",
        "module": "Drug Discovery",
        "workflow": "virtual_screening",
        "target": data.target,
        "molecule_count": len(results),
        "results": results,
        "user": user["username"],
        "warning": (
            "Development-stage heuristic "
            "screening only. No validated "
            "docking, binding affinity, "
            "ADMET, or clinical prediction "
            "is performed."
        ),
    }



# =========================================================
# MOLECULAR DOCKING ENGINE
# =========================================================

class DockingRequest(BaseModel):
    target: str
    ligand_smiles: str
    center_x: float | None = None
    center_y: float | None = None
    center_z: float | None = None
    size_x: float = 20.0
    size_y: float = 20.0
    size_z: float = 20.0


@app.get("/api/v1/docking/status")
def docking_status(user=Depends(get_current_user)):
    items = list(docking_jobs_store.values())
    return {
        "status": "ready",
        "count": len(items),
        "jobs": items,
        "user": user["username"],
    }


# =========================================================
# SUPER ADMIN
# =========================================================

def require_super_admin(user):
    if user.get("role") != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Super Admin access required")


@app.get("/api/v1/admin/overview")
def admin_overview(user=Depends(get_current_user)):
    require_super_admin(user)
    return {
        "status": "ready",
        "role": user["role"],
        "users": len(set(tokens.values()) | set(user_profiles.keys()) | set(user_consents.keys())),
        "active_tokens": len(tokens),
        "jobs": len(jobs_store),
        "docking_jobs": len(docking_jobs_store),
        "docking_running": sum(1 for x in docking_jobs_store.values() if x.get("status") in ("queued", "running")),
        "experiments": len(experiments_store),
        "reports": len(reports_store),
        "workflows": len(workflows_store),
        "recent_activity": activity_log[:50],
    }


@app.get("/api/v1/admin/users")
def admin_users(user=Depends(get_current_user)):
    require_super_admin(user)
    usernames = sorted(set(tokens.values()) | set(user_profiles.keys()) | set(user_consents.keys()))
    return {
        "users": [
            {
                "username": u,
                "role": "SUPER_ADMIN" if u == ADMIN_USERNAME else "USER",
                "profile": user_profiles.get(u, {}),
                "consent": user_consents.get(u, {}),
                "active_tokens": sum(1 for x in tokens.values() if x == u),
            }
            for u in usernames
        ]
    }


@app.get("/api/v1/admin/tokens")
def admin_tokens(user=Depends(get_current_user)):
    require_super_admin(user)
    return {
        "tokens": [
            {
                "username": username,
                "created_at": token_created_at.get(token),
                "active": True,
            }
            for token, username in tokens.items()
        ]
    }


@app.get("/api/v1/admin/jobs")
def admin_jobs(user=Depends(get_current_user)):
    require_super_admin(user)
    return {"jobs": jobs_store, "count": len(jobs_store)}


@app.get("/api/v1/admin/docking")
def admin_docking(user=Depends(get_current_user)):
    require_super_admin(user)
    items = list(docking_jobs_store.values())
    return {"docking": items, "count": len(items)}


@app.get("/api/v1/admin/experiments")
def admin_experiments(user=Depends(get_current_user)):
    require_super_admin(user)
    return {"experiments": experiments_store, "count": len(experiments_store)}


@app.get("/api/v1/admin/reports")
def admin_reports(user=Depends(get_current_user)):
    require_super_admin(user)
    return {"reports": reports_store, "count": len(reports_store)}


@app.get("/api/v1/admin/workflows")
def admin_workflows(user=Depends(get_current_user)):
    require_super_admin(user)
    return {"workflows": workflows_store, "count": len(workflows_store)}


@app.get("/api/v1/admin/activity")
def admin_activity(user=Depends(get_current_user)):
    require_super_admin(user)
    return {"activity": activity_log[:100]}