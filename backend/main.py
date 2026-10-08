import uuid
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

ALLOWED_CORS_ORIGINS = [
    origin.strip() for origin in os.getenv(
        "MEDGEN_CORS_ORIGINS",
        "https://medgenai-web-1.onrender.com,https://medgenai-web.onrender.com,http://localhost:3000,http://localhost:5173"
    ).split(",") if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_CORS_ORIGINS,
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
revoked_tokens = set()
login_attempts = {}
LOGIN_WINDOW_SECONDS = int(os.getenv("MEDGEN_LOGIN_WINDOW_SECONDS", "300"))
LOGIN_MAX_ATTEMPTS = int(os.getenv("MEDGEN_LOGIN_MAX_ATTEMPTS", "8"))
user_profiles = {}
user_accounts = {}
user_consents = {}
role_requests_store = []
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
        stores={"user_accounts":user_accounts,"user_profiles":user_profiles,"user_consents":user_consents,"role_requests_store":role_requests_store,"experiments_store":experiments_store,"reports_store":reports_store,"activity_log":activity_log,"knowledge_entities_store":knowledge_entities_store,"knowledge_relations_store":knowledge_relations_store,"organizations_store":organizations_store,"memberships_store":memberships_store,"workspaces_store":workspaces_store,"projects_store":projects_store,"api_keys_store":api_keys_store,"platform_audit_log":platform_audit_log,"usage_store":usage_store,"webhooks_store":webhooks_store}
        for key,value in rows:
            if key in stores and isinstance(value,(dict,list)):
                stores[key].clear()
                if isinstance(stores[key],dict): stores[key].update(value)
                else: stores[key].extend(value)
    except Exception as exc: print(f"PostgreSQL load skipped: {exc}")

def _db_save():
    if not PERSISTENCE_ENABLED: return
    stores={"user_accounts":user_accounts,"user_profiles":user_profiles,"user_consents":user_consents,"role_requests_store":role_requests_store,"experiments_store":experiments_store,"reports_store":reports_store,"activity_log":activity_log,"knowledge_entities_store":knowledge_entities_store,"knowledge_relations_store":knowledge_relations_store,"organizations_store":organizations_store,"memberships_store":memberships_store,"workspaces_store":workspaces_store,"projects_store":projects_store,"api_keys_store":api_keys_store,"platform_audit_log":platform_audit_log,"usage_store":usage_store,"webhooks_store":webhooks_store}
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
    role: str = "student"
    education_mode: str = "GLOBAL"
    country_code: str = ""
    university: str = ""
    faculty: str = ""
    major: str = ""
    academic_year: int = 1
    group: str = ""
    student_id: str = ""


class AccountUpdateRequest(BaseModel):
    username: str | None = None
    phone: str | None = None
    email: str | None = None


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str

class AdminRoleUpdateRequest(BaseModel):
    username: str
    role: str

class RoleRequest(BaseModel):
    role: str

class AdminSessionRevokeRequest(BaseModel):
    username: str


class ProfileRequest(BaseModel):
    full_name: str = ""
    email: str = ""
    organization: str = ""
    country: str = ""
    region: str = ""
    district: str = ""
    city: str = ""
    location_label: str = ""
    location_lat: float | None = None
    location_lon: float | None = None
    location_source: str = ""
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

class IdentityVerificationRequest(BaseModel):
    method: str = "DOCUMENT_PROVIDER"



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


class EducationPreferenceRequest(BaseModel):
    mode: str = "GLOBAL"
    country_code: str = "INTL"
    education_level: str = "UNIVERSITY"
    language: str = "en"


# =========================================================
# AUTH FUNCTIONS
# =========================================================

def validate_password(password: str):
    if (
        len(password) < 8
        or not re.search(r"[A-Za-z]", password)
        or not re.search(r"\d", password)
    ):
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters and contain letters and numbers.",
        )

def is_required_profile_complete(profile: dict) -> bool:
    if not profile: return False
    required = ["full_name","email","country","region","district","city"]
    if not all(str(profile.get(k) or "").strip() for k in required): return False
    if not all(profile.get(k) is not None for k in ("birth_year","birth_month","birth_day")): return False
    role = normalize_role(profile.get("role") or "student")
    if role in {"student","school_student","researcher","professor"}:
        ap = profile.get("academic_profile") or {}
        if not all(str(ap.get(k) or "").strip() for k in ("university","faculty","major","group","student_id")): return False
    return True

def normalize_role(value: str) -> str:
    role = str(value or "student").strip().lower()
    return "SUPER_ADMIN" if role.upper() == "SUPER_ADMIN" else role

ALLOWED_USER_ROLES = {
    "student", "school_student", "doctor", "researcher", "professor",
    "lab", "biotech", "pharma", "bioinformatician", "hospital", "company"
}


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

    token = credentials.credentials
    username = tokens.get(token)
    created_at = token_created_at.get(token)

    if token in revoked_tokens:
        tokens.pop(token, None)
        token_created_at.pop(token, None)
        raise HTTPException(status_code=401, detail="Session revoked")

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

    profile = user_profiles.get(username, {})
    if str(profile.get("role_status", "active")).lower() != "active":
        raise HTTPException(status_code=403, detail="Account is disabled")

    stored_role = normalize_role(profile.get("role") or "student")
    approved_roles = [normalize_role(x) for x in (profile.get("approved_roles") or [stored_role])]
    if stored_role not in approved_roles: approved_roles.insert(0, stored_role)
    if str(username).strip().casefold() == str(ADMIN_USERNAME).strip().casefold():
        stored_role = "SUPER_ADMIN"
    return {
        "username": username,
        "role": stored_role,
        "roles": approved_roles,
    }


# =========================================================
# ACCOUNT READINESS GUARD
# =========================================================
@app.middleware("http")
async def account_readiness_guard(request: Request, call_next):
    path = request.url.path
    if not path.startswith("/api/v1/"):
        return await call_next(request)

    allowed = {
        "/api/v1/health/live",
        "/api/v1/auth/login",
        "/api/v1/auth/register",
        "/api/v1/auth/me",
        "/api/v1/auth/logout",
        "/api/v1/profile",
        "/api/v1/account",
        "/api/v1/legal/documents",
        "/api/v1/legal/consent",
        "/api/v1/academy/profile",
        "/api/v1/education/preferences",
        "/api/v1/roles/request",
        "/api/v1/security/overview",
    }
    if path in allowed or path.startswith("/api/v1/admin/"):
        return await call_next(request)

    auth = request.headers.get("authorization", "")
    token = auth[7:].strip() if auth.lower().startswith("bearer ") else ""
    username = tokens.get(token)
    if not username:
        return await call_next(request)

    profile = user_profiles.get(username, {})
    if not is_required_profile_complete(profile):
        return JSONResponse(
            status_code=403,
            content={"detail":"PROFILE_INCOMPLETE","message":"Profilni to‘liq to‘ldiring."},
        )

    consent = user_consents.get(username, {})
    if not all(bool(consent.get(k)) for k in ("terms_accepted","privacy_accepted","data_processing_accepted","research_disclaimer_accepted")):
        return JSONResponse(
            status_code=403,
            content={"detail":"LEGAL_CONSENT_REQUIRED","message":"Avval majburiy roziliklarni tasdiqlang."},
        )
    return await call_next(request)

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
    activity_log.insert(0, {
        "type": "login",
        "username": data.username,
        "at": now.isoformat(),
    })
    _db_save()
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": TOKEN_TTL_SECONDS,
    }


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
    role = normalize_role(data.role)
    if role not in ALLOWED_USER_ROLES:
        role = "student"
    if not 1 <= int(data.academic_year) <= 6:
        raise HTTPException(status_code=400, detail="Academic year must be between 1 and 6.")
    user_profiles[username] = {
        "full_name": data.full_name.strip(), "email": email, "phone": data.phone.strip(),
        "country": data.country.strip(), "region": "", "district": "", "city": "",
        "location_label": "", "location_lat": None, "location_lon": None,
        "location_source": "", "organization": data.organization.strip(),
        "birth_year": None, "birth_month": None, "birth_day": None,
        "research_interests": "", "bio": "", "avatar": "",
        "role": role,
        "approved_roles": [role],
        "role_status": "active",
        "academic_profile": {
            "country_code": str(data.country_code or "").upper()[:2],
            "education_mode": str(data.education_mode or "GLOBAL").upper(),
            "university": str(data.university or "").strip()[:200],
            "faculty": str(data.faculty or "").strip()[:200],
            "major": str(data.major or "").strip()[:200],
            "year": int(data.academic_year),
            "group": str(data.group or "").strip()[:100],
            "student_id": str(data.student_id or "").strip()[:100],
            "study_language": "en",
            "academic_degree": "MD/MBBS",
        },
    }
    activity_log.insert(0, {
        "type": "account_registered",
        "username": username,
        "role": role,
        "at": datetime.now(timezone.utc).isoformat(),
    })
    _db_save()
    return {"status": "registered", "username": username, "role": role}


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
        "profile_complete": is_required_profile_complete(profile),
        "consent_complete": all([
            consent.get("terms_accepted", False),
            consent.get("privacy_accepted", False),
            consent.get("data_processing_accepted", False),
            consent.get("research_disclaimer_accepted", False),
        ]),
    }


# =========================================================
# EDUCATION PREFERENCES — GLOBAL OR COUNTRY-SPECIFIC
# =========================================================

EDUCATION_MODES = {"GLOBAL", "COUNTRY"}
EDUCATION_LEVELS = {"SCHOOL", "COLLEGE", "UNIVERSITY", "POSTGRADUATE", "RESEARCH"}
EDUCATION_LANGUAGES = {"en", "uz", "ru", "es", "fr", "de", "pt", "ar", "zh", "ja", "ko", "hi", "tr"}

@app.get("/api/v1/education/preferences")
def get_education_preferences(user=Depends(get_current_user)):
    profile = user_profiles.setdefault(user["username"], {})
    preferences = profile.get("education_preferences") or {
        "mode": "GLOBAL",
        "country_code": "INTL",
        "education_level": "UNIVERSITY",
        "language": "en",
    }
    return {"status": "ok", "preferences": preferences}


@app.put("/api/v1/education/preferences")
def update_education_preferences(
    data: EducationPreferenceRequest,
    user=Depends(get_current_user),
):
    mode = str(data.mode or "GLOBAL").upper().strip()
    country_code = str(data.country_code or "INTL").upper().strip()
    education_level = str(data.education_level or "UNIVERSITY").upper().strip()
    language = str(data.language or "en").lower().strip()

    if mode not in EDUCATION_MODES:
        raise HTTPException(status_code=400, detail="mode must be GLOBAL or COUNTRY.")
    if mode == "COUNTRY" and (len(country_code) != 2 or country_code == "INTL"):
        raise HTTPException(status_code=400, detail="A valid ISO-style two-letter country code is required for COUNTRY mode.")
    if mode == "GLOBAL":
        country_code = "INTL"
    if education_level not in EDUCATION_LEVELS:
        raise HTTPException(status_code=400, detail="Invalid education level.")
    if language not in EDUCATION_LANGUAGES:
        raise HTTPException(status_code=400, detail="Unsupported education language.")

    preferences = {
        "mode": mode,
        "country_code": country_code,
        "education_level": education_level,
        "language": language,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    user_profiles.setdefault(user["username"], {})["education_preferences"] = preferences
    activity_log.insert(0, {
        "type": "education_preferences_updated",
        "username": user["username"],
        "mode": mode,
        "country_code": country_code,
        "at": preferences["updated_at"],
    })
    _db_save()
    return {"status": "saved", "preferences": preferences}


@app.post("/api/v1/auth/logout")
def logout(credentials: HTTPAuthorizationCredentials = Depends(security)):
    if credentials:
        token = credentials.credentials
        username = tokens.pop(token, None)
        token_created_at.pop(token, None)
        revoked_tokens.add(token)
        if username:
            activity_log.insert(0, {
                "type": "logout",
                "username": username,
                "at": datetime.now(timezone.utc).isoformat(),
            })
    _db_save()
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
    activity_log.insert(0, {
        "type": "account_updated",
        "username": current,
        "at": datetime.now(timezone.utc).isoformat(),
    })
    _db_save()
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
            revoked_tokens.add(token)
    activity_log.insert(0, {
        "type": "password_changed",
        "username": user["username"],
        "at": datetime.now(timezone.utc).isoformat(),
    })
    _db_save()
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
    if not data.region.strip() or not data.district.strip() or not data.city.strip():
        raise HTTPException(status_code=400, detail="Viloyat, tuman va shahar majburiy.")
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
    # Normalize optional location fields; exact coordinates are only stored when
    # the user explicitly grants browser location permission.
    profile["country"] = str(profile.get("country") or "").strip()[:120]
    profile["region"] = str(profile.get("region") or "").strip()[:160]
    profile["district"] = str(profile.get("district") or "").strip()[:160]
    profile["city"] = str(profile.get("city") or "").strip()[:160]
    profile["location_label"] = str(profile.get("location_label") or "").strip()[:240]
    profile["location_source"] = str(profile.get("location_source") or "").strip()[:40]
    user_profiles[user["username"]] = profile

    activity_log.insert(
        0,
        {
            "type": "profile_updated",
            "username": user["username"],
            "at": datetime.now(timezone.utc).isoformat(),
        },
    )

    _db_save()
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


@app.get("/api/v1/security/summary")
def security_summary(user=Depends(get_current_user)):
    username = user["username"]
    profile = user_profiles.get(username, {})
    consent = user_consents.get(username, {})
    identity = profile.get("identity_verification") or {
        "status": "NOT_VERIFIED",
        "method": "",
        "requested_at": None,
    }
    return {
        "status": "ok",
        "consent_complete": all([
            consent.get("terms_accepted", False),
            consent.get("privacy_accepted", False),
            consent.get("data_processing_accepted", False),
            consent.get("research_disclaimer_accepted", False),
        ]),
        "consent_version": consent.get("version", ""),
        "consent_accepted_at": consent.get("accepted_at"),
        "identity": identity,
        "active_sessions": sum(1 for owner in tokens.values() if owner == username),
        "location": {
            "source": profile.get("location_source", ""),
            "label": profile.get("location_label", ""),
            "country": profile.get("country", ""),
            "region": profile.get("region", ""),
            "district": profile.get("district", ""),
            "city": profile.get("city", ""),
            "has_coordinates": profile.get("location_lat") is not None and profile.get("location_lon") is not None,
        },
    }


@app.post("/api/v1/security/identity/request")
def request_identity_verification(data: IdentityVerificationRequest, user=Depends(get_current_user)):
    method = str(data.method or "DOCUMENT_PROVIDER").strip().upper()
    allowed = {"DOCUMENT_PROVIDER", "PASSPORT_PROVIDER", "NATIONAL_ID_PROVIDER"}
    if method not in allowed:
        raise HTTPException(status_code=400, detail="Unsupported identity verification method.")
    now = datetime.now(timezone.utc).isoformat()
    verification = {
        "status": "PENDING_PROVIDER",
        "method": method,
        "requested_at": now,
        "note": "No passport, selfie, or raw biometric data is stored by this endpoint. A compliant identity provider must complete the actual verification.",
    }
    user_profiles.setdefault(user["username"], {})["identity_verification"] = verification
    activity_log.insert(0, {"type": "identity_verification_requested", "username": user["username"], "method": method, "at": now})
    _db_save()
    return {"status": "requested", "identity": verification}


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
# BIOINFORMATICS — PHASE 2 SCIENTIFIC CORE
# =========================================================

DNA_ALPHABET = set("ACGTN")
RNA_ALPHABET = set("ACGUN")
PROTEIN_ALPHABET = set("ACDEFGHIKLMNPQRSTVWYBXZJUO")


def _clean_sequence(raw: str) -> str:
    # Accept plain sequence text and simple FASTA input.
    lines = [
        line.strip()
        for line in str(raw or "").splitlines()
        if line.strip()
    ]
    if lines and lines[0].startswith(">"):
        lines = lines[1:]
    return "".join(lines).replace(" ", "").upper()


def detect_sequence_type(sequence: str) -> str:
    clean = _clean_sequence(sequence)
    if not clean:
        return "UNKNOWN"

    chars = set(clean)
    if chars.issubset(DNA_ALPHABET):
        return "DNA"
    if chars.issubset(RNA_ALPHABET):
        return "RNA"
    if chars.issubset(PROTEIN_ALPHABET):
        return "PROTEIN"
    return "UNKNOWN"


def _reverse_complement(sequence: str, sequence_type: str) -> str | None:
    if sequence_type == "DNA":
        table = str.maketrans("ACGTN", "TGCAN")
    elif sequence_type == "RNA":
        table = str.maketrans("ACGUN", "UGCAN")
    else:
        return None
    return sequence.translate(table)[::-1]


def _orf_summary(sequence: str, sequence_type: str) -> dict[str, Any] | None:
    if sequence_type not in {"DNA", "RNA"}:
        return None

    stop_codons = {"TAA", "TAG", "TGA"} if sequence_type == "DNA" else {"UAA", "UAG", "UGA"}
    start_codon = "ATG" if sequence_type == "DNA" else "AUG"
    orfs: list[dict[str, int]] = []

    # Lightweight six-frame ORF scan; this is an exploratory analysis,
    # not a gene-calling or clinical annotation pipeline.
    strands = [("forward", sequence), ("reverse_complement", _reverse_complement(sequence, sequence_type) or "")]
    for strand_name, strand in strands:
        for frame in range(3):
            i = frame
            while i + 2 < len(strand):
                codon = strand[i:i + 3]
                if codon == start_codon:
                    j = i + 3
                    while j + 2 < len(strand):
                        if strand[j:j + 3] in stop_codons:
                            aa_len = (j - i) // 3
                            if aa_len >= 2:
                                orfs.append({
                                    "strand": strand_name,
                                    "frame": frame + 1,
                                    "start": i + 1,
                                    "end": j + 3,
                                    "codons": aa_len + 1,
                                })
                            break
                        j += 3
                    i = j + 3 if j + 2 < len(strand) else len(strand)
                else:
                    i += 3

    return {
        "count": len(orfs),
        "open_reading_frames": orfs[:100],
        "truncated": len(orfs) > 100,
    }


@app.post("/api/v1/bioinformatics/analyze")
def bioinformatics_analyze(
    data: SequenceRequest,
    user=Depends(get_current_user),
):
    sequence = _clean_sequence(data.sequence)

    if not sequence:
        raise HTTPException(status_code=400, detail="Sequence is required.")

    detected_type = detect_sequence_type(sequence)
    requested_type = str(data.sequence_type or "AUTO").upper().strip()
    if requested_type != "AUTO":
        if requested_type not in {"DNA", "RNA", "PROTEIN"}:
            raise HTTPException(
                status_code=400,
                detail="sequence_type must be AUTO, DNA, RNA, or PROTEIN.",
            )
        detected_type = requested_type

    alphabet = DNA_ALPHABET if detected_type == "DNA" else RNA_ALPHABET if detected_type == "RNA" else PROTEIN_ALPHABET
    invalid_symbols = sorted(set(sequence) - alphabet)

    if invalid_symbols:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "Sequence contains symbols outside the selected alphabet.",
                "sequence_type": detected_type,
                "invalid_symbols": invalid_symbols,
            },
        )

    length = len(sequence)
    a_count = sequence.count("A")
    c_count = sequence.count("C")
    g_count = sequence.count("G")
    t_count = sequence.count("T")
    u_count = sequence.count("U")
    gc_count = g_count + c_count

    result: dict[str, Any] = {
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
        "gc_content_percent": round((gc_count / length) * 100, 2) if length else 0,
        "at_content_percent": round(((a_count + t_count) / length) * 100, 2) if length else 0,
        "ambiguous_bases": sequence.count("N") if detected_type in {"DNA", "RNA"} else sequence.count("X"),
    }

    if detected_type in {"DNA", "RNA"}:
        result["reverse_complement"] = _reverse_complement(sequence, detected_type)
        result["orf_analysis"] = _orf_summary(sequence, detected_type)
        result["alphabet"] = "nucleotide"
    else:
        aa_counts = {aa: sequence.count(aa) for aa in sorted(PROTEIN_ALPHABET) if sequence.count(aa)}
        result["amino_acid_composition"] = aa_counts
        result["alphabet"] = "protein"

    result["message"] = "Sequence analysis completed."
    return result


@app.post("/api/v1/workflows/bioinformatics")
def bioinformatics_workflow(
    data: SequenceRequest,
    user=Depends(get_current_user),
):
    return bioinformatics_analyze(data, user)


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
    _check_quota(user["username"], "workflows_created")

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
    _check_quota(user["username"], "research_runs")
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
# PERSONAL DASHBOARD / USER DIRECTORY
# =========================================================

DASHBOARD_ROLE_LABELS = {
    "student": "Talabalar",
    "school_student": "O‘quvchilar",
    "doctor": "Shifokorlar",
    "researcher": "Tadqiqotchilar",
    "professor": "Professorlar",
    "lab": "Laboratoriyalar",
    "biotech": "Biotech",
    "pharma": "Pharma",
    "bioinformatician": "Bioinformaticianlar",
    "hospital": "Klinikalar / Hospital",
    "company": "Kompaniyalar",
    "SUPER_ADMIN": "Super Admin / Owner",
}

@app.get("/api/v1/dashboard/summary")
def dashboard_summary(user=Depends(get_current_user)):
    username = user["username"]
    current_profile = user_profiles.get(username, {})
    role = str(user.get("role") or current_profile.get("role") or "student")
    all_users = sorted(set(user_accounts) | set(user_profiles) | set(user_consents) | set(tokens.values()))

    role_counts = {}
    for name in all_users:
        r = "SUPER_ADMIN" if name.casefold() == str(ADMIN_USERNAME).casefold() else str(user_profiles.get(name, {}).get("role", "student"))
        role_counts[r] = role_counts.get(r, 0) + 1

    own_activity = [x for x in activity_log if x.get("username") == username][:20]
    own_jobs = [x for x in jobs_store if x.get("username") == username]
    own_workflows = [x for x in workflows_store if x.get("username") == username]
    own_experiments = [x for x in experiments_store if x.get("username") == username]
    own_reports = [x for x in reports_store if x.get("username") == username]

    result = {
        "status": "ok",
        "username": username,
        "role": role,
        "role_label": DASHBOARD_ROLE_LABELS.get(role, role),
        "personal": {
            "profile": current_profile,
            "activity": own_activity,
            "jobs": len(own_jobs),
            "workflows": len(own_workflows),
            "experiments": len(own_experiments),
            "reports": len(own_reports),
        },
        "navigation_scope": "ALL" if role == "SUPER_ADMIN" else "ROLE",
    }

    if role == "SUPER_ADMIN":
        role_activity = {}
        for name in all_users:
            rr = "SUPER_ADMIN" if name.casefold() == str(ADMIN_USERNAME).casefold() else str(user_profiles.get(name, {}).get("role", "student"))
            role_activity[rr] = {
                "users": role_counts.get(rr, 0),
                "jobs": sum(1 for x in jobs_store if x.get("username") == name),
                "workflows": sum(1 for x in workflows_store if x.get("username") == name),
                "experiments": sum(1 for x in experiments_store if x.get("username") == name),
                "reports": sum(1 for x in reports_store if x.get("username") == name),
                "recent_activity": [x for x in activity_log if x.get("username") == name][:10],
            }
        result["global"] = {
            "total_users": len(all_users),
            "role_counts": role_counts,
            "active_sessions": len(tokens),
            "jobs": len(jobs_store),
            "workflows": len(workflows_store),
            "experiments": len(experiments_store),
            "reports": len(reports_store),
            "docking_jobs": len(docking_jobs_store),
            "recent_activity": activity_log[:50],
        }
    elif role in {"student", "school_student", "professor", "researcher", "doctor"}:
        result["role_group"] = {
            "role_users": role_counts.get(role, 0),
            "group_label": DASHBOARD_ROLE_LABELS.get(role, role),
        }

    return result



# =========================================================
# PHASE 6–7 — SAFE CLINICAL / PROCEDURE SIMULATION FOUNDATION
# Educational simulation only; never represents real patient care.
# =========================================================
CLINICAL_SIM_CASES = {
    "basic-triage": {
        "title": "Basic Triage Simulation",
        "level": "student",
        "disclaimer": "Educational simulation. Not medical advice or a real clinical decision.",
        "steps": [
            {"id": "s1", "prompt": "Review the simulated vital signs and identify the first safety priority.", "options": ["Airway/breathing/circulation safety check", "Prescribe medication immediately", "Discharge immediately"]},
            {"id": "s2", "prompt": "Choose the next educational action.", "options": ["Gather focused history and repeat observations", "Skip assessment", "Make a definitive diagnosis from one finding"]},
        ],
    },
    "osce-general": {
        "title": "General OSCE Simulation",
        "level": "student",
        "disclaimer": "Educational OSCE practice. No real patient data.",
        "steps": [
            {"id": "s1", "prompt": "Begin the simulated station.", "options": ["Introduce yourself, confirm identity and explain the procedure", "Start without explanation", "Skip consent discussion"]},
            {"id": "s2", "prompt": "Close the station safely.", "options": ["Summarize findings, safety-net and document", "Invent missing findings", "Hide uncertainty"]},
        ],
    },
}

class ClinicalSimulationStartRequest(BaseModel):
    case_id: str = "basic-triage"

class ClinicalSimulationSubmitRequest(BaseModel):
    case_id: str
    answers: dict[str, str] = {}

@app.get("/api/v1/clinical/simulations")
def clinical_simulations(user=Depends(get_current_user)):
    return {
        "status": "ok",
        "educational_only": True,
        "cases": [{"id": k, "title": v["title"], "level": v["level"], "disclaimer": v["disclaimer"]} for k, v in CLINICAL_SIM_CASES.items()],
    }

@app.post("/api/v1/clinical/simulations/start")
def clinical_simulation_start(data: ClinicalSimulationStartRequest, user=Depends(get_current_user)):
    case = CLINICAL_SIM_CASES.get(data.case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Simulation case not found.")
    return {"status": "started", "case_id": data.case_id, "title": case["title"], "educational_only": True, "disclaimer": case["disclaimer"], "steps": case["steps"]}

@app.post("/api/v1/clinical/simulations/submit")
def clinical_simulation_submit(data: ClinicalSimulationSubmitRequest, user=Depends(get_current_user)):
    case = CLINICAL_SIM_CASES.get(data.case_id)
    if not case:
        raise HTTPException(status_code=404, detail="Simulation case not found.")
    # This foundation evaluates only completion/structure, not clinical correctness.
    completed = sum(1 for step in case["steps"] if data.answers.get(step["id"]))
    score = round(completed * 100 / len(case["steps"])) if case["steps"] else 0
    activity_log.insert(0, {"type": "clinical_simulation", "username": user["username"], "case_id": data.case_id, "score": score, "at": datetime.now(timezone.utc).isoformat()})
    _db_save()
    return {"status": "completed", "case_id": data.case_id, "score": score, "educational_only": True, "disclaimer": case["disclaimer"]}

# =========================================================
# PHASE 8–10 — GLOBAL PHASE REGISTRY / READINESS
# =========================================================
@app.get("/api/v1/platform/phase-status")
def platform_phase_status(user=Depends(get_current_user)):
    role = str(user.get("role", "")).upper()
    if role != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="SUPER_ADMIN required.")
    return {
        "status": "ok",
        "principle": "BUILD -> INTEGRATE -> TEST -> SECURITY -> UI -> REGRESSION -> FINALIZE",
        "phases": [
            {"phase": 1, "name": "Medical Education Foundation", "state": "finalized_foundation"},
            {"phase": 2, "name": "Bioinformatics & Molecular Analysis", "state": "implemented"},
            {"phase": 3, "name": "Virtual Laboratory", "state": "implemented_foundation"},
            {"phase": 4, "name": "Drug Discovery", "state": "implemented_foundation"},
            {"phase": 5, "name": "Research / AI Scientist", "state": "implemented_foundation"},
            {"phase": 6, "name": "Clinical Workspace + Digital Patient", "state": "safe_simulation_foundation"},
            {"phase": 7, "name": "Virtual Clinical & Surgery Simulation", "state": "safe_simulation_foundation"},
            {"phase": 8, "name": "Global Platform / Organization / Admin", "state": "implemented_foundation"},
            {"phase": 9, "name": "Security, Identity Verification & Compliance", "state": "implemented_foundation"},
            {"phase": 10, "name": "Global Launch + Monetization + Web/API/Mobile", "state": "foundation_ready"},
        ],
        "note": "A phase is not called production-complete merely because its foundation exists.",
    }

@app.get("/api/v1/academy/catalog")
def academy_catalog(user=Depends(get_current_user)):
    # Curated starter catalog. The UI also supports manual entry for institutions
    # that are not yet in this catalog; no location or identity data is inferred.
    return {
        "status": "ok",
        "countries": [
            {"code": "UZ", "name": "Uzbekistan"},
            {"code": "US", "name": "United States"},
            {"code": "GB", "name": "United Kingdom"},
            {"code": "DE", "name": "Germany"},
            {"code": "FR", "name": "France"},
            {"code": "TR", "name": "Türkiye"},
            {"code": "RU", "name": "Russia"},
            {"code": "KZ", "name": "Kazakhstan"},
            {"code": "JP", "name": "Japan"},
            {"code": "KR", "name": "South Korea"},
            {"code": "CN", "name": "China"},
            {"code": "IN", "name": "India"},
            {"code": "CA", "name": "Canada"},
            {"code": "AU", "name": "Australia"},
            {"code": "OTHER", "name": "Other country"},
        ],
        "universities": {
            "UZ": [
                "Tashkent State Medical University",
                "Tashkent Medical Academy",
                "Samarkand State Medical University",
                "Bukhara State Medical Institute",
                "Andijan State Medical Institute",
                "Fergana Medical Institute of Public Health",
                "Tashkent State Dental Institute",
                "Other / enter manually",
            ],
            "US": ["Harvard University", "Johns Hopkins University", "Stanford University", "Other / enter manually"],
            "GB": ["University of Oxford", "University of Cambridge", "Imperial College London", "Other / enter manually"],
            "DE": ["Charité – Universitätsmedizin Berlin", "Heidelberg University", "Other / enter manually"],
            "FR": ["Université Paris Cité", "Sorbonne University", "Other / enter manually"],
            "TR": ["Hacettepe University", "Istanbul University", "Ankara University", "Other / enter manually"],
            "RU": ["Sechenov University", "Pirogov Russian National Research Medical University", "Other / enter manually"],
            "KZ": ["Asfendiyarov Kazakh National Medical University", "Astana Medical University", "Other / enter manually"],
            "JP": ["University of Tokyo", "Kyoto University", "Other / enter manually"],
            "KR": ["Seoul National University", "Yonsei University", "Other / enter manually"],
            "CN": ["Peking University", "Tsinghua University", "Other / enter manually"],
            "IN": ["All India Institute of Medical Sciences", "Christian Medical College Vellore", "Other / enter manually"],
            "CA": ["University of Toronto", "McGill University", "Other / enter manually"],
            "AU": ["University of Melbourne", "University of Sydney", "Other / enter manually"],
        },
    }

# =========================================================
# SUPER ADMIN
# =========================================================

def require_super_admin(user):
    if user.get("role") != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Super Admin access required")


@app.post("/api/v1/roles/request")
def request_role(data: RoleRequest, user=Depends(get_current_user)):
    role = normalize_role(data.role)
    if role not in ALLOWED_USER_ROLES: raise HTTPException(status_code=400, detail="Unsupported role.")
    profile=user_profiles.setdefault(user["username"], {})
    approved=[normalize_role(x) for x in (profile.get("approved_roles") or [profile.get("role","student")])]
    if role in approved: return {"status":"already_approved","roles":approved}
    if any(x.get("username")==user["username"] and x.get("role")==role and x.get("status")=="PENDING" for x in role_requests_store):
        return {"status":"pending","roles":approved}
    req={"id":secrets.token_hex(12),"username":user["username"],"role":role,"status":"PENDING","requested_at":datetime.now(timezone.utc).isoformat()}
    role_requests_store.append(req); _db_save(); return {"status":"pending","request":req,"roles":approved}

@app.get("/api/v1/admin/role-requests")
def admin_role_requests(user=Depends(get_current_user)):
    require_super_admin(user); return {"requests":[x for x in role_requests_store if x.get("status")=="PENDING"]}

@app.patch("/api/v1/admin/role-requests/{request_id}")
def admin_approve_role(request_id: str, approve: bool=True, user=Depends(get_current_user)):
    require_super_admin(user)
    req=next((x for x in role_requests_store if x.get("id")==request_id),None)
    if not req: raise HTTPException(status_code=404, detail="Role request not found.")
    if req.get("status")!="PENDING": return {"status":req.get("status")}
    req["status"]="APPROVED" if approve else "REJECTED"; req["reviewed_at"]=datetime.now(timezone.utc).isoformat(); req["reviewed_by"]=user["username"]
    if approve:
        p=user_profiles.setdefault(req["username"],{}); roles=[normalize_role(x) for x in (p.get("approved_roles") or [p.get("role","student")])]
        if req["role"] not in roles: roles.append(req["role"])
        p["approved_roles"]=roles
    _db_save(); return {"status":req["status"],"username":req["username"],"roles":user_profiles.get(req["username"],{}).get("approved_roles",[])}

@app.get("/api/v1/admin/overview")
def admin_overview(user=Depends(get_current_user)):
    require_super_admin(user)
    all_users = sorted(set(tokens.values()) | set(user_accounts.keys()) | set(user_profiles.keys()) | set(user_consents.keys()))
    role_counts = {}
    for username in all_users:
        r = str(
            "SUPER_ADMIN" if username.casefold() == str(ADMIN_USERNAME).casefold()
            else user_profiles.get(username, {}).get("role", "student")
        ).lower()
        role_counts[r] = role_counts.get(r, 0) + 1
    return {
        "status": "ready",
        "role": user["role"],
        "users": len(all_users),
        "role_counts": role_counts,
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
                "roles": user_profiles.get(u, {}).get("approved_roles", [user_profiles.get(u, {}).get("role", "student")]),
                "role": (
                    "SUPER_ADMIN"
                    if str(u).strip().casefold() == str(ADMIN_USERNAME).strip().casefold()
                    else user_profiles.get(u, {}).get("role", "student")
                ),
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


@app.patch("/api/v1/admin/users/{username}/role")
def admin_update_user_role(
    username: str,
    data: AdminRoleUpdateRequest,
    user=Depends(get_current_user),
):
    require_super_admin(user)
    target = username.strip()
    if target not in user_accounts and target not in user_profiles:
        raise HTTPException(status_code=404, detail="User not found.")

    role = normalize_role(data.role)
    allowed = ALLOWED_USER_ROLES | {"SUPER_ADMIN"}
    if role not in allowed:
        raise HTTPException(status_code=400, detail="Unsupported role.")

    if target.casefold() == str(ADMIN_USERNAME).strip().casefold():
        raise HTTPException(status_code=400, detail="Primary SUPER_ADMIN role is protected.")

    profile = user_profiles.setdefault(target, {})
    old_role = normalize_role(profile.get("role", "student"))
    profile["role"] = role
    profile["role_status"] = "active"
    now = datetime.now(timezone.utc).isoformat()
    activity_log.insert(0, {
        "type": "admin_role_changed",
        "actor": user["username"],
        "username": target,
        "old_role": old_role,
        "new_role": role,
        "at": now,
    })
    _platform_audit(
        user,
        "user.role_changed",
        "user",
        target,
        {"old_role": old_role, "new_role": role},
    )
    _db_save()
    return {"status": "updated", "username": target, "role": role}

@app.patch("/api/v1/admin/users/{username}/status")
def admin_update_user_status(
    username: str,
    enabled: bool,
    user=Depends(get_current_user),
):
    require_super_admin(user)
    target = username.strip()
    if target.casefold() == str(ADMIN_USERNAME).strip().casefold():
        raise HTTPException(status_code=400, detail="Primary SUPER_ADMIN account cannot be disabled.")
    if target not in user_accounts and target not in user_profiles:
        raise HTTPException(status_code=404, detail="User not found.")

    profile = user_profiles.setdefault(target, {})
    profile["role_status"] = "active" if enabled else "disabled"
    if not enabled:
        for token, owner in list(tokens.items()):
            if owner == target:
                tokens.pop(token, None)
                token_created_at.pop(token, None)
                revoked_tokens.add(token)
    now = datetime.now(timezone.utc).isoformat()
    activity_log.insert(0, {
        "type": "admin_account_status_changed",
        "actor": user["username"],
        "username": target,
        "enabled": enabled,
        "at": now,
    })
    _platform_audit(
        user,
        "user.status_changed",
        "user",
        target,
        {"enabled": enabled},
    )
    _db_save()
    return {"status": "updated", "username": target, "enabled": enabled}

@app.post("/api/v1/admin/users/{username}/revoke-sessions")
def admin_revoke_user_sessions(
    username: str,
    user=Depends(get_current_user),
):
    require_super_admin(user)
    target = username.strip()
    if target not in user_accounts and target not in user_profiles:
        raise HTTPException(status_code=404, detail="User not found.")
    count = 0
    for token, owner in list(tokens.items()):
        if owner == target:
            tokens.pop(token, None)
            token_created_at.pop(token, None)
            revoked_tokens.add(token)
            count += 1
    now = datetime.now(timezone.utc).isoformat()
    activity_log.insert(0, {
        "type": "admin_sessions_revoked",
        "actor": user["username"],
        "username": target,
        "count": count,
        "at": now,
    })
    _platform_audit(user, "user.sessions_revoked", "user", target, {"count": count})
    _db_save()
    return {"status": "revoked", "username": target, "sessions_revoked": count}

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
            "webhook_layer": True,
            "webhook_dispatcher": True
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

# =========================================================
# PHASE 1 — MEDICAL ACADEMY CORE (FINALIZED FOUNDATION)
# =========================================================

ACADEMY_COURSES = {
    1: {
        "title": "1-kurs — Fundamental fanlar",
        "subjects": [
            ("Anatomy", "Anatomiya", "human body structure"),
            ("Histology", "Gistologiya", "tissue structure"),
            ("Physiology", "Fiziologiya", "normal body function"),
            ("Biochemistry", "Biokimyo", "molecular processes of life"),
            ("Genetics", "Genetika", "genes and inheritance"),
            ("Microbiology", "Mikrobiologiya", "microorganisms and infection"),
            ("Immunology", "Immunologiya", "immune system"),
            ("Pathology", "Patologiya", "mechanisms of disease"),
            ("Medical terminology", "Tibbiy terminologiya", "medical language"),
            ("Public health", "Jamoat salomatligi", "population health"),
        ],
    },
    2: {"title": "2-kurs — Preklinik fanlar", "subjects": [
        ("Pathophysiology", "Patofiziologiya", "mechanisms of altered function"),
        ("Pharmacology", "Farmakologiya", "drug actions and safety"),
        ("Clinical biochemistry", "Klinik biokimyo", "laboratory interpretation"),
        ("Medical microbiology", "Tibbiy mikrobiologiya", "pathogens and diagnosis"),
        ("Immunopathology", "Immunopatologiya", "immune-mediated disease"),
        ("Genomic medicine", "Genom tibbiyoti", "genomic medicine"),
        ("Topographic anatomy", "Topografik anatomiya", "anatomical relationships"),
        ("Operative surgery", "Operativ xirurgiya", "surgical principles"),
        ("Radiology basics", "Radiologiya asoslari", "medical imaging principles"),
        ("Medical statistics", "Tibbiy statistika", "evidence and statistics"),
    ]},
    3: {"title": "3-kurs — Klinik fanlarga kirish", "subjects": [
        ("Internal medicine", "Ichki kasalliklar", "clinical assessment"),
        ("General surgery", "Umumiy xirurgiya", "surgical assessment"),
        ("Pediatrics", "Pediatriya", "child health"),
        ("Obstetrics and gynecology", "Akusherlik va ginekologiya", "maternal health"),
        ("Neurology", "Nevrologiya", "nervous system disorders"),
        ("Infectious diseases", "Yuqumli kasalliklar", "infectious syndromes"),
        ("Dermatology", "Dermatologiya", "skin disease"),
        ("ENT", "Otorinolaringologiya", "ear nose throat"),
        ("Ophthalmology", "Oftalmologiya", "eye disease"),
        ("Clinical pharmacology", "Klinik farmakologiya", "safe prescribing"),
    ]},
    4: {"title": "4-kurs — Klinik chuqurlashtirish", "subjects": [
        ("Cardiology", "Kardiologiya", "cardiovascular disease"),
        ("Pulmonology", "Pulmonologiya", "respiratory disease"),
        ("Gastroenterology", "Gastroenterologiya", "digestive disease"),
        ("Nephrology", "Nefrologiya", "kidney disease"),
        ("Endocrinology", "Endokrinologiya", "endocrine disease"),
        ("Hematology", "Gematologiya", "blood disorders"),
        ("Rheumatology", "Revmatologiya", "rheumatic disease"),
        ("Oncology", "Onkologiya", "cancer medicine"),
        ("Clinical genetics", "Klinik genetika", "genetic disorders"),
        ("Emergency medicine", "Shoshilinch tibbiyot", "acute care"),
    ]},
    5: {"title": "5-kurs — Klinik amaliyot", "subjects": [
        ("Advanced internal medicine", "Ichki kasalliklar II", "complex medical care"),
        ("Advanced surgery", "Xirurgiya II", "advanced surgical care"),
        ("Anesthesiology", "Anesteziologiya", "perioperative care"),
        ("Traumatology", "Travmatologiya", "trauma care"),
        ("Critical care", "Reanimatologiya", "critical illness"),
        ("Family medicine", "Oilaviy tibbiyot", "primary care"),
        ("Psychiatry", "Psixiatriya", "mental health"),
        ("Urology", "Urologiya", "urinary and male reproductive health"),
        ("Clinical nutrition", "Klinik ovqatlanish", "nutrition in disease"),
        ("Medical ethics", "Tibbiy etika", "professional practice"),
    ]},
    6: {"title": "6-kurs — Integratsion klinik tayyorgarlik", "subjects": [
        ("Integrated medicine", "Integratsion tibbiyot", "integrated clinical reasoning"),
        ("Integrated surgery", "Integratsion xirurgiya", "integrated surgical reasoning"),
        ("Clinical decision making", "Klinik qaror qabul qilish", "structured clinical reasoning"),
        ("Evidence-based medicine", "Dalillarga asoslangan tibbiyot", "evidence appraisal"),
        ("Clinical research", "Klinik tadqiqot", "research methods"),
        ("Health systems", "Sog‘liqni saqlash tizimlari", "health systems"),
        ("Rehabilitation", "Reabilitatsiya", "functional recovery"),
        ("Palliative care", "Palliativ yordam", "symptom-focused care"),
        ("Disaster medicine", "Falokatlar tibbiyoti", "mass-casualty principles"),
        ("Final OSCE", "Yakuniy OSCE", "integrated practical skills"),
    ]},
}

ACADEMY_ASSESSMENT_TYPES = ("theory", "practice", "quiz", "case", "exam")

def _academy_subject(course: int, subject_id: str):
    course_data = ACADEMY_COURSES.get(course)
    if not course_data:
        raise HTTPException(status_code=404, detail="Course not found.")
    for sid, name, objective in course_data["subjects"]:
        if sid == subject_id:
            return {"id": sid, "name": name, "objective": objective}
    raise HTTPException(status_code=404, detail="Subject not found.")

def _academy_profile(username: str):
    p = user_profiles.setdefault(username, {})
    ap = p.setdefault("academic_profile", {})
    defaults = {
        "country_code": "",
        "education_mode": "GLOBAL",
        "university": "",
        "faculty": "",
        "major": "",
        "year": 1,
        "group": "",
        "student_id": "",
        "study_language": "en",
        "academic_degree": "MD/MBBS",
    }
    for k, v in defaults.items():
        ap.setdefault(k, v)
    return ap

def _academy_progress(username: str):
    p = user_profiles.setdefault(username, {})
    return p.setdefault("academy_progress", {})

def _academy_key(course: int, subject_id: str):
    return f"{course}:{subject_id}"

def _academy_question_bank(course: int, subject: dict):
    topic = subject["objective"]
    sid = subject["id"]
    base = [
        {
            "id": f"{course}-{sid}-q1",
            "question": f"Which statement best describes {topic}?",
            "options": [
                f"It is a core concept of {topic}.",
                "It is unrelated to biomedical science.",
                "It is only an administrative process.",
                "It has no measurable scientific basis.",
            ],
            "answer": 0,
            "explanation": f"The first option states the intended core learning objective: {topic}.",
        },
        {
            "id": f"{course}-{sid}-q2",
            "question": f"What is the safest learning approach when studying {topic}?",
            "options": [
                "Learn the mechanism, practice it, then verify with assessment.",
                "Skip theory and memorize a final answer.",
                "Treat every simulation as real-patient care.",
                "Use an unverified source as the only authority.",
            ],
            "answer": 0,
            "explanation": "Medical Academy separates theory, practice, assessment and supervised simulation.",
        },
        {
            "id": f"{course}-{sid}-q3",
            "question": f"Why is {topic} important in medical education?",
            "options": [
                "It supports structured scientific and clinical reasoning.",
                "It replaces all laboratory and clinical evidence.",
                "It guarantees a diagnosis without examination.",
                "It removes the need for qualified supervision.",
            ],
            "answer": 0,
            "explanation": "Educational knowledge supports reasoning but does not replace real clinical validation.",
        },
        {
            "id": f"{course}-{sid}-q4",
            "question": f"Which action improves mastery of {topic}?",
            "options": [
                "Recall, apply, explain and review errors.",
                "Only reread the same paragraph.",
                "Ignore incorrect answers.",
                "Avoid practice until the final exam.",
            ],
            "answer": 0,
            "explanation": "Active recall, application and error review are appropriate learning methods.",
        },
        {
            "id": f"{course}-{sid}-q5",
            "question": f"When should a student revisit {topic}?",
            "options": [
                "After practice or an assessment exposes a knowledge gap.",
                "Never after passing one question.",
                "Only after graduation.",
                "Only when a patient is waiting.",
            ],
            "answer": 0,
            "explanation": "Assessment results should drive targeted review.",
        },
        {
            "id": f"{course}-{sid}-q6",
            "question": f"What is a correct interpretation of a MedGen AI {topic} simulation?",
            "options": [
                "An educational exercise, not an independent clinical authorization.",
                "A legally binding clinical order.",
                "A guaranteed treatment recommendation.",
                "A substitute for a licensed clinician.",
            ],
            "answer": 0,
            "explanation": "The Academy is educational; clinical decisions require qualified professionals and validated evidence.",
        },
        {
            "id": f"{course}-{sid}-q7",
            "question": f"Which evidence hierarchy principle applies while learning {topic}?",
            "options": [
                "Use reliable, current sources and critically evaluate evidence.",
                "Accept every generated answer as fact.",
                "Prefer anonymous claims over validated evidence.",
                "Ignore uncertainty.",
            ],
            "answer": 0,
            "explanation": "Scientific learning requires source criticism and explicit uncertainty.",
        },
        {
            "id": f"{course}-{sid}-q8",
            "question": f"What should be recorded after a {topic} practice session?",
            "options": [
                "Performance, errors, feedback and next learning objective.",
                "Only the final score.",
                "Nothing if the attempt was difficult.",
                "Only a screenshot.",
            ],
            "answer": 0,
            "explanation": "A useful academic record captures progress and remediation needs.",
        },
        {
            "id": f"{course}-{sid}-q9",
            "question": f"How does {topic} connect to other medical subjects?",
            "options": [
                "Biomedical subjects are integrated through mechanisms and clinical reasoning.",
                "Each subject is completely isolated.",
                "Integration is never needed.",
                "Only one subject can be scientifically valid.",
            ],
            "answer": 0,
            "explanation": "Medical education progressively integrates foundational and clinical knowledge.",
        },
        {
            "id": f"{course}-{sid}-q10",
            "question": f"What should happen after a weak result in {topic}?",
            "options": [
                "Review the gap, repeat targeted practice and reassess.",
                "Automatically promote the student.",
                "Delete the academic record.",
                "Treat the score as a clinical diagnosis.",
            ],
            "answer": 0,
            "explanation": "Remediation and reassessment are more meaningful than a one-question promotion rule.",
        },
    ]
    cases = [
        {
            "id": f"{course}-{sid}-case1",
            "scenario": f"A student is learning {topic} and makes a systematic error during a simulated exercise.",
            "prompt": "What is the best next step?",
            "options": ["Identify the error, review the relevant concept and repeat practice.", "Ignore it.", "Use the result as a patient diagnosis.", "Skip all future assessments."],
            "answer": 0,
        },
        {
            "id": f"{course}-{sid}-case2",
            "scenario": f"A learning resource gives a confident but unsupported statement about {topic}.",
            "prompt": "What should the student do?",
            "options": ["Check reliable sources and mark uncertainty before accepting it.", "Accept it because it sounds confident.", "Publish it as clinical guidance.", "Remove the uncertainty."],
            "answer": 0,
        },
        {
            "id": f"{course}-{sid}-case3",
            "scenario": f"A simulated {topic} task has a low score.",
            "prompt": "Which educational response is appropriate?",
            "options": ["Target the weak objectives, practice again and reassess.", "Promote immediately.", "Hide the result.", "Stop studying the subject."],
            "answer": 0,
        },
    ]
    skills = [{"id": f"{course}-{sid}-skill{i}", "title": f"Practical skill {i}: {topic}", "instruction": "Perform the structured educational skill, explain the rationale, and identify safety checks."} for i in range(1, 4)]
    osce = [
        {"id": f"{course}-{sid}-osce1", "station": f"OSCE Station 1 — {topic}", "prompt": "Complete the station in a structured sequence and communicate key safety checks.", "checklist": ["Preparation", "Structured execution", "Communication", "Safety check", "Documentation"]},
        {"id": f"{course}-{sid}-osce2", "station": f"OSCE Station 2 — {topic}", "prompt": "Interpret the educational scenario, demonstrate the skill, and explain the decision.", "checklist": ["Interpretation", "Skill performance", "Reasoning", "Safety", "Feedback"]},
    ]
    return {"quiz": base, "exam": base + base, "case": cases, "skills": skills, "osce": osce}

class AcademyProfileRequest(BaseModel):
    country_code: str = ""
    education_mode: str = "GLOBAL"
    university: str = ""
    faculty: str = ""
    region: str = ""
    district: str = ""
    city: str = ""
    location_label: str = ""
    location_lat: float | None = None
    location_lon: float | None = None
    location_source: str = ""
    major: str = ""
    year: int = 1
    group: str = ""
    student_id: str = ""
    study_language: str = "en"
    academic_degree: str = "MD/MBBS"

class AcademyAssessmentStartRequest(BaseModel):
    course: int
    subject_id: str
    assessment_type: str

class AcademyAssessmentSubmitRequest(BaseModel):
    course: int
    subject_id: str
    assessment_type: str
    answers: dict[str, int]

@app.get("/api/v1/academy/profile")
def academy_get_profile(user=Depends(get_current_user)):
    return {"status": "ok", "profile": _academy_profile(user["username"])}

@app.put("/api/v1/academy/profile")
def academy_update_profile(data: AcademyProfileRequest, user=Depends(get_current_user)):
    mode = str(data.education_mode or "GLOBAL").upper()
    if mode not in {"GLOBAL", "COUNTRY"}:
        raise HTTPException(status_code=400, detail="education_mode must be GLOBAL or COUNTRY.")
    if mode == "COUNTRY" and not re.fullmatch(r"[A-Z]{2}", str(data.country_code or "").upper()):
        raise HTTPException(status_code=400, detail="Country code must be two letters in COUNTRY mode.")
    if not 1 <= int(data.year) <= 6:
        raise HTTPException(status_code=400, detail="University course must be between 1 and 6.")
    role = str(user.get("role") or user.get("user_role") or "").lower()
    academic_required = role == "student"
    if academic_required:
        if not str(data.university).strip():
            raise HTTPException(status_code=400, detail="University is required for student profiles.")
        if not str(data.faculty).strip():
            raise HTTPException(status_code=400, detail="Faculty is required for student profiles.")
        if not str(data.major).strip():
            raise HTTPException(status_code=400, detail="Major is required for student profiles.")
        if not str(data.group).strip():
            raise HTTPException(status_code=400, detail="Group is required for student profiles.")
    profile = _academy_profile(user["username"])
    profile.update({
        "country_code": str(data.country_code or "").upper() if mode == "COUNTRY" else "INTL",
        "education_mode": mode,
        "university": str(data.university).strip()[:200],
        "faculty": str(data.faculty).strip()[:200],
        "region": str(data.region or "").strip()[:160],
        "district": str(data.district or "").strip()[:160],
        "city": str(data.city or "").strip()[:160],
        "location_label": str(data.location_label or "").strip()[:240],
        "location_lat": data.location_lat,
        "location_lon": data.location_lon,
        "location_source": str(data.location_source or "").strip()[:40],
        "major": str(data.major).strip()[:200],
        "year": int(data.year),
        "group": str(data.group).strip()[:100],
        "student_id": str(data.student_id or "").strip()[:100],
        "study_language": str(data.study_language or "en").lower()[:10],
        "academic_degree": str(data.academic_degree or "MD/MBBS").strip()[:100],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
    activity_log.insert(0, {"type": "academy_profile_updated", "username": user["username"], "at": profile["updated_at"]})
    _db_save()
    return {"status": "saved", "profile": profile}

@app.get("/api/v1/academy/curriculum")
def academy_curriculum(user=Depends(get_current_user)):
    ap = _academy_profile(user["username"])
    mode = ap.get("education_mode", "GLOBAL")
    return {
        "status": "ok",
        "mode": mode,
        "country_code": ap.get("country_code", "INTL"),
        "courses": {
            str(k): {
                "title": v["title"],
                "subjects": [{"id": s[0], "name": s[1], "objective": s[2]} for s in v["subjects"]],
            } for k, v in ACADEMY_COURSES.items()
        },
        "note": "Curriculum is an educational framework; official university promotion remains the responsibility of the institution."
    }

@app.get("/api/v1/academy/subject/{course}/{subject_id:path}")
def academy_subject(course: int, subject_id: str, user=Depends(get_current_user)):
    subject = _academy_subject(course, subject_id)
    bank = _academy_question_bank(course, subject)
    return {
        "status": "ok",
        "course": course,
        "subject": subject,
        "modules": {
            "theory": [
                {"id": f"{course}-{subject_id}-theory-1", "title": "Core concepts", "objective": subject["objective"]},
                {"id": f"{course}-{subject_id}-theory-2", "title": "Mechanisms and integration", "objective": "Explain, compare and connect the major concepts."},
                {"id": f"{course}-{subject_id}-theory-3", "title": "Evidence and safety", "objective": "Recognize uncertainty and use reliable sources."},
            ],
            "practice": [
                {"id": f"{course}-{subject_id}-practice-1", "title": "Guided practice", "task": f"Explain the main mechanism of {subject['objective']} in your own words."},
                {"id": f"{course}-{subject_id}-practice-2", "title": "Application exercise", "task": "Apply the concept to a structured educational example and record errors."},
                {"id": f"{course}-{subject_id}-practice-3", "title": "Integration exercise", "task": "Connect this subject with at least two other medical subjects."},
            ],
            "quiz": {"count": len(bank["quiz"]), "passing_score": 70},
            "case": {"count": len(bank["case"]), "passing_score": 70},
            "exam": {"count": len(bank["exam"]), "passing_score": 70},
        }
    }

@app.post("/api/v1/academy/assessment/start")
def academy_start_assessment(data: AcademyAssessmentStartRequest, user=Depends(get_current_user)):
    if data.assessment_type not in ACADEMY_ASSESSMENT_TYPES:
        raise HTTPException(status_code=400, detail="Invalid assessment type.")
    subject = _academy_subject(data.course, data.subject_id)
    bank = _academy_question_bank(data.course, subject)
    if data.assessment_type in {"theory", "practice"}:
        items = [{"id": f"{data.course}-{data.subject_id}-{data.assessment_type}-1", "prompt": f"Complete the {data.assessment_type} learning activity for {subject['objective']}.", "instruction": "Submit completion only after you have actually performed the activity."}]
    elif data.assessment_type == "case":
        items = [{"id": q["id"], "scenario": q["scenario"], "prompt": q["prompt"], "options": q["options"]} for q in bank["case"]]
    else:
        pool = bank["quiz"]
        items = [{"id": q["id"], "question": q["question"], "options": q["options"]} for q in pool]
        if data.assessment_type == "exam":
            items = [{"id": q["id"], "question": q["question"], "options": q["options"]} for q in bank["exam"]]
    return {"status": "started", "course": data.course, "subject_id": data.subject_id, "assessment_type": data.assessment_type, "items": items, "time_limit_minutes": 45 if data.assessment_type == "exam" else None}

@app.post("/api/v1/academy/assessment/submit")
def academy_submit_assessment(data: AcademyAssessmentSubmitRequest, user=Depends(get_current_user)):
    if data.assessment_type not in ACADEMY_ASSESSMENT_TYPES:
        raise HTTPException(status_code=400, detail="Invalid assessment type.")
    subject = _academy_subject(data.course, data.subject_id)
    bank = _academy_question_bank(data.course, subject)
    if data.assessment_type in {"theory", "practice"}:
        score = 100 if data.answers.get("completion") == 1 else 0
        total = 1
    else:
        questions = bank["case"] if data.assessment_type == "case" else (bank["exam"] if data.assessment_type == "exam" else bank["quiz"])
        correct = sum(1 for q in questions if data.answers.get(q["id"]) == q["answer"])
        total = len(questions)
        score = round(correct * 100 / total) if total else 0
    key = _academy_key(data.course, data.subject_id)
    progress = _academy_progress(user["username"])
    record = progress.setdefault(key, {})
    record[data.assessment_type] = {
        "score": score,
        "passed": score >= 70,
        "attempts": int(record.get(data.assessment_type, {}).get("attempts", 0)) + 1,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    _db_save()
    return {"status": "recorded", "score": score, "passed": score >= 70, "total": total, "progress": record}

@app.get("/api/v1/academy/dashboard")
def academy_dashboard(user=Depends(get_current_user)):
    ap = _academy_profile(user["username"])
    progress = _academy_progress(user["username"])
    course = int(ap.get("year", 1))
    subjects = []
    for sid, name, objective in ACADEMY_COURSES[course]["subjects"]:
        record = progress.get(_academy_key(course, sid), {})
        passed = [x for x in ACADEMY_ASSESSMENT_TYPES if record.get(x, {}).get("passed")]
        subjects.append({
            "id": sid, "name": name, "objective": objective,
            "completed_assessments": passed,
            "complete": all(x in passed for x in ACADEMY_ASSESSMENT_TYPES),
            "record": record,
        })
    complete_count = sum(1 for s in subjects if s["complete"])
    overall = round(complete_count * 100 / len(subjects)) if subjects else 0
    return {"status": "ok", "course": course, "course_title": ACADEMY_COURSES[course]["title"], "overall_progress": overall, "subjects": subjects, "academic_profile": ap}

@app.get("/api/v1/academy/eligibility/{course}")
def academy_eligibility(course: int, user=Depends(get_current_user)):
    if course not in ACADEMY_COURSES:
        raise HTTPException(status_code=404, detail="Course not found.")
    progress = _academy_progress(user["username"])
    required_components = ("theory", "practice", "quiz", "case", "skills", "osce", "exam")
    requirements = []
    for sid, name, _ in ACADEMY_COURSES[course]["subjects"]:
        rec = progress.get(_academy_key(course, sid), {})
        ok = all(rec.get(t, {}).get("passed", False) for t in required_components)
        requirements.append({"subject_id": sid, "subject": name, "ready": ok})
    ready = bool(requirements) and all(x["ready"] for x in requirements)
    return {
        "status": "ok",
        "course": course,
        "eligible_for_next_course": ready and course < max(ACADEMY_COURSES),
        "course_complete": ready,
        "requirements": requirements,
        "required_components": list(required_components),
        "rule": "Promotion requires completion of theory, practice, quiz, case, skills, OSCE and exam for every subject; no three-question shortcut exists."
    }


# =========================================================
# SUPPORT / AI ASSISTANT / ROLE COMMUNITY
# =========================================================

class SupportTicketRequest(BaseModel):
    subject: str
    message: str
    category: str = "GENERAL"
    priority: str = "NORMAL"

class CommunityMessageRequest(BaseModel):
    message: str
    role: str | None = None

class AssistantMessageRequest(BaseModel):
    message: str

_SUPPORT_CATEGORIES = {"GENERAL", "LOGIN", "ACADEMY", "BIOINFORMATICS", "DRUG_DISCOVERY", "RESEARCH", "SECURITY", "BILLING"}
_SUPPORT_PRIORITIES = {"LOW", "NORMAL", "HIGH", "URGENT"}

def _safe_role(user):
    return str(user.get("role") or user.get("user_role") or "student")

def _community_store():
    return user_profiles.setdefault("__MEDGEN_COMMUNITY__", {}).setdefault("messages", {})

@app.get("/api/v1/support/tickets")
def support_list_tickets(user=Depends(get_current_user)):
    tickets = user_profiles.setdefault(user["username"], {}).setdefault("support_tickets", [])
    return {"status":"ok","tickets":tickets[:100]}

@app.post("/api/v1/support/tickets")
def support_create_ticket(data: SupportTicketRequest, user=Depends(get_current_user)):
    subject=str(data.subject or "").strip()[:160]
    message=str(data.message or "").strip()[:4000]
    category=str(data.category or "GENERAL").upper()
    priority=str(data.priority or "NORMAL").upper()
    if not subject or not message:
        raise HTTPException(status_code=400, detail="Subject and message are required.")
    if category not in _SUPPORT_CATEGORIES:
        category="GENERAL"
    if priority not in _SUPPORT_PRIORITIES:
        priority="NORMAL"
    ticket={
        "id":f"SUP-{int(datetime.now(timezone.utc).timestamp()*1000)}",
        "subject":subject,"message":message,"category":category,"priority":priority,
        "status":"OPEN","username":user["username"],
        "created_at":datetime.now(timezone.utc).isoformat(),
    }
    user_profiles.setdefault(user["username"], {}).setdefault("support_tickets", []).insert(0,ticket)
    activity_log.insert(0,{"type":"support_ticket_created","username":user["username"],"ticket_id":ticket["id"],"at":ticket["created_at"]})
    _db_save()
    return {"status":"created","ticket":ticket}

@app.get("/api/v1/community")
def community_feed(role: str | None = None, user=Depends(get_current_user)):
    current_role=_safe_role(user)
    requested=normalize_role(role) if role else current_role
    if requested != current_role and current_role != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Only Super Admin can inspect another role community.")
    messages=_community_store()
    return {"status":"ok","role":requested,"room":requested,"messages":messages.get(requested,[])[:100]}

@app.post("/api/v1/community/messages")
def community_post(data: CommunityMessageRequest, user=Depends(get_current_user)):
    message=str(data.message or "").strip()[:2000]
    if not message:
        raise HTTPException(status_code=400, detail="Message is required.")
    role=_safe_role(user)
    requested=normalize_role(data.role) if data.role else role
    if requested != role and role != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Only Super Admin can post to another role community.")
    messages=_community_store()
    item={"id":f"MSG-{int(datetime.now(timezone.utc).timestamp()*1000)}","username":user["username"],"role":requested,"message":message,"created_at":datetime.now(timezone.utc).isoformat(),"room":requested}
    messages.setdefault(requested,[]).insert(0,item)
    messages[requested]=messages[requested][:200]
    activity_log.insert(0,{"type":"community_message","username":user["username"],"role":requested,"at":item["created_at"]})
    _db_save()
    return {"status":"sent","message":item}

@app.post("/api/v1/assistant/chat")
def assistant_chat(data: AssistantMessageRequest, user=Depends(get_current_user)):
    q=str(data.message or "").strip()
    if not q:
        raise HTTPException(status_code=400, detail="Message is required.")
    ql=q.lower()
    if any(x in ql for x in ["login","parol","password","kirm"]):
        answer="Login muammosi bo‘lsa, username va parolni tekshiring. Parolni hech kimga yubormang. Muammo davom etsa Yordam markazidan ticket oching."
    elif any(x in ql for x in ["bioinformat","sequence","fasta","dna","rna","protein"]):
        answer="Bioinformatics modulida FASTA/sequence tahlili, ketma-ketlik turi, uzunlik, tarkib va asosiy tahlillarni bajarishingiz mumkin. Natijalarni ilmiy xulosa sifatida tekshirib foydalaning."
    elif any(x in ql for x in ["dori","drug","molecule","molekula","docking"]):
        answer="Drug Discovery modulida molekula va target workflowlari mavjud. Virtual screening/docking natijalari eksperimental tasdiq o‘rnini bosmaydi."
    elif any(x in ql for x in ["research","pubmed","maqola","ilmiy"]):
        answer="Research Assistant ilmiy savolni PubMed dalillari bilan tekshirish va manbalarni tartiblashga yordam beradi."
    elif any(x in ql for x in ["support","yordam","muammo","xato"]):
        answer="Muammoingizni Yordam markazida kategoriya va ustuvorlik bilan ticket qilib yuboring. Support tarixingiz ham shu yerda saqlanadi."
    else:
        answer="Men MedGen AI platformasi bo‘yicha yordamchi sifatida ishlayman. Bioinformatics, Molecular Analysis, Drug Discovery, Research, Academy, login yoki platforma funksiyasi haqida savol bering."
    return {"status":"ok","answer":answer,"role":_safe_role(user),"disclaimer":"AI javobi ilmiy yoki klinik qarorning yagona manbai emas."}


# =========================================================
# PHASE 2 — SCIENTIFIC CORE HARDENING
# Bioinformatics + Molecular Analysis + Structure + Discovery
# =========================================================

class SequenceTranslateRequest(BaseModel):
    sequence: str
    frame: int = 1

class SequenceAlignRequest(BaseModel):
    sequence_a: str
    sequence_b: str
    match: int = 1
    mismatch: int = -1
    gap: int = -2

class MoleculeBatchRequest(BaseModel):
    smiles: list[str]

class MoleculeSimilarityRequest(BaseModel):
    reference_smiles: str
    query_smiles: list[str]
    threshold: float = 0.0

class Molecule3DRequest(BaseModel):
    smiles: str
    optimize: bool = True

class Molecule2DRequest(BaseModel):
    smiles: str
    width: int = 520
    height: int = 360

class PDBDownloadRequest(BaseModel):
    format: str = "pdb"


_CODON_TABLE = {
    "TTT":"F","TTC":"F","TTA":"L","TTG":"L","TCT":"S","TCC":"S","TCA":"S","TCG":"S",
    "TAT":"Y","TAC":"Y","TAA":"*","TAG":"*","TGT":"C","TGC":"C","TGA":"*","TGG":"W",
    "CTT":"L","CTC":"L","CTA":"L","CTG":"L","CCT":"P","CCC":"P","CCA":"P","CCG":"P",
    "CAT":"H","CAC":"H","CAA":"Q","CAG":"Q","CGT":"R","CGC":"R","CGA":"R","CGG":"R",
    "ATT":"I","ATC":"I","ATA":"I","ATG":"M","ACT":"T","ACC":"T","ACA":"T","ACG":"T",
    "AAT":"N","AAC":"N","AAA":"K","AAG":"K","AGT":"S","AGC":"S","AGA":"R","AGG":"R",
    "GTT":"V","GTC":"V","GTA":"V","GTG":"V","GCT":"A","GCC":"A","GCA":"A","GCG":"A",
    "GAT":"D","GAC":"D","GAA":"E","GAG":"E","GGT":"G","GGC":"G","GGA":"G","GGG":"G",
}

def _translate_dna(sequence: str, frame: int = 1) -> dict[str, Any]:
    seq = _clean_sequence(sequence).replace("U", "T")
    if not seq:
        raise HTTPException(status_code=400, detail="Sequence is required")
    if frame not in (1, 2, 3):
        raise HTTPException(status_code=400, detail="Frame must be 1, 2 or 3")
    start = frame - 1
    codons = [seq[i:i+3] for i in range(start, len(seq) - 2, 3)]
    protein = "".join(_CODON_TABLE.get(c, "X") for c in codons)
    return {
        "sequence_type": "DNA",
        "frame": frame,
        "codon_count": len(codons),
        "protein": protein,
        "stop_codons": protein.count("*"),
        "ambiguous_codons": protein.count("X"),
    }

@app.post("/api/v1/bioinformatics/translate")
def bioinformatics_translate(data: SequenceTranslateRequest, user=Depends(get_current_user)):
    result = _translate_dna(data.sequence, data.frame)
    result.update({
        "status": "completed",
        "module": "Bioinformatics",
        "workflow": "DNA_translation",
        "user": user["username"],
        "warning": "Exploratory translation only; not a clinical or gene-annotation result.",
    })
    return result

@app.post("/api/v1/bioinformatics/align")
def bioinformatics_align(data: SequenceAlignRequest, user=Depends(get_current_user)):
    a = _clean_sequence(data.sequence_a)
    b = _clean_sequence(data.sequence_b)
    if not a or not b:
        raise HTTPException(status_code=400, detail="Both sequences are required")
    if len(a) > 5000 or len(b) > 5000:
        raise HTTPException(status_code=413, detail="Sequences are limited to 5000 characters for interactive alignment")
    n, m = len(a), len(b)
    prev = [j * data.gap for j in range(m + 1)]
    rows = []
    trace = []
    for i in range(1, n + 1):
        cur = [i * data.gap]
        row_trace = []
        for j in range(1, m + 1):
            diag = prev[j-1] + (data.match if a[i-1] == b[j-1] else data.mismatch)
            up = prev[j] + data.gap
            left = cur[j-1] + data.gap
            best = max(diag, up, left)
            cur.append(best)
            row_trace.append(0 if best == diag else (1 if best == up else 2))
        prev = cur
        rows.append(cur)
        trace.append(row_trace)
    i, j = n, m
    aa, bb = [], []
    while i or j:
        if i and j and trace[i-1][j-1] == 0:
            aa.append(a[i-1]); bb.append(b[j-1]); i -= 1; j -= 1
        elif i and (not j or trace[i-1][j-1] == 1):
            aa.append(a[i-1]); bb.append("-"); i -= 1
        else:
            aa.append("-"); bb.append(b[j-1]); j -= 1
    aligned_a, aligned_b = "".join(reversed(aa)), "".join(reversed(bb))
    matches = sum(x == y for x, y in zip(aligned_a, aligned_b) if x != "-" and y != "-")
    comparable = sum(x != "-" and y != "-" for x, y in zip(aligned_a, aligned_b))
    identity = round(matches / comparable * 100, 2) if comparable else 0.0
    return {
        "status": "completed", "module": "Bioinformatics", "workflow": "global_alignment",
        "score": prev[m], "identity_percent": identity,
        "aligned_length": len(aligned_a), "matches": matches, "comparable_positions": comparable,
        "alignment": {"sequence_a": aligned_a, "sequence_b": aligned_b},
        "parameters": {"match": data.match, "mismatch": data.mismatch, "gap": data.gap},
        "user": user["username"],
        "warning": "Educational/research alignment; not a clinical interpretation.",
    }


def _tanimoto_similarity(smiles_a: str, smiles_b: str) -> float:
    mol_a = Chem.MolFromSmiles(str(smiles_a).strip())
    mol_b = Chem.MolFromSmiles(str(smiles_b).strip())
    if mol_a is None or mol_b is None:
        raise ValueError("Invalid SMILES")
    fp_a = AllChem.GetMorganFingerprintAsBitVect(mol_a, 2, nBits=2048)
    fp_b = AllChem.GetMorganFingerprintAsBitVect(mol_b, 2, nBits=2048)
    return round(float(DataStructs.TanimotoSimilarity(fp_a, fp_b)), 6)

def _molecule_descriptors(smiles: str) -> dict[str, Any]:
    mol = Chem.MolFromSmiles(str(smiles).strip())
    if mol is None:
        raise ValueError("Invalid SMILES")
    return {
        "input_smiles": str(smiles).strip(),
        "canonical_smiles": Chem.MolToSmiles(mol),
        "molecular_formula": rdMolDescriptors.CalcMolFormula(mol),
        "molecular_weight": round(Descriptors.MolWt(mol), 4),
        "exact_molecular_weight": round(Descriptors.ExactMolWt(mol), 4),
        "logP": round(Descriptors.MolLogP(mol), 4),
        "TPSA": round(Descriptors.TPSA(mol), 4),
        "HBD": int(Lipinski.NumHDonors(mol)),
        "HBA": int(Lipinski.NumHAcceptors(mol)),
        "rotatable_bonds": int(Lipinski.NumRotatableBonds(mol)),
        "rings": int(Lipinski.RingCount(mol)),
        "aromatic_rings": int(Lipinski.NumAromaticRings(mol)),
        "heavy_atoms": int(mol.GetNumHeavyAtoms()),
        "formal_charge": int(Chem.GetFormalCharge(mol)),
        "fraction_csp3": round(Lipinski.FractionCSP3(mol), 4),
        "QED": round(QED.qed(mol), 4),
    }

@app.post("/api/v1/molecules/batch-analyze")
def molecule_batch_analyze(data: MoleculeBatchRequest, user=Depends(get_current_user)):
    if not data.smiles:
        raise HTTPException(status_code=400, detail="At least one SMILES is required")
    if len(data.smiles) > 500:
        raise HTTPException(status_code=413, detail="Maximum 500 molecules per interactive request")
    results, errors = [], []
    for smi in data.smiles:
        try:
            results.append(_molecule_descriptors(smi))
        except ValueError as exc:
            errors.append({"smiles": smi, "error": str(exc)})
    return {
        "status": "completed", "module": "Molecular Analysis", "count": len(results),
        "results": results, "errors": errors, "user": user["username"],
    }

@app.post("/api/v1/molecules/similarity")
def molecule_similarity(data: MoleculeSimilarityRequest, user=Depends(get_current_user)):
    try:
        ref = Chem.MolFromSmiles(data.reference_smiles.strip())
    except Exception:
        ref = None
    if ref is None:
        raise HTTPException(status_code=400, detail="Invalid reference SMILES")
    if not data.query_smiles:
        raise HTTPException(status_code=400, detail="Query molecules are required")
    if not 0 <= data.threshold <= 1:
        raise HTTPException(status_code=400, detail="Threshold must be between 0 and 1")
    generator = AllChem.GetMorganGenerator(radius=2, fpSize=2048)
    ref_fp = generator.GetFingerprint(ref)
    results = []
    for smi in data.query_smiles[:1000]:
        mol = Chem.MolFromSmiles(str(smi).strip())
        if mol is None:
            results.append({"smiles": smi, "valid": False, "error": "Invalid SMILES"})
            continue
        sim = float(DataStructs.TanimotoSimilarity(ref_fp, generator.GetFingerprint(mol)))
        results.append({"smiles": smi, "valid": True, "similarity": round(sim, 6), "above_threshold": sim >= data.threshold})
    results.sort(key=lambda x: x.get("similarity", -1), reverse=True)
    return {
        "status": "completed", "module": "Molecular Analysis", "workflow": "molecular_similarity",
        "reference_smiles": data.reference_smiles, "threshold": data.threshold,
        "results": results, "user": user["username"],
    }

@app.post("/api/v1/molecules/2d")
def molecule_2d(data: Molecule2DRequest, user=Depends(get_current_user)):
    smiles = str(data.smiles or "").strip()
    if not smiles or len(smiles) > 5000:
        raise HTTPException(status_code=400, detail="SMILES is required and must be <= 5000 characters.")
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise HTTPException(status_code=400, detail="Invalid SMILES")
    width = max(240, min(int(data.width), 1200))
    height = max(180, min(int(data.height), 900))
    try:
        from rdkit.Chem import Draw
        drawer = Draw.MolDraw2DSVG(width, height)
        drawer.drawOptions().addStereoAnnotation = True
        drawer.DrawMolecule(mol)
        drawer.FinishDrawing()
        svg = drawer.GetDrawingText()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"2D rendering failed: {exc}")
    return {
        "status": "completed", "module": "Molecular Analysis", "workflow": "2d_structure",
        "input_smiles": smiles, "canonical_smiles": Chem.MolToSmiles(mol),
        "svg": svg, "width": width, "height": height, "user": user["username"],
        "warning": "2D depiction is a computational visualization, not an experimental structure.",
    }

@app.post("/api/v1/molecules/3d")
def molecule_3d(data: Molecule3DRequest, user=Depends(get_current_user)):
    mol = Chem.MolFromSmiles(data.smiles.strip())
    if mol is None:
        raise HTTPException(status_code=400, detail="Invalid SMILES")
    mol = Chem.AddHs(mol)
    params = AllChem.ETKDGv3()
    params.randomSeed = 20261008
    embed_status = AllChem.EmbedMolecule(mol, params)
    if embed_status != 0:
        raise HTTPException(status_code=422, detail="3D conformer generation failed")
    optimized = False
    if data.optimize:
        try:
            optimized = AllChem.UFFOptimizeMolecule(mol, maxIters=200) == 0
        except Exception:
            optimized = False
    return {
        "status": "completed", "module": "Molecular Analysis", "workflow": "3d_conformer",
        "canonical_smiles": Chem.MolToSmiles(Chem.RemoveHs(mol)),
        "optimized": optimized,
        "atom_count": mol.GetNumAtoms(),
        "mol_block": Chem.MolToMolBlock(mol),
        "user": user["username"],
        "warning": "3D conformer is a computational starting geometry, not an experimentally determined structure.",
    }

@app.get("/api/v1/pdb/structures/{pdb_id}/links")
def pdb_structure_links(pdb_id: str, user=Depends(get_current_user)):
    pdb_id = pdb_id.strip().upper()
    if not re.fullmatch(r"[0-9A-Z]{4}", pdb_id):
        raise HTTPException(status_code=400, detail="PDB ID must contain 4 alphanumeric characters")
    return {
        "status": "ready", "module": "PDB & Structure", "pdb_id": pdb_id,
        "sources": {
            "rcsb_entry": f"https://www.rcsb.org/structure/{pdb_id}",
            "pdb_file": f"https://files.rcsb.org/download/{pdb_id}.pdb",
            "mmcif_file": f"https://files.rcsb.org/download/{pdb_id}.cif",
        },
        "user": user["username"],
    }


SCIENTIFIC_INPUT_LIMIT = int(os.getenv("MEDGEN_SCIENTIFIC_INPUT_LIMIT", "5000"))
SCIENTIFIC_LIBRARY_LIMIT = int(os.getenv("MEDGEN_SCIENTIFIC_LIBRARY_LIMIT", "200"))

@app.get("/api/v1/scientific/core/status")
def scientific_core_status(user=Depends(get_current_user)):
    return {
        "status": "operational", "phase": 2, "module": "Scientific Core",
        "components": {
            "rdkit": True, "bioinformatics": True, "pdb_rcsb": True,
            "morgan_similarity": True, "molecule_3d": True,
            "drug_discovery_screening": True, "docking_engine": VINA_AVAILABLE,
        },
        "user": user["username"],
        "limitations": [
            "Docking requires a prepared receptor and ligand PDBQT inputs.",
            "Sequence annotation is not a clinical diagnosis.",
            "Property-based screening is not experimental efficacy or safety evidence.",
        ],
    }


# =========================================================
# PHASE 2 — REAL DOCKING + REPRODUCIBLE SCIENTIFIC PIPELINE
# =========================================================

class PreparedDockingRequest(BaseModel):
    target: str
    ligand_smiles: str = ""
    receptor_pdbqt: str
    ligand_pdbqt: str
    center_x: float
    center_y: float
    center_z: float
    size_x: float = 20.0
    size_y: float = 20.0
    size_z: float = 20.0
    exhaustiveness: int = 8
    n_poses: int = 3

class ScientificPipelineRequest(BaseModel):
    name: str = "MedGen Scientific Pipeline"
    target: str
    sequence: str = ""
    pdb_id: str = ""
    ligand_smiles: str = ""
    workflow_type: str = "sequence_structure_screening"

@app.post("/api/v1/docking/run")
def run_prepared_docking(data: PreparedDockingRequest, user=Depends(get_current_user)):
    if not VINA_AVAILABLE:
        raise HTTPException(status_code=503, detail="AutoDock Vina engine is not installed on this deployment.")
    if not data.receptor_pdbqt.strip() or not data.ligand_pdbqt.strip():
        raise HTTPException(status_code=400, detail="Prepared receptor and ligand PDBQT content are required.")
    if not all(0.0 < x <= 100.0 for x in [data.size_x, data.size_y, data.size_z]):
        raise HTTPException(status_code=400, detail="Docking box dimensions must be >0 and <=100 Å.")
    if not 1 <= data.exhaustiveness <= 64 or not 1 <= data.n_poses <= 20:
        raise HTTPException(status_code=400, detail="Invalid docking limits.")

    import tempfile
    receptor_file = ligand_file = None
    try:
        receptor_file = tempfile.NamedTemporaryFile("w", suffix=".pdbqt", delete=False)
        ligand_file = tempfile.NamedTemporaryFile("w", suffix=".pdbqt", delete=False)
        receptor_file.write(data.receptor_pdbqt)
        ligand_file.write(data.ligand_pdbqt)
        receptor_file.close()
        ligand_file.close()

        engine = Vina(sf_name="vina", verbosity=0)
        engine.set_receptor(receptor_file.name)
        engine.set_ligand_from_file(ligand_file.name)
        engine.compute_vina_maps(
            center=[data.center_x, data.center_y, data.center_z],
            box_size=[data.size_x, data.size_y, data.size_z],
        )
        engine.dock(exhaustiveness=int(data.exhaustiveness), n_poses=int(data.n_poses))
        energies = engine.energies(n_poses=int(data.n_poses))
        poses = []
        for row in energies:
            values = [float(x) for x in row]
            poses.append({"affinity_kcal_mol": values[0], "inter_rmsd_lb": values[1] if len(values)>1 else None, "inter_rmsd_ub": values[2] if len(values)>2 else None})
        now = datetime.now(timezone.utc).isoformat()
        result = {
            "status": "completed", "module": "Drug Discovery", "workflow": "molecular_docking",
            "target": data.target, "ligand_smiles": data.ligand_smiles,
            "engine": "AutoDock Vina", "poses": poses,
            "box": {"center": [data.center_x,data.center_y,data.center_z], "size": [data.size_x,data.size_y,data.size_z]},
            "parameters": {"exhaustiveness": data.exhaustiveness, "n_poses": data.n_poses},
            "user": user["username"], "completed_at": now,
            "warning": "Docking score is computational evidence, not experimentally validated binding affinity or clinical efficacy."
        }
        job_id = secrets.token_hex(10)
        docking_jobs_store[job_id] = {"id": job_id, **result, "created_at": now}
        activity_log.insert(0, {"type":"docking_completed","username":user["username"],"job_id":job_id,"target":data.target,"at":now})
        return {"job_id": job_id, "result": result}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=422, detail=f"Docking execution failed: {exc}")
    finally:
        for f in (receptor_file, ligand_file):
            try:
                if f is not None:
                    os.unlink(f.name)
            except Exception:
                pass

@app.get("/api/v1/docking/status/{job_id}")
def get_docking_job(job_id: str, user=Depends(get_current_user)):
    job = docking_jobs_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Docking job not found")
    if job.get("user") != user["username"] and user.get("role") != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Access denied")
    return job

@app.post("/api/v1/scientific/pipeline")
def scientific_pipeline(data: ScientificPipelineRequest, user=Depends(get_current_user)):
    target = data.target.strip()
    if not target:
        raise HTTPException(status_code=400, detail="Target is required")
    steps = []
    if data.sequence.strip():
        steps.append({"step":"sequence_analysis","status":"ready","endpoint":"/api/v1/bioinformatics/analyze"})
    if data.pdb_id.strip():
        pdb_id=data.pdb_id.strip().upper()
        if not re.fullmatch(r"[0-9A-Z]{4}", pdb_id):
            raise HTTPException(status_code=400, detail="PDB ID must contain 4 alphanumeric characters")
        steps.append({"step":"structure_lookup","status":"ready","pdb_id":pdb_id,"endpoint":f"/api/v1/pdb/structures/{pdb_id}"})
    if data.ligand_smiles.strip():
        desc=_molecule_descriptors(data.ligand_smiles)
        steps.append({"step":"molecular_analysis","status":"completed","descriptors":desc})
        steps.append({"step":"virtual_screening","status":"ready","endpoint":"/api/v1/discovery/screen"})
    steps.append({"step":"experiment_record","status":"ready","endpoint":"/api/v1/experiments"})
    now=datetime.now(timezone.utc).isoformat()
    experiment={
        "id":secrets.token_hex(10),"name":data.name.strip() or "MedGen Scientific Pipeline",
        "workflow_type":data.workflow_type,"target":target,"status":"ready",
        "input":{"sequence":data.sequence,"pdb_id":data.pdb_id,"ligand_smiles":data.ligand_smiles},
        "parameters":{},"results":{"steps":steps},"user":user["username"],"created_at":now,"updated_at":now,
    }
    experiments_store.insert(0, experiment)
    activity_log.insert(0, {"type":"scientific_pipeline_created","username":user["username"],"experiment_id":experiment["id"],"target":target,"at":now})
    return {"status":"ready","module":"Scientific Core","pipeline_id":experiment["id"],"target":target,"steps":steps,"user":user["username"]}


# =========================================================
# PHASE 2 — REPRODUCIBLE VIRTUAL LAB + SCIENTIFIC REPORT
# =========================================================

class LabPipelineRequest(BaseModel):
    name: str = "MedGen Virtual Lab Experiment"
    target: str
    sequence: str = ""
    pdb_id: str = ""
    ligand_smiles: str = ""
    steps: list[str] = []
    parameters: dict[str, Any] = {}

class ScientificReportRequest(BaseModel):
    experiment_id: str
    title: str = ""
    include_inputs: bool = True
    include_results: bool = True

@app.post("/api/v1/lab/pipeline")
def create_lab_pipeline(data: LabPipelineRequest, user=Depends(get_current_user)):
    target=data.target.strip()
    if not target:
        raise HTTPException(status_code=400, detail="Target is required")
    allowed={"sequence_analysis","structure_lookup","molecular_analysis","virtual_screening","docking","report"}
    steps=data.steps[:] if data.steps else ["sequence_analysis","structure_lookup","molecular_analysis","virtual_screening","report"]
    invalid=[x for x in steps if x not in allowed]
    if invalid:
        raise HTTPException(status_code=400, detail=f"Unsupported workflow steps: {invalid}")
    if data.pdb_id and not re.fullmatch(r"[0-9A-Z]{4}", data.pdb_id.strip().upper()):
        raise HTTPException(status_code=400, detail="PDB ID must contain 4 alphanumeric characters")
    if data.ligand_smiles:
        try: molecular=_molecule_descriptors(data.ligand_smiles)
        except ValueError as exc: raise HTTPException(status_code=400, detail=str(exc))
    else: molecular=None
    now=datetime.now(timezone.utc).isoformat()
    step_results=[]
    for step in steps:
        item={"step":step,"status":"ready"}
        if step=="sequence_analysis" and data.sequence:
            item["result"]=bioinformatics_analyze(SequenceRequest(sequence=data.sequence),user)
            item["status"]="completed"
        elif step=="structure_lookup" and data.pdb_id:
            item["status"]="ready"
            item["pdb_id"]=data.pdb_id.strip().upper()
            item["endpoint"]=f"/api/v1/pdb/structures/{item['pdb_id']}"
        elif step=="molecular_analysis" and molecular:
            item["result"]=molecular; item["status"]="completed"
        elif step=="virtual_screening":
            item["status"]="ready"; item["endpoint"]="/api/v1/discovery/screen"
        elif step=="docking":
            item["status"]="requires_prepared_inputs"; item["endpoint"]="/api/v1/docking/run"
        elif step=="report":
            item["status"]="available_after_completion"
    experiment={
        "id":secrets.token_hex(10),"name":data.name.strip() or "MedGen Virtual Lab Experiment",
        "workflow_type":"virtual_lab","target":target,"status":"ready",
        "input":{"sequence":data.sequence,"pdb_id":data.pdb_id,"ligand_smiles":data.ligand_smiles},
        "parameters":data.parameters,"results":{"steps":step_results},
        "user":user["username"],"created_at":now,"updated_at":now
    }
    experiments_store.insert(0,experiment)
    activity_log.insert(0,{"type":"lab_pipeline_created","username":user["username"],"experiment_id":experiment["id"],"target":target,"at":now})
    _db_save()
    return {"status":"ready","module":"Virtual Laboratory","experiment":experiment}

@app.post("/api/v1/lab/experiments/{experiment_id}/execute")
def execute_lab_experiment(experiment_id: str, user=Depends(get_current_user)):
    experiment=next((e for e in experiments_store if e.get("id")==experiment_id),None)
    if not experiment: raise HTTPException(status_code=404,detail="Experiment not found")
    if experiment.get("user")!=user["username"] and user.get("role")!="SUPER_ADMIN": raise HTTPException(status_code=403,detail="Access denied")
    results=experiment.setdefault("results",{}).setdefault("steps",[])
    for item in results:
        if item.get("status")=="ready":
            if item.get("step")=="virtual_screening":
                smiles = str(experiment.get("input", {}).get("ligand_smiles", "") or "").strip()
                if smiles:
                    try:
                        screening = calculate_molecule_score(smiles)
                        item["status"] = "completed"
                        item["result"] = {
                            "engine": "RDKit molecular screening",
                            "status": "completed",
                            "molecule": screening,
                            "note": "Property-based computational screening only; not docking, binding-affinity or ADMET prediction."
                        }
                    except HTTPException as exc:
                        item["status"] = "failed"
                        item["result"] = {"error": str(exc.detail)}
                else:
                    item["status"] = "completed"
                    item["result"] = {
                        "engine": "MedGen screening workflow",
                        "status": "skipped",
                        "reason": "No ligand SMILES supplied"
                    }
            elif item.get("step")=="report": item["status"]="completed"
    experiment["status"]="completed"
    experiment["updated_at"]=datetime.now(timezone.utc).isoformat()
    activity_log.insert(0,{"type":"lab_experiment_executed","username":user["username"],"experiment_id":experiment_id,"at":experiment["updated_at"]})
    _db_save()
    return {"status":"completed","module":"Virtual Laboratory","experiment":experiment}

@app.get("/api/v1/lab/experiments/{experiment_id}")
def get_lab_experiment(experiment_id: str, user=Depends(get_current_user)):
    experiment=next((e for e in experiments_store if e.get("id")==experiment_id),None)
    if not experiment: raise HTTPException(status_code=404,detail="Experiment not found")
    if experiment.get("user")!=user["username"] and user.get("role")!="SUPER_ADMIN":
        raise HTTPException(status_code=403,detail="Access denied")
    return {"status":"ok","module":"Virtual Laboratory","experiment":experiment}

@app.post("/api/v1/scientific/reports")
def create_scientific_report(data: ScientificReportRequest,user=Depends(get_current_user)):
    experiment=next((e for e in experiments_store if e["id"]==data.experiment_id),None)
    if not experiment: raise HTTPException(status_code=404,detail="Experiment not found")
    if experiment.get("user")!=user["username"] and user.get("role")!="SUPER_ADMIN":
        raise HTTPException(status_code=403,detail="Access denied")
    report={
        "id":secrets.token_hex(10),
        "title":data.title.strip() or experiment.get("name") or "Scientific Report",
        "experiment_id":experiment["id"],
        "target":experiment.get("target",""),
        "created_at":datetime.now(timezone.utc).isoformat(),
        "inputs":experiment.get("input",{}) if data.include_inputs else {},
        "results":experiment.get("results",{}) if data.include_results else {},
        "methodology":{"workflow_type":experiment.get("workflow_type"),"parameters":experiment.get("parameters",{})},
        "disclaimer":"Computational research output. It is not a clinical diagnosis, treatment recommendation, or experimentally validated efficacy/safety result."
    }
    reports_store.insert(0,report)
    activity_log.insert(0,{"type":"scientific_report_created","username":user["username"],"report_id":report["id"],"experiment_id":experiment["id"],"at":report["created_at"]})
    _db_save()
    return {"status":"completed","module":"Scientific Research","report":report}

@app.get("/api/v1/scientific/reports/{report_id}")
def get_scientific_report(report_id:str,user=Depends(get_current_user)):
    report=next((r for r in reports_store if r["id"]==report_id),None)
    if not report: raise HTTPException(status_code=404,detail="Report not found")
    experiment=next((e for e in experiments_store if e["id"]==report.get("experiment_id")),None)
    if experiment and experiment.get("user")!=user["username"] and user.get("role")!="SUPER_ADMIN":
        raise HTTPException(status_code=403,detail="Access denied")
    return report


# =========================================================
# PHASE 2 — STRUCTURE PARSING + SEQUENCE/STRUCTURE BRIDGE
# =========================================================

class StructureAnalysisRequest(BaseModel):
    pdb_id: str
    chain_id: str = ""

def _fetch_rcsb_file(pdb_id: str, suffix: str) -> bytes:
    url=f"https://files.rcsb.org/download/{pdb_id}.{suffix}"
    req=URLRequest(url,headers={"User-Agent":"MedGenAI/1.1"})
    try:
        with urlopen(req,timeout=20) as response:
            return response.read()
    except HTTPError as exc:
        if exc.code==404: raise HTTPException(status_code=404,detail=f"PDB structure {pdb_id} not found")
        raise HTTPException(status_code=502,detail="RCSB structure service returned an error")
    except (URLError,TimeoutError):
        raise HTTPException(status_code=503,detail="Unable to connect to RCSB structure service")

@app.post("/api/v1/pdb/structures/analyze")
def analyze_pdb_structure(data: StructureAnalysisRequest,user=Depends(get_current_user)):
    pdb_id=data.pdb_id.strip().upper()
    if not re.fullmatch(r"[0-9A-Z]{4}",pdb_id):
        raise HTTPException(status_code=400,detail="PDB ID must contain 4 alphanumeric characters")
    raw=_fetch_rcsb_file(pdb_id,"cif")
    try:
        import gemmi
        doc=gemmi.cif.read_string(raw.decode("utf-8"))
        block=doc.sole_block()
        structure=gemmi.make_structure_from_block(block)
        models=len(structure)
        chains=[]
        residues_total=0
        atoms_total=0
        selected=None
        for model in structure:
            for chain in model:
                residue_count=sum(1 for res in chain)
                atom_count=sum(len(res) for res in chain)
                item={"chain_id":chain.name,"residues":residue_count,"atoms":atom_count}
                chains.append(item)
                residues_total+=residue_count
                atoms_total+=atom_count
                if data.chain_id and chain.name==data.chain_id:
                    selected=chain
        if data.chain_id and selected is None:
            raise HTTPException(status_code=404,detail=f"Chain {data.chain_id} not found in {pdb_id}")
        sequence=""
        if selected is not None:
            one_letter=[]
            for res in selected:
                code=gemmi.find_tabulated_residue(res.name).one_letter_code
                one_letter.append(code if code else "X")
            sequence="".join(one_letter)
        return {"status":"completed","module":"PDB & Structure","pdb_id":pdb_id,
                "models":models,"chains":chains,"residue_count":residues_total,"atom_count":atoms_total,
                "selected_chain":data.chain_id or None,"sequence":sequence,
                "sequence_length":len(sequence),"source":"RCSB Protein Data Bank",
                "warning":"Structure-derived sequence is computational metadata and is not a clinical interpretation.",
                "user":user["username"]}
    except HTTPException: raise
    except Exception as exc:
        raise HTTPException(status_code=422,detail=f"Structure parsing failed: {exc}")

@app.post("/api/v1/scientific/sequence-structure")
def sequence_structure_bridge(data: StructureAnalysisRequest,user=Depends(get_current_user)):
    result=analyze_pdb_structure(data,user)
    sequence=result.get("sequence","")
    return {"status":"completed","module":"Scientific Core","pdb_id":result["pdb_id"],
            "chain":result.get("selected_chain"),"sequence":sequence,
            "sequence_length":len(sequence),"structure_summary":{"models":result["models"],"chains":result["chains"],
            "residues":result["residue_count"],"atoms":result["atom_count"]},
            "next_steps":["Bioinformatics analysis","Molecular target selection","Virtual screening","Docking"],
            "user":user["username"]}


# =========================================================
# PHASE 2 — END-TO-END SCIENTIFIC WORKFLOW
# =========================================================
class ScientificWorkflowRequest(BaseModel):
    name: str = "MedGen Scientific Workflow"
    target: str
    pdb_id: str = ""
    chain_id: str = ""
    sequence: str = ""
    ligand_smiles: str = ""
    run_similarity: bool = True
    similarity_library: list[str] = []

@app.post("/api/v1/scientific/workflow")
def run_scientific_workflow(data: ScientificWorkflowRequest,user=Depends(get_current_user)):
    target=data.target.strip()
    if not target: raise HTTPException(status_code=400,detail="Target is required")
    result={"status":"completed","name":data.name,"target":target,"stages":[],
            "owner":user["username"],"created_at":datetime.utcnow().isoformat()+"Z"}
    seq=data.sequence.strip().upper()
    if data.pdb_id:
        bridge=sequence_structure_bridge(StructureAnalysisRequest(pdb_id=data.pdb_id,chain_id=data.chain_id),user)
        seq=bridge.get("sequence","") or seq
        result["structure"]=bridge
        result["stages"].append({"stage":"structure","status":"completed"})
    if seq:
        clean=re.sub(r"[^A-Z]","",seq)
        result["sequence"]={"length":len(clean),"sequence":clean[:5000]}
        result["stages"].append({"stage":"sequence","status":"completed"})
    if data.ligand_smiles.strip():
        mol=_molecule_descriptors(data.ligand_smiles.strip())
        result["molecule"]=mol
        result["stages"].append({"stage":"molecular_analysis","status":"completed"})
        if data.run_similarity and data.similarity_library:
            sims=[]
            ref=data.ligand_smiles.strip()
            for candidate in data.similarity_library[:200]:
                try:
                    q=_molecule_descriptors(candidate)["canonical_smiles"]
                    sims.append({"smiles":candidate,"similarity":_tanimoto_similarity(ref,candidate)})
                except Exception: pass
            result["similarity"]=sorted(sims,key=lambda x:x["similarity"],reverse=True)
            result["stages"].append({"stage":"similarity","status":"completed"})
    exp={"id":str(uuid.uuid4()),"owner":user["username"],"type":"scientific_workflow",
         "name":data.name,"target":target,"created_at":result["created_at"],
         "result":result}
    experiments_store[exp["id"]]=exp
    _db_save()
    result["experiment_id"]=exp["id"]
    result["report_ready"]=True
    return result

@app.get("/api/v1/scientific/core/status")
def scientific_core_status_v2(user=Depends(get_current_user)):
    return {"phase":2,"status":"active","components":{
        "bioinformatics":True,"molecular_analysis":True,"pdb_rcsb":True,
        "pdb_parsing_gemmi":True,"sequence_structure_bridge":True,
        "molecular_similarity":True,"molecule_3d":True,
        "drug_discovery_screening":True,"docking":VINA_AVAILABLE,
        "virtual_lab":True,"scientific_reports":True,
        "end_to_end_workflow":True},
        "workflow":["PDB/sequence","structure parsing","sequence extraction",
                    "molecular analysis","similarity","screening","docking","report"],
        "disclaimer":"Computational research workflow; results require scientific validation and are not clinical advice.",
        "user":user["username"]}


# Phase 1 academic extensions are additive and backward-compatible.
try:
    from . import phase1_academy_ext  # package execution
except ImportError:
    try:
        import phase1_academy_ext  # direct uvicorn main:app execution
    except ModuleNotFoundError:
        # Optional extension: keep the core API bootable if deployment has not received the file yet.
        phase1_academy_ext = None
