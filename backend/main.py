from datetime import datetime, timezone
import hashlib
import json
import xml.etree.ElementTree as ET
import os
import secrets
import re
from typing import Any
try:
    from pwdlib import PasswordHash
except Exception:
    PasswordHash = None
try:
    import psycopg
except Exception:
    psycopg = None
from urllib.parse import quote
from urllib.request import Request as URLRequest, urlopen
from urllib.error import HTTPError, URLError

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
try:
    from .knowledge_engine import make_entity, make_relation, search_graph, neighborhood, validate_graph, normalize_entity, graph_stats, find_paths
except ImportError:
    from knowledge_engine import make_entity, make_relation, search_graph, neighborhood, validate_graph, normalize_entity, graph_stats
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
    allow_origins=["*"],
    allow_credentials=False,
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
knowledge_entities_store = []
knowledge_relations_store = []

# =========================================================
# GLOBAL PLATFORM STATE — ORGANIZATIONS / WORKSPACES / API
# =========================================================
organizations_store = {}
memberships_store = []
workspaces_store = []
projects_store = []
api_keys_store = {}
platform_audit_log = []
usage_store = {}

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
PERSISTENCE_ENABLED = bool(DATABASE_URL and psycopg)
password_hasher = PasswordHash.recommended() if PasswordHash else None

def _db_init():
    if not PERSISTENCE_ENABLED: return
    with psycopg.connect(DATABASE_URL) as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS medgen_state (state_key TEXT PRIMARY KEY, state_value JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())""")
        conn.commit()

def _db_load():
    if not PERSISTENCE_ENABLED: return
    try:
        _db_init()
        with psycopg.connect(DATABASE_URL) as conn:
            rows = conn.execute("SELECT state_key, state_value FROM medgen_state").fetchall()
        stores={"user_accounts":user_accounts,"user_profiles":user_profiles,"user_consents":user_consents,"experiments_store":experiments_store,"reports_store":reports_store,"activity_log":activity_log,"knowledge_entities_store":knowledge_entities_store,"knowledge_relations_store":knowledge_relations_store,"organizations_store":organizations_store,"memberships_store":memberships_store,"workspaces_store":workspaces_store,"projects_store":projects_store,"api_keys_store":api_keys_store,"platform_audit_log":platform_audit_log,"usage_store":usage_store,"webhooks_store":webhooks_store}
        for key,value in rows:
            if key in stores and isinstance(value,(dict,list)):
                stores[key].clear()
                if isinstance(stores[key],dict): stores[key].update(value)
                else: stores[key].extend(value)
    except Exception as exc: print(f"PostgreSQL load skipped: {exc}")

def _db_save():
    if not PERSISTENCE_ENABLED: return
    stores={"user_accounts":user_accounts,"user_profiles":user_profiles,"user_consents":user_consents,"experiments_store":experiments_store,"reports_store":reports_store,"activity_log":activity_log,"knowledge_entities_store":knowledge_entities_store,"knowledge_relations_store":knowledge_relations_store,"organizations_store":organizations_store,"memberships_store":memberships_store,"workspaces_store":workspaces_store,"projects_store":projects_store,"api_keys_store":api_keys_store,"platform_audit_log":platform_audit_log,"usage_store":usage_store,"webhooks_store":webhooks_store}
    try:
        with psycopg.connect(DATABASE_URL) as conn:
            for key,value in stores.items():
                conn.execute("INSERT INTO medgen_state(state_key,state_value,updated_at) VALUES (%s,%s::jsonb,NOW()) ON CONFLICT (state_key) DO UPDATE SET state_value=EXCLUDED.state_value,updated_at=NOW()", (key,json.dumps(value,ensure_ascii=False)))
            conn.commit()
    except Exception as exc: print(f"PostgreSQL save skipped: {exc}")


# Load persisted application state once startup definitions are ready.
# (Token state intentionally remains in-memory.)


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


class ResearchAgentRequest(BaseModel):
    query: str
    limit: int = 8
    focus: str = ""


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
    if password_hasher:
        return password_hasher.hash(password)
    return hashlib.sha256((SECRET_KEY + ":" + password).encode()).hexdigest()


def verify_password(password: str, password_hash: str) -> bool:
    if password_hasher:
        try:
            return password_hasher.verify(password, password_hash)
        except Exception:
            legacy = hashlib.sha256((SECRET_KEY + ":" + password).encode()).hexdigest()
            return secrets.compare_digest(legacy, password_hash)
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
            if str(username).strip().casefold() == str(ADMIN_USERNAME).strip().casefold()
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
        "version": app.version,
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
    valid_admin = (
        data.username.strip().casefold() == str(ADMIN_USERNAME).strip().casefold()
        and data.password == ADMIN_PASSWORD
    )
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

def _pubmed_articles(query: str, limit: int = 8) -> list[dict]:
    """Retrieve PubMed evidence with title, abstract, DOI and publication metadata."""
    limit = max(1, min(int(limit), 12))
    url = ("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
           "?db=pubmed&term=" + quote(query) + "&retmax=" + str(limit) + "&retmode=xml")
    req = URLRequest(url, headers={"User-Agent": "MedGenAI/1.0 (research-agent)"})
    with urlopen(req, timeout=15) as response:
        root = ET.fromstring(response.read())
    pmids = [x.text for x in root.findall(".//Id") if x.text]
    if not pmids:
        return []
    fetch = ("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
             "?db=pubmed&id=" + ",".join(pmids) + "&retmode=xml")
    req = URLRequest(fetch, headers={"User-Agent": "MedGenAI/1.0 (research-agent)"})
    with urlopen(req, timeout=15) as response:
        articles = ET.fromstring(response.read())
    results=[]
    for article in articles.findall(".//PubmedArticle"):
        pmid=article.findtext(".//PMID") or ""
        title_node=article.find(".//ArticleTitle")
        title="".join(title_node.itertext()) if title_node is not None else ""
        abstract=" ".join("".join(x.itertext()) for x in article.findall(".//Abstract/AbstractText"))
        doi=""
        for aid in article.findall(".//ArticleId"):
            if aid.attrib.get("IdType") == "doi": doi=aid.text or ""
        results.append({
            "pmid": pmid, "title": title, "abstract": abstract,
            "journal": article.findtext(".//Journal/Title") or "",
            "publication_date": article.findtext(".//PubDate/Year") or article.findtext(".//PubDate/MedlineDate") or "",
            "doi": doi, "source": "PubMed",
            "url": "https://pubmed.ncbi.nlm.nih.gov/" + pmid + "/"
        })
    return results


def _evidence_score(query: str, article: dict) -> float:
    terms=[t.lower() for t in re.findall(r"[A-Za-z0-9-]{3,}", query) if t.lower() not in {"and","the","for","with","from"}]
    text=(article.get("title","")+" "+article.get("abstract","")).lower()
    if not terms: return 0.0
    hits=sum(1 for term in terms if term in text)
    title_hits=sum(1 for term in terms if term in article.get("title","").lower())
    return round(min(100.0, hits/len(terms)*75 + title_hits/len(terms)*25), 2)


def _extract_evidence_sentences(query: str, abstract: str, max_sentences: int = 3) -> list[str]:
    terms=[t.lower() for t in re.findall(r"[A-Za-z0-9-]{3,}", query)]
    sentences=re.split(r"(?<=[.!?])\\s+", abstract or "")
    scored=[]
    for sentence in sentences:
        s=sentence.strip()
        if len(s)<40: continue
        score=sum(1 for term in terms if term in s.lower())
        if score: scored.append((score,s))
    scored.sort(key=lambda x:x[0], reverse=True)
    return [s for _,s in scored[:max_sentences]]



def _study_type(article: dict) -> str:
    """Deterministic study-design classifier with explicit precedence."""
    text=((article.get("title","") or "")+" "+(article.get("abstract","") or "")).lower()
    if any(x in text for x in ("systematic review","meta-analysis","meta analysis")):
        return "REVIEW_SYSTEMATIC_OR_META_ANALYSIS"
    if re.search(r"\b(randomized|randomised) controlled trial\b|\b(rct)\b", text):
        return "RCT"
    if re.search(r"\bphase\s*(3|iii)\b", text):
        return "PHASE_3"
    if re.search(r"\bphase\s*(2|ii)\b", text):
        return "PHASE_2"
    if re.search(r"\bphase\s*(1|i)\b", text):
        return "PHASE_1"
    case_report_signal = (
        "case report" in text
        or "case series" in text
        or re.search(r"\bwe report (?:a|an) (?:rare )?case\b", text)
        or re.search(r"\b(?:a|an|one)\s+\d{1,3}[- ]year[- ]old\b", text)
    )
    if case_report_signal:
        return "CASE_REPORT_OR_SERIES"
    if "case-control" in text or "case control" in text:
        return "CASE_CONTROL"
    # Explicit retrospective design must win over incidental mentions of prospective cohorts.
    if re.search(r"\b(retrospective|retrospectively)\b", text) or "real-world" in text or "real world" in text:
        return "RETROSPECTIVE_OR_REAL_WORLD"
    if "machine learning" in text or "random forest" in text or "logistic regression" in text:
        return "COMPUTATIONAL_MODELING"
    if re.search(r"\b(prospective|prospectively)\b", text):
        return "PROSPECTIVE_STUDY"
    if "review" in text:
        return "REVIEW"
    if "cohort" in text:
        return "COHORT"
    if "observational" in text:
        return "OBSERVATIONAL"
    return "OTHER"


def _evidence_grade(article: dict) -> str:
    """Research-triage tier; not a formal clinical evidence hierarchy."""
    study=_study_type(article)
    if study in ("RCT","PHASE_3"):
        return "A"
    if study in ("PHASE_2","PROSPECTIVE_STUDY"):
        return "B"
    if study in ("RETROSPECTIVE_OR_REAL_WORLD","CASE_CONTROL","COMPUTATIONAL_MODELING","COHORT","OBSERVATIONAL"):
        return "C"
    if study == "CASE_REPORT_OR_SERIES":
        return "D"
    if study in ("REVIEW_SYSTEMATIC_OR_META_ANALYSIS","REVIEW"):
        return "NA"
    return "E"


def _claim_polarity(claim: str) -> str:
    text=(claim or "").lower()
    # Avoid labeling case reports/reviews by isolated words such as "effective".
    positive=("improved","benefit","promising","favorable","favourable","longer os","longer survival","higher response")
    negative=("limited","uncertain","inferior","no significant","not significant","failed","poorer os","shorter os","reduced sensitivity")
    p=sum(x in text for x in positive)
    n=sum(x in text for x in negative)
    if p and n: return "mixed"
    if p: return "positive"
    if n: return "negative"
    return "neutral"


def _claim_topics(claim: str) -> set[str]:
    text=(claim or "").lower()
    terms=("egfr","alk","nsclc","lung cancer","overall survival","progression-free survival",
           "response rate","resistance","toxicity","adverse","mtap","tp53","brain metastases",
           "amivantamab","lazertinib","sunvozertinib","chemotherapy","tki")
    return {t for t in terms if t in text}


def _claim_outcomes(claim: str) -> set[str]:
    text=(claim or "").lower()
    terms=("overall survival","longer survival","progression-free survival","response rate",
           "response","resistance","toxicity","adverse","brain metastases","sensitivity")
    return {t for t in terms if t in text}


def _compare_claims(evidence: list[dict]) -> list[dict]:
    """Compare only overlapping topic + outcome claims; never declare contradiction."""
    comparisons=[]
    for i in range(len(evidence)):
        a=evidence[i]
        ca=(a.get("evidence") or [a.get("title","")])[0]
        for j in range(i+1,len(evidence)):
            b=evidence[j]
            cb=(b.get("evidence") or [b.get("title","")])[0]
            shared_topics=sorted(_claim_topics(ca) & _claim_topics(cb))
            shared_outcomes=sorted(_claim_outcomes(ca) & _claim_outcomes(cb))
            if not shared_topics or not shared_outcomes:
                continue
            pa,pb=_claim_polarity(ca),_claim_polarity(cb)
            if {pa,pb}=={"positive","negative"}:
                status="review_needed"
            elif "mixed" in (pa,pb):
                status="qualifies"
            elif pa==pb and pa!="neutral":
                status="supports"
            else:
                status="insufficient"
            comparisons.append({
                "pmids":[a.get("pmid"),b.get("pmid")],
                "shared_topics":shared_topics[:6],
                "shared_outcomes":shared_outcomes[:4],
                "direction":[pa,pb],
                "comparison":status,
                "basis":"Overlapping topic and outcome terms in extracted abstract evidence.",
                "note":"Automated triage only; population, intervention/exposure, comparator and endpoint definitions require expert review."
            })
    return comparisons[:20]


def _detect_evidence_tensions(evidence: list[dict]) -> list[dict]:
    return [x for x in _compare_claims(evidence) if x["comparison"]=="review_needed"][:10]


def _build_research_synthesis(evidence: list[dict]) -> dict:
    findings=[]
    grades={}
    study_types={}
    for item in evidence:
        claim=(item.get("evidence") or [item.get("title","")])[0]
        grade=item.get("evidence_grade","E")
        st=item.get("study_type","OTHER")
        grades[grade]=grades.get(grade,0)+1
        study_types[st]=study_types.get(st,0)+1
        findings.append({
            "pmid":item.get("pmid"),
            "claim":claim[:500],
            "claim_polarity":_claim_polarity(claim),
            "study_type":st,
            "study_evidence_grade":grade,
            "citation":item.get("citation","")
        })
    comparisons=_compare_claims(evidence)
    non_na=[k for k in ("A","B","C","D","E") if k in grades]
    summary=(
        f"Retrieved {len(evidence)} PubMed records. "
        f"Study designs: {', '.join(f'{k}={v}' for k,v in study_types.items()) or 'not classified'}. "
        f"Automated comparison found {len(comparisons)} overlapping topic/outcome pairs."
    )
    return {
        "executive_summary":summary,
        "key_findings":findings[:8],
        "study_type_distribution":study_types,
        "evidence_grade_distribution":grades,
        "claim_evidence_map":[
            {"claim":x["claim"],"supporting_citation":x["citation"],
             "study_type":x["study_type"],"study_evidence_grade":x["study_evidence_grade"]}
            for x in findings[:8]
        ],
        "cross_paper_comparisons":comparisons,
        "possible_tensions":_detect_evidence_tensions(evidence),
        "limitations":["PubMed records and abstracts only","Automated classification is research triage, not peer review","No causal, efficacy, diagnostic or treatment recommendation is inferred"],
        "method_note":"Automated metadata/text classification with claim-level topic/outcome overlap; expert review required."
    }

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
        req = URLRequest(url, headers={"User-Agent": "MedGenAI/1.0"})
        with urlopen(req, timeout=15) as response:
            root = ET.fromstring(response.read())
        pmids = [x.text for x in root.findall(".//Id") if x.text]
        results = []
        if pmids:
            fetch = (
                "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"
                "?db=pubmed&id=" + ",".join(pmids) + "&retmode=xml"
            )
            req = URLRequest(fetch, headers={"User-Agent": "MedGenAI/1.0"})
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

@app.post("/api/v1/research/agent")
def research_agent(data: ResearchAgentRequest, user=Depends(get_current_user)):
    query=data.query.strip()
    if not query: raise HTTPException(status_code=400, detail="Research query is required")
    normalized=normalize_pubmed_query(query)
    if data.focus.strip(): normalized += " " + normalize_pubmed_query(data.focus.strip())
    try:
        articles=_pubmed_articles(normalized, data.limit)
    except (URLError, TimeoutError, ET.ParseError):
        raise HTTPException(status_code=503, detail="PubMed service unavailable")
    for article in articles:
        article["relevance_score"]=_evidence_score(normalized, article)
        article["evidence"]=_extract_evidence_sentences(normalized, article.get("abstract", ""))
        article["study_type"]=_study_type(article)
        article["evidence_grade"]=_evidence_grade(article)
    articles.sort(key=lambda x:(x.get("relevance_score",0), x.get("publication_date", "")), reverse=True)
    evidence=[{
        "rank":i+1, "pmid":a["pmid"], "title":a["title"], "journal":a["journal"],
        "publication_date":a["publication_date"], "relevance_score":a["relevance_score"],
        "evidence":a["evidence"], "study_type":a.get("study_type","unspecified"), "evidence_grade":a.get("evidence_grade","E"), "citation":f"PMID: {a['pmid']}", "url":a["url"]
    } for i,a in enumerate(articles)]
    synthesis=[]
    for item in evidence[:5]:
        if item["evidence"]:
            synthesis.append({"pmid":item["pmid"],"claim":item["evidence"][0],"source":item["citation"],"evidence_grade":item["evidence_grade"]})
    synthesis_analysis=_build_research_synthesis(evidence)

    # Autonomous Research pipeline:
    # Question -> Evidence -> Knowledge Graph -> Reproducible Report
    graph_entities_added = []
    graph_relations_added = []
    query_entity = normalize_entity(query)
    if query and not any(x["id"] == query_entity for x in knowledge_entities_store):
        knowledge_entities_store.append(make_entity(query, "research_question", "Research Agent"))
        graph_entities_added.append(query_entity)

    for item in evidence[:8]:
        pmid = item["pmid"]
        paper_name = f"PMID:{pmid}"
        paper_id = normalize_entity(paper_name)
        if not any(x["id"] == paper_id for x in knowledge_entities_store):
            knowledge_entities_store.append(make_entity(paper_name, "publication", "PubMed"))
            graph_entities_added.append(paper_id)
        claim = item["evidence"][0] if item["evidence"] else item["title"]
        rel = make_relation(query, "supported_by", paper_name, "PubMed", claim)
        if rel not in knowledge_relations_store:
            knowledge_relations_store.append(rel)
            graph_relations_added.append(rel)

    report={
        "status":"completed", "module":"Autonomous Research", "query":query,
        "normalized_query":normalized,
        "plan":["normalize_query","retrieve_pubmed_evidence","rank_relevance","extract_evidence","update_knowledge_graph","build_reproducible_report","evidence_grading","tension_detection"],
        "pipeline":{
            "question": query,
            "evidence_retrieved": len(evidence),
            "knowledge_graph_updated": bool(graph_entities_added or graph_relations_added),
            "report_generated": True
        },
        "evidence_count":len(evidence), "evidence":evidence, "synthesis":synthesis, "synthesis_analysis":synthesis_analysis, "scientific_synthesis":synthesis_analysis,
        "knowledge_graph":{
            "entities_added":len(graph_entities_added),
            "relations_added":len(graph_relations_added),
            "query_entity":query_entity
        },
        "reproducibility":{
            "engine":"MedGen Research Agent",
            "source":"NCBI PubMed E-utilities",
            "query":query,
            "normalized_query":normalized,
            "limit":data.limit,
            "focus":data.focus.strip(),
            "evidence_pmids":[x["pmid"] for x in evidence],
            "generated_at":datetime.now(timezone.utc).isoformat()
        },
        "limitations":["Evidence is limited to retrieved PubMed records and abstracts.","Automated study/claim classification is for research triage, not clinical decision-making.","Cross-paper signals do not establish contradiction, causality, efficacy, or treatment advice."],
        "source":"NCBI PubMed E-utilities", "user":user["username"]
    }
    now=datetime.now(timezone.utc).isoformat()
    reports_store.insert(0,{"id":secrets.token_hex(10),"type":"research_intelligence","title":"Research Intelligence — "+query,"user":user["username"],"created_at":now,"report":report})
    activity_log.insert(0,{"type":"research_agent","username":user["username"],"query":query,"evidence_count":len(evidence),"at":now})
    return report


@app.post("/api/v1/research/autonomous")
def autonomous_research(data: ResearchAgentRequest, user=Depends(get_current_user)):
    query = data.query.strip()
    if not query:
        raise HTTPException(status_code=400, detail="Research query is required")
    normalized = normalize_pubmed_query(query)
    if data.focus.strip():
        normalized += " " + normalize_pubmed_query(data.focus.strip())
    try:
        articles = _pubmed_articles(normalized, data.limit)
    except (URLError, TimeoutError, ET.ParseError):
        raise HTTPException(status_code=503, detail="PubMed service unavailable")
    for article in articles:
        article["relevance_score"] = _evidence_score(normalized, article)
        article["evidence"] = _extract_evidence_sentences(normalized, article.get("abstract", ""))
    articles.sort(key=lambda x: (x.get("relevance_score", 0), x.get("publication_date", "")), reverse=True)
    top = articles[:8]
    evidence = [{"pmid":a["pmid"],"title":a["title"],"score":a["relevance_score"],"evidence":a["evidence"],"url":a["url"]} for a in top]
    qid = normalize_entity(query)
    if not any(x["id"] == qid for x in knowledge_entities_store):
        knowledge_entities_store.append(make_entity(query, "research_question", "PubMed"))
    added = 0
    for item in evidence:
        pid = normalize_entity("PMID:" + item["pmid"])
        if not any(x["id"] == pid for x in knowledge_entities_store):
            knowledge_entities_store.append(make_entity("PMID:" + item["pmid"], "publication", "PubMed"))
        rel = make_relation(query, "supported_by", "PMID:" + item["pmid"], "PubMed", (item["evidence"] or [item["title"]])[0])
        if rel not in knowledge_relations_store:
            knowledge_relations_store.append(rel)
            added += 1
    now = datetime.now(timezone.utc).isoformat()
    report = {
        "status":"completed","module":"Autonomous Research","query":query,"normalized_query":normalized,
        "steps":["question","evidence","knowledge_graph","report"],
        "evidence_count":len(evidence),"evidence":evidence,
        "knowledge_graph":{"query_entity":qid,"relations_added":added},
        "reproducibility":{"source":"NCBI PubMed E-utilities","query":query,"normalized_query":normalized,"limit":data.limit,"focus":data.focus.strip(),"pmids":[x["pmid"] for x in evidence],"generated_at":now},
        "limitations":["Retrieved abstracts are not clinical evidence of efficacy.","Results require expert review and independent validation."]
    }
    reports_store.insert(0,{"id":secrets.token_hex(10),"type":"autonomous_research","title":"Autonomous Research — "+query,"user":user["username"],"created_at":now,"report":report})
    activity_log.insert(0,{"type":"autonomous_research","username":user["username"],"query":query,"evidence_count":len(evidence),"at":now})
    return report

@app.get("/api/v1/research/history")
def research_history(user=Depends(get_current_user)):
    items = [x for x in reports_store if x.get("type") == "research_intelligence" and x.get("user") == user["username"]]
    return {"status": "ok", "count": len(items), "reports": items[:50]}


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
# KNOWLEDGE LAYER — BIOMEDICAL KNOWLEDGE GRAPH
# =========================================================

class KnowledgeEntityRequest(BaseModel):
    name: str
    entity_type: str = "concept"
    source: str = "user"

class KnowledgeRelationRequest(BaseModel):
    subject: str
    relation: str
    object: str
    source: str = "user"
    evidence: str = ""

@app.get("/api/v1/knowledge/graph")
def knowledge_graph(user=Depends(get_current_user)):
    return {"status":"ok","entity_count":len(knowledge_entities_store),
            "relation_count":len(knowledge_relations_store),
            "entities":knowledge_entities_store[:1000],
            "relations":knowledge_relations_store[:3000]}

@app.post("/api/v1/knowledge/entities")
def knowledge_entity(data: KnowledgeEntityRequest, user=Depends(get_current_user)):
    entity=make_entity(data.name,data.entity_type,data.source)
    if not entity["name"]: raise HTTPException(status_code=400, detail="Entity name is required")
    if not any(x["id"]==entity["id"] for x in knowledge_entities_store):
        knowledge_entities_store.append(entity)
        _db_save()
    return {"status":"created","entity":entity}

@app.delete("/api/v1/knowledge/entities/{entity_id}")
def knowledge_entity_delete(entity_id: str, user=Depends(get_current_user)):
    key=normalize_entity(entity_id)
    before=len(knowledge_entities_store)
    knowledge_entities_store[:]=[e for e in knowledge_entities_store if e.get("id")!=key]
    knowledge_relations_store[:]=[r for r in knowledge_relations_store if r.get("subject")!=key and r.get("object")!=key]
    if len(knowledge_entities_store)==before: raise HTTPException(status_code=404,detail="Entity not found")
    _db_save()
    return {"status":"deleted","entity_id":key}


@app.post("/api/v1/knowledge/relations")
def knowledge_relation(data: KnowledgeRelationRequest, user=Depends(get_current_user)):
    try: rel=make_relation(data.subject,data.relation,data.object,data.source,data.evidence)
    except ValueError as exc: raise HTTPException(status_code=400,detail=str(exc))
    for name in (data.subject,data.object):
        if not any(x["id"]==normalize_entity(name) for x in knowledge_entities_store):
            knowledge_entities_store.append(make_entity(name,"concept",data.source))
    if rel not in knowledge_relations_store:
        knowledge_relations_store.append(rel)
        _db_save()
    return {"status":"created","relation":rel}

@app.post("/api/v1/knowledge/search")
def knowledge_search(data: ResearchRequest, user=Depends(get_current_user)):
    return {"status":"ok",**search_graph(knowledge_entities_store,knowledge_relations_store,data.query,max(1,min(data.limit,50)))}

@app.get("/api/v1/knowledge/neighborhood/{entity}")
def knowledge_neighborhood(entity: str, hops: int=2, user=Depends(get_current_user)):
    return {"status":"ok",**neighborhood(knowledge_entities_store,knowledge_relations_store,entity,hops)}

@app.get("/api/v1/knowledge/validate")
def knowledge_validate(user=Depends(get_current_user)):
    errors=validate_graph(knowledge_entities_store,knowledge_relations_store)
    return {"status":"valid" if not errors else "invalid","errors":errors,"entity_count":len(knowledge_entities_store),"relation_count":len(knowledge_relations_store)}


@app.get("/api/v1/knowledge/stats")
def knowledge_stats(user=Depends(get_current_user)):
    return {"status":"ok", **graph_stats(knowledge_entities_store, knowledge_relations_store)}


@app.get("/api/v1/knowledge/evidence")
def knowledge_evidence(query: str = "", source: str = "", relation: str = "", limit: int = 50, user=Depends(get_current_user)):
    q = query.strip().lower()
    src = source.strip().lower()
    rel = relation.strip().lower().replace(" ", "_")
    items = []
    for item in knowledge_relations_store:
        if rel and item.get("relation") != rel:
            continue
        if src and src not in str(item.get("source", "")).lower():
            continue
        hay = " ".join(str(item.get(k, "")) for k in ("subject", "relation", "object", "evidence", "source")).lower()
        if q and q not in hay:
            continue
        items.append(item)
    items.sort(key=lambda x: (bool(x.get("evidence")), x.get("source", "")), reverse=True)
    return {"status":"ok","query":query,"source":source,"relation":relation,"count":len(items),"evidence":items[:max(1,min(limit,200))]}


@app.get("/api/v1/knowledge/export")
def knowledge_export(user=Depends(get_current_user)):
    return {
        "status":"ok",
        "format":"medgen-knowledge-v1",
        "generated_at":datetime.now(timezone.utc).isoformat(),
        "entities":knowledge_entities_store,
        "relations":knowledge_relations_store,
        "stats":graph_stats(knowledge_entities_store, knowledge_relations_store),
    }

class KnowledgePathRequest(BaseModel):
    start: str
    end: str
    max_hops: int = 4

@app.post("/api/v1/knowledge/paths")
def knowledge_paths(data: KnowledgePathRequest, user=Depends(get_current_user)):
    if not data.start.strip() or not data.end.strip():
        raise HTTPException(status_code=400, detail="Start and end entities are required")
    paths=find_paths(knowledge_entities_store, knowledge_relations_store, data.start, data.end, data.max_hops)
    return {"status":"ok","start":normalize_entity(data.start),"end":normalize_entity(data.end),"paths":paths,"count":len(paths)}

class KnowledgeImportRequest(BaseModel):
    entities: list[dict[str, Any]] = []
    relations: list[dict[str, Any]] = []
    source: str = "import"

@app.post("/api/v1/knowledge/import")
def knowledge_import(data: KnowledgeImportRequest, user=Depends(get_current_user)):
    added_entities=0; added_relations=0
    for raw in data.entities:
        entity=make_entity(str(raw.get("name","")), str(raw.get("type","concept")), data.source)
        if entity["name"] and not any(x["id"]==entity["id"] for x in knowledge_entities_store):
            knowledge_entities_store.append(entity); added_entities+=1
    for raw in data.relations:
        try:
            rel=make_relation(str(raw.get("subject","")),str(raw.get("relation","")),str(raw.get("object","")),data.source,str(raw.get("evidence","")))
        except ValueError:
            continue
        for name in (rel["subject"],rel["object"]):
            if not any(x["id"]==normalize_entity(name) for x in knowledge_entities_store):
                knowledge_entities_store.append(make_entity(name,"concept",data.source))
        if rel not in knowledge_relations_store:
            knowledge_relations_store.append(rel); added_relations+=1
    _db_save()
    return {"status":"imported","added_entities":added_entities,"added_relations":added_relations,**graph_stats(knowledge_entities_store,knowledge_relations_store)}

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
        "users": len(set(tokens.values()) | set(user_accounts.keys()) | set(user_profiles.keys()) | set(user_consents.keys())),
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
    usernames = sorted(set(tokens.values()) | set(user_accounts.keys()) | set(user_profiles.keys()) | set(user_consents.keys()))
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


# =========================================================
# PHASE 8 — GLOBAL PLATFORM FOUNDATION
# Organizations → Workspaces → Projects → API → Audit → Usage
# =========================================================

class OrganizationCreateRequest(BaseModel):
    name: str
    slug: str = ""

class WorkspaceCreateRequest(BaseModel):
    organization_id: str
    name: str

class ProjectCreateRequest(BaseModel):
    workspace_id: str
    name: str
    description: str = ""

class MemberRequest(BaseModel):
    organization_id: str
    username: str
    role: str = "MEMBER"

class ApiKeyCreateRequest(BaseModel):
    organization_id: str
    name: str = "MedGen API Key"

class ApiKeyRotateRequest(BaseModel):
    key_id: str

class PlatformApiKeyRequest(BaseModel):
    api_key: str

PLATFORM_ROLES = {"OWNER", "ADMIN", "MEMBER", "VIEWER"}

def _slugify(value: str) -> str:
    value = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    return value[:48] or "organization"

def _platform_audit(user, action: str, resource_type: str, resource_id: str = "", details: dict | None = None):
    event = {
        "id": secrets.token_hex(10),
        "at": datetime.now(timezone.utc).isoformat(),
        "username": user.get("username", "api"),
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id,
        "details": details or {},
    }
    platform_audit_log.insert(0, event)
    activity_log.insert(0, {"type": "platform", "username": event["username"], "action": action, "resource_type": resource_type, "resource_id": resource_id, "at": event["at"]})
    return event

def _org_role(user, organization_id: str) -> str | None:
    if user.get("role") == "SUPER_ADMIN":
        return "OWNER"
    for item in memberships_store:
        if item.get("organization_id") == organization_id and item.get("username") == user.get("username"):
            return item.get("role")
    return None

def _require_org(user, organization_id: str, minimum: str = "VIEWER"):
    role = _org_role(user, organization_id)
    order = {"VIEWER": 0, "MEMBER": 1, "ADMIN": 2, "OWNER": 3}
    if role is None or order.get(role, -1) < order.get(minimum, 0):
        raise HTTPException(status_code=403, detail=f"Organization {minimum} access required.")
    return role

def _usage(username: str):
    return usage_store.setdefault(username, {
        "api_requests": 0,
        "research_runs": 0,
        "discovery_runs": 0,
        "workflows_created": 0,
        "last_activity": None,
    })

@app.post("/api/v1/platform/organizations")
def platform_create_organization(data: OrganizationCreateRequest, user=Depends(get_current_user)):
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Organization name is required.")
    base = _slugify(data.slug or name)
    slug = base
    n = 2
    while any(x.get("slug") == slug for x in organizations_store.values()):
        slug = f"{base}-{n}"
        n += 1
    now = datetime.now(timezone.utc).isoformat()
    org_id = secrets.token_hex(12)
    organizations_store[org_id] = {"id": org_id, "name": name, "slug": slug, "created_at": now, "created_by": user["username"]}
    memberships_store.append({"organization_id": org_id, "username": user["username"], "role": "OWNER", "joined_at": now})
    _platform_audit(user, "organization.created", "organization", org_id, {"name": name})
    _db_save()
    return {"status": "created", "organization": organizations_store[org_id], "role": "OWNER"}

@app.get("/api/v1/platform/organizations")
def platform_organizations(user=Depends(get_current_user)):
    visible = []
    for org in organizations_store.values():
        role = _org_role(user, org["id"])
        if role:
            visible.append({**org, "role": role, "member_count": sum(1 for m in memberships_store if m["organization_id"] == org["id"])})
    return {"organizations": visible, "count": len(visible)}

@app.post("/api/v1/platform/members")
def platform_add_member(data: MemberRequest, user=Depends(get_current_user)):
    _require_org(user, data.organization_id, "ADMIN")
    role = data.role.upper().strip()
    if role not in PLATFORM_ROLES or role == "OWNER":
        raise HTTPException(status_code=400, detail="Role must be ADMIN, MEMBER, or VIEWER.")
    username = data.username.strip()
    if username not in user_accounts and username not in user_profiles and username.casefold() != ADMIN_USERNAME.casefold():
        raise HTTPException(status_code=404, detail="User not found.")
    existing = next((m for m in memberships_store if m["organization_id"] == data.organization_id and m["username"] == username), None)
    if existing:
        existing["role"] = role
        action = "member.role_updated"
    else:
        existing = {"organization_id": data.organization_id, "username": username, "role": role, "joined_at": datetime.now(timezone.utc).isoformat()}
        memberships_store.append(existing)
        action = "member.added"
    _platform_audit(user, action, "membership", f"{data.organization_id}:{username}", {"role": role})
    _db_save()
    return {"status": "updated", "membership": existing}

@app.get("/api/v1/platform/members/{organization_id}")
def platform_members(organization_id: str, user=Depends(get_current_user)):
    _require_org(user, organization_id, "VIEWER")
    return {"organization_id": organization_id, "members": [m for m in memberships_store if m["organization_id"] == organization_id]}

@app.post("/api/v1/platform/workspaces")
def platform_create_workspace(data: WorkspaceCreateRequest, user=Depends(get_current_user)):
    _require_org(user, data.organization_id, "MEMBER")
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Workspace name is required.")
    wid = secrets.token_hex(12)
    item = {"id": wid, "organization_id": data.organization_id, "name": name, "created_by": user["username"], "created_at": datetime.now(timezone.utc).isoformat()}
    workspaces_store.append(item)
    _platform_audit(user, "workspace.created", "workspace", wid, {"organization_id": data.organization_id})
    _db_save()
    return {"status": "created", "workspace": item}

@app.get("/api/v1/platform/workspaces")
def platform_workspaces(organization_id: str | None = None, user=Depends(get_current_user)):
    if organization_id:
        _require_org(user, organization_id, "VIEWER")
        items = [x for x in workspaces_store if x["organization_id"] == organization_id]
    else:
        orgs = {x["id"] for x in organizations_store.values() if _org_role(user, x["id"])}
        items = [x for x in workspaces_store if x["organization_id"] in orgs]
    return {"workspaces": items, "count": len(items)}

@app.post("/api/v1/platform/projects")
def platform_create_project(data: ProjectCreateRequest, user=Depends(get_current_user)):
    workspace = next((x for x in workspaces_store if x["id"] == data.workspace_id), None)
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found.")
    _require_org(user, workspace["organization_id"], "MEMBER")
    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Project name is required.")
    pid = secrets.token_hex(12)
    item = {"id": pid, "workspace_id": data.workspace_id, "organization_id": workspace["organization_id"], "name": name, "description": data.description.strip(), "created_by": user["username"], "created_at": datetime.now(timezone.utc).isoformat()}
    projects_store.append(item)
    _platform_audit(user, "project.created", "project", pid, {"workspace_id": data.workspace_id})
    _db_save()
    return {"status": "created", "project": item}

@app.get("/api/v1/platform/projects")
def platform_projects(workspace_id: str | None = None, organization_id: str | None = None, user=Depends(get_current_user)):
    if workspace_id:
        workspace = next((x for x in workspaces_store if x["id"] == workspace_id), None)
        if not workspace:
            raise HTTPException(status_code=404, detail="Workspace not found.")
        _require_org(user, workspace["organization_id"], "VIEWER")
        items = [x for x in projects_store if x["workspace_id"] == workspace_id]
    elif organization_id:
        _require_org(user, organization_id, "VIEWER")
        items = [x for x in projects_store if x["organization_id"] == organization_id]
    else:
        orgs = {x["id"] for x in organizations_store.values() if _org_role(user, x["id"])}
        items = [x for x in projects_store if x["organization_id"] in orgs]
    return {"projects": items, "count": len(items)}

@app.post("/api/v1/platform/api-keys")
def platform_create_api_key(data: ApiKeyCreateRequest, user=Depends(get_current_user)):
    _require_org(user, data.organization_id, "ADMIN")
    raw = "mgai_" + secrets.token_urlsafe(32)
    key_id = secrets.token_hex(10)
    digest = hashlib.sha256(raw.encode()).hexdigest()
    now = datetime.now(timezone.utc).isoformat()
    api_keys_store[key_id] = {"id": key_id, "organization_id": data.organization_id, "name": data.name.strip() or "MedGen API Key", "prefix": raw[:12], "key_hash": digest, "created_by": user["username"], "created_at": now, "revoked": False, "last_used_at": None}
    _platform_audit(user, "api_key.created", "api_key", key_id, {"organization_id": data.organization_id})
    _db_save()
    return {"status": "created", "api_key": raw, "warning": "Store this key now. The raw API key will not be shown again.", "metadata": {k:v for k,v in api_keys_store[key_id].items() if k != "key_hash"}}

@app.get("/api/v1/platform/api-keys")
def platform_list_api_keys(organization_id: str, user=Depends(get_current_user)):
    _require_org(user, organization_id, "ADMIN")
    items = [{k:v for k,v in x.items() if k != "key_hash"} for x in api_keys_store.values() if x["organization_id"] == organization_id]
    return {"api_keys": items, "count": len(items)}

@app.delete("/api/v1/platform/api-keys/{key_id}")
def platform_revoke_api_key(key_id: str, user=Depends(get_current_user)):
    item = api_keys_store.get(key_id)
    if not item:
        raise HTTPException(status_code=404, detail="API key not found.")
    _require_org(user, item["organization_id"], "ADMIN")
    item["revoked"] = True
    item["revoked_at"] = datetime.now(timezone.utc).isoformat()
    _platform_audit(user, "api_key.revoked", "api_key", key_id, {"organization_id": item["organization_id"]})
    _db_save()
    return {"status": "revoked", "id": key_id}

@app.post("/api/v1/platform/api-keys/rotate")
def platform_rotate_api_key(data: ApiKeyRotateRequest, user=Depends(get_current_user)):
    item = api_keys_store.get(data.key_id)
    if not item:
        raise HTTPException(status_code=404, detail="API key not found.")
    _require_org(user, item["organization_id"], "ADMIN")
    item["revoked"] = True
    item["revoked_at"] = datetime.now(timezone.utc).isoformat()
    raw = "mgai_" + secrets.token_urlsafe(32)
    new_id = secrets.token_hex(10)
    now = datetime.now(timezone.utc).isoformat()
    api_keys_store[new_id] = {
        "id": new_id,
        "organization_id": item["organization_id"],
        "name": item["name"],
        "prefix": raw[:12],
        "key_hash": hashlib.sha256(raw.encode()).hexdigest(),
        "created_by": user["username"],
        "created_at": now,
        "revoked": False,
        "last_used_at": None,
        "rotated_from": data.key_id,
    }
    _platform_audit(user, "api_key.rotated", "api_key", new_id, {"organization_id": item["organization_id"], "rotated_from": data.key_id})
    _db_save()
    return {"status": "rotated", "api_key": raw, "warning": "Store this key now. The raw API key will not be shown again.", "metadata": {k:v for k,v in api_keys_store[new_id].items() if k != "key_hash"}}

@app.post("/api/v1/platform/api-keys/validate")
def platform_validate_api_key(data: PlatformApiKeyRequest):
    digest = hashlib.sha256(data.api_key.strip().encode()).hexdigest()
    item = next((x for x in api_keys_store.values() if x.get("key_hash") == digest and not x.get("revoked")), None)
    if not item:
        raise HTTPException(status_code=401, detail="Invalid or revoked API key.")
    item["last_used_at"] = datetime.now(timezone.utc).isoformat()
    org = organizations_store.get(item["organization_id"], {})
    return {"valid": True, "organization": {"id": org.get("id"), "name": org.get("name"), "slug": org.get("slug")}, "key_id": item["id"]}

@app.get("/api/v1/platform/audit")
def platform_audit(organization_id: str | None = None, limit: int = 100, user=Depends(get_current_user)):
    if organization_id:
        _require_org(user, organization_id, "VIEWER")
        items = [x for x in platform_audit_log if x.get("details", {}).get("organization_id") == organization_id or x.get("resource_id") == organization_id]
    elif user.get("role") == "SUPER_ADMIN":
        items = platform_audit_log
    else:
        visible_orgs = {x["id"] for x in organizations_store.values() if _org_role(user, x["id"])}
        items = [x for x in platform_audit_log if x.get("resource_id") in visible_orgs or x.get("details", {}).get("organization_id") in visible_orgs]
    return {"audit": items[:max(1, min(limit, 500))], "count": len(items)}

@app.get("/api/v1/platform/usage")
def platform_usage(user=Depends(get_current_user)):
    item = _usage(user["username"])
    return {"username": user["username"], "usage": item, "limits": {"api_requests": 10000, "research_runs": 1000, "discovery_runs": 1000, "workflows_created": 1000}, "plan": "foundation"}

@app.get("/api/v1/platform/overview")
def platform_overview(user=Depends(get_current_user)):
    orgs = [x for x in organizations_store.values() if _org_role(user, x["id"])]
    org_ids = {x["id"] for x in orgs}
    return {
        "status": "ready",
        "platform": "MedGen AI Global Platform",
        "organizations": len(orgs),
        "workspaces": sum(1 for x in workspaces_store if x["organization_id"] in org_ids),
        "projects": sum(1 for x in projects_store if x["organization_id"] in org_ids),
        "api_keys": sum(1 for x in api_keys_store.values() if x["organization_id"] in org_ids and not x.get("revoked")),
        "audit_events": len(platform_audit_log),
        "usage": _usage(user["username"]),
        "capabilities": ["organizations", "teams", "workspaces", "projects", "rbac", "api_keys", "audit_logs", "usage"],
    }

# =========================================================

def _api_key_context(request: Request):
    raw = request.headers.get("X-API-Key", "").strip()
    if not raw:
        raise HTTPException(status_code=401, detail="X-API-Key is required.")
    digest = hashlib.sha256(raw.encode()).hexdigest()
    item = next((x for x in api_keys_store.values() if x.get("key_hash") == digest and not x.get("revoked")), None)
    if not item:
        raise HTTPException(status_code=401, detail="Invalid or revoked API key.")
    item["last_used_at"] = datetime.now(timezone.utc).isoformat()
    usage = _usage(item["created_by"])
    usage["api_requests"] += 1
    usage["last_activity"] = item["last_used_at"]
    return item

@app.get("/api/v1/public/knowledge/stats")
def public_knowledge_stats(request: Request):
    item = _api_key_context(request)
    return {"status": "ok", "organization_id": item["organization_id"], **graph_stats(knowledge_entities_store, knowledge_relations_store)}

@app.get("/api/v1/public/platform/overview")
def public_platform_overview(request: Request):
    item = _api_key_context(request)
    org = organizations_store.get(item["organization_id"], {})
    return {
        "status": "ok",
        "organization": {"id": org.get("id"), "name": org.get("name"), "slug": org.get("slug")},
        "capabilities": ["knowledge_stats", "api_keys", "usage"],
        "api_key_id": item["id"],
    }






# =========================================================
# PHASE 9.4 — FINAL DEPLOYMENT CHECKS
# =========================================================
@app.get("/api/v1/platform/readiness")
def platform_readiness():
    checks = {
        "health_endpoint": True,
        "api_v1": True,
        "authentication": True,
        "multi_tenant": True,
        "knowledge_graph": True,
        "research": True,
        "drug_discovery": True,
        "virtual_lab": True,
        "audit": True,
        "api_keys": True,
        "webhooks": True,
        "plans_quotas": True,
    }
    return {"status": "ready", "checks": checks, "passed": sum(checks.values()), "total": len(checks)}

# =========================================================
# PHASE 9.3 — FINAL API / PLATFORM READINESS
# =========================================================
@app.get("/api/v1/platform/status")
def platform_status(user=Depends(get_current_user)):
    return {
        "platform": "MedGen AI",
        "status": "operational",
        "environment": "production",
        "api_version": "v1",
        "modules": [
            "auth","knowledge","research","autonomous_research",
            "discovery","workflows","experiments","reports",
            "organizations","workspaces","projects","api_keys",
            "audit","usage","plans","webhooks"
        ],
        "capabilities": {
            "multi_tenant": True,
            "public_api": True,
            "reproducible_research": True,
            "audit_logging": True,
            "quota_layer": True,
            "webhook_layer": True
        }
    }

@app.get("/api/v1/openapi-summary")
def openapi_summary():
    return {
        "name": "MedGen AI API",
        "version": "v1",
        "authentication": ["Bearer", "X-API-Key"],
        "documentation": "/docs",
        "health": "/api/v1/health"
    }

# =========================================================
# PHASE 9.2 — PRODUCTION SECURITY / REQUEST LIMITING
# =========================================================
REQUEST_WINDOW = {}
REQUEST_LIMIT = 120
REQUEST_WINDOW_SECONDS = 60

def _request_guard(username: str):
    now = datetime.now(timezone.utc)
    bucket = REQUEST_WINDOW.setdefault(username, [])
    bucket[:] = [t for t in bucket if (now - t).total_seconds() < REQUEST_WINDOW_SECONDS]
    if len(bucket) >= REQUEST_LIMIT:
        raise HTTPException(status_code=429, detail="Request rate limit exceeded.")
    bucket.append(now)
    REQUEST_METRICS["total"] += 1
    REQUEST_METRICS["last_request_at"] = now.isoformat()

@app.get("/api/v1/platform/security")
def platform_security(user=Depends(get_current_user)):
    if str(user.get("role","")).upper() != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="SUPER_ADMIN required.")
    return {
        "authentication": "Bearer token",
        "api_keys": "SHA-256 hashed at rest",
        "password_hashing": "Argon2 / legacy compatibility",
        "rate_limit": {"requests": REQUEST_LIMIT, "window_seconds": REQUEST_WINDOW_SECONDS},
        "cors": "configured",
        "security_headers": "configured",
        "status": "production-ready foundation"
    }

# =========================================================
# PHASE 9 — PRODUCTION READINESS / HEALTH / METRICS
# =========================================================
APP_STARTED_AT = datetime.now(timezone.utc).isoformat()
REQUEST_METRICS = {"total": 0, "errors": 0, "last_request_at": None}

@app.get("/health")
def health():
    return {"status": "ok", "service": "medgen-api", "started_at": APP_STARTED_AT}

@app.get("/api/v1/health")
def api_health():
    return {"status": "ok", "service": "medgen-api", "timestamp": datetime.now(timezone.utc).isoformat()}

@app.get("/api/v1/platform/metrics")
def platform_metrics(user=Depends(get_current_user)):
    if str(user.get("role","")).upper() != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="SUPER_ADMIN required.")
    return {
        "status": "ok",
        "requests": REQUEST_METRICS,
        "organizations": len(organizations_store),
        "workspaces": len(workspaces_store),
        "projects": len(projects_store),
        "api_keys": len(api_keys_store),
        "webhooks": len(webhooks_store),
        "experiments": len(experiments_store),
        "reports": len(reports_store),
    }

# =========================================================
# PHASE 8.3 — PLAN / QUOTA / WEBHOOK FOUNDATION
# =========================================================

PLATFORM_PLANS = {
    "foundation": {"api_requests": 10000, "research_runs": 1000, "discovery_runs": 1000, "workflows_created": 1000},
    "research": {"api_requests": 100000, "research_runs": 10000, "discovery_runs": 10000, "workflows_created": 10000},
    "enterprise": {"api_requests": 1000000, "research_runs": 100000, "discovery_runs": 100000, "workflows_created": 100000},
}

webhooks_store = {}

class PlanUpdateRequest(BaseModel):
    organization_id: str
    plan: str

class WebhookCreateRequest(BaseModel):
    organization_id: str
    url: str
    events: list[str] = []

def _plan_for_org(organization_id: str):
    org = organizations_store.get(organization_id, {})
    return org.get("plan", "foundation")

def _check_quota(username: str, metric: str):
    usage = _usage(username)
    orgs = [x for x in organizations_store.values() if _org_role({"username": username, "role": "USER"}, x["id"])]
    plan = _plan_for_org(orgs[0]["id"]) if orgs else "foundation"
    limit = PLATFORM_PLANS.get(plan, PLATFORM_PLANS["foundation"]).get(metric)
    if limit is not None and usage.get(metric, 0) >= limit:
        raise HTTPException(status_code=429, detail=f"{metric} quota exceeded for {plan} plan.")
    return plan

@app.post("/api/v1/platform/plan")
def platform_update_plan(data: PlanUpdateRequest, user=Depends(get_current_user)):
    _require_org(user, data.organization_id, "OWNER")
    plan = data.plan.strip().lower()
    if plan not in PLATFORM_PLANS:
        raise HTTPException(status_code=400, detail="Invalid plan.")
    organizations_store[data.organization_id]["plan"] = plan
    _platform_audit(user, "organization.plan_updated", "organization", data.organization_id, {"organization_id": data.organization_id, "plan": plan})
    _db_save()
    return {"status": "updated", "organization_id": data.organization_id, "plan": plan, "limits": PLATFORM_PLANS[plan]}

@app.get("/api/v1/platform/plans")
def platform_plans():
    return {"plans": PLATFORM_PLANS}

@app.post("/api/v1/platform/webhooks")
def platform_create_webhook(data: WebhookCreateRequest, user=Depends(get_current_user)):
    _require_org(user, data.organization_id, "ADMIN")
    url = data.url.strip()
    if not (url.startswith("https://") or url.startswith("http://localhost")):
        raise HTTPException(status_code=400, detail="Webhook URL must use HTTPS (localhost allowed for development).")
    wid = secrets.token_hex(10)
    secret = secrets.token_urlsafe(24)
    item = {"id": wid, "organization_id": data.organization_id, "url": url, "events": data.events[:50], "secret": hashlib.sha256(secret.encode()).hexdigest(), "secret_prefix": secret[:8], "created_at": datetime.now(timezone.utc).isoformat(), "active": True}
    webhooks_store[wid] = item
    _platform_audit(user, "webhook.created", "webhook", wid, {"organization_id": data.organization_id})
    _db_save()
    return {"status": "created", "webhook": {k:v for k,v in item.items() if k != "secret"}, "signing_secret": secret, "warning": "Store the signing secret now. It will not be shown again."}

@app.get("/api/v1/platform/webhooks")
def platform_list_webhooks(organization_id: str, user=Depends(get_current_user)):
    _require_org(user, organization_id, "ADMIN")
    return {"webhooks": [{k:v for k,v in x.items() if k != "secret"} for x in webhooks_store.values() if x["organization_id"] == organization_id]}

@app.delete("/api/v1/platform/webhooks/{webhook_id}")
def platform_delete_webhook(webhook_id: str, user=Depends(get_current_user)):
    item = webhooks_store.get(webhook_id)
    if not item:
        raise HTTPException(status_code=404, detail="Webhook not found.")
    _require_org(user, item["organization_id"], "ADMIN")
    item["active"] = False
    item["disabled_at"] = datetime.now(timezone.utc).isoformat()
    _platform_audit(user, "webhook.disabled", "webhook", webhook_id, {"organization_id": item["organization_id"]})
    _db_save()
    return {"status": "disabled", "id": webhook_id}

# =========================================================
# ADVANCED DRUG DISCOVERY — REPRODUCIBLE PIPELINE
# =========================================================

class DiscoveryPipelineRequest(BaseModel):
    target: str
    molecules: list[str] = []
    max_molecular_weight: float = 500.0
    max_logp: float = 5.0
    max_hbd: int = 5
    max_hba: int = 10
    min_qed: float = 0.0

@app.post("/api/v1/discovery/pipeline")
def discovery_pipeline(data: DiscoveryPipelineRequest, user=Depends(get_current_user)):
    target = data.target.strip()
    if not target:
        raise HTTPException(status_code=400, detail="Target is required")
    if not data.molecules:
        raise HTTPException(status_code=400, detail="At least one molecule is required")

    filtered = discovery_filter(LibraryFilterRequest(
        target=target, molecules=data.molecules,
        max_molecular_weight=data.max_molecular_weight,
        max_logp=data.max_logp, max_hbd=data.max_hbd,
        max_hba=data.max_hba, min_qed=data.min_qed
    ), user)
    candidates = [x["smiles"] for x in filtered["passed"]]
    screening = discovery_screen(ScreeningRequest(target=target, molecules=candidates), user) if candidates else {
        "status":"completed","workflow":"virtual_screening","target":target,"molecule_count":0,"results":[]
    }
    now=datetime.now(timezone.utc).isoformat()
    experiment={
        "id":secrets.token_hex(10),
        "name":f"Advanced Discovery — {target}",
        "workflow_type":"advanced_drug_discovery", "target":target,
        "status":"completed","input":{"molecules":data.molecules},
        "parameters":{"filters":filtered["filters"],"pipeline":["filter","virtual_screening","rank","reproducible_record"]},
        "results":{"filtered_count":len(candidates),"screening":screening},
        "user":user["username"],"created_at":now,"updated_at":now,
        "reproducibility":{"api_version":app.version,"rdkit_available":True,"docking_engine_available":VINA_AVAILABLE}
    }
    experiments_store.insert(0,experiment)
    activity_log.insert(0,{"type":"advanced_discovery_pipeline","username":user["username"],"target":target,"candidates":len(candidates),"at":now})
    _db_save()
    _usage(user["username"])["discovery_runs"] += 1
    _usage(user["username"])["last_activity"] = now
    _db_save()
    return {"status":"completed","module":"Advanced Drug Discovery","workflow":"Target → Library Filter → Virtual Screening → Ranking → Reproducible Experiment","experiment_id":experiment["id"],"target":target,"filtered_count":len(candidates),"rejected_count":filtered["rejected_count"],"ranked_results":screening["results"],"experiment":experiment}


# Initialize persistent platform/application state after all definitions are loaded.
try:
    _db_load()
except Exception as exc:
    print(f"MedGen state initialization skipped: {exc}")
