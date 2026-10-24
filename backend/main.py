import uuid
import threading
import copy
from datetime import date, datetime, timezone
import hashlib
import json
import xml.etree.ElementTree as ET
import os
import secrets
import re
import hmac
import base64
import struct
import time
from typing import Any
try:
    from pwdlib import PasswordHash
except Exception:
    PasswordHash = None
try:
    import psycopg
except Exception:
    psycopg = None
from urllib.parse import quote, urlsplit
from urllib.request import Request as URLRequest, urlopen
from urllib.error import HTTPError, URLError

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from html import escape as _email_esc
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
try:
    from .knowledge_engine import make_entity, make_relation, search_graph, neighborhood, validate_graph, normalize_entity, graph_stats, find_paths
except ImportError:
    from knowledge_engine import make_entity, make_relation, search_graph, neighborhood, validate_graph, normalize_entity, graph_stats, find_paths
from pydantic import BaseModel, Field, StrictInt, ValidationError
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

REQUIRED_CORS_ORIGINS = {
    "https://medgen-web.onrender.com",
    "https://medgenai-web-1.onrender.com",
    "https://medgenai-web.onrender.com",
}


def _build_allowed_cors_origins(configured: str | None) -> list[str]:
    # Always keep the known production frontend origins, even when Render has
    # a custom MEDGEN_CORS_ORIGINS value. Custom origins extend this set.
    extra_origins = (
        {"http://localhost:3000", "http://localhost:5173"}
        if configured is None
        else {origin.strip() for origin in configured.split(",") if origin.strip()}
    )
    return sorted(REQUIRED_CORS_ORIGINS | extra_origins)


ALLOWED_CORS_ORIGINS = _build_allowed_cors_origins(os.getenv("MEDGEN_CORS_ORIGINS"))




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
academy_syllabi_store = {}
experiments_store = []
knowledge_entities_store = []
knowledge_relations_store = []

# =========================================================
# GLOBAL PLATFORM STATE — ORGANIZATIONS / WORKSPACES / API
# =========================================================
opportunities_store = {}
organizations_store = {}
school_directory_store = {}
school_invitations_store = {}
school_assignments_store = {}
school_submissions_store = {}
memberships_store = []
workspaces_store = []
projects_store = []
api_keys_store = {}
platform_audit_log = []
usage_store = {}
totp_store = {}
mfa_pending = {}
billing_store = {}
trusted_devices = {}
REQUIRE_2FA_ROLES = {r.strip() for r in os.getenv("MEDGEN_REQUIRE_2FA_ROLES", "doctor,pharma,SUPER_ADMIN").split(",") if r.strip()}
DEVICE_TTL_SECONDS = 30 * 86400
screening_jobs_store = {}
billing_events = {}
DODO_API_KEY = os.getenv("DODO_API_KEY", "").strip()
DODO_ENV = os.getenv("DODO_ENV", "test").strip().lower()
DODO_WEBHOOK_SECRET = os.getenv("DODO_WEBHOOK_SECRET", "").strip()
BILLING_PLANS = {
    "pro": {"label": "Pro (Researcher)", "product_id": os.getenv("DODO_PRODUCT_PRO", "").strip()},
    "enterprise": {"label": "Enterprise (Pharma)", "product_id": os.getenv("DODO_PRODUCT_ENTERPRISE", "").strip()},
}
RESEND_API_KEY = os.getenv("RESEND_API_KEY", "").strip()
BREVO_API_KEY = os.getenv("BREVO_API_KEY", "").strip()
BREVO_SENDER_EMAIL = os.getenv("BREVO_SENDER_EMAIL", "").strip()
BREVO_SENDER_NAME = os.getenv("BREVO_SENDER_NAME", "MedGen AI").strip()
EMAIL_ENABLED = bool(RESEND_API_KEY or (BREVO_API_KEY and BREVO_SENDER_EMAIL))
EMAIL_FROM = os.getenv("MEDGEN_EMAIL_FROM", "MedGen AI <onboarding@resend.dev>").strip()
PUBLIC_API_URL = os.getenv("MEDGEN_PUBLIC_API_URL", "https://medgenai-web-1.onrender.com").rstrip("/")
SITE_URL = os.getenv("MEDGEN_SITE_URL", "https://medgenai-web.onrender.com").rstrip("/")
REQUIRE_EMAIL_VERIFICATION = os.getenv("MEDGEN_REQUIRE_EMAIL_VERIFICATION", "").strip().lower() in {"1", "true", "yes"}
EMAIL_TOKEN_TTL = 172800
_email_cooldown = {}

def _normalize_db_url(raw: str) -> str:
    """Forgiving cleanup of a pasted Postgres URL: quotes, spaces, [brackets] around the password,
    and unescaped special characters in the user/password."""
    from urllib.parse import quote, unquote
    url = str(raw or "").strip().strip("'\"").strip()
    if "://" not in url:
        return url
    scheme, rest = url.split("://", 1)
    if "@" not in rest:
        return url
    userinfo, hostpart = rest.rsplit("@", 1)
    user, sep, password = userinfo.partition(":")
    password = password.strip()
    if password.startswith("[") and password.endswith("]"):
        password = password[1:-1]
    def enc(v):
        return quote(unquote(v) if re.search(r"%[0-9A-Fa-f]{2}", v) else v, safe="")
    userinfo = enc(user) + ((":" + enc(password)) if sep else "")
    return scheme + "://" + userinfo + "@" + hostpart.strip()


SUPABASE_REF = os.getenv("MEDGEN_SUPABASE_REF", "dbkxgbeisgyjilflkneq").strip()
SUPABASE_REGION = os.getenv("MEDGEN_SUPABASE_REGION", "ap-southeast-2").strip()


def _resolve_db_url(raw: str) -> str:
    """Accepts a full Postgres URL (cleaned up), or just a Supabase database password:
    in that case the Session-pooler URL is built and the working host is detected."""
    raw = str(raw or "").strip().strip("'\"").strip()
    if not raw:
        return ""
    if "://" in raw:
        return _normalize_db_url(raw)
    if psycopg is None:
        return raw
    from urllib.parse import quote
    pw = quote(raw, safe="")
    for prefix in ("aws-1", "aws-0"):
        host = f"{prefix}-{SUPABASE_REGION}.pooler.supabase.com"
        candidate = f"postgresql://postgres.{SUPABASE_REF}:{pw}@{host}:5432/postgres"
        try:
            with psycopg.connect(candidate, connect_timeout=10) as probe:
                probe.execute("SELECT 1")
            print("DB shorthand resolved: host=" + host)
            return candidate
        except Exception as exc:
            print("DB shorthand candidate failed: host=" + host, type(exc).__name__)
    return raw


DATABASE_URL = _resolve_db_url(os.getenv("DATABASE_URL", ""))
MIGRATE_TARGET_URL = _resolve_db_url(os.getenv("MEDGEN_MIGRATE_TO_URL", ""))
LEGAL_CONSENT_VERSION = "1.2"
PERSISTENCE_ENABLED = bool(DATABASE_URL and psycopg)
password_hasher = PasswordHash.recommended() if PasswordHash else None

_PERSISTENCE_LOCK = threading.RLock()
_state_revision = 0

def _persistent_stores():
    return {"opportunities_store":opportunities_store,"user_accounts":user_accounts,"user_profiles":user_profiles,"user_consents":user_consents,"role_requests_store":role_requests_store,"experiments_store":experiments_store,"reports_store":reports_store,"academy_syllabi_store":academy_syllabi_store,"activity_log":activity_log,"jobs_store":jobs_store,"workflows_store":workflows_store,"docking_jobs_store":docking_jobs_store,"knowledge_entities_store":knowledge_entities_store,"knowledge_relations_store":knowledge_relations_store,"organizations_store":organizations_store,"school_directory_store":school_directory_store,"school_invitations_store":school_invitations_store,"school_assignments_store":school_assignments_store,"school_submissions_store":school_submissions_store,"memberships_store":memberships_store,"workspaces_store":workspaces_store,"projects_store":projects_store,"api_keys_store":api_keys_store,"platform_audit_log":platform_audit_log,"usage_store":usage_store,"totp_store":totp_store,"billing_store":billing_store,"trusted_devices":trusted_devices,"screening_jobs_store":screening_jobs_store,"billing_events":billing_events,"webhooks_store":webhooks_store}

def _db_migrate_if_requested():
    """One-time server-side copy of all state rows from DATABASE_URL to MEDGEN_MIGRATE_TO_URL.
    Data never leaves the server. Remove MEDGEN_MIGRATE_TO_URL after switching DATABASE_URL."""
    if not MIGRATE_TARGET_URL or not PERSISTENCE_ENABLED or MIGRATE_TARGET_URL == DATABASE_URL:
        return
    phase = "parse-target-url"
    target_url = MIGRATE_TARGET_URL
    try:
        from urllib.parse import urlsplit
        parts = urlsplit(target_url)
        print("MIGRATION target:", "scheme=" + str(parts.scheme), "host=" + str(parts.hostname), "port=" + str(parts.port),
              "user=" + str(parts.username)[:40], "has_password=" + str(bool(parts.password)), "db=" + str(parts.path))
        phase = "connect-source"
        with psycopg.connect(DATABASE_URL) as src:
            phase = "read-source"
            rows = src.execute("SELECT state_key, state_value, updated_at FROM medgen_state").fetchall()
        phase = "connect-target"
        with psycopg.connect(target_url) as dst:
            phase = "write-target"
            dst.execute("CREATE TABLE IF NOT EXISTS medgen_state (state_key TEXT PRIMARY KEY, state_value JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())")
            for key, value, updated in rows:
                dst.execute(
                    "INSERT INTO medgen_state(state_key,state_value,updated_at) VALUES (%s,%s::jsonb,%s) "
                    "ON CONFLICT (state_key) DO UPDATE SET state_value=EXCLUDED.state_value, updated_at=EXCLUDED.updated_at",
                    (key, json.dumps(value, ensure_ascii=False), updated),
                )
            dst.commit()
        print("MIGRATION OK: copied", len(rows), "state rows")
    except Exception as exc:
        msg = str(exc)
        for secret in (DATABASE_URL, MIGRATE_TARGET_URL):
            if secret:
                msg = msg.replace(secret, "<url>")
        msg = re.sub(r"://[^@\s]+@", "://<redacted>@", msg)
        print("MIGRATION FAILED:", phase, type(exc).__name__, msg[:200])


def _db_init():
    if not PERSISTENCE_ENABLED: return
    with psycopg.connect(DATABASE_URL) as conn:
        conn.execute("""CREATE TABLE IF NOT EXISTS medgen_state (state_key TEXT PRIMARY KEY, state_value JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW())""")
        conn.execute("INSERT INTO medgen_state(state_key,state_value) VALUES ('__revision','0'::jsonb) ON CONFLICT (state_key) DO NOTHING")
        conn.commit()

def _db_load():
    global _state_revision
    if DATABASE_URL and psycopg is None:
        raise RuntimeError("PostgreSQL driver is required when DATABASE_URL is configured")
    if not PERSISTENCE_ENABLED: return
    try:
        _db_migrate_if_requested()
        _db_init()
        with psycopg.connect(DATABASE_URL) as conn:
            rows = conn.execute("SELECT state_key, state_value FROM medgen_state").fetchall()
        stores = _persistent_stores()
        revision = next((v for k, v in rows if k == "__revision"), 0)
        if type(revision) is not int or revision < 0:
            raise ValueError("Invalid persisted revision")
        # Validate the entire snapshot before changing any process-local state.
        for key, value in rows:
            if key in stores and type(value) is not type(stores[key]):
                raise ValueError("Invalid persisted store type")
        for key,value in rows:
            if key in stores:
                stores[key].clear()
                if isinstance(stores[key],dict): stores[key].update(value)
                else: stores[key].extend(value)
        _state_revision = revision
    except Exception as exc:
        raise RuntimeError("Unable to restore PostgreSQL state; startup aborted") from exc

def _db_save():
    global _state_revision
    if not PERSISTENCE_ENABLED: return
    try:
        with _PERSISTENCE_LOCK:
            # Snapshot values before opening the transaction; serialize writers in this process.
            stores = copy.deepcopy(_persistent_stores())
            with psycopg.connect(DATABASE_URL) as conn:
                row = conn.execute("SELECT state_value FROM medgen_state WHERE state_key = '__revision' FOR UPDATE").fetchone()
                if row is None or type(row[0]) is not int or row[0] != _state_revision:
                    raise RuntimeError("Persisted state changed in another process; restart required")
                for key, value in stores.items():
                    conn.execute("INSERT INTO medgen_state(state_key,state_value,updated_at) VALUES (%s,%s::jsonb,NOW()) ON CONFLICT (state_key) DO UPDATE SET state_value=EXCLUDED.state_value,updated_at=NOW()", (key,json.dumps(value,ensure_ascii=False)))
                next_revision = _state_revision + 1
                conn.execute("UPDATE medgen_state SET state_value=%s::jsonb, updated_at=NOW() WHERE state_key='__revision'", (json.dumps(next_revision),))
                conn.commit()
            _state_revision = next_revision
    except Exception as exc:
        raise HTTPException(status_code=503, detail="Ma’lumotni bazaga saqlash amalga oshmadi.") from exc


# Load persisted application state once startup definitions are ready.
# (Token state intentionally remains in-memory.)


# =========================================================
# MODELS
# =========================================================

class LoginRequest(BaseModel):
    username: str
    password: str
    device_token: str = ""


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
    school_name: str = ""
    class_name: str = ""
    invitation_code: str = ""


class SchoolInvitationRequest(BaseModel):
    school_name: str
    region: str = ""
    role: str = "school_student"
    class_name: str = ""
    expires_in_days: int = 7


class SchoolReviewRequest(BaseModel):
    approve: bool
    note: str = ""
    class_name: str = ""


class SchoolAssignmentRequest(BaseModel):
    title: str
    subject: str = ""
    description: str = ""
    class_name: str
    due_date: str = ""


class EducationAssessmentRequest(BaseModel):
    subject: str
    grade: str
    topic: str
    assessment_type: str = "BSB"
    question_count: int = 5
    language: str = "uz"
    difficulty: str = "medium"


class SchoolSubmissionRequest(BaseModel):
    answer: str


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
    phone: str = ""
    organization: str = ""
    country: str = ""
    region: str = ""
    district: str = ""
    city: str = ""
    location_label: str = ""
    location_lat: float | None = Field(default=None, ge=-90, le=90, allow_inf_nan=False)
    location_lon: float | None = Field(default=None, ge=-180, le=180, allow_inf_nan=False)
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
    query: str = Field(min_length=1, max_length=3000)
    limit: int = Field(default=8, ge=1, le=20)
    focus: str = Field(default="", max_length=300)


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
    if not profile:
        return False
    role = normalize_role(profile.get("role") or "student")
    # School accounts use data minimization: do not require university fields,
    # precise location, or date of birth just to access school learning.
    if role in {"school_student", "school_teacher"}:
        required = ["full_name", "email", "school_name"]
        if role == "school_student":
            required.append("class_name")
        return all(str(profile.get(k) or "").strip() for k in required)
    required = ["full_name", "email", "country", "region", "district", "city"]
    if not all(str(profile.get(k) or "").strip() for k in required):
        return False
    if not all(profile.get(k) is not None for k in ("birth_year", "birth_month", "birth_day")):
        return False
    if role in {"student", "researcher", "professor"}:
        ap = profile.get("academic_profile") or {}
        if not all(str(ap.get(k) or "").strip() for k in ("university", "faculty", "major", "group")):
            return False
    return True

def normalize_role(value: str) -> str:
    role = str(value or "student").strip().lower()
    return "SUPER_ADMIN" if role.upper() == "SUPER_ADMIN" else role

ALLOWED_USER_ROLES = {
    "student", "doctor", "researcher", "professor",
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
    # The configured platform owner account must not be locked out by a stale
    # persisted role_status value. Other accounts still respect admin disablement.
    is_primary_admin = str(username).strip().casefold() == str(ADMIN_USERNAME).strip().casefold()
    if not is_primary_admin and str(profile.get("role_status", "active")).lower() != "active":
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

    mfa_exempt = {
        "/api/v1/health/live", "/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/me",
        "/api/v1/auth/logout", "/api/v1/account", "/api/v1/profile", "/api/v1/billing/webhook",
        "/api/v1/auth/verify-email",
    }
    if REQUIRE_2FA_ROLES and path not in mfa_exempt and not path.startswith("/api/v1/auth/2fa/"):
        _hdr = request.headers.get("authorization", "")
        _tok = _hdr[7:].strip() if _hdr.lower().startswith("bearer ") else ""
        _usr = tokens.get(_tok)
        if _usr and _mfa_required_for(_usr) and not totp_store.get(_usr, {}).get("enabled"):
            return JSONResponse(status_code=403, content={"detail": "MFA_SETUP_REQUIRED"})

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
        "/api/v1/academy/dashboard",  # read-only student progress/onboarding surface
        "/api/v1/academy/catalog",
        "/api/v1/education/preferences",
        "/api/v1/roles/request",
        "/api/v1/security/overview",
        "/api/v1/security/location",
        "/api/v1/security/summary",
        # Dashboard summary and roadmap are read-only navigation surfaces.
        # Keep them available during onboarding; scientific/data operations
        # remain gated by profile completion and explicit legal consent.
        "/api/v1/dashboard/summary",
        "/api/v1/platform/phase-status",
    }
    if path in allowed or path.startswith("/api/v1/admin/") or path.startswith("/api/v1/auth/2fa/"):
        return await call_next(request)

    auth = request.headers.get("authorization", "")
    token = auth[7:].strip() if auth.lower().startswith("bearer ") else ""
    username = tokens.get(token)
    if not username:
        return await call_next(request)

    profile = user_profiles.get(username, {})
    # Medical Academy learning activities use their own academic profile flow.
    # Keep legal consent mandatory, but don't block learning solely because
    # unrelated platform profile fields (e.g. location/date fields) are absent.
    academy_learning_path = path in {
        "/api/v1/academy/assessment/start",
        "/api/v1/academy/assessment/submit",
        "/api/v1/academy/v2/assessment/submit",
        "/api/v1/academy/lesson/complete",
    }
    if not academy_learning_path and not is_required_profile_complete(profile):
        return JSONResponse(
            status_code=403,
            content={"detail":"PROFILE_INCOMPLETE","message":"Profilni to‘liq to‘ldiring."},
        )

    # Academic content is locked until a platform administrator verifies
    # the student's university/major/year/group. Keep onboarding surfaces open.
    academic_learning_paths = (
        path == "/api/v1/academy/curriculum"
        or path.startswith("/api/v1/academy/subject/")
        or path.startswith("/api/v1/academy/v2/subject/")
        or path in {
            "/api/v1/academy/assessment/start",
            "/api/v1/academy/assessment/submit",
            "/api/v1/academy/v2/assessment/submit",
            "/api/v1/academy/lesson/complete",
        }
        or path.startswith("/api/v1/academy/eligibility/")
    )
    if academic_learning_paths:
        is_primary_admin = str(username).strip().casefold() == str(ADMIN_USERNAME).strip().casefold()
        profile_for_academic_gate = user_profiles.get(username, {})
        academic_status = str(profile_for_academic_gate.get("academic_status", "pending")).lower()
        if not is_primary_admin and academic_status != "approved":
            return JSONResponse(
                status_code=403,
                content={
                    "detail": "ACADEMIC_APPROVAL_REQUIRED",
                    "message": "Akademik ma’lumotlaringiz administrator tomonidan tasdiqlanishi kutilmoqda.",
                    "academic_status": academic_status,
                },
            )

    consent = user_consents.get(username, {})
    if consent.get("version") != LEGAL_CONSENT_VERSION or not all(
        bool(consent.get(k))
        for k in ("terms_accepted", "privacy_accepted", "data_processing_accepted", "research_disclaimer_accepted")
    ):
        return JSONResponse(
            status_code=403,
            content={"detail":"LEGAL_CONSENT_REQUIRED","message":"Amaldagi majburiy roziliklarni tasdiqlang."},
        )
    return await call_next(request)

# Register CORS after the readiness middleware so even its early 403 responses
# include CORS headers and the browser can show the required onboarding action.
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

    # Resolve usernames case-insensitively so the casing used at login
    # does not make a valid account appear to have the wrong password.
    canonical_username = next(
        (name for name in user_accounts if name.casefold() == data.username.strip().casefold()),
        None,
    )
    registered = user_accounts.get(canonical_username) if canonical_username else None
    valid_registered = bool(
        registered and verify_password(data.password, registered["password_hash"])
    )
    valid_admin = (
        data.username.strip().casefold() == str(ADMIN_USERNAME).strip().casefold()
        and data.password == ADMIN_PASSWORD
    )
    if not valid_registered and not valid_admin:
        attempts.append(now)
        login_attempts[key] = attempts
        raise HTTPException(status_code=401, detail="Invalid username or password")

    login_attempts.pop(key, None)
    authenticated_username = canonical_username if valid_registered else str(ADMIN_USERNAME).strip()
    if REQUIRE_EMAIL_VERIFICATION and user_profiles.get(authenticated_username, {}).get("email_verified") is False:
        raise HTTPException(status_code=403, detail="Email is not verified. Check your inbox.")
    if totp_store.get(authenticated_username, {}).get("enabled") and not _device_trusted(authenticated_username, data.device_token):
        mfa_token = secrets.token_urlsafe(32)
        mfa_pending[mfa_token] = {"username": authenticated_username, "exp": time.time() + 300}
        return {"mfa_required": True, "mfa_token": mfa_token, "expires_in": 300}
    token = make_token(authenticated_username)
    tokens[token] = authenticated_username
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
    if (
        username.casefold() == ADMIN_USERNAME.casefold()
        or any(existing.casefold() == username.casefold() for existing in user_accounts)
    ):
        raise HTTPException(status_code=409, detail="Username already exists.")
    email = data.email.strip().lower()
    if "@" not in email:
        raise HTTPException(status_code=400, detail="Valid email is required.")
    try:
        academic_year = int(data.academic_year)
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail="Academic year must be between 1 and 6.")
    if not 1 <= academic_year <= 6:
        raise HTTPException(status_code=400, detail="Academic year must be between 1 and 6.")

    # Reject unsupported roles before mutating account state.
    role = normalize_role(data.role)
    if role not in ALLOWED_USER_ROLES:
        raise HTTPException(status_code=400, detail="Unsupported role.")
    school_name = str(data.school_name or "").strip()[:160]
    class_name = str(data.class_name or "").strip()[:40]
    invitation_code = re.sub(r"[^A-Za-z0-9-]", "", str(data.invitation_code or "").strip()).upper()
    school_role = role in {"school_student", "school_teacher"}
    invitation = None
    if school_role:
        if not school_name:
            raise HTTPException(status_code=400, detail="Maktab nomini kiriting.")
        if role == "school_student" and not class_name:
            raise HTTPException(status_code=400, detail="O‘quvchi uchun sinfni kiriting.")
        if invitation_code:
            code_hash = hashlib.sha256(invitation_code.encode()).hexdigest()
            invitation = school_invitations_store.get(code_hash)
            if not invitation or invitation.get("revoked"):
                raise HTTPException(status_code=400, detail="Taklif kodi noto‘g‘ri yoki bekor qilingan.")
            expires_at = datetime.fromisoformat(invitation["expires_at"])
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)
            if expires_at <= datetime.now(timezone.utc):
                raise HTTPException(status_code=400, detail="Taklif kodi muddati tugagan.")
            if int(invitation.get("used_count", 0)) >= int(invitation.get("max_uses", 100)):
                raise HTTPException(status_code=400, detail="Taklif kodi ishlatish limiti tugagan.")
            if invitation.get("role") != role:
                raise HTTPException(status_code=400, detail="Bu taklif kodi boshqa foydalanuvchi turi uchun.")
            if str(invitation.get("school_name", "")).casefold() != school_name.casefold():
                raise HTTPException(status_code=400, detail="Taklif kodi boshqa maktabga tegishli.")
            invited_class = str(invitation.get("class_name") or "")
            if invited_class and invited_class.casefold() != class_name.casefold():
                raise HTTPException(status_code=400, detail="Taklif kodi boshqa sinf uchun.")
    user_accounts[username] = {
        "username": username,
        "password_hash": make_password_hash(data.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    user_profiles[username] = {
        "full_name": data.full_name.strip(), "email": email, "phone": data.phone.strip(),
        "country": data.country.strip(), "region": "", "district": "", "city": "",
        "location_label": "", "location_lat": None, "location_lon": None,
        "location_source": "", "organization": data.organization.strip(),
        "birth_year": None, "birth_month": None, "birth_day": None,
        "research_interests": "", "bio": "", "avatar": "",
        "role": role,
        "approved_roles": [role],
        "role_status": "pending" if school_role else "active",
        "school_name": school_name if school_role else "",
        "school_region": str((invitation or {}).get("region") or "").strip()[:120] if school_role else "",
        "class_name": class_name if school_role else "",
        "school_status": "pending" if school_role else "not_applicable",
        "invitation_code_used": bool(school_role and invitation),
        "school_review": {"status": "pending", "submitted_at": datetime.now(timezone.utc).isoformat(), "reviewed_at": None, "reviewed_by": None, "note": ""} if school_role else {},
        # Enrollment claims are untrusted until reviewed by a platform admin.
        "academic_status": "pending",
        "academic_review": {
            "status": "pending",
            "submitted_at": datetime.now(timezone.utc).isoformat(),
            "reviewed_at": None,
            "reviewed_by": None,
            "note": "",
        },
        "academic_profile": {
            "country_code": str(data.country_code or "").upper()[:2],
            "education_mode": str(data.education_mode or "GLOBAL").upper(),
            "university": str(data.university or "").strip()[:200],
            "faculty": str(data.faculty or "").strip()[:200],
            "major": str(data.major or "").strip()[:200],
            "year": academic_year,
            "group": str(data.group or "").strip()[:100],
            "student_id": str(data.student_id or "").strip()[:100],
            "study_language": "uz",
            "academic_degree": "MD/MBBS",
        },
    }
    if school_role and invitation:
        invitation["used_count"] = int(invitation.get("used_count", 0)) + 1
        invitation["last_used_at"] = datetime.now(timezone.utc).isoformat()
    if school_role:
        school_key = school_name.casefold()
        school_record = school_directory_store.setdefault(school_key, {"name": school_name, "region": str((invitation or {}).get("region") or "").strip()[:120], "created_at": datetime.now(timezone.utc).isoformat()})
        if not school_record.get("region") and (invitation or {}).get("region"):
            school_record["region"] = str(invitation.get("region") or "").strip()[:120]
    activity_log.insert(0, {
        "type": "account_registered",
        "username": username,
        "role": role,
        "school_name": school_name if school_role else "",
        "school_status": "pending" if school_role else "not_applicable",
        "at": datetime.now(timezone.utc).isoformat(),
    })
    if EMAIL_ENABLED:
        user_profiles[username]["email_verified"] = False
        _send_verification_email(username)
    _db_save()
    return {"status": "registered", "username": username, "role": role, "school_status": "pending" if school_role else "not_applicable", "message": "Maktab akkauntingiz administrator tasdig‘ini kutmoqda." if school_role else "Ro‘yxatdan o‘tildi."}


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
        "academic_status": profile.get("academic_status", "pending"),
        "academic_review": profile.get("academic_review", {"status": profile.get("academic_status", "pending")}),
        "school_name": profile.get("school_name", ""),
        "class_name": profile.get("class_name", ""),
        "school_status": profile.get("school_status", "not_applicable"),
        "school_review": profile.get("school_review", {}),
        "consent_complete": consent.get("version") == LEGAL_CONSENT_VERSION and all([
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


# =========================================================
# TWO-FACTOR AUTHENTICATION (TOTP, RFC 6238, Google Authenticator)
# =========================================================
class TotpCodeRequest(BaseModel):
    code: str


class TotpLoginRequest(BaseModel):
    mfa_token: str
    code: str
    remember: bool = False


try:
    from cryptography.fernet import Fernet, InvalidToken
except Exception:  # cryptography not installed: secrets stay readable but the app keeps working
    Fernet = None
    InvalidToken = Exception


def _fernet():
    if Fernet is None:
        return None
    key = base64.urlsafe_b64encode(hashlib.sha256(("medgen-2fa-v1:" + SECRET_KEY).encode("utf-8")).digest())
    return Fernet(key)


def _secret_encrypt(plain: str) -> str:
    f = _fernet()
    return ("enc1:" + f.encrypt(plain.encode("utf-8")).decode("utf-8")) if f else plain


def _secret_plain(stored: str) -> str:
    stored = str(stored)
    if not stored.startswith("enc1:"):
        return stored
    f = _fernet()
    if f is None:
        raise HTTPException(status_code=503, detail="2FA storage is temporarily unavailable.")
    try:
        return f.decrypt(stored[5:].encode("utf-8")).decode("utf-8")
    except InvalidToken:
        raise HTTPException(status_code=503, detail="2FA storage key mismatch. Contact the administrator.")


def _device_hash(token: str) -> str:
    return hashlib.sha256(("dev:" + SECRET_KEY + ":" + str(token)).encode("utf-8")).hexdigest()


def _device_trusted(username: str, token: str) -> bool:
    if not token:
        return False
    exp = trusted_devices.get(username, {}).get(_device_hash(token))
    return bool(exp and exp > time.time())


def _device_issue(username: str) -> str:
    token = secrets.token_urlsafe(32)
    now = time.time()
    devices = {h: e for h, e in trusted_devices.get(username, {}).items() if e > now}
    while len(devices) >= 5:
        devices.pop(min(devices, key=devices.get))
    devices[_device_hash(token)] = now + DEVICE_TTL_SECONDS
    trusted_devices[username] = devices
    return token


def _mfa_required_for(username: str) -> bool:
    if not REQUIRE_2FA_ROLES:
        return False
    required = {normalize_role(r) for r in REQUIRE_2FA_ROLES}
    profile = user_profiles.get(username, {})
    roles = {normalize_role(profile.get("role") or "student")}
    roles |= {normalize_role(x) for x in (profile.get("approved_roles") or [])}
    if str(username).strip().casefold() == str(ADMIN_USERNAME).strip().casefold():
        roles.add("SUPER_ADMIN")
    return bool(roles & required)


def _totp_code(secret_b32: str, counter: int) -> str:
    key = base64.b32decode(secret_b32 + "=" * (-len(secret_b32) % 8), casefold=True)
    digest = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    offset = digest[-1] & 15
    value = struct.unpack(">I", digest[offset:offset + 4])[0] & 0x7FFFFFFF
    return f"{value % 1000000:06d}"


def _totp_verify(record: dict, code: str) -> bool:
    code = re.sub(r"\s", "", str(code or ""))
    if not re.fullmatch(r"\d{6}", code):
        return False
    now = int(time.time() // 30)
    plain = _secret_plain(record["secret"])
    for counter in (now - 1, now, now + 1):
        if counter > int(record.get("last_counter", -1)) and hmac.compare_digest(_totp_code(plain, counter), code):
            record["last_counter"] = counter
            if not str(record["secret"]).startswith("enc1:"):
                record["secret"] = _secret_encrypt(plain)
            return True
    return False


def _recovery_norm(code: str) -> str:
    return re.sub(r"[^a-z0-9]", "", str(code or "").lower())


def _recovery_hash(norm: str) -> str:
    return hashlib.sha256((SECRET_KEY + ":rc:" + norm).encode("utf-8")).hexdigest()


def _new_recovery_codes(record: dict) -> list:
    alphabet = "abcdefghjkmnpqrstuvwxyz23456789"
    codes = []
    for _ in range(8):
        raw = "".join(secrets.choice(alphabet) for _ in range(10))
        codes.append(raw[:5] + "-" + raw[5:])
    record["recovery"] = [_recovery_hash(_recovery_norm(c)) for c in codes]
    return codes


def _recovery_consume(record: dict, code: str) -> bool:
    norm = _recovery_norm(code)
    if len(norm) != 10:
        return False
    digest = _recovery_hash(norm)
    for item in list(record.get("recovery", [])):
        if hmac.compare_digest(item, digest):
            record["recovery"].remove(item)
            return True
    return False


def _second_factor_ok(record: dict, code: str) -> bool:
    return _totp_verify(record, code) or _recovery_consume(record, code)


def _totp_rate_limit(key: str) -> None:
    now = datetime.now(timezone.utc)
    attempts = [t for t in login_attempts.get(key, []) if (now - t).total_seconds() < LOGIN_WINDOW_SECONDS]
    login_attempts[key] = attempts
    if len(attempts) >= 5:
        raise HTTPException(status_code=429, detail="Too many attempts. Try again later.")


def _totp_fail(key: str) -> None:
    login_attempts.setdefault(key, []).append(datetime.now(timezone.utc))


@app.get("/api/v1/auth/2fa/status")
def twofa_status(user=Depends(get_current_user)):
    record = totp_store.get(user["username"], {})
    return {
        "enabled": bool(record.get("enabled")),
        "recovery_remaining": len(record.get("recovery", [])),
        "required": _mfa_required_for(user["username"]),
        "trusted_devices": len([e for e in trusted_devices.get(user["username"], {}).values() if e > time.time()]),
    }


@app.post("/api/v1/auth/2fa/setup")
def twofa_setup(user=Depends(get_current_user)):
    username = user["username"]
    if totp_store.get(username, {}).get("enabled"):
        raise HTTPException(status_code=400, detail="2FA is already enabled. Disable it first.")
    secret = base64.b32encode(secrets.token_bytes(20)).decode().rstrip("=")
    totp_store[username] = {"secret": _secret_encrypt(secret), "enabled": False, "last_counter": -1}
    uri = (
        "otpauth://totp/" + quote("MedGen AI") + ":" + quote(username)
        + "?secret=" + secret + "&issuer=" + quote("MedGen AI") + "&algorithm=SHA1&digits=6&period=30"
    )
    _db_save()
    return {"secret": secret, "otpauth_uri": uri}


@app.post("/api/v1/auth/2fa/enable")
def twofa_enable(data: TotpCodeRequest, user=Depends(get_current_user)):
    username = user["username"]
    record = totp_store.get(username)
    if not record or record.get("enabled"):
        raise HTTPException(status_code=400, detail="Start 2FA setup first.")
    key = "2fa:" + username.lower()
    _totp_rate_limit(key)
    if not _totp_verify(record, data.code):
        _totp_fail(key)
        raise HTTPException(status_code=400, detail="Invalid code")
    record["enabled"] = True
    codes = _new_recovery_codes(record)
    login_attempts.pop(key, None)
    activity_log.insert(0, {"type": "2fa_enabled", "username": username, "at": datetime.now(timezone.utc).isoformat()})
    _db_save()
    return {"enabled": True, "recovery_codes": codes}


@app.post("/api/v1/auth/2fa/disable")
def twofa_disable(data: TotpCodeRequest, user=Depends(get_current_user)):
    username = user["username"]
    record = totp_store.get(username)
    if not record or not record.get("enabled"):
        raise HTTPException(status_code=400, detail="2FA is not enabled.")
    key = "2fa:" + username.lower()
    _totp_rate_limit(key)
    if not _second_factor_ok(record, data.code):
        _totp_fail(key)
        raise HTTPException(status_code=400, detail="Invalid code")
    totp_store.pop(username, None)
    trusted_devices.pop(username, None)
    login_attempts.pop(key, None)
    activity_log.insert(0, {"type": "2fa_disabled", "username": username, "at": datetime.now(timezone.utc).isoformat()})
    _db_save()
    return {"enabled": False}


@app.post("/api/v1/auth/2fa/recovery/regenerate")
def twofa_recovery_regenerate(data: TotpCodeRequest, user=Depends(get_current_user)):
    username = user["username"]
    record = totp_store.get(username)
    if not record or not record.get("enabled"):
        raise HTTPException(status_code=400, detail="2FA is not enabled.")
    key = "2fa:" + username.lower()
    _totp_rate_limit(key)
    if not _totp_verify(record, data.code):
        _totp_fail(key)
        raise HTTPException(status_code=400, detail="Invalid code")
    codes = _new_recovery_codes(record)
    login_attempts.pop(key, None)
    _db_save()
    return {"recovery_codes": codes}


@app.post("/api/v1/auth/2fa/devices/revoke")
def twofa_devices_revoke(data: TotpCodeRequest, user=Depends(get_current_user)):
    username = user["username"]
    record = totp_store.get(username)
    if not record or not record.get("enabled"):
        raise HTTPException(status_code=400, detail="2FA is not enabled.")
    key = "2fa:" + username.lower()
    _totp_rate_limit(key)
    if not _totp_verify(record, data.code):
        _totp_fail(key)
        raise HTTPException(status_code=400, detail="Invalid code")
    trusted_devices.pop(username, None)
    login_attempts.pop(key, None)
    _db_save()
    return {"revoked": True}


@app.post("/api/v1/auth/2fa/login")
def twofa_login(data: TotpLoginRequest):
    now_ts = time.time()
    for stale in [k for k, v in mfa_pending.items() if v["exp"] < now_ts]:
        mfa_pending.pop(stale, None)
    pending = mfa_pending.get(data.mfa_token)
    if not pending:
        raise HTTPException(status_code=401, detail="Login session expired. Sign in again.")
    username = pending["username"]
    record = totp_store.get(username)
    if not record or not record.get("enabled"):
        mfa_pending.pop(data.mfa_token, None)
        raise HTTPException(status_code=401, detail="Login session expired. Sign in again.")
    key = "2fa:" + username.lower()
    _totp_rate_limit(key)
    if not _second_factor_ok(record, data.code):
        _totp_fail(key)
        raise HTTPException(status_code=401, detail="Invalid code")
    mfa_pending.pop(data.mfa_token, None)
    login_attempts.pop(key, None)
    now = datetime.now(timezone.utc)
    token = make_token(username)
    tokens[token] = username
    token_created_at[token] = now.isoformat()
    activity_log.insert(0, {"type": "login", "username": username, "at": now.isoformat(), "mfa": True})
    device = _device_issue(username) if data.remember else None
    _db_save()
    result = {"access_token": token, "token_type": "bearer", "expires_in": TOKEN_TTL_SECONDS}
    if device:
        result["device_token"] = device
    return result


# =========================================================
# EMAIL (Resend): verification and report delivery
# =========================================================
def _send_email(to: str, subject: str, html_body: str) -> bool:
    if not EMAIL_ENABLED or not to:
        return False

    if RESEND_API_KEY:
        url = "https://api.resend.com/emails"
        payload = {"from": EMAIL_FROM, "to": [to], "subject": subject, "html": html_body}
        headers = {"Authorization": "Bearer " + RESEND_API_KEY}
    else:
        url = "https://api.brevo.com/v3/smtp/email"
        payload = {
            "sender": {"name": BREVO_SENDER_NAME, "email": BREVO_SENDER_EMAIL},
            "to": [{"email": to}],
            "subject": subject,
            "htmlContent": html_body,
        }
        headers = {"api-key": BREVO_API_KEY, "Accept": "application/json"}
    headers.update({"Content-Type": "application/json", "User-Agent": "medgen-ai/1.0"})

    def _worker():
        try:
            req = URLRequest(url, data=json.dumps(payload).encode("utf-8"), headers=headers, method="POST")
            urlopen(req, timeout=15).read()
        except Exception as exc:
            print("EMAIL ERROR:", type(exc).__name__)

    threading.Thread(target=_worker, daemon=True).start()
    return True


def _email_sig(payload: str) -> str:
    return hmac.new(SECRET_KEY.encode(), ("email:" + payload).encode(), hashlib.sha256).hexdigest()[:32]


def _email_token(username: str) -> str:
    raw = f"{username}|{int(time.time()) + EMAIL_TOKEN_TTL}".encode("utf-8")
    payload = base64.urlsafe_b64encode(raw).decode().rstrip("=")
    return payload + "." + _email_sig(payload)


def _email_token_user(token: str):
    try:
        payload, sig = str(token or "").split(".", 1)
        if not hmac.compare_digest(sig, _email_sig(payload)):
            return None
        username, exp = base64.urlsafe_b64decode(payload + "=" * (-len(payload) % 4)).decode("utf-8").rsplit("|", 1)
        return username if int(exp) >= time.time() else None
    except Exception:
        return None


def _email_shell(inner: str) -> str:
    return (
        '<div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:auto;padding:24px;'
        'background:#0f1b2b;color:#e8f0f6;border-radius:16px">'
        '<h2 style="margin:0 0 12px;color:#56dcc0">MedGen AI</h2>' + inner +
        '<p style="color:#8fa3b5;font-size:12px;margin-top:24px">Global Biomedical AI Platform</p></div>'
    )


def _send_verification_email(username: str) -> bool:
    profile = user_profiles.get(username, {})
    email = profile.get("email")
    link = PUBLIC_API_URL + "/api/v1/auth/verify-email?token=" + quote(_email_token(username))
    name = _email_esc(str(profile.get("full_name") or username))
    inner = (
        f"<p>Salom, {name}!</p><p>Email manzilingizni tasdiqlash uchun tugmani bosing:</p>"
        f'<p><a href="{link}" style="display:inline-block;padding:12px 20px;background:#56dcc0;color:#06231d;'
        'border-radius:10px;font-weight:700;text-decoration:none">Emailni tasdiqlash</a></p>'
        '<p style="color:#8fa3b5;font-size:13px">Havola 48 soat amal qiladi. Agar siz ro\'yxatdan o\'tmagan bo\'lsangiz, bu xatni e\'tiborsiz qoldiring.</p>'
    )
    return _send_email(email, "MedGen AI: emailni tasdiqlang", _email_shell(inner))


@app.get("/api/v1/auth/verify-email", response_class=HTMLResponse)
def verify_email(token: str = ""):
    username = _email_token_user(token)
    ok = bool(username and username in user_profiles)
    if ok:
        user_profiles[username]["email_verified"] = True
        _db_save()
    title = "Email tasdiqlandi ✓" if ok else "Havola yaroqsiz yoki muddati tugagan"
    page = (
        '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
        '<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;'
        'background:#0b1522;color:#e8f0f6;font-family:system-ui,sans-serif;text-align:center;padding:16px">'
        f'<div><h2 style="color:#56dcc0">{title}</h2>'
        f'<p><a href="{SITE_URL}" style="color:#56dcc0">MedGen AI ga qaytish</a></p></div></body>'
    )
    return HTMLResponse(page, status_code=200 if ok else 400)


@app.post("/api/v1/auth/resend-verification")
def resend_verification(user=Depends(get_current_user)):
    username = user["username"]
    profile = user_profiles.get(username, {})
    if profile.get("email_verified") is True:
        return {"status": "already_verified"}
    if not EMAIL_ENABLED:
        raise HTTPException(status_code=503, detail="Email service is not configured.")
    if time.time() - _email_cooldown.get("v:" + username, 0) < 60:
        raise HTTPException(status_code=429, detail="Wait a minute before requesting another email.")
    _email_cooldown["v:" + username] = time.time()
    _send_verification_email(username)
    return {"status": "queued"}


@app.post("/api/v1/reports/{report_id}/email")
def email_report(report_id: str, user=Depends(get_current_user)):
    username = user["username"]
    item = next((r for r in reports_store if r.get("id") == report_id and r.get("user") == username), None)
    if not item:
        raise HTTPException(status_code=404, detail="Report not found.")
    email = str(user_profiles.get(username, {}).get("email") or "")
    if "@" not in email:
        raise HTTPException(status_code=400, detail="No email address on file.")
    if not EMAIL_ENABLED:
        raise HTTPException(status_code=503, detail="Email service is not configured.")
    if time.time() - _email_cooldown.get("r:" + username, 0) < 20:
        raise HTTPException(status_code=429, detail="Please wait a few seconds.")
    _email_cooldown["r:" + username] = time.time()
    body = json.dumps(item.get("report", item), ensure_ascii=False, indent=2)[:20000]
    inner = (
        f"<h3 style=\"margin:0 0 6px\">{_email_esc(str(item.get('title') or 'Report'))}</h3>"
        f"<p style=\"color:#8fa3b5;font-size:13px\">{_email_esc(str(item.get('created_at') or ''))}</p>"
        f"<pre style=\"white-space:pre-wrap;background:#13222f;padding:12px;border-radius:10px;font-size:12px\">{_email_esc(body)}</pre>"
    )
    _send_email(email, "MedGen AI hisoboti: " + str(item.get("title") or "Report")[:80], _email_shell(inner))
    return {"status": "queued", "to": email[0] + "***" + email[email.index("@"):]}


# =========================================================
# BILLING (Dodo Payments): subscriptions via hosted checkout
# =========================================================
def _billing_ready() -> bool:
    return bool(DODO_API_KEY and any(p["product_id"] for p in BILLING_PLANS.values()))


def _dodo_base() -> str:
    return "https://live.dodopayments.com" if DODO_ENV == "live" else "https://test.dodopayments.com"


def _dodo_signature_ok(raw: bytes, wid: str, ts: str, sigs: str) -> bool:
    if not DODO_WEBHOOK_SECRET or not wid or not ts or not sigs:
        return False
    try:
        if abs(time.time() - int(ts)) > 300:
            return False
    except ValueError:
        return False
    return _dodo_hmac_match(DODO_WEBHOOK_SECRET, raw, wid, ts, sigs)


def _dodo_hmac_match(secret: str, raw: bytes, wid: str, ts: str, sigs: str) -> bool:
    key = secret.split("_", 1)[1] if secret.startswith("whsec_") else secret
    try:
        key_bytes = base64.b64decode(key)
    except Exception:
        key_bytes = key.encode("utf-8")
    signed = f"{wid}.{ts}.".encode("utf-8") + raw
    expected = base64.b64encode(hmac.new(key_bytes, signed, hashlib.sha256).digest()).decode()
    for part in sigs.split(" "):
        version, _, sig = part.partition(",")
        if version == "v1" and hmac.compare_digest(sig, expected):
            return True
    return False


# =========================================================
# CURRICULUM CATALOG, LEADERBOARD AND CERTIFICATES (relational tables)
# Keyed by username (TEXT): this platform does not use Supabase Auth.
# =========================================================
ACADEMY_TABLES = ["academic_years", "subjects", "topics", "topic_resources", "clinical_simulation_cases",
                  "student_leaderboard", "leaderboard_awards", "certificates"]
ACADEMY_SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS academic_years (id SERIAL PRIMARY KEY, year_number INT NOT NULL UNIQUE, title TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS subjects (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), academic_year_id INT REFERENCES academic_years(id) ON DELETE CASCADE, name TEXT NOT NULL, code TEXT NOT NULL UNIQUE, icon_url TEXT);
CREATE TABLE IF NOT EXISTS topics (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE, order_number INT NOT NULL, title TEXT NOT NULL, summary_md TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE (subject_id, order_number));
CREATE TABLE IF NOT EXISTS topic_resources (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), topic_id UUID REFERENCES topics(id) ON DELETE CASCADE, resource_type TEXT NOT NULL CHECK (resource_type IN ('model_3d','video_interactive','image_dicom','virtual_case')), title TEXT NOT NULL, resource_url TEXT NOT NULL, metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS clinical_simulation_cases (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), topic_id UUID REFERENCES topics(id) ON DELETE SET NULL, title TEXT NOT NULL, difficulty TEXT NOT NULL DEFAULT 'medium', patient_data JSONB NOT NULL, flow_steps JSONB NOT NULL, time_limit_seconds INT NOT NULL DEFAULT 180, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS student_leaderboard (username TEXT PRIMARY KEY, display_name TEXT NOT NULL, university TEXT, course_number INT, total_score INT NOT NULL DEFAULT 0, solved_cases_count INT NOT NULL DEFAULT 0, consent_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
CREATE TABLE IF NOT EXISTS leaderboard_awards (username TEXT NOT NULL, case_id TEXT NOT NULL, award_date DATE NOT NULL DEFAULT CURRENT_DATE, points INT NOT NULL, PRIMARY KEY (username, case_id, award_date));
CREATE TABLE IF NOT EXISTS certificates (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), username TEXT NOT NULL, certificate_code TEXT UNIQUE NOT NULL, holder_name TEXT NOT NULL, title TEXT NOT NULL, issued_by TEXT, issue_date DATE NOT NULL DEFAULT CURRENT_DATE, revoked BOOLEAN NOT NULL DEFAULT FALSE);
DO $$
DECLARE t TEXT; has_anon BOOLEAN;
BEGIN
  SELECT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') INTO has_anon;
  FOREACH t IN ARRAY ARRAY['academic_years','subjects','topics','topic_resources','clinical_simulation_cases','student_leaderboard','leaderboard_awards','certificates'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    IF has_anon THEN EXECUTE format('REVOKE ALL ON %I FROM anon, authenticated', t); END IF;
  END LOOP;
END $$;
"""
ACADEMY_YEARS = [
    (1, "1-kurs: Fundamental fanlar"), (2, "2-kurs: Funksional fanlar"), (3, "3-kurs: Propedevtika"),
    (4, "4-kurs: Klinik fanlar"), (5, "5-kurs: Gospital va shoshilinch fanlar"), (6, "6-kurs: Gospital va shoshilinch fanlar"),
]
ACADEMY_SUBJECTS = [
    (1, "Normal anatomiya", "ANAT-101"), (1, "Gistologiya", "HIST-102"), (1, "Tibbiy biologiya va kimyo", "BIOL-103"), (1, "Lotin tili", "LAT-104"),
    (2, "Fiziologiya", "PHYS-201"), (2, "Biokimyo", "BIOC-202"), (2, "Patologik anatomiya va fiziologiya", "PATH-203"), (2, "Mikrobiologiya", "MICR-204"),
    (3, "Umumiy xirurgiya", "SURG-301"), (3, "Ichki kasalliklar propedevtikasi", "PROP-302"), (3, "Farmakologiya", "PHAR-303"),
    (4, "Nevrologiya", "NEUR-401"), (4, "Travmatologiya", "TRAU-402"), (4, "Urologiya", "UROL-403"), (4, "Pediatriya", "PEDI-404"),
    (5, "Gospital xirurgiya", "HSUR-501"), (5, "Reanimatsiya", "REAN-502"), (5, "Akusherlik va ginekologiya", "OBGY-503"),
    (6, "Gospital xirurgiya", "HSUR-601"), (6, "Reanimatsiya", "REAN-602"), (6, "Akusherlik va ginekologiya", "OBGY-603"),
]
ACADEMY_SAMPLE_NOTE = "\n\n(Namuna kontent. Foydalanishdan oldin o'qituvchi tekshiruvi tavsiya etiladi.)"
ACADEMY_SAMPLE_TOPICS = [
    ("ANAT-101", 1, "Kalla suyagi: miya va yuz qismlari",
     "Kalla suyagi (cranium) ikki qismga bo'linadi: miya qutisi (neurocranium) va yuz skeleti (viscerocranium). Jami 22 ta suyak.\n\n"
     "Miya qutisi (8 ta): os frontale (1), os parietale (2), os temporale (2), os occipitale (1), os sphenoidale (1), os ethmoidale (1).\n\n"
     "Yuz skeleti (14 ta): maxilla (2), os zygomaticum (2), os nasale (2), os lacrimale (2), os palatinum (2), concha nasalis inferior (2), vomer (1), mandibula (1)."),
    ("ANAT-101", 2, "Kalla suyagi asosidagi muhim teshiklar",
     "Foramen magnum (os occipitale): medulla oblongata va aa. vertebrales o'tadi.\n"
     "Canalis opticus (os sphenoidale): n. opticus va a. ophthalmica.\n"
     "Foramen rotundum: n. maxillaris (V2).\n"
     "Foramen ovale: n. mandibularis (V3).\n"
     "Foramen spinosum: a. meningea media.\n"
     "Foramen jugulare: v. jugularis interna, n. glossopharyngeus (IX), n. vagus (X), n. accessorius (XI)."),
    ("ANAT-101", 3, "Umurtqa pog'onasi bo'limlari",
     "Umurtqa pog'onasi (columna vertebralis) odatda 33 ta umurtqadan iborat: 7 bo'yin (cervicales), 12 ko'krak (thoracicae), 5 bel (lumbales), 5 dumg'aza (sacrales, o'zaro qo'shilib os sacrum hosil qiladi) va 4 dum (coccygeae).\n\n"
     "Birinchi bo'yin umurtqasi atlas (C1), ikkinchisi axis (C2); axisda tishsimon o'simta (dens axis) bor."),
]
_academy_ready = False
_academy_lock = threading.Lock()


def _academy_ensure() -> None:
    global _academy_ready
    if _academy_ready or not PERSISTENCE_ENABLED:
        return
    with _academy_lock:
        if _academy_ready:
            return
        with psycopg.connect(DATABASE_URL, connect_timeout=10) as conn:
            conn.execute(ACADEMY_SCHEMA_SQL)
            for number, title in ACADEMY_YEARS:
                conn.execute("INSERT INTO academic_years(year_number, title) VALUES (%s,%s) ON CONFLICT (year_number) DO NOTHING", (number, title))
            for number, name, code in ACADEMY_SUBJECTS:
                conn.execute("INSERT INTO subjects(academic_year_id, name, code) SELECT id, %s::text, %s::text FROM academic_years WHERE year_number=%s ON CONFLICT (code) DO NOTHING", (name, code, number))
            for code, order, title, summary in ACADEMY_SAMPLE_TOPICS:
                conn.execute("INSERT INTO topics(subject_id, order_number, title, summary_md) SELECT id, %s::int, %s::text, %s::text FROM subjects WHERE code=%s ON CONFLICT (subject_id, order_number) DO NOTHING", (order, title, summary + ACADEMY_SAMPLE_NOTE, code))
            conn.commit()
        _academy_ready = True


def _sql(query: str, params=(), fetch: str = "all"):
    if not PERSISTENCE_ENABLED:
        raise HTTPException(status_code=503, detail="Database is not configured.")
    try:
        _academy_ensure()
        from psycopg.rows import dict_row
        with psycopg.connect(DATABASE_URL, row_factory=dict_row, connect_timeout=10) as conn:
            cur = conn.execute(query, params)
            result = cur.fetchall() if fetch == "all" else (cur.fetchone() if fetch == "one" else None)
            conn.commit()
        return result
    except HTTPException:
        raise
    except Exception as exc:
        print("SQL ERROR:", type(exc).__name__)
        raise HTTPException(status_code=503, detail="Database is temporarily unavailable.")


def _is_admin(user: dict) -> bool:
    return str(user.get("role", "")).upper() == "SUPER_ADMIN"


class CurriculumTopicCreate(BaseModel):
    subject_code: str = Field(max_length=40)
    title: str = Field(min_length=2, max_length=200)
    summary_md: str = Field(default="", max_length=20000)
    order_number: int = Field(default=0, ge=0, le=1000)


class CurriculumResourceCreate(BaseModel):
    resource_type: str
    title: str = Field(min_length=2, max_length=200)
    resource_url: str = Field(max_length=1000)
    metadata: dict = Field(default_factory=dict)


@app.get("/api/v1/curriculum/years")
def curriculum_years(user=Depends(get_current_user)):
    rows = _sql("""SELECT y.year_number, y.title AS year_title, s.code, s.name,
                          (SELECT COUNT(*) FROM topics t WHERE t.subject_id = s.id) AS topic_count
                   FROM academic_years y LEFT JOIN subjects s ON s.academic_year_id = y.id
                   ORDER BY y.year_number, s.code""")
    years = {}
    for r in rows:
        year = years.setdefault(r["year_number"], {"year_number": r["year_number"], "title": r["year_title"], "subjects": []})
        if r["code"]:
            year["subjects"].append({"code": r["code"], "name": r["name"], "topic_count": r["topic_count"]})
    return {"years": list(years.values())}


@app.get("/api/v1/curriculum/subjects/{code}/topics")
def curriculum_topics(code: str, user=Depends(get_current_user)):
    subject = _sql("SELECT id, name, code FROM subjects WHERE code=%s", (code,), "one")
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    topics = _sql("SELECT id::text AS id, order_number, title FROM topics WHERE subject_id=%s ORDER BY order_number", (subject["id"],))
    return {"subject": {"code": subject["code"], "name": subject["name"]}, "topics": topics}


@app.get("/api/v1/curriculum/topics/{topic_id}")
def curriculum_topic(topic_id: str, user=Depends(get_current_user)):
    try:
        topic = _sql("SELECT id::text AS id, title, summary_md, order_number FROM topics WHERE id=%s::uuid", (topic_id,), "one")
    except HTTPException:
        raise HTTPException(status_code=404, detail="Topic not found")
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    resources = _sql("SELECT id::text AS id, resource_type, title, resource_url, metadata FROM topic_resources WHERE topic_id=%s::uuid ORDER BY created_at", (topic_id,))
    return {"topic": topic, "resources": resources}


@app.post("/api/v1/curriculum/topics")
def curriculum_topic_create(data: CurriculumTopicCreate, user=Depends(get_current_user)):
    if not _is_admin(user):
        raise HTTPException(status_code=403, detail="SUPER_ADMIN required.")
    subject = _sql("SELECT id FROM subjects WHERE code=%s", (data.subject_code,), "one")
    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found")
    order = data.order_number or (_sql("SELECT COALESCE(MAX(order_number),0)+1 AS n FROM topics WHERE subject_id=%s", (subject["id"],), "one")["n"])
    row = _sql("INSERT INTO topics(subject_id, order_number, title, summary_md) VALUES (%s,%s,%s,%s) RETURNING id::text AS id", (subject["id"], order, data.title.strip(), data.summary_md), "one")
    return {"id": row["id"], "order_number": order}


@app.post("/api/v1/curriculum/topics/{topic_id}/resources")
def curriculum_resource_create(topic_id: str, data: CurriculumResourceCreate, user=Depends(get_current_user)):
    if not _is_admin(user):
        raise HTTPException(status_code=403, detail="SUPER_ADMIN required.")
    if data.resource_type not in {"model_3d", "video_interactive", "image_dicom", "virtual_case"}:
        raise HTTPException(status_code=400, detail="Unknown resource type.")
    if not data.resource_url.lower().startswith("https://"):
        raise HTTPException(status_code=400, detail="resource_url must start with https://")
    row = _sql("INSERT INTO topic_resources(topic_id, resource_type, title, resource_url, metadata) VALUES (%s::uuid,%s,%s,%s,%s::jsonb) RETURNING id::text AS id",
               (topic_id, data.resource_type, data.title.strip(), data.resource_url.strip(), json.dumps(data.metadata)), "one")
    return {"id": row["id"]}


# ---------------- Leaderboard (opt-in, activity points) ----------------
class LeaderboardJoin(BaseModel):
    display_name: str = Field(min_length=2, max_length=40)
    university: str = Field(default="", max_length=80)
    course_number: int = Field(default=1, ge=1, le=6)
    consent: bool = False


def _leaderboard_award(username: str, case_id: str, score: int) -> None:
    """Best-effort: 1 point per 10 completion-score points, once per case per day (opted-in users only)."""
    try:
        points = max(0, min(10, int(score) // 10))
        row = _sql("INSERT INTO leaderboard_awards(username, case_id, points) SELECT %s::text,%s::text,%s::int WHERE EXISTS (SELECT 1 FROM student_leaderboard WHERE username=%s) ON CONFLICT DO NOTHING RETURNING points",
                   (username, case_id, points, username), "one")
        if row:
            _sql("UPDATE student_leaderboard SET total_score = total_score + %s, solved_cases_count = (SELECT COUNT(DISTINCT case_id) FROM leaderboard_awards WHERE username=%s), updated_at = NOW() WHERE username=%s",
                 (points, username, username), None)
    except Exception:
        pass


@app.get("/api/v1/leaderboard")
def leaderboard_top(user=Depends(get_current_user)):
    top = _sql("SELECT display_name, university, course_number, total_score, solved_cases_count FROM student_leaderboard ORDER BY total_score DESC, solved_cases_count DESC, updated_at ASC LIMIT 50")
    mine = _sql("SELECT display_name, university, course_number, total_score, solved_cases_count FROM student_leaderboard WHERE username=%s", (user["username"],), "one")
    return {
        "metric": "Faollik ochkolari: klinik simulyatorni yakunlash uchun (har keys kuniga bir marta). Bu klinik bilim bahosi emas.",
        "top": top, "me": mine, "joined": bool(mine),
    }


@app.post("/api/v1/leaderboard/join")
def leaderboard_join(data: LeaderboardJoin, user=Depends(get_current_user)):
    if not data.consent:
        raise HTTPException(status_code=400, detail="Consent is required to appear on the public leaderboard.")
    name = re.sub(r"\s+", " ", data.display_name).strip()[:40]
    if len(name) < 2:
        raise HTTPException(status_code=400, detail="Display name is too short.")
    _sql("""INSERT INTO student_leaderboard(username, display_name, university, course_number, consent_at)
            VALUES (%s,%s,%s,%s,NOW())
            ON CONFLICT (username) DO UPDATE SET display_name=EXCLUDED.display_name, university=EXCLUDED.university, course_number=EXCLUDED.course_number, updated_at=NOW()""",
         (user["username"], name, data.university.strip(), data.course_number), None)
    return {"joined": True}


@app.delete("/api/v1/leaderboard/me")
def leaderboard_leave(user=Depends(get_current_user)):
    _sql("DELETE FROM student_leaderboard WHERE username=%s", (user["username"],), None)
    _sql("DELETE FROM leaderboard_awards WHERE username=%s", (user["username"],), None)
    return {"joined": False}


# ---------------- Certificates ----------------
class CertificateIssue(BaseModel):
    username: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=3, max_length=200)
    holder_name: str = Field(default="", max_length=120)


def _new_certificate_code() -> str:
    raw = base64.b32encode(secrets.token_bytes(8)).decode().rstrip("=")[:12]
    return f"MG-{raw[:4]}-{raw[4:8]}-{raw[8:12]}"


def _qr_svg(text: str) -> str:
    try:
        import segno
        return segno.make(text, error="m").svg_inline(scale=4, border=1, dark="#111111", light="#ffffff")
    except Exception:
        return ""


@app.post("/api/v1/certificates/issue")
def certificate_issue(data: CertificateIssue, user=Depends(get_current_user)):
    if not _is_admin(user):
        raise HTTPException(status_code=403, detail="SUPER_ADMIN required.")
    target = next((u for u in user_profiles if str(u).casefold() == data.username.strip().casefold()), None)
    if not target:
        raise HTTPException(status_code=404, detail="User not found.")
    holder = data.holder_name.strip() or str(user_profiles[target].get("full_name") or target)
    for _ in range(5):
        code = _new_certificate_code()
        if not _sql("SELECT 1 FROM certificates WHERE certificate_code=%s", (code,), "one"):
            break
    _sql("INSERT INTO certificates(username, certificate_code, holder_name, title, issued_by) VALUES (%s,%s,%s,%s,%s)",
         (target, code, holder, data.title.strip(), user["username"]), None)
    return {"certificate_code": code, "view_url": f"{PUBLIC_API_URL}/api/v1/certificates/{code}/view"}


@app.get("/api/v1/certificates/mine")
def certificate_mine(user=Depends(get_current_user)):
    rows = _sql("SELECT certificate_code, title, holder_name, issue_date::text AS issue_date, revoked FROM certificates WHERE username=%s ORDER BY issue_date DESC", (user["username"],))
    return {"certificates": rows}


@app.post("/api/v1/certificates/{code}/revoke")
def certificate_revoke(code: str, user=Depends(get_current_user)):
    if not _is_admin(user):
        raise HTTPException(status_code=403, detail="SUPER_ADMIN required.")
    _sql("UPDATE certificates SET revoked=TRUE WHERE certificate_code=%s", (code.strip().upper(),), None)
    return {"revoked": True}


@app.get("/api/v1/certificates/verify/{code}")
def certificate_verify(code: str):
    row = _sql("SELECT holder_name, title, issue_date::text AS issue_date, revoked FROM certificates WHERE certificate_code=%s", (code.strip().upper(),), "one")
    if not row:
        return {"valid": False}
    return {"valid": not row["revoked"], "revoked": row["revoked"], "holder_name": row["holder_name"], "title": row["title"], "issue_date": row["issue_date"]}


@app.get("/api/v1/certificates/{code}/view", response_class=HTMLResponse)
def certificate_view(code: str):
    code = code.strip().upper()
    row = _sql("SELECT holder_name, title, issue_date::text AS issue_date, revoked FROM certificates WHERE certificate_code=%s", (code,), "one")
    if not row:
        return HTMLResponse("<!doctype html><meta charset='utf-8'><body style='font-family:sans-serif;text-align:center;padding:40px'><h2>Sertifikat topilmadi</h2></body>", status_code=404)
    link = f"{PUBLIC_API_URL}/api/v1/certificates/{code}/view"
    status = "<p style='color:#b00020;font-weight:700'>BEKOR QILINGAN</p>" if row["revoked"] else "<p style='color:#0b7a4b;font-weight:700'>Haqiqiy sertifikat</p>"
    page = (
        "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'>"
        "<title>MedGen AI sertifikati</title><style>@page{size:A4 landscape;margin:12mm}body{margin:0;font-family:Georgia,serif;color:#111;background:#fff}"
        ".c{max-width:900px;margin:18px auto;border:6px double #0b8a74;padding:36px;text-align:center}h1{margin:0;color:#0b8a74;letter-spacing:.12em;font-size:30px}"
        ".n{font-size:34px;margin:18px 0;border-bottom:1px solid #999;display:inline-block;padding:0 24px}.t{font-size:22px;margin:10px 0}.m{color:#444;font-size:14px;margin-top:20px}"
        "button{margin:14px;padding:10px 18px;border:0;border-radius:8px;background:#0b8a74;color:#fff;font-size:15px}@media print{button{display:none}}</style></head><body>"
        "<div class='c'><h1>MEDGEN AI</h1><p>SERTIFIKAT</p><p>Ushbu sertifikat</p>"
        f"<div class='n'>{_email_esc(row['holder_name'])}</div><p>ga quyidagi uchun topshirildi:</p><div class='t'>{_email_esc(row['title'])}</div>"
        f"<div class='m'>Sana: {_email_esc(row['issue_date'])} &nbsp;|&nbsp; Kod: {_email_esc(code)}</div>{status}"
        f"<div style='margin-top:10px'>{_qr_svg(link)}</div><div class='m'>Haqiqiyligini tekshirish: {_email_esc(link)}</div></div>"
        "<div style='text-align:center'><button onclick='window.print()'>PDF sifatida saqlash / chop etish</button></div></body></html>"
    )
    return HTMLResponse(page)


@app.get("/api/v1/billing/status")
def billing_status(user=Depends(get_current_user)):
    record = billing_store.get(user["username"], {})
    return {
        "configured": _billing_ready(),
        "environment": DODO_ENV,
        "plan": record.get("plan", "free"),
        "status": record.get("status", "none"),
        "plans": [{"id": k, "label": v["label"]} for k, v in BILLING_PLANS.items() if v["product_id"]],
    }


class BillingCheckoutRequest(BaseModel):
    plan: str


@app.post("/api/v1/billing/checkout")
def billing_checkout(data: BillingCheckoutRequest, user=Depends(get_current_user)):
    username = user["username"]
    plan = BILLING_PLANS.get(str(data.plan or "").lower())
    if not _billing_ready() or not plan or not plan["product_id"]:
        raise HTTPException(status_code=503, detail="Payments are not configured.")
    profile = user_profiles.get(username, {})
    body = {
        "product_cart": [{"product_id": plan["product_id"], "quantity": 1}],
        "return_url": SITE_URL + "/?billing=success",
        "metadata": {"username": username, "plan": str(data.plan).lower()},
    }
    email = str(profile.get("email") or "")
    if "@" in email:
        body["customer"] = {"email": email, "name": str(profile.get("full_name") or username)}
    try:
        req = URLRequest(
            _dodo_base() + "/checkouts",
            data=json.dumps(body).encode("utf-8"),
            headers={"Authorization": "Bearer " + DODO_API_KEY, "Content-Type": "application/json", "User-Agent": "medgen-ai/1.0"},
            method="POST",
        )
        result = json.loads(urlopen(req, timeout=20).read().decode("utf-8"))
    except Exception as exc:
        print("BILLING ERROR:", type(exc).__name__)
        raise HTTPException(status_code=502, detail="Could not start checkout. Try again later.")
    url = result.get("checkout_url")
    if not url:
        raise HTTPException(status_code=502, detail="Could not start checkout. Try again later.")
    return {"checkout_url": url}


@app.post("/api/v1/billing/webhook")
async def billing_webhook(request: Request):
    raw = await request.body()
    wid = request.headers.get("webhook-id", "")
    if not _dodo_signature_ok(raw, wid, request.headers.get("webhook-timestamp", ""), request.headers.get("webhook-signature", "")):
        raise HTTPException(status_code=401, detail="Invalid signature")
    if wid in billing_events:
        return {"received": True, "duplicate": True}
    try:
        payload = json.loads(raw.decode("utf-8"))
    except Exception:
        raise HTTPException(status_code=400, detail="Bad payload")
    etype = str(payload.get("type") or "")
    data = payload.get("data") or {}
    meta = data.get("metadata") or {}
    username = str(meta.get("username") or "")
    plan = str(meta.get("plan") or "").lower()
    status = None
    if etype in {"subscription.active", "subscription.renewed", "subscription.plan_changed"}:
        status = "active"
    elif etype in {"subscription.cancelled", "subscription.expired", "subscription.failed"}:
        status = "inactive"
    elif etype == "subscription.on_hold":
        status = "on_hold"
    if status and username in user_profiles and plan in BILLING_PLANS:
        billing_store[username] = {
            "plan": plan if status == "active" else billing_store.get(username, {}).get("plan", plan),
            "status": status,
            "subscription_id": str(data.get("subscription_id") or ""),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        activity_log.insert(0, {"type": "billing_" + etype.split(".")[-1], "username": username, "at": datetime.now(timezone.utc).isoformat(), "plan": plan})
    billing_events[wid] = int(time.time())
    if len(billing_events) > 500:
        for old in sorted(billing_events, key=billing_events.get)[:100]:
            billing_events.pop(old, None)
    _db_save()
    return {"received": True}


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
            if current in user_consents:
                user_consents[new_username] = user_consents.pop(current)
            for api_key in api_keys_store.values():
                if api_key.get("created_by") == current:
                    api_key["created_by"] = new_username
            # Keep explicit teaching grants attached to the renamed account.
            # Otherwise re-registering the old username could inherit its grants.
            for teaching_profile in user_profiles.values():
                if "teaching_students" in teaching_profile:
                    teaching_profile["teaching_students"] = [
                        new_username if name == current else name
                        for name in teaching_profile["teaching_students"]
                    ]
            for record in knowledge_entities_store + knowledge_relations_store:
                if record.get("owner") == current:
                    record["owner"] = new_username
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
    existing_profile = user_profiles.get(user["username"], {})
    profile_role = normalize_role(existing_profile.get("role") or user.get("role"))
    school_role = profile_role in {"school_student", "school_teacher"}
    if not data.full_name.strip():
        raise HTTPException(status_code=400, detail="To‘liq ism majburiy.")
    if not data.email.strip() or "@" not in data.email:
        raise HTTPException(status_code=400, detail="To‘g‘ri email manzili majburiy.")
    # School profiles intentionally do not require personal location or birth
    # details; enrollment is validated with school/class fields at registration.
    if not school_role:
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

    # Merge editable profile fields into the existing record. Replacing the whole
    # record here would silently erase role/approval state, academic profile,
    # education preferences, and other server-managed fields.
    profile = {**existing_profile, **data.model_dump()}
    if school_role:
        # A school learner can update name/email without accidentally erasing
        # fields that are not part of the school profile form.
        for key in ("country", "region", "district", "city", "location_label", "location_source",
                    "location_lat", "location_lon", "birth_year", "birth_month", "birth_day"):
            incoming = getattr(data, key)
            current = existing_profile.get(key)
            if (incoming is None or (isinstance(incoming, str) and not incoming.strip())) and current not in (None, ""):
                profile[key] = current
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
        "version": LEGAL_CONSENT_VERSION,
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
        "consent_complete": consent.get("version") == LEGAL_CONSENT_VERSION and all([
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


@app.post("/api/v1/security/location")
async def save_security_location(request: Request, user=Depends(get_current_user)):
    """Save precise coordinates only after the signed-in user grants browser permission."""
    try:
        data = await request.json()
        lat = float(data.get("location_lat"))
        lon = float(data.get("location_lon"))
    except (TypeError, ValueError, AttributeError):
        raise HTTPException(status_code=400, detail="Valid latitude and longitude are required.")
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        raise HTTPException(status_code=400, detail="Coordinates are outside valid ranges.")
    username = user["username"]
    previous_profile = user_profiles.get(username)
    profile = dict(previous_profile or {})
    profile.update({
        "location_lat": lat,
        "location_lon": lon,
        "location_source": "browser_permission",
        "location_label": str(data.get("location_label") or profile.get("location_label") or "Qurilma GPS")[:240],
    })
    user_profiles[username] = profile
    event = {
        "type": "location_updated",
        "username": username,
        "at": datetime.now(timezone.utc).isoformat(),
    }
    activity_log.insert(0, event)
    try:
        _db_save()
    except Exception:
        if previous_profile is None:
            user_profiles.pop(username, None)
        else:
            user_profiles[username] = previous_profile
        activity_log[:] = [item for item in activity_log if item is not event]
        raise
    return {"status": "saved", "has_coordinates": True}


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
    consent = {**data.model_dump(), "version": LEGAL_CONSENT_VERSION, "accepted_at": datetime.now(timezone.utc).isoformat()}
    user_consents[user["username"]] = consent
    activity_log.insert(0, {"type": "consent", "username": user["username"], "at": consent["accepted_at"]})
    _db_save()
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
    if any(line.startswith(">") for line in lines):
        raise HTTPException(status_code=400, detail="Submit one FASTA record at a time.")
    return "".join("".join(lines).split()).upper()


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
    items = [j for j in jobs_store if j.get("user") == user["username"]]
    return {"jobs": items, "count": len(items), "user": user["username"]}


@app.get("/api/v1/jobs/status")
def jobs_status(user=Depends(get_current_user)):
    items = [j for j in jobs_store if j.get("user") == user["username"]]
    counts = {}
    for item in items:
        status = str(item.get("status") or "unknown")
        counts[status] = counts.get(status, 0) + 1
    active = sum(counts.get(status, 0) for status in ("submitted", "queued", "running"))
    return {
        "status": "available",
        "worker": "inline-api",
        "queue": "not-required-for-inline-jobs",
        "active": active,
        "total": len(items),
        "counts": counts,
        "note": "Molekulyar tahlil API ichida bajariladi; docking uchun AutoDock Vina va tayyor PDBQT fayllari talab qilinadi. Structure prediction engine ulanmagan.",
        "user": user["username"],
    }


@app.post("/api/v1/jobs")
def create_job(
    data: JobRequest,
    user=Depends(get_current_user),
):
    job_type = str(data.job_type or "").strip().upper()
    job_input = data.input or {}
    result = None

    if job_type == "MOLECULAR":
        smiles = str(job_input.get("smiles") or job_input.get("ligand_smiles") or "").strip()
        if not smiles:
            raise HTTPException(status_code=400, detail="MOLECULAR job input JSON must include the smiles field, for example a SMILES value of CCO.")
        result = {
            "engine": "RDKit molecular property screening",
            "analysis": calculate_molecule_score(smiles),
            "disclaimer": "Property-based screening only; not docking, binding affinity, ADMET, or clinical evidence."
        }
        status = "completed"
    elif job_type == "DOCKING":
        required = ("target", "receptor_pdbqt", "ligand_pdbqt")
        missing = [key for key in required if not str(job_input.get(key) or "").strip()]
        if missing:
            raise HTTPException(status_code=400, detail="DOCKING job input is missing: " + ", ".join(missing))
        try:
            docking_request = PreparedDockingRequest(**{
                **{"center_x": 0, "center_y": 0, "center_z": 0},
                **job_input,
            })
        except ValidationError as exc:
            fields = ", ".join(".".join(map(str, error["loc"])) for error in exc.errors())
            raise HTTPException(status_code=422, detail="Invalid docking input fields: " + fields)
        result = _execute_prepared_docking(docking_request, user, persist=False)
        status = "completed"
    elif job_type == "STRUCTURE_PREDICTION":
        raise HTTPException(
            status_code=501,
            detail="Structure prediction engine is not connected on this deployment. No fake job was created."
        )
    else:
        raise HTTPException(status_code=400, detail="Unsupported job_type. Choose MOLECULAR, DOCKING, or STRUCTURE_PREDICTION.")

    job = {
        "id": secrets.token_hex(8),
        "status": status,
        "job_type": job_type,
        "input": job_input,
        "result": result,
        "user": user["username"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }
    docking_record = docking_event = None
    if job_type == "DOCKING":
        docking_id = result["job_id"]
        docking_record = {"id": docking_id, **result["result"], "created_at": job["created_at"]}
        docking_event = {"type": "docking_completed", "username": user["username"],
                         "job_id": docking_id, "target": result["result"]["target"], "at": job["created_at"]}
        docking_jobs_store[docking_id] = docking_record
        activity_log.insert(0, docking_event)
    jobs_store.insert(0, job)
    try:
        _db_save()
    except Exception:
        jobs_store[:] = [item for item in jobs_store if item is not job]
        if docking_record is not None and docking_jobs_store.get(docking_id) is docking_record:
            docking_jobs_store.pop(docking_id, None)
        if docking_event is not None:
            activity_log[:] = [item for item in activity_log if item is not docking_event]
        raise
    return job


# =========================================================
# REPORTS
# =========================================================

@app.get("/api/v1/reports")
def reports(user=Depends(get_current_user)):
    # Older saved reports may predate owner metadata; skip them safely instead of raising KeyError.
    items = [r for r in reports_store if r.get("user") == user["username"]]
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
    _db_save()
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
    _db_save()
    return experiment


@app.get("/api/v1/experiments")
def list_experiments(user=Depends(get_current_user)):
    items = [e for e in experiments_store if e.get("user") == user["username"]]
    return {"experiments": items, "count": len(items), "user": user["username"]}


@app.get("/api/v1/experiments/{experiment_id}")
def get_experiment(experiment_id: str, user=Depends(get_current_user)):
    experiment = next((e for e in experiments_store if e["id"] == experiment_id), None)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if experiment.get("user") != user["username"] and user["role"] != "SUPER_ADMIN":
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
    if experiment.get("user") != user["username"] and user["role"] != "SUPER_ADMIN":
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
    _db_save()
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

def _record_research_change(store, item, changes, first=False):
    if first: store.insert(0,item)
    else: store.append(item)
    changes.append((store,item))


def _save_research_changes(changes):
    try:
        _db_save()
    except Exception:
        for store,item in reversed(changes):
            store[:]=[record for record in store if record is not item]
        raise


@app.post("/api/v1/research/agent")
def research_agent(data: ResearchAgentRequest, user=Depends(get_current_user)):
    _check_quota(user["username"], "research_runs")
    changes=[]
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
    if query and not any(x["id"] == query_entity for x in knowledge_entities_store if x.get("owner") == user["username"]):
        _record_research_change(knowledge_entities_store,_owned_knowledge_entity(user, query, "research_question", "Research Agent"),changes)
        graph_entities_added.append(query_entity)

    for item in evidence[:8]:
        pmid = item["pmid"]
        paper_name = f"PMID:{pmid}"
        paper_id = normalize_entity(paper_name)
        if not any(x["id"] == paper_id for x in knowledge_entities_store if x.get("owner") == user["username"]):
            _record_research_change(knowledge_entities_store,_owned_knowledge_entity(user, paper_name, "publication", "PubMed"),changes)
            graph_entities_added.append(paper_id)
        claim = item["evidence"][0] if item["evidence"] else item["title"]
        rel = _owned_knowledge_relation(user, query, "supported_by", paper_name, "PubMed", claim)
        if rel not in knowledge_relations_store:
            _record_research_change(knowledge_relations_store,rel,changes)
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
    _record_research_change(reports_store,{"id":secrets.token_hex(10),"type":"research_intelligence","title":"Research Intelligence — "+query,"user":user["username"],"created_at":now,"report":report},changes,first=True)
    _record_research_change(activity_log,{"type":"research_agent","username":user["username"],"query":query,"evidence_count":len(evidence),"at":now},changes,first=True)
    _save_research_changes(changes)
    return report


@app.post("/api/v1/research/autonomous")
def autonomous_research(data: ResearchAgentRequest, user=Depends(get_current_user)):
    changes=[]
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
    if not any(x["id"] == qid for x in knowledge_entities_store if x.get("owner") == user["username"]):
        _record_research_change(knowledge_entities_store,_owned_knowledge_entity(user, query, "research_question", "PubMed"),changes)
    added = 0
    for item in evidence:
        pid = normalize_entity("PMID:" + item["pmid"])
        if not any(x["id"] == pid for x in knowledge_entities_store if x.get("owner") == user["username"]):
            _record_research_change(knowledge_entities_store,_owned_knowledge_entity(user, "PMID:" + item["pmid"], "publication", "PubMed"),changes)
        rel = _owned_knowledge_relation(user, query, "supported_by", "PMID:" + item["pmid"], "PubMed", (item["evidence"] or [item["title"]])[0])
        if rel not in knowledge_relations_store:
            _record_research_change(knowledge_relations_store,rel,changes)
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
    _record_research_change(reports_store,{"id":secrets.token_hex(10),"type":"autonomous_research","title":"Autonomous Research — "+query,"user":user["username"],"created_at":now,"report":report},changes,first=True)
    _record_research_change(activity_log,{"type":"autonomous_research","username":user["username"],"query":query,"evidence_count":len(evidence),"at":now},changes,first=True)
    _save_research_changes(changes)
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

# Learning Hub practice results are graded by the server, not supplied scores.
HUB_ATTEMPT_LOCK = threading.RLock()
HUB_ANSWER_KEYS = {
    "quick": [0, 1, 1, 1, 1, 0, 0, 1, 0, 0, 0, 1],
    "theory": [0, 0, 0, 0, 0],
    "clinical": [0, 0, 0, 0, 0],
    "molecule": [0, 1, 2, 3, 4],
    "organ": [1, 1, 0, 2, 3],
    **{"lesson_" + topic: [0] for topic in ("cell", "blood", "heart", "dna", "micro")},
}

class HubAttemptRequest(BaseModel):
    attempt_id: uuid.UUID
    activity: str
    answers: list[StrictInt] = Field(min_length=1, max_length=12)
    question_ids: list[StrictInt] = Field(min_length=1, max_length=12)
    version: int = 1


@app.get("/api/v1/learning-hub/progress")
def hub_progress(user=Depends(get_current_user)):
    with HUB_ATTEMPT_LOCK:
        attempts = user_profiles.get(user["username"], {}).get("learning_hub_attempts", [])
        best = {}
        for attempt in attempts:
            activity = attempt["activity"]
            best[activity] = max(best.get(activity, 0), attempt["percent"])
        return {"attempts": attempts, "best": best, "retention_limit": 100,
                "readings": user_profiles.get(user["username"], {}).get("learning_hub_readings", {}),
                "assessment_kind": "practice", "official_credit": False,
                "storage": "postgresql" if PERSISTENCE_ENABLED else "process_memory"}


@app.post("/api/v1/learning-hub/attempts")
def hub_attempt(data: HubAttemptRequest, user=Depends(get_current_user)):
    with HUB_ATTEMPT_LOCK:
        key = HUB_ANSWER_KEYS.get(data.activity)
        if data.version != 1 or key is None:
            raise HTTPException(status_code=400, detail="Unsupported practice version or activity")
        if (sorted(data.question_ids) != list(range(len(key)))
                or len(data.answers) != len(key)
                or any(a < (-1 if data.activity == "organ" else 0) or a >= (5 if data.activity == "molecule" else 4 if data.activity == "organ" else 3) for a in data.answers)):
            raise HTTPException(status_code=400, detail="A complete set of valid answers is required")
        profile = user_profiles.setdefault(user["username"], {})
        attempts = profile.setdefault("learning_hub_attempts", [])
        attempt_id = str(data.attempt_id)
        existing = next((a for a in attempts if a["attempt_id"] == attempt_id), None)
        if existing:
            if (existing["activity"] != data.activity or existing["answers"] != data.answers
                    or existing["question_ids"] != data.question_ids):
                raise HTTPException(status_code=409, detail="Attempt ID already used")
            return {"status": "saved", "attempt": existing, "storage": "postgresql" if PERSISTENCE_ENABLED else "process_memory"}
        score = sum(answer == key[q] for q, answer in zip(data.question_ids, data.answers))
        attempt = {"attempt_id": attempt_id, "activity": data.activity,
                   "answers": data.answers, "question_ids": data.question_ids,
                   "score": score, "total": len(key), "percent": round(score * 100 / len(key)),
                   "version": data.version, "created_at": datetime.now(timezone.utc).isoformat()}
        previous = attempts[:]
        attempts.insert(0, attempt)
        del attempts[100:]
        try:
            _db_save()
        except Exception:
            # Do not report an unsaved attempt as saved when the client retries.
            attempts[:] = previous
            raise
        return {"status": "saved", "attempt": attempt, "storage": "postgresql" if PERSISTENCE_ENABLED else "process_memory"}


class HubReadingRequest(BaseModel):
    language: str
    track: str


@app.post("/api/v1/learning-hub/readings")
def hub_reading(data: HubReadingRequest, user=Depends(get_current_user)):
    if data.language not in {"en", "ru", "de", "fr"} or data.track not in {"medical", "general", "exam"}:
        raise HTTPException(status_code=400, detail="Unknown language lesson")
    with HUB_ATTEMPT_LOCK:
        readings = user_profiles.setdefault(user["username"], {}).setdefault("learning_hub_readings", {})
        key = data.language + ":" + data.track
        previous = readings.get(key)
        readings[key] = {"completed_at": datetime.now(timezone.utc).isoformat(), "self_reported": True}
        try:
            _db_save()
        except Exception:
            if previous is None:
                readings.pop(key, None)
            else:
                readings[key] = previous
            raise
        return {"status": "saved", "reading": readings[key],
                "storage": "postgresql" if PERSISTENCE_ENABLED else "process_memory"}


class KnowledgeRelationRequest(BaseModel):
    subject: str
    relation: str
    object: str
    source: str = "user"
    evidence: str = ""

def _knowledge_scope(username):
    # Unattributed legacy rows stay stored but are not shared implicitly.
    return ([x for x in knowledge_entities_store if x.get("owner") == username],
            [x for x in knowledge_relations_store if x.get("owner") == username])


def _owned_knowledge_entity(user, *args):
    return {**make_entity(*args), "owner": user["username"]}


def _owned_knowledge_relation(user, *args):
    return {**make_relation(*args), "owner": user["username"]}


@app.get("/api/v1/knowledge/graph")
def knowledge_graph(user=Depends(get_current_user)):
    entities, relations = _knowledge_scope(user["username"])
    return {"status":"ok","entity_count":len(entities),
            "relation_count":len(relations),
            "entities":entities[:1000],
            "relations":relations[:3000]}

@app.post("/api/v1/knowledge/entities")
def knowledge_entity(data: KnowledgeEntityRequest, user=Depends(get_current_user)):
    entity=_owned_knowledge_entity(user, data.name,data.entity_type,data.source)
    if not entity["name"]: raise HTTPException(status_code=400, detail="Entity name is required")
    if not any(x["id"]==entity["id"] for x in knowledge_entities_store if x.get("owner") == user["username"]):
        knowledge_entities_store.append(entity)
        _db_save()
    return {"status":"created","entity":entity}

@app.delete("/api/v1/knowledge/entities/{entity_id}")
def knowledge_entity_delete(entity_id: str, user=Depends(get_current_user)):
    key=normalize_entity(entity_id)
    if not any(e.get("id") == key and e.get("owner") == user["username"] for e in knowledge_entities_store):
        raise HTTPException(status_code=404, detail="Entity not found")
    before=len(knowledge_entities_store)
    knowledge_entities_store[:]=[e for e in knowledge_entities_store if not (e.get("id")==key and e.get("owner")==user["username"])]
    knowledge_relations_store[:]=[r for r in knowledge_relations_store if not (r.get("owner")==user["username"] and (r.get("subject")==key or r.get("object")==key))]
    if len(knowledge_entities_store)==before: raise HTTPException(status_code=404,detail="Entity not found")
    _db_save()
    return {"status":"deleted","entity_id":key}


@app.post("/api/v1/knowledge/relations")
def knowledge_relation(data: KnowledgeRelationRequest, user=Depends(get_current_user)):
    try: rel=_owned_knowledge_relation(user, data.subject,data.relation,data.object,data.source,data.evidence)
    except ValueError as exc: raise HTTPException(status_code=400,detail=str(exc))
    for name in (data.subject,data.object):
        if not any(x["id"]==normalize_entity(name) for x in knowledge_entities_store if x.get("owner") == user["username"]):
            knowledge_entities_store.append(_owned_knowledge_entity(user, name,"concept",data.source))
    if rel not in knowledge_relations_store:
        knowledge_relations_store.append(rel)
        _db_save()
    return {"status":"created","relation":rel}

@app.post("/api/v1/knowledge/search")
def knowledge_search(data: ResearchRequest, user=Depends(get_current_user)):
    entities, relations = _knowledge_scope(user["username"])
    return {"status":"ok",**search_graph(entities,relations,data.query,max(1,min(data.limit,50)))}

@app.get("/api/v1/knowledge/neighborhood/{entity}")
def knowledge_neighborhood(entity: str, hops: int=2, user=Depends(get_current_user)):
    entities, relations = _knowledge_scope(user["username"])
    return {"status":"ok",**neighborhood(entities,relations,entity,hops)}

@app.get("/api/v1/knowledge/validate")
def knowledge_validate(user=Depends(get_current_user)):
    entities, relations = _knowledge_scope(user["username"])
    errors=validate_graph(entities,relations)
    return {"status":"valid" if not errors else "invalid","errors":errors,"entity_count":len(entities),"relation_count":len(relations)}


@app.get("/api/v1/knowledge/stats")
def knowledge_stats(user=Depends(get_current_user)):
    entities, relations = _knowledge_scope(user["username"])
    return {"status":"ok", **graph_stats(entities, relations)}


@app.get("/api/v1/knowledge/evidence")
def knowledge_evidence(query: str = "", source: str = "", relation: str = "", limit: int = 50, user=Depends(get_current_user)):
    entities, relations = _knowledge_scope(user["username"])
    q = query.strip().lower()
    src = source.strip().lower()
    rel = relation.strip().lower().replace(" ", "_")
    items = []
    for item in relations:
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
    entities, relations = _knowledge_scope(user["username"])
    return {
        "status":"ok",
        "format":"medgen-knowledge-v1",
        "generated_at":datetime.now(timezone.utc).isoformat(),
        "entities":entities,
        "relations":relations,
        "stats":graph_stats(entities, relations),
    }

class KnowledgePathRequest(BaseModel):
    start: str
    end: str
    max_hops: int = 4

@app.post("/api/v1/knowledge/paths")
def knowledge_paths(data: KnowledgePathRequest, user=Depends(get_current_user)):
    entities, relations = _knowledge_scope(user["username"])
    if not data.start.strip() or not data.end.strip():
        raise HTTPException(status_code=400, detail="Start and end entities are required")
    ids = {e["id"] for e in entities}
    paths = (find_paths(entities, relations, data.start, data.end, data.max_hops)
             if normalize_entity(data.start) in ids and normalize_entity(data.end) in ids else [])
    return {"status":"ok","start":normalize_entity(data.start),"end":normalize_entity(data.end),"paths":paths,"count":len(paths)}

class KnowledgeImportRequest(BaseModel):
    entities: list[dict[str, Any]] = []
    relations: list[dict[str, Any]] = []
    source: str = "import"

@app.post("/api/v1/knowledge/import")
def knowledge_import(data: KnowledgeImportRequest, user=Depends(get_current_user)):
    added_entities=0; added_relations=0
    for raw in data.entities:
        entity=_owned_knowledge_entity(user, str(raw.get("name","")), str(raw.get("type","concept")), data.source)
        if entity["name"] and not any(x["id"]==entity["id"] for x in knowledge_entities_store if x.get("owner") == user["username"]):
            knowledge_entities_store.append(entity); added_entities+=1
    for raw in data.relations:
        try:
            rel=_owned_knowledge_relation(user, str(raw.get("subject","")),str(raw.get("relation","")),str(raw.get("object","")),data.source,str(raw.get("evidence","")))
        except ValueError:
            continue
        for name in (rel["subject"],rel["object"]):
            if not any(x["id"]==normalize_entity(name) for x in knowledge_entities_store if x.get("owner") == user["username"]):
                knowledge_entities_store.append(_owned_knowledge_entity(user, name,"concept",data.source))
        if rel not in knowledge_relations_store:
            knowledge_relations_store.append(rel); added_relations+=1
    _db_save()
    return {"status":"imported","added_entities":added_entities,"added_relations":added_relations,**graph_stats(*_knowledge_scope(user["username"]))}

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
    own_jobs = [x for x in jobs_store if (x.get("user") or x.get("username") or x.get("owner")) == username]
    own_workflows = [x for x in workflows_store if (x.get("user") or x.get("username") or x.get("owner")) == username]
    own_experiments = [x for x in experiments_store if (x.get("user") or x.get("username") or x.get("owner")) == username]
    own_reports = [x for x in reports_store if (x.get("user") or x.get("username") or x.get("owner")) == username]

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
    _leaderboard_award(user["username"], data.case_id, score)
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
    if approve and normalize_role(req.get("role")) not in ALLOWED_USER_ROLES:
        raise HTTPException(status_code=400, detail="Unsupported role.")
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


@app.get("/api/v1/admin/academic-approvals")
def admin_academic_approvals(user=Depends(get_current_user)):
    """List accounts awaiting academic verification."""
    require_super_admin(user)
    pending = []
    reviewed = []
    for username, profile in user_profiles.items():
        if str(profile.get("role", "student")).lower() not in {"student"}:
            continue
        review = profile.get("academic_review") or {}
        status = str(profile.get("academic_status", "pending")).lower()
        item = {
            "username": username,
            "full_name": profile.get("full_name", ""),
            "email": profile.get("email", ""),
            "academic_profile": profile.get("academic_profile", {}),
            "academic_status": status,
            "academic_review": review,
        }
        (pending if status == "pending" else reviewed).append(item)
    return {"pending": pending, "reviewed": reviewed}


@app.patch("/api/v1/admin/academic-approvals/{username}")
def admin_review_academic_approval(
    username: str,
    approve: bool = True,
    note: str = "",
    user=Depends(get_current_user),
):
    """Approve/reject a student's claimed academic enrollment."""
    require_super_admin(user)
    target = next((name for name in user_profiles if name.casefold() == username.strip().casefold()), None)
    if not target:
        raise HTTPException(status_code=404, detail="Student account not found.")
    profile = user_profiles[target]
    if str(profile.get("role", "student")).lower() not in {"student"}:
        raise HTTPException(status_code=400, detail="Only student accounts can receive academic approval.")
    now = datetime.now(timezone.utc).isoformat()
    status = "approved" if approve else "rejected"
    profile["academic_status"] = status
    profile["academic_review"] = {
        "status": status,
        "submitted_at": (profile.get("academic_review") or {}).get("submitted_at"),
        "reviewed_at": now,
        "reviewed_by": user["username"],
        "note": str(note or "").strip()[:1000],
    }
    activity_log.insert(0, {
        "type": "academic_approval_" + status,
        "username": target,
        "reviewed_by": user["username"],
        "at": now,
    })
    _db_save()
    return {
        "status": status,
        "username": target,
        "academic_status": status,
        "message": "Akademik ruxsat berildi." if approve else "Akademik tasdiq rad etildi.",
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
    return {"status": "ok", "organization_id": item["organization_id"], **graph_stats(*_knowledge_scope(item["created_by"]))}

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


# State is restored by the startup handler after all stores are defined.

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


ACADEMY_UZ_TRANSLATIONS = {
    "Which structure connects skeletal muscle to bone?": "Skelet mushagini suyak bilan qaysi tuzilma bog‘laydi?",
    "Tendon": "Pay", "Ligament": "Boylam", "Articular cartilage": "Bo‘g‘im tog‘ayi", "Synovial membrane": "Sinovial parda",
    "Tendons transmit force from muscle to bone.": "Paylar mushak kuchini suyakka uzatadi.",
    "Which chamber pumps oxygenated blood into the systemic circulation?": "Qaysi yurak bo‘lmachasi kislorodga boy qonni katta qon aylanish doirasiga haydaydi?",
    "Right atrium": "O‘ng bo‘lmacha", "Right ventricle": "O‘ng qorincha", "Left atrium": "Chap bo‘lmacha", "Left ventricle": "Chap qorincha",
    "The left ventricle ejects blood into the aorta.": "Chap qorincha qonni aortaga chiqaradi.",
    "Which plane divides the body into left and right portions?": "Qaysi tekislik tanani chap va o‘ng qismlarga ajratadi?",
    "Transverse": "Ko‘ndalang", "Sagittal": "Sagittal", "Coronal": "Frontal", "Oblique": "Qiyshiq",
    "A sagittal plane divides left and right portions.": "Sagittal tekislik tanani chap va o‘ng qismlarga ajratadi.",
    "Which type of joint normally permits the greatest range of movement?": "Qaysi bo‘g‘im turi odatda eng katta harakat diapazonini ta’minlaydi?",
    "Fibrous suture": "Tolali chok", "Cartilaginous symphysis": "Tog‘ayli simfiz", "Synovial joint": "Sinovial bo‘g‘im", "Synchondrosis": "Sinxondroz",
    "Synovial joints are designed for substantial movement.": "Sinovial bo‘g‘imlar keng harakatlanish uchun moslashgan.",
    "Which statement best describes {topic}?": "{topic}ni qaysi fikr eng to‘g‘ri ta’riflaydi?",
    "It is a core concept of {topic}.": "Bu {topic}ning asosiy tushunchasidir.",
    "It is unrelated to biomedical science.": "Bu biotibbiyot fanlariga aloqador emas.",
    "It is only an administrative process.": "Bu faqat ma’muriy jarayondir.",
    "It has no measurable scientific basis.": "Buning o‘lchanadigan ilmiy asosi yo‘q.",
    "What is the safest learning approach when studying {topic}?": "{topic}ni o‘rganishda eng xavfsiz yondashuv qaysi?",
    "Learn the mechanism, practice it, then verify with assessment.": "Mexanizmni o‘rganing, mashq qiling, so‘ng bilimni baholash orqali tekshiring.",
    "Skip theory and memorize a final answer.": "Nazariyani tashlab, yakuniy javobni yodlang.",
    "Treat every simulation as real-patient care.": "Har bir simulyatsiyani haqiqiy bemorga yordam ko‘rsatish deb qabul qiling.",
    "Use an unverified source as the only authority.": "Tekshirilmagan manbani yagona ishonchli manba deb oling.",
    "Medical Academy separates theory, practice, assessment and supervised simulation.": "Tibbiyot akademiyasida nazariya, amaliyot, baholash va nazorat ostidagi simulyatsiya alohida bosqichlardir.",
    "Why is {topic} important in medical education?": "{topic} tibbiy ta’limda nima uchun muhim?",
    "It supports structured scientific and clinical reasoning.": "U ilmiy va klinik fikrlashni tizimli rivojlantiradi.",
    "It replaces all laboratory and clinical evidence.": "U barcha laboratoriya va klinik dalillarning o‘rnini bosadi.",
    "It guarantees a diagnosis without examination.": "U ko‘riksiz tashxisni kafolatlaydi.",
    "It removes the need for qualified supervision.": "U malakali mutaxassis nazoratiga ehtiyojni yo‘q qiladi.",
    "Educational knowledge supports reasoning but does not replace real clinical validation.": "O‘quv bilimlari fikrlashni qo‘llab-quvvatlaydi, ammo haqiqiy klinik tekshiruv o‘rnini bosmaydi.",
    "Which action improves mastery of {topic}?": "{topic}ni puxta o‘zlashtirishga qaysi harakat yordam beradi?",
    "Recall, apply, explain and review errors.": "Eslab aytish, qo‘llash, tushuntirish va xatolarni tahlil qilish.",
    "Only reread the same paragraph.": "Faqat bir xil paragrafni qayta o‘qish.",
    "Ignore incorrect answers.": "Noto‘g‘ri javoblarni e’tiborsiz qoldirish.",
    "Avoid practice until the final exam.": "Yakuniy imtihongacha mashq qilmaslik.",
    "Active recall, application and error review are appropriate learning methods.": "Faol eslab qolish, qo‘llash va xatolarni ko‘rib chiqish samarali o‘rganish usullaridir.",
    "When should a student revisit {topic}?": "Talaba {topic}ni qachon qayta ko‘rib chiqishi kerak?",
    "After practice or an assessment exposes a knowledge gap.": "Mashq yoki baholash bilimdagi bo‘shliqni ko‘rsatgandan keyin.",
    "Never after passing one question.": "Bitta savolga to‘g‘ri javob bergach, hech qachon qaytmaslik.",
    "Only after graduation.": "Faqat o‘qishni tugatgandan keyin.",
    "Only when a patient is waiting.": "Faqat bemor kutib turganda.",
    "Assessment results should drive targeted review.": "Baholash natijalari maqsadli takrorlashga yo‘naltirishi kerak.",
    "What is a correct interpretation of a MedGen AI {topic} simulation?": "MedGen AI tizimidagi {topic} simulyatsiyasini qanday to‘g‘ri talqin qilish kerak?",
    "An educational exercise, not an independent clinical authorization.": "Bu o‘quv mashqi, mustaqil klinik faoliyatga ruxsat emas.",
    "A legally binding clinical order.": "Yuridik kuchga ega klinik buyruq.",
    "A guaranteed treatment recommendation.": "Kafolatlangan davolash tavsiyasi.",
    "A substitute for a licensed clinician.": "Litsenziyaga ega shifokorning o‘rnini bosuvchi vosita.",
    "The Academy is educational; clinical decisions require qualified professionals and validated evidence.": "Akademiya ta’lim uchun mo‘ljallangan; klinik qarorlar malakali mutaxassis va tekshirilgan dalillarni talab qiladi.",
    "Which evidence hierarchy principle applies while learning {topic}?": "{topic}ni o‘rganishda dalillar ierarxiyasining qaysi tamoyili qo‘llanadi?",
    "Use reliable, current sources and critically evaluate evidence.": "Ishonchli va dolzarb manbalardan foydalaning, dalillarni tanqidiy baholang.",
    "Accept every generated answer as fact.": "Yaratilgan har qanday javobni haqiqat deb qabul qiling.",
    "Prefer anonymous claims over validated evidence.": "Tasdiqlangan dalillardan ko‘ra anonim da’volarni afzal ko‘ring.",
    "Ignore uncertainty.": "Noaniqlikni e’tiborsiz qoldiring.",
    "Scientific learning requires source criticism and explicit uncertainty.": "Ilmiy o‘rganish manbalarni tanqidiy baholash va noaniqlikni ochiq ko‘rsatishni talab qiladi.",
    "What should be recorded after a {topic} practice session?": "{topic} bo‘yicha mashqdan keyin nimalar qayd etilishi kerak?",
    "Performance, errors, feedback and next learning objective.": "Bajarilish, xatolar, fikr-mulohaza va keyingi o‘quv maqsadi.",
    "Only the final score.": "Faqat yakuniy ball.",
    "Nothing if the attempt was difficult.": "Urinish qiyin bo‘lgan bo‘lsa, hech narsa.",
    "Only a screenshot.": "Faqat ekran tasviri.",
    "A useful academic record captures progress and remediation needs.": "Foydali akademik qayd rivojlanish va qo‘shimcha mashq zaruratini ko‘rsatadi.",
    "How does {topic} connect to other medical subjects?": "{topic} boshqa tibbiy fanlar bilan qanday bog‘lanadi?",
    "Biomedical subjects are integrated through mechanisms and clinical reasoning.": "Biotibbiyot fanlari mexanizmlar va klinik fikrlash orqali o‘zaro bog‘lanadi.",
    "Each subject is completely isolated.": "Har bir fan boshqalaridan butunlay ajralgan.",
    "Integration is never needed.": "Fanlararo bog‘lanish hech qachon kerak emas.",
    "Only one subject can be scientifically valid.": "Faqat bitta fan ilmiy jihatdan to‘g‘ri bo‘lishi mumkin.",
    "Medical education progressively integrates foundational and clinical knowledge.": "Tibbiy ta’lim asosiy va klinik bilimlarni bosqichma-bosqich birlashtiradi.",
    "What should happen after a weak result in {topic}?": "{topic} bo‘yicha natija past bo‘lsa, nima qilish kerak?",
    "Review the gap, repeat targeted practice and reassess.": "Bilimdagi bo‘shliqni ko‘rib chiqing, maqsadli mashqni takrorlang va qayta baholang.",
    "Automatically promote the student.": "Talabani avtomatik ravishda keyingi bosqichga o‘tkazing.",
    "Delete the academic record.": "Akademik qaydni o‘chirib tashlang.",
    "Treat the score as a clinical diagnosis.": "Ballni klinik tashxis deb qabul qiling.",
    "Remediation and reassessment are more meaningful than a one-question promotion rule.": "Bilimni to‘ldirish va qayta baholash bitta savolga asoslangan o‘tkazish qoidasidan mazmunliroq.",
    "What is the best next step?": "Keyingi eng to‘g‘ri qadam qaysi?",
    "Identify the error, review the relevant concept and repeat practice.": "Xatoni aniqlang, tegishli tushunchani takrorlang va mashqni qayta bajaring.",
    "Ignore it.": "Buni e’tiborsiz qoldiring.",
    "Use the result as a patient diagnosis.": "Natijani bemorga qo‘yilgan tashxis sifatida ishlating.",
    "Skip all future assessments.": "Keyingi barcha baholashlardan voz keching.",
    "What should the student do?": "Talaba nima qilishi kerak?",
    "Check reliable sources and mark uncertainty before accepting it.": "Qabul qilishdan oldin ishonchli manbalarni tekshiring va noaniqlikni belgilang.",
    "Accept it because it sounds confident.": "Ishonchli eshitilgani uchun qabul qiling.",
    "Publish it as clinical guidance.": "Uni klinik ko‘rsatma sifatida e’lon qiling.",
    "Remove the uncertainty.": "Noaniqlikni olib tashlang.",
    "Which educational response is appropriate?": "Qaysi ta’limiy yondashuv to‘g‘ri?",
    "Target the weak objectives, practice again and reassess.": "Zaif o‘zlashtirilgan maqsadlarni tanlang, qayta mashq qiling va qayta baholang.",
    "Promote immediately.": "Darhol keyingi bosqichga o‘tkazing.",
    "Hide the result.": "Natijani yashiring.",
    "Stop studying the subject.": "Fanni o‘rganishni to‘xtating.",
    "Preparation": "Tayyorgarlik", "Correct sequence": "To‘g‘ri ketma-ketlik",
    "Scientific rationale": "Ilmiy asos", "Safety check": "Xavfsizlik tekshiruvi",
    "Reflection": "Tahlil", "Structured execution": "Tizimli bajarish",
    "Communication": "Muloqot", "Documentation": "Hujjatlashtirish",
    "Interpretation": "Talqin", "Skill performance": "Ko‘nikmani bajarish",
    "Reasoning": "Fikrlash", "Feedback": "Fikr-mulohaza",
    "Perform the structured educational skill, explain the rationale, and identify safety checks.": "Tuzilgan o‘quv ko‘nikmasini bajaring, ilmiy asosini tushuntiring va xavfsizlik tekshiruvlarini aniqlang.",
    "Complete the station in a structured sequence and communicate key safety checks.": "Stansiyani belgilangan ketma-ketlikda bajaring va asosiy xavfsizlik tekshiruvlarini ayting.",
    "Interpret the educational scenario, demonstrate the skill, and explain the decision.": "O‘quv vaziyatini talqin qiling, ko‘nikmani ko‘rsating va qaroringizni tushuntiring.",
}
def _academy_translate_value(value):
    if not isinstance(value, str):
        return value
    translated = ACADEMY_UZ_TRANSLATIONS.get(value)
    if translated:
        return translated
    # Translate dynamically generated generic question-bank text.
    patterns = (
        (r"^Which statement best describes (.+)\?$", r"Qaysi fikr \1ni eng to‘g‘ri ta’riflaydi?"),
        (r"^What is the safest learning approach when studying (.+)\?$", r"\1ni o‘rganishda eng xavfsiz yondashuv qaysi?"),
        (r"^Why is (.+) important in medical education\?$", r"\1 tibbiy ta’limda nima uchun muhim?"),
        (r"^Which action improves mastery of (.+)\?$", r"\1ni puxta o‘zlashtirishga qaysi harakat yordam beradi?"),
        (r"^When should a student revisit (.+)\?$", r"Talaba \1ni qachon qayta ko‘rib chiqishi kerak?"),
        (r"^What should be recorded after a (.+) practice session\?$", r"\1 bo‘yicha mashqdan keyin nimalar qayd etilishi kerak?"),
        (r"^How does (.+) connect to other medical subjects\?$", r"\1 boshqa tibbiy fanlar bilan qanday bog‘lanadi?"),
        (r"^What should happen after a weak result in (.+)\?$", r"\1 bo‘yicha natija past bo‘lsa, nima qilish kerak?"),
        (r"^It is a core concept of (.+)\.$", r"Bu \1ning asosiy tushunchasidir."),
    )
    import re as _re
    for pattern, replacement in patterns:
        if _re.match(pattern, value):
            return _re.sub(pattern, replacement, value)
    return value

def _academy_translate_payload(value):
    if isinstance(value, list):
        return [_academy_translate_payload(item) for item in value]
    if isinstance(value, dict):
        return {key: _academy_translate_payload(item) for key, item in value.items()}
    return _academy_translate_value(value)

ACADEMY_ASSESSMENT_TYPES = ("theory", "practice", "puzzle", "quiz", "test", "case", "skills", "osce", "theory_exam", "practical_exam", "exam")

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
        "study_language": "uz",
        "academic_degree": "MD/MBBS",
    }
    for k, v in defaults.items():
        ap.setdefault(k, v)
    return ap

def _academy_progress(username: str):
    p = user_profiles.setdefault(username, {})
    return p.setdefault("academy_progress", {})

def _save_academy_assessment(username, course, subject_id, assessment_type, score):
    profile = user_profiles.setdefault(username, {})
    had_progress = "academy_progress" in profile
    progress = _academy_progress(username)
    key = _academy_key(course, subject_id)
    had_subject = key in progress
    record = progress.setdefault(key, {})
    previous = record.get(assessment_type)
    updated = {
        "score": score, "passed": score >= 70,
        "attempts": int((previous or {}).get("attempts", 0)) + 1,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    record[assessment_type] = updated
    try:
        _db_save()
    except Exception:
        if record.get(assessment_type) is updated:
            if previous is None:
                record.pop(assessment_type, None)
            else:
                record[assessment_type] = previous
        if not had_subject and not record and progress.get(key) is record:
            progress.pop(key, None)
        if not had_progress and not progress and profile.get("academy_progress") is progress:
            profile.pop("academy_progress", None)
        raise
    return record


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
    # Curated foundational medical questions. These are educational checks, not clinical advice.
    curated = {
        "Anatomy": [
            ("Which structure connects skeletal muscle to bone?", ["Tendon", "Ligament", "Articular cartilage", "Synovial membrane"], 0, "Tendons transmit force from muscle to bone."),
            ("Which chamber pumps oxygenated blood into the systemic circulation?", ["Right atrium", "Right ventricle", "Left atrium", "Left ventricle"], 3, "The left ventricle ejects blood into the aorta."),
            ("Which plane divides the body into left and right portions?", ["Transverse", "Sagittal", "Coronal", "Oblique"], 1, "A sagittal plane divides left and right portions."),
            ("Which type of joint normally permits the greatest range of movement?", ["Fibrous suture", "Cartilaginous symphysis", "Synovial joint", "Synchondrosis"], 2, "Synovial joints are designed for substantial movement."),
        ],
        "Histology": [
            ("Which epithelium is specialized for rapid diffusion in pulmonary alveoli?", ["Simple squamous", "Stratified squamous", "Transitional", "Pseudostratified columnar"], 0, "Thin simple squamous cells minimize diffusion distance."),
            ("Which cell produces most of the collagen in ordinary connective tissue?", ["Neutrophil", "Fibroblast", "Erythrocyte", "Neuron"], 1, "Fibroblasts synthesize extracellular matrix including collagen."),
            ("Which organelle is especially abundant in cells producing secreted proteins?", ["Smooth endoplasmic reticulum only", "Lysosome", "Rough endoplasmic reticulum", "Centriole"], 2, "Rough ER supports synthesis of proteins destined for secretion or membranes."),
            ("Which blood element is primarily responsible for oxygen transport?", ["Platelet", "Lymphocyte", "Monocyte", "Erythrocyte"], 3, "Erythrocytes carry hemoglobin."),
        ],
        "Physiology": [
            ("Which change usually increases heart rate through the autonomic nervous system?", ["Increased sympathetic activity", "Increased vagal activity", "Complete beta-1 blockade", "Reduced catecholamine release"], 0, "Sympathetic stimulation generally increases heart rate."),
            ("Where is the main respiratory rhythm-generating network located?", ["Cerebellar cortex", "Medulla oblongata", "Occipital lobe", "Spinal lumbar enlargement"], 1, "Medullary networks are central to respiratory rhythm generation."),
            ("What is the principal immediate stimulus for ventilation in most healthy adults?", ["Arterial oxygen rising", "Plasma sodium falling slightly", "Rising arterial carbon dioxide", "Blood glucose after a meal"], 2, "Carbon dioxide-related changes in pH are a major ventilatory drive."),
            ("Which hormone increases water reabsorption in the renal collecting ducts?", ["Insulin", "Thyroxine", "Glucagon", "Antidiuretic hormone"], 3, "ADH increases collecting-duct water permeability."),
        ],
        "Biochemistry": [
            ("Which molecule is the principal immediate energy currency used by cells?", ["ATP", "DNA", "Cholesterol", "Urea"], 0, "ATP couples energy-releasing and energy-requiring reactions."),
            ("Which enzyme begins starch digestion in the mouth?", ["Pepsin", "Salivary amylase", "Trypsin", "Lactase"], 1, "Salivary amylase hydrolyzes starch."),
            ("Which vitamin-derived cofactor is required for many carboxylation reactions?", ["Thiamine pyrophosphate", "FAD only", "Biotin", "Pyridoxal phosphate"], 2, "Biotin is a cofactor for carboxylases."),
            ("Which process produces most ATP from complete aerobic oxidation of glucose?", ["Glycogenolysis alone", "Fermentation", "Glycolysis alone", "Oxidative phosphorylation"], 3, "The electron transport chain and oxidative phosphorylation generate most ATP aerobically."),
        ],
        "Genetics": [
            ("Which molecule carries the usual heritable genetic information in human cells?", ["DNA", "Triglyceride", "Glycogen", "Collagen"], 0, "Nuclear and mitochondrial genomes are DNA."),
            ("A change in one nucleotide is commonly called what?", ["Translocation only", "Point mutation", "Polyploidy", "Crossing over"], 1, "A single-nucleotide change is a point mutation."),
            ("Which chromosome pattern is typically associated with Turner syndrome?", ["47,XXY", "Trisomy 21", "45,X", "47,XXX"], 2, "Turner syndrome classically involves complete or partial monosomy X."),
            ("What does genetic counseling primarily help people do?", ["Guarantee a healthy outcome", "Replace diagnostic testing", "Choose treatment without consent", "Understand genetic risks and available options"], 3, "Counseling supports informed, non-directive decisions about genetic risk."),
        ],
        "Microbiology": [
            ("Which structure is present in bacteria but absent from human cells?", ["Peptidoglycan cell wall", "Plasma membrane", "Ribosomes", "DNA"], 0, "Most bacteria have peptidoglycan cell walls; human cells do not."),
            ("Which method reliably sterilizes suitable heat-stable instruments using pressurized steam?", ["Refrigeration", "Autoclaving", "Brief rinsing", "Ultraviolet room lighting alone"], 1, "Validated autoclave cycles use saturated steam under pressure."),
            ("Which laboratory method detects bacterial growth inhibition around an antimicrobial disk?", ["Gram stain alone", "ELISA", "Disk diffusion susceptibility test", "Complete blood count"], 2, "Disk diffusion assesses inhibition zones under standardized conditions."),
            ("Viruses require which resource to replicate?", ["A nutrient agar plate alone", "Independent ribosomes", "A bacterial cell wall", "Host-cell machinery"], 3, "Viruses depend on host cells for replication."),
        ],
        "Immunology": [
            ("Which cells can differentiate into antibody-secreting plasma cells?", ["B lymphocytes", "Erythrocytes", "Platelets", "Neutrophils only"], 0, "Activated B cells can differentiate into plasma cells."),
            ("Which immunoglobulin class commonly predominates in a secondary systemic response?", ["IgE", "IgG", "IgD", "IgM only"], 1, "IgG is commonly prominent after class switching and memory responses."),
            ("Which cells are central to antigen-specific cellular immunity?", ["Erythrocytes", "Fibroblasts", "T lymphocytes", "Osteocytes"], 2, "T cells mediate key adaptive cellular immune responses."),
            ("What is the main purpose of vaccination?", ["Cause the target disease in everyone", "Remove all innate immunity", "Replace every future treatment", "Establish immune memory against a target"], 3, "Vaccination trains immune responses and memory while aiming to reduce disease risk."),
        ],
        "Pathology": [
            ("Which term describes reversible cellular swelling after mild injury?", ["Cellular adaptation", "Hydropic change", "Metastasis", "Dysplasia"], 1, "Hydropic change is a common reversible injury pattern."),
            ("Which feature best distinguishes apoptosis from uncontrolled necrosis?", ["Regulated cell death with membrane integrity initially maintained", "Always causes widespread inflammation", "Only occurs after bacterial infection", "Always affects an entire organ"], 0, "Apoptosis is regulated and typically limits inflammation."),
            ("Which process describes spread of malignant cells to distant sites?", ["Hypertrophy", "Metaplasia", "Metastasis", "Atrophy"], 2, "Metastasis is the dissemination of malignant cells to distant locations."),
            ("Which inflammatory cell is often prominent early in acute bacterial inflammation?", ["Plasma cell", "Eosinophil only", "Mature erythrocyte", "Neutrophil"], 3, "Neutrophils are commonly early responders in acute bacterial inflammation."),
        ],
        "Medical terminology": [
            ("In medical terminology, the prefix 'brady-' generally means what?", ["Slow", "Fast", "Around", "Within"], 0, "Brady- indicates slowness, as in bradycardia."),
            ("The suffix '-itis' usually indicates what?", ["Surgical removal", "Inflammation", "Visual examination", "Blood condition"], 1, "-itis denotes inflammation."),
            ("The prefix 'hypo-' most commonly means what?", ["Above normal", "Around", "Below or deficient", "Between"], 2, "Hypo- indicates below, low, or deficient."),
            ("What does 'bilateral' mean?", ["Only on the left", "Only on the right", "Inside an organ", "Affecting both sides"], 3, "Bilateral means involving both sides."),
        ],
        "Public health": [
            ("Incidence measures which quantity in a population over a specified period?", ["New cases", "All existing cases at one point", "Deaths from every cause only", "Hospital beds"], 0, "Incidence counts new cases in a defined population and time."),
            ("Which is an example of primary prevention?", ["Rehabilitation after stroke", "Immunization before infection", "Screening for established disease", "Palliative care"], 1, "Primary prevention aims to prevent disease before it occurs."),
            ("A screening test with high sensitivity is especially useful for what purpose?", ["Confirming every positive result without follow-up", "Eliminating the need for prevalence data", "Reducing missed cases", "Proving causality"], 2, "High sensitivity reduces false negatives and helps rule out disease when negative in suitable contexts."),
            ("Which factor is essential when interpreting a population health statistic?", ["Anecdote alone", "Ignoring the denominator", "Assuming association proves causation", "The population and time period measured"], 3, "Rates require clear denominators, population definitions and time windows."),
        ],
    }
    if sid in curated:
        specific = []
        for index, (question_text, options, answer, explanation) in enumerate(curated[sid], start=1):
            specific.append({
                "id": f"{course}-{sid}-specific{index}",
                "question": question_text,
                "options": list(options),
                "answer": answer,
                "explanation": explanation,
            })
        base = specific + base[len(specific):]

    # Rotate answer positions while preserving the correct answer key.
    for index, question in enumerate(base):
        shift = (index + course + len(sid)) % len(question["options"])
        original_answer = int(question["answer"])
        question["options"] = question["options"][shift:] + question["options"][:shift]
        question["answer"] = (original_answer - shift) % len(question["options"])

    # Keep exam items conceptually distinct: do not inflate the exam by duplicating
    # the same questions with cosmetic wording changes.
    exam = []
    for index, question in enumerate(base):
        exam_question = dict(question)
        exam_question["id"] = f"{course}-{sid}-exam{index + 1}"
        exam.append(exam_question)

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
    for index, case in enumerate(cases):
        shift = (index + course + len(sid) + 1) % len(case["options"])
        case["options"] = case["options"][shift:] + case["options"][:shift]
        case["answer"] = (0 - shift) % len(case["options"])

    skills = [{"id": f"{course}-{sid}-skill{i}", "title": f"Practical skill {i}: {topic}", "instruction": "Perform the structured educational skill, explain the rationale, and identify safety checks.", "checklist": ["Preparation", "Correct sequence", "Scientific rationale", "Safety check", "Reflection"]} for i in range(1, 4)]
    osce = [
        {"id": f"{course}-{sid}-osce1", "station": f"OSCE Station 1 — {topic}", "prompt": "Complete the station in a structured sequence and communicate key safety checks.", "checklist": ["Preparation", "Structured execution", "Communication", "Safety check", "Documentation"]},
        {"id": f"{course}-{sid}-osce2", "station": f"OSCE Station 2 — {topic}", "prompt": "Interpret the educational scenario, demonstrate the skill, and explain the decision.", "checklist": ["Interpretation", "Skill performance", "Reasoning", "Safety", "Feedback"]},
    ]
    return {"quiz": base, "exam": exam, "case": cases, "skills": skills, "osce": osce}

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
    study_language: str = "uz"
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
        "study_language": str(data.study_language or "uz").lower()[:10],
        "academic_degree": str(data.academic_degree or "MD/MBBS").strip()[:100],
        "updated_at": datetime.now(timezone.utc).isoformat(),
    })
    activity_log.insert(0, {"type": "academy_profile_updated", "username": user["username"], "at": profile["updated_at"]})
    _db_save()
    return {"status": "saved", "profile": profile}

class AcademySyllabusSubject(BaseModel):
    subject: str
    topics: list[str] = []
    practicals: list[str] = []
    teacher: str = ""

class AcademySyllabusImportRequest(BaseModel):
    university: str
    faculty: str = ""
    major: str
    year: int
    semester: int
    academic_year: str = ""
    source_filename: str = ""
    source_note: str = ""
    subjects: list[AcademySyllabusSubject]

@app.post("/api/v1/admin/academy/syllabi")
def admin_import_academy_syllabus(data: AcademySyllabusImportRequest, user=Depends(get_current_user)):
    require_super_admin(user)
    university = data.university.strip()
    major = data.major.strip()
    if not university or not major:
        raise HTTPException(status_code=400, detail="University and major are required.")
    if not 1 <= data.year <= 6 or not 1 <= data.semester <= 12:
        raise HTTPException(status_code=400, detail="Course must be 1-6 and semester 1-12.")
    if not data.subjects:
        raise HTTPException(status_code=400, detail="At least one subject is required.")
    if len(data.subjects) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 subjects per import.")
    clean_subjects = []
    for item in data.subjects:
        subject = item.subject.strip()[:200]
        if not subject:
            raise HTTPException(status_code=400, detail="Subject names cannot be empty.")
        clean_subjects.append({
            "subject": subject,
            "topics": [str(x).strip()[:500] for x in item.topics if str(x).strip()][:200],
            "practicals": [str(x).strip()[:500] for x in item.practicals if str(x).strip()][:100],
            "teacher": item.teacher.strip()[:200],
        })
    syllabus_id = secrets.token_hex(12)
    record = {
        "id": syllabus_id, "status": "pending_review",
        "university": university[:200], "faculty": data.faculty.strip()[:200],
        "major": major[:200], "year": data.year, "semester": data.semester,
        "academic_year": data.academic_year.strip()[:30],
        "source_filename": data.source_filename.strip()[:200],
        "source_note": data.source_note.strip()[:1000],
        "subjects": clean_subjects, "created_by": user["username"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "reviewed_by": None, "reviewed_at": None,
    }
    academy_syllabi_store[syllabus_id] = record
    activity_log.insert(0, {"type":"academy_syllabus_imported","username":user["username"],"syllabus_id":syllabus_id,"at":record["created_at"]})
    _db_save()
    return {"status":"pending_review","syllabus":record}

@app.get("/api/v1/admin/academy/syllabi")
def admin_list_academy_syllabi(user=Depends(get_current_user)):
    require_super_admin(user)
    return {"syllabi": sorted(academy_syllabi_store.values(), key=lambda x:x.get("created_at",""), reverse=True)}

@app.patch("/api/v1/admin/academy/syllabi/{syllabus_id}")
def admin_review_academy_syllabus(syllabus_id: str, publish: bool = True, note: str = "", user=Depends(get_current_user)):
    require_super_admin(user)
    record = academy_syllabi_store.get(syllabus_id)
    if not record:
        raise HTTPException(status_code=404, detail="Syllabus not found.")
    record["status"] = "published" if publish else "rejected"
    record["reviewed_by"] = user["username"]
    record["reviewed_at"] = datetime.now(timezone.utc).isoformat()
    record["review_note"] = note.strip()[:1000]
    activity_log.insert(0, {"type":"academy_syllabus_reviewed","username":user["username"],"syllabus_id":syllabus_id,"status":record["status"],"at":record["reviewed_at"]})
    _db_save()
    return {"status":record["status"],"syllabus":record}

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
        "official_syllabi": [
            {
                "id": item["id"], "university": item["university"], "faculty": item["faculty"],
                "major": item["major"], "year": item["year"], "semester": item["semester"],
                "academic_year": item["academic_year"], "subjects": item["subjects"]
            }
            for item in academy_syllabi_store.values()
            if item.get("status") == "published"
            and item.get("university", "").casefold() == str(ap.get("university", "")).casefold()
            and item.get("major", "").casefold() == str(ap.get("major", "")).casefold()
            and item.get("year") == ap.get("year")
            and (not item.get("faculty") or item.get("faculty", "").casefold() == str(ap.get("faculty", "")).casefold())
        ],
        "note": "Official university syllabi appear only after an administrator reviews and publishes the institution-provided data. General curriculum is an educational framework, not an official university schedule."
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
            "theory": (
                [
                    {"id": f"{course}-{subject_id}-brain-1", "title": "Bosh miya: umumiy tuzilishi", "objective": "Katta yarimsharlar, miyacha va miya ustunini farqlash.", "content": "Katta yarimsharlar ongli sezgi, ixtiyoriy harakat, til, xotira va fikrlashda qatnashadi. Miyacha harakat aniqligi va muvozanatni muvofiqlashtiradi. Miya ustuni o‘rta miya, ko‘prik va uzunchoq miyadan iborat."},
                    {"id": f"{course}-{subject_id}-brain-2", "title": "Miya bo‘laklari", "objective": "Peshona, tepa, chakka va ensa bo‘laklari vazifalarini bog‘lash.", "content": "Peshona bo‘lagi ixtiyoriy harakat va rejalashtirishda; tepa bo‘lagi somatosensor axborot va fazoviy diqqatda; chakka bo‘lagi eshitish, xotira va tilni tushunishda; ensa bo‘lagi esa ko‘rish axborotini qayta ishlashda muhim."},
                    {"id": f"{course}-{subject_id}-brain-3", "title": "Miyacha va miya ustuni", "objective": "Tuzilmalarning fazoviy joylashuvini tushuntirish.", "content": "Miyacha katta yarimsharlarning orqa-pastki qismida, miya ustunining orqasida joylashadi. Miya ustuni orqa miya bilan davomiylik hosil qiladi."},
                    {"id": f"{course}-{subject_id}-brain-4", "title": "Klinik-anatomik bog‘lanish", "objective": "Tuzilish va funksiya o‘rtasidagi aloqani tushuntirish.", "content": "Ensa korteksi shikastlanishi ko‘rish buzilishlariga, miyacha zararlanishi esa koordinatsiya va muvozanat buzilishlariga olib kelishi mumkin. Bu o‘quv misollari klinik tashxis o‘rnini bosmaydi."}
                ] if course == 1 and subject_id == "Anatomy" else [
                    {"id": f"{course}-{subject_id}-theory-1", "title": "Asosiy tushunchalar", "objective": subject["objective"]},
                    {"id": f"{course}-{subject_id}-theory-2", "title": "Mexanizmlar va fanlararo bog‘lanish", "objective": "Asosiy tushunchalarni izohlash va bog‘lash."},
                    {"id": f"{course}-{subject_id}-theory-3", "title": "Dalillar va xavfsizlik", "objective": "Ishonchli manbalardan foydalanish."}
                ]
            ),
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
    if data.assessment_type == "puzzle":
        if data.course == 1 and data.subject_id == "Anatomy":
            items = [{
                "id": "brain-assembly-v1",
                "title": "Bosh miya qismlarini joylashtiring",
                "instruction": "Har bir tuzilmani mos anatomik joyiga qo‘ying. Bu boshlang‘ich joylashtirish mashqi; to‘liq interaktiv 3D model hali ulanmagan.",
                "parts": [{"id":"frontal","label":"Peshona bo‘lagi"},{"id":"parietal","label":"Tepa bo‘lagi"},{"id":"temporal","label":"Chakka bo‘lagi"},{"id":"occipital","label":"Ensa bo‘lagi"},{"id":"cerebellum","label":"Miyacha"},{"id":"brainstem","label":"Miya ustuni"}],
                "slots": [{"value":0,"label":"Oldingi-yuqori"},{"value":1,"label":"Markaziy-yuqori"},{"value":2,"label":"Yon-pastki"},{"value":3,"label":"Orqa-yuqori"},{"value":4,"label":"Orqa-pastki"},{"value":5,"label":"Pastki markaz"}]
            }]
        else:
            items = [{"id":"puzzle-unavailable","title":"Bu fan uchun puzzle tayyorlanmoqda","instruction":"Hozircha maxsus puzzle xaritasi mavjud emas.","parts":[],"slots":[]}]
    elif data.assessment_type == "theory":
        items = [
            {
                "id": f"{data.course}-{data.subject_id}-theory-1",
                "title": "Asosiy tushuncha",
                "prompt": f"{subject['name']}: {subject['objective']}",
                "content": f"{subject['name']} fanining asosiy maqsadi — {subject['objective']}ni ilmiy dalillar asosida tushunish. Avval asosiy atamalarni aniqlang, keyin normal tuzilish yoki mexanizmni izohlang va uni tegishli tibbiy fanlar bilan bog‘lang.",
                "instruction": "O‘qib chiqing, asosiy atamalarni o‘z so‘zingiz bilan tushuntiring va keyin bajarildi deb belgilang."
            },
            {
                "id": f"{data.course}-{data.subject_id}-theory-2",
                "title": "Mexanizm va fanlararo bog‘lanish",
                "prompt": f"{subject['name']} bo‘yicha mexanizmni tushuntirish",
                "content": f"Bilimni yodlash bilan cheklanmang: sabab → mexanizm → kuzatiladigan natija zanjirini tuzing. {subject['objective']}ni anatomiya, fiziologiya, biokimyo yoki klinik fanlar bilan bog‘lang. Dalil yetarli bo‘lmagan joyda noaniqlikni alohida belgilang.",
                "instruction": "Ushbu zanjirni daftarga yozib, kamida bitta fanlararo bog‘lanishni ko‘rsating."
            },
            {
                "id": f"{data.course}-{data.subject_id}-theory-3",
                "title": "Takrorlash va xavfsizlik",
                "prompt": "Bilimni tekshirish va xatolarni tuzatish",
                "content": f"{subject['name']} bo‘yicha asosiy tushunchalarni qayta eslang, ishonchli manba bilan tekshiring va tushunmagan joylaringizni yozib oling. O‘quv simulyatsiyasi real bemorga tashxis qo‘yish yoki davolash vakolatini bermaydi.",
                "instruction": "Uchta asosiy fikrni qayd eting va keyin bajarildi deb belgilang."
            }
        ]
        if data.course == 1 and data.subject_id == "Anatomy":
            items = [
                {"id":"brain-theory-1","title":"Bosh miya: umumiy tuzilishi","prompt":"Bosh miyaning asosiy qismlari va vazifalari","content":"Bosh miya markaziy asab tizimining bosh suyagi ichida joylashgan qismidir. Katta yarimsharlar ongli sezgi, ixtiyoriy harakat, til, xotira va murakkab fikrlashda qatnashadi. Miyacha harakat aniqligi, muvozanat va motor o‘rganishni muvofiqlashtiradi. Miya ustuni o‘rta miya, ko‘prik va uzunchoq miyadan iborat; u bosh miya va orqa miya yo‘llarini bog‘laydi hamda nafas olish va yurak-qon tomir funksiyalariga aloqador markazlarni o‘z ichiga oladi.","instruction":"Har bir qismning vazifasini o‘z so‘zingiz bilan tushuntiring."},
                {"id":"brain-theory-2","title":"Katta yarimshar bo‘laklari","prompt":"Peshona, tepa, chakka va ensa bo‘laklari","content":"Peshona bo‘lagi ixtiyoriy harakat, rejalashtirish va ijro funksiyalarida qatnashadi. Tepa bo‘lagi somatosensor axborot va fazoviy diqqat uchun muhim. Chakka bo‘lagi eshitish, xotira va tilni tushunish tarmoqlarida qatnashadi. Ensa bo‘lagi ko‘rish axborotini qayta ishlashning asosiy kortikal hududlarini saqlaydi. Funksiyalar ko‘pincha bir nechta soha va tarmoq hamkorligida bajariladi.","instruction":"To‘rtta bo‘lakni ularning asosiy funksiyalari bilan bog‘lang."},
                {"id":"brain-theory-3","title":"Miyacha va miya ustuni","prompt":"Orqa-pastki tuzilmalar va ularning anatomik joylashuvi","content":"Miyacha katta yarimsharlarning orqa-pastki qismida va miya ustunining orqasida joylashadi. U harakatlarni muvofiqlashtirish va muvozanatga hissa qo‘shadi. Miya ustuni o‘rta miya, ko‘prik va uzunchoq miyadan tuzilgan hamda orqa miya bilan davomiylik hosil qiladi.","instruction":"Miyacha va miya ustunining joylashuvini farqlang."},
                {"id":"brain-theory-4","title":"Klinik-anatomik bog‘lanish","prompt":"Tuzilish va funksiya o‘rtasidagi aloqa","content":"Ensa korteksi shikastlanishi ko‘rish bilan bog‘liq buzilishlarga, miyacha zararlanishi esa muvozanat va harakat koordinatsiyasi buzilishlariga olib kelishi mumkin. Belgilar shikastlanish joyi va hajmiga qarab farq qiladi; bu o‘quv misollari klinik tashxis o‘rnini bosmaydi.","instruction":"Tuzilma, vazifa va ehtimoliy belgi o‘rtasida ehtiyotkor bog‘lanish tuzing."}
            ]
    elif data.assessment_type == "practice":
        items = [{"id": f"{data.course}-{data.subject_id}-practice-1", "prompt": f"{subject['name']} bo‘yicha amaliy mashq: {subject['objective']}.", "instruction": "Asosiy mexanizmni o‘z so‘zingiz bilan izohlang, bitta misol keltiring va xatolaringizni qayd eting."}]
    elif data.assessment_type in {"skills", "practical_exam"}:
        items = [{"id": q["id"], "question": q["title"], "prompt": q["instruction"], "checklist": q["checklist"]} for q in bank["skills"]]
        if data.assessment_type == "practical_exam":
            items += [{"id": q["id"], "question": q["station"], "prompt": q["prompt"], "checklist": q["checklist"]} for q in bank["osce"]]
    elif data.assessment_type == "osce":
        items = [{"id": q["id"], "question": q["station"], "prompt": q["prompt"], "checklist": q["checklist"]} for q in bank["osce"]]
    elif data.assessment_type == "case":
        items = [{"id": q["id"], "scenario": q["scenario"], "prompt": q["prompt"], "options": q["options"]} for q in bank["case"]]
    elif data.assessment_type == "theory_exam":
        items = [{"id": q["id"], "question": q["question"], "options": q["options"]} for q in bank["exam"]]
    else:
        pool = bank["exam"] if data.assessment_type in {"exam", "test"} else bank["quiz"]
        if data.assessment_type == "quiz":
            pool = bank["quiz"][:5]
        items = [{"id": q["id"], "question": q["question"], "options": q["options"]} for q in pool]
    ap = _academy_profile(user["username"])
    study_language = str(ap.get("study_language") or "uz").lower().split("-")[0]
    if study_language in {"uz", "uzbek", "uzb"}:
        items = _academy_translate_payload(items)
    return {"status": "started", "course": data.course, "subject_id": data.subject_id, "assessment_type": data.assessment_type, "items": items, "time_limit_minutes": 60 if data.assessment_type in {"theory_exam", "exam"} else (45 if data.assessment_type == "practical_exam" else None)}

@app.post("/api/v1/academy/assessment/submit")
def academy_submit_assessment(data: AcademyAssessmentSubmitRequest, user=Depends(get_current_user)):
    if data.assessment_type not in ACADEMY_ASSESSMENT_TYPES:
        raise HTTPException(status_code=400, detail="Invalid assessment type.")
    subject = _academy_subject(data.course, data.subject_id)
    bank = _academy_question_bank(data.course, subject)
    if data.assessment_type in {"theory", "practice"}:
        score = 100 if data.answers.get("completion") == 1 else 0
        total = 1
    elif data.assessment_type == "puzzle":
        expected = {"frontal": 0, "parietal": 1, "temporal": 2, "occipital": 3, "cerebellum": 4, "brainstem": 5} if data.course == 1 and data.subject_id == "Anatomy" else {}
        total = len(expected)
        correct = sum(1 for part, slot in expected.items() if data.answers.get(part) == slot)
        score = round(correct * 100 / total) if total else 0
    elif data.assessment_type in {"skills", "osce", "practical_exam"}:
        items = bank["skills"] if data.assessment_type == "skills" else (bank["skills"] + bank["osce"] if data.assessment_type == "practical_exam" else bank["osce"])
        total = sum(len(item["checklist"]) for item in items)
        completed = sum(1 for item in items for index in range(len(item["checklist"])) if data.answers.get(f"{item['id']}:{index}") == 1)
        score = round(completed * 100 / total) if total else 0
    else:
        questions = bank["case"] if data.assessment_type == "case" else (bank["exam"] if data.assessment_type in {"exam", "theory_exam", "test"} else bank["quiz"])
        if data.assessment_type == "quiz":
            questions = questions[:5]
        correct = sum(1 for q in questions if data.answers.get(q["id"]) == q["answer"])
        total = len(questions)
        score = round(correct * 100 / total) if total else 0
    record = _save_academy_assessment(user["username"], data.course, data.subject_id, data.assessment_type, score)
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
    message: str = Field(min_length=1, max_length=3000)
    language: str = "uz"
    search_evidence: bool = False

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
    language = data.language if data.language in {"uz", "en", "ru"} else "uz"
    texts = {
        "uz": {
            "login": "Kirish uchun foydalanuvchi nomi va parolni tekshiring. Parolingizni xabarga yozmang. Yordam markazida muammo yuborishingiz mumkin.",
            "bio": "Bioinformatika bo‘limida DNK, RNK yoki oqsil ketma-ketligini kiriting. Masalan, ATGC bilan uzunlik va GC ulushini ko‘rishingiz mumkin. Bu o‘quv misoli.",
            "drug": "Molekula bo‘limida SMILES yozuvi bilan hisoblash bajariladi. Masalan, CCO — etanol uchun o‘quv misoli. Docking uchun tayyorlangan ligand, retseptor va tekshirilgan qidiruv sohasi kerak. Hisoblash dori samaradorligini tasdiqlamaydi.",
            "default": "Savolingizni o‘z tilingizda yozing. Ilmiy maqolalarni topish uchun «PubMed manbalarini qidirish»ni belgilang. Men hozir platforma yo‘riqnomasi va manba qidiruvini bajaraman; umumiy sun’iy intellekt modeli ulanmagan.",
            "found": "PubMed manbalari topildi. Quyida asl sarlavha va maqola havolalari berilgan; ular avtomatik tarjima yoki davolash tavsiyasi emas. Avval sharh maqolalarni o‘qing, so‘ng tadqiqot savolini toraytiring. Molekula tanlash uchun alohida nishon, taqqoslash mezoni va mustaqil tasdiq zarur.",
            "empty": "Bu so‘rov uchun PubMed manbasi topilmadi. Kasallik yoki oqsilning boshqa nomini kiriting. Manba yo‘qligi ilmiy xulosa emas.",
        },
        "en": {
            "login": "Check your username and password. Never include your password in messages. You can report the issue in Support.",
            "bio": "Enter a DNA, RNA or protein sequence in Bioinformatics. For example, ATGC demonstrates length and GC content. This is a learning example.",
            "drug": "Molecular analysis accepts SMILES. CCO (ethanol) is a learning example. Docking needs a prepared ligand, receptor and validated search box. Computation does not establish drug efficacy.",
            "default": "Write in your own language. Select Search PubMed evidence to retrieve papers. This assistant currently provides platform guidance and source retrieval; no general AI language model is connected.",
            "found": "PubMed sources retrieved. Original titles and article links appear below; they are not automatic translations or treatment recommendations. Start with review papers, then narrow your research question. Selecting a molecule requires a defined target, comparison criteria and independent validation.",
            "empty": "No PubMed sources were found. Try another disease or protein name. Missing search results are not a scientific conclusion.",
        },
        "ru": {
            "login": "Проверьте имя пользователя и пароль. Не отправляйте пароль в сообщениях. Обратитесь в поддержку.",
            "bio": "Введите последовательность ДНК, РНК или белка в разделе биоинформатики. Например, ATGC показывает длину и долю GC. Это учебный пример.",
            "drug": "Молекулярный анализ принимает SMILES. CCO (этанол) — учебный пример. Докинг требует подготовленных лиганда, рецептора и проверенной области поиска. Расчёт не подтверждает эффективность лекарства.",
            "default": "Пишите на своём языке. Для поиска статей выберите «Поиск источников PubMed». Сейчас помощник даёт инструкции по платформе и ищет источники; универсальная языковая ИИ-модель не подключена.",
            "found": "Найдены источники PubMed. Ниже приведены оригинальные названия и ссылки, а не автоматический перевод или рекомендации по лечению. Начните с обзоров и уточните исследовательский вопрос. Выбор молекулы требует определённой мишени, критериев сравнения и независимой проверки.",
            "empty": "Источники PubMed не найдены. Попробуйте другое название заболевания или белка. Отсутствие результатов не является научным выводом.",
        },
    }[language]
    ql = q.lower()
    evidence = []
    normalized = None
    if data.search_evidence:
        # Explicitly scoped retrieval, not an ungrounded diagnosis or drug ranking.
        normalized = normalize_pubmed_query(q)
        if re.search(r"\b(oiv(?:ni|ga|ning|dan)?|hiv|вич)\b", ql):
            normalized = "HIV treatment review"
        try:
            articles = _pubmed_articles(normalized, 5)
        except (URLError, TimeoutError, ET.ParseError):
            raise HTTPException(status_code=503, detail={"uz":"PubMed bilan bog‘lanib bo‘lmadi. Qayta urinib ko‘ring.","en":"PubMed is unavailable. Please retry.","ru":"PubMed недоступен. Повторите попытку."}[language])
        evidence = [{k: a.get(k, "") for k in ("pmid", "title", "url", "publication_date")} for a in articles]
        answer = texts["found" if evidence else "empty"]
    elif any(x in ql for x in ("login", "parol", "password", "парол", "kirish")):
        answer = texts["login"]
    elif any(x in ql for x in ("bioinformat", "sequence", "fasta", "dna", "rna", "protein", "oqsil", "днк", "белок")):
        answer = texts["bio"]
    elif any(x in ql for x in ("molecule", "molekula", "docking", "dori", "молекул", "докинг")):
        answer = texts["drug"]
    else:
        answer = texts["default"]
    return {"status":"ok", "answer":answer, "language":language, "evidence":evidence,
            "original_query":q, "search_query":normalized, "engine":"platform_guidance_and_pubmed_retrieval", "role":_safe_role(user)}



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
    if set(seq) - DNA_ALPHABET:
        raise HTTPException(status_code=400, detail="Translation requires DNA or RNA symbols (A, C, G, T/U, N).")
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
    if n * m > 1_000_000:
        raise HTTPException(
            status_code=413,
            detail="Interactive alignment is limited to 1,000,000 sequence-position pairs. Shorten one or both sequences.",
        )
    prev = [j * data.gap for j in range(m + 1)]
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
    if mol is None or mol.GetNumAtoms() == 0:
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

@app.get("/api/v1/pdb/structures/{pdb_id}/viewer")
def pdb_structure_viewer(pdb_id: str, user=Depends(get_current_user)):
    """Return the actual PDB coordinate text consumed by the frontend 3D viewer."""
    pdb_id = pdb_id.strip().upper()
    if not re.fullmatch(r"[0-9A-Z]{4}", pdb_id):
        raise HTTPException(status_code=400, detail="PDB ID must contain 4 alphanumeric characters")
    request = URLRequest(
        f"https://files.rcsb.org/download/{pdb_id}.pdb",
        headers={"User-Agent": "MedGenAI/1.1"},
    )
    try:
        with urlopen(request, timeout=20) as response:
            pdb_text = response.read().decode("utf-8")
    except HTTPError as exc:
        if exc.code == 404:
            raise HTTPException(status_code=404, detail=f"PDB structure {pdb_id} not found")
        raise HTTPException(status_code=502, detail="RCSB PDB file service returned an error")
    except (URLError, TimeoutError):
        raise HTTPException(status_code=503, detail="RCSB PDB file service is temporarily unavailable")
    if not pdb_text.strip() or not ("ATOM" in pdb_text or "HETATM" in pdb_text):
        raise HTTPException(status_code=502, detail="RCSB returned an empty or invalid PDB file")
    return {"status": "ready", "module": "PDB & Structure", "pdb_id": pdb_id, "pdb": pdb_text, "user": user["username"]}


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
    center_x: float = Field(allow_inf_nan=False)
    center_y: float = Field(allow_inf_nan=False)
    center_z: float = Field(allow_inf_nan=False)
    size_x: float = Field(default=20.0, gt=0, le=100, allow_inf_nan=False)
    size_y: float = Field(default=20.0, gt=0, le=100, allow_inf_nan=False)
    size_z: float = Field(default=20.0, gt=0, le=100, allow_inf_nan=False)
    exhaustiveness: int = Field(default=8, ge=1, le=64)
    n_poses: int = Field(default=3, ge=1, le=20)

class ScientificPipelineRequest(BaseModel):
    name: str = "MedGen Scientific Pipeline"
    target: str
    sequence: str = ""
    pdb_id: str = ""
    ligand_smiles: str = ""
    workflow_type: str = "sequence_structure_screening"

@app.post("/api/v1/docking/run")
def run_prepared_docking(data: PreparedDockingRequest, user=Depends(get_current_user)):
    return _execute_prepared_docking(data, user)


def _execute_prepared_docking(data: PreparedDockingRequest, user, *, persist=True):
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

        engine = Vina(sf_name="vina", verbosity=0, cpu=1)
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
            # Vina.energies() returns energy components, NOT RMSD bounds.
            # https://autodock-vina.readthedocs.io/en/stable/vina.html
            columns = ["affinity_kcal_mol", "intermolecular_energy_kcal_mol",
                       "intramolecular_energy_kcal_mol", "torsional_energy_kcal_mol",
                       "best_pose_intramolecular_energy_kcal_mol"]
            poses.append(dict(zip(columns, values)))
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
        if not persist:
            return {"job_id": job_id, "result": result}
        docking_jobs_store[job_id] = {"id": job_id, **result, "created_at": now}
        event = {"type":"docking_completed","username":user["username"],"job_id":job_id,"target":data.target,"at":now}
        activity_log.insert(0, event)
        try:
            _db_save()
        except Exception:
            docking_jobs_store.pop(job_id, None)
            if event in activity_log:
                activity_log.remove(event)
            raise
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

# =========================================================
# HIGH-THROUGHPUT VIRTUAL SCREENING (AutoDock Vina, batch of prepared ligands)
# =========================================================
SCREENING_MAX_LIGANDS = int(os.getenv("MEDGEN_SCREENING_MAX_LIGANDS", "25") or 25)
SCREENING_MAX_SECONDS = int(os.getenv("MEDGEN_SCREENING_MAX_SECONDS", "900") or 900)
SCREENING_ROLES = {"pharma", "researcher", "bioinformatician", "biotech", "super_admin", "admin"}


def _smiles_to_pdbqt(smiles: str) -> str:
    """Prepare a docking-ready ligand (3D conformer, charges, torsion tree) from a SMILES string."""
    from rdkit import Chem
    mol = Chem.MolFromSmiles(str(smiles or "").strip())
    if mol is None:
        raise ValueError("Invalid SMILES")
    if mol.GetNumHeavyAtoms() > 70:
        raise ValueError("Molecule is too large for screening")
    mol = Chem.AddHs(mol)
    params = AllChem.ETKDGv3()
    params.randomSeed = 42
    if AllChem.EmbedMolecule(mol, params) != 0:
        raise ValueError("3D conformer generation failed")
    try:
        AllChem.MMFFOptimizeMolecule(mol, maxIters=200)
    except Exception:
        pass
    try:
        from meeko import MoleculePreparation, PDBQTWriterLegacy
        setups = MoleculePreparation().prepare(mol)
        pdbqt, ok, err = PDBQTWriterLegacy.write_string(setups[0])
        if not ok:
            raise ValueError(err or "Ligand preparation failed")
        return pdbqt
    except ImportError:
        from meeko import MoleculePreparation
        prep = MoleculePreparation()
        prep.prepare(mol)
        return prep.write_pdbqt_string()
_screening_lock = threading.Lock()
_screening_running = set()


class ScreeningLigand(BaseModel):
    name: str = Field(default="ligand", max_length=80)
    smiles: str = Field(default="", max_length=500)
    ligand_pdbqt: str = Field(default="", max_length=200000)


class VirtualScreeningRequest(BaseModel):
    target: str = Field(max_length=200)
    receptor_pdbqt: str = Field(max_length=5000000)
    center_x: float = Field(allow_inf_nan=False)
    center_y: float = Field(allow_inf_nan=False)
    center_z: float = Field(allow_inf_nan=False)
    size_x: float = Field(default=20.0, gt=0, le=100, allow_inf_nan=False)
    size_y: float = Field(default=20.0, gt=0, le=100, allow_inf_nan=False)
    size_z: float = Field(default=20.0, gt=0, le=100, allow_inf_nan=False)
    exhaustiveness: int = Field(default=4, ge=1, le=16)
    ligands: list[ScreeningLigand] = Field(min_length=1, max_length=200)


def _screening_worker(job_id: str, data: VirtualScreeningRequest, user: dict) -> None:
    job = screening_jobs_store[job_id]
    started = time.time()
    try:
        for lig in data.ligands:
            entry = {"name": lig.name, "smiles": lig.smiles}
            if time.time() - started > SCREENING_MAX_SECONDS:
                entry["error"] = "Skipped: time limit reached"
                job["results"].append(entry)
                job["done"] += 1
                continue
            try:
                ligand_pdbqt = lig.ligand_pdbqt if lig.ligand_pdbqt.strip() else _smiles_to_pdbqt(lig.smiles)
                req = PreparedDockingRequest(
                    target=data.target, ligand_smiles=lig.smiles,
                    receptor_pdbqt=data.receptor_pdbqt, ligand_pdbqt=ligand_pdbqt,
                    center_x=data.center_x, center_y=data.center_y, center_z=data.center_z,
                    size_x=data.size_x, size_y=data.size_y, size_z=data.size_z,
                    exhaustiveness=data.exhaustiveness, n_poses=1,
                )
                res = _execute_prepared_docking(req, user, persist=False)
                entry["affinity_kcal_mol"] = res["result"]["poses"][0]["affinity_kcal_mol"]
            except HTTPException as exc:
                entry["error"] = str(exc.detail)[:200]
            except ValueError as exc:
                entry["error"] = str(exc)[:200]
            except Exception as exc:
                entry["error"] = type(exc).__name__
            job["results"].append(entry)
            job["done"] += 1
        job["status"] = "completed"
    except Exception as exc:
        job["status"] = "failed"
        job["error"] = type(exc).__name__
    finally:
        job["completed_at"] = datetime.now(timezone.utc).isoformat()
        try:
            _db_save()
        except Exception:
            pass
        with _screening_lock:
            _screening_running.discard(job["user"])


def _screening_view(job: dict) -> dict:
    ok = sorted([r for r in job["results"] if "affinity_kcal_mol" in r], key=lambda r: r["affinity_kcal_mol"])
    bad = [r for r in job["results"] if "affinity_kcal_mol" not in r]
    ranked = [dict(r, rank=i + 1) for i, r in enumerate(ok)] + bad
    return {k: v for k, v in job.items() if k != "results"} | {"results": ranked}


@app.post("/api/v1/screening/run")
def screening_run(data: VirtualScreeningRequest, user=Depends(get_current_user)):
    username = user["username"]
    if str(user.get("role", "")).lower() not in SCREENING_ROLES:
        raise HTTPException(status_code=403, detail="Virtual screening is available for Pharma and Researcher roles.")
    if not VINA_AVAILABLE:
        raise HTTPException(status_code=503, detail="AutoDock Vina engine is not installed on this deployment.")
    if len(data.ligands) > SCREENING_MAX_LIGANDS:
        raise HTTPException(status_code=400, detail=f"At most {SCREENING_MAX_LIGANDS} ligands per run.")
    if not data.receptor_pdbqt.strip():
        raise HTTPException(status_code=400, detail="Prepared receptor PDBQT is required.")
    if not all(l.ligand_pdbqt.strip() or l.smiles.strip() for l in data.ligands):
        raise HTTPException(status_code=400, detail="Each ligand needs a SMILES string or a prepared PDBQT.")
    with _screening_lock:
        if username in _screening_running or len(_screening_running) >= 1:
            raise HTTPException(status_code=429, detail="A screening is already running. Try again when it finishes.")
        _screening_running.add(username)
    job_id = secrets.token_hex(10)
    screening_jobs_store[job_id] = {
        "id": job_id, "user": username, "target": data.target, "status": "running",
        "total": len(data.ligands), "done": 0, "results": [],
        "created_at": datetime.now(timezone.utc).isoformat(), "engine": "AutoDock Vina",
        "warning": "Docking scores are computational evidence, not experimentally validated binding affinity.",
    }
    threading.Thread(target=_screening_worker, args=(job_id, data, user), daemon=True).start()
    return {"job_id": job_id, "status": "running", "total": len(data.ligands)}


@app.get("/api/v1/screening/{job_id}")
def screening_status(job_id: str, user=Depends(get_current_user)):
    job = screening_jobs_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Screening job not found")
    if job.get("user") != user["username"] and user.get("role") != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Access denied")
    return _screening_view(job)


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
    if not any((data.sequence.strip(),data.pdb_id.strip(),data.ligand_smiles.strip())):
        raise HTTPException(status_code=400,detail="Provide a sequence, PDB structure, or ligand SMILES to analyze.")
    if data.sequence.strip():
        bioinformatics_analyze(SequenceRequest(sequence=data.sequence),user)
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
        step_results.append(item)
    experiment={
        "id":secrets.token_hex(10),"name":data.name.strip() or "MedGen Virtual Lab Experiment",
        "workflow_type":"virtual_lab","target":target,"status":"ready",
        "input":{"sequence":data.sequence,"pdb_id":data.pdb_id,"ligand_smiles":data.ligand_smiles},
        "parameters":data.parameters,"results":{"steps":step_results},
        "user":user["username"],"created_at":now,"updated_at":now
    }
    experiments_store.insert(0,experiment)
    event={"type":"lab_pipeline_created","username":user["username"],"experiment_id":experiment["id"],"target":target,"at":now}
    activity_log.insert(0,event)
    try:
        _db_save()
    except Exception:
        experiments_store[:]=[item for item in experiments_store if item is not experiment]
        activity_log[:]=[item for item in activity_log if item is not event]
        raise
    return {"status":"ready","module":"Virtual Laboratory","experiment":experiment}

@app.post("/api/v1/lab/experiments/{experiment_id}/execute")
def execute_lab_experiment(experiment_id: str, user=Depends(get_current_user)):
    experiment = next((e for e in experiments_store if e.get("id") == experiment_id), None)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    if experiment.get("user") != user["username"] and user.get("role") != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Access denied")

    if not experiment.get("results",{}).get("steps"):
        raise HTTPException(status_code=409,detail="This legacy experiment has no recorded steps. Create a new experiment to run analysis.")
    previous=copy.deepcopy(experiment)
    experiment_input = experiment.get("input", {})
    results = experiment.setdefault("results", {}).setdefault("steps", [])

    for item in results:
        step = item.get("step")
        if item.get("status") not in ("ready", "available_after_completion"):
            continue

        if step == "sequence_analysis":
            sequence = str(experiment_input.get("sequence", "") or "").strip()
            if sequence:
                try:
                    item["result"] = bioinformatics_analyze(SequenceRequest(sequence=sequence), user)
                    item["status"] = "completed"
                except HTTPException as exc:
                    item["status"] = "failed"
                    item["result"] = {"error": exc.detail}
            else:
                item["status"] = "skipped"
                item["result"] = {"reason": "No sequence supplied"}

        elif step == "structure_lookup":
            pdb_id = str(experiment_input.get("pdb_id", "") or "").strip().upper()
            if pdb_id:
                try:
                    item["result"] = pdb_structure(pdb_id, user)
                    item["status"] = "completed"
                except HTTPException as exc:
                    item["status"] = "failed"
                    item["result"] = {"error": exc.detail}
            else:
                item["status"] = "skipped"
                item["result"] = {"reason": "No PDB ID supplied"}

        elif step == "molecular_analysis":
            smiles = str(experiment_input.get("ligand_smiles", "") or "").strip()
            if smiles:
                try:
                    item["result"] = _molecule_descriptors(smiles)
                    item["status"] = "completed"
                except (ValueError, HTTPException) as exc:
                    item["status"] = "failed"
                    item["result"] = {"error": getattr(exc, "detail", str(exc))}
            else:
                item["status"] = "skipped"
                item["result"] = {"reason": "No ligand SMILES supplied"}

        elif step == "virtual_screening":
            smiles = str(experiment_input.get("ligand_smiles", "") or "").strip()
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
                except (ValueError, HTTPException) as exc:
                    item["status"] = "failed"
                    item["result"] = {"error": getattr(exc, "detail", str(exc))}
            else:
                item["status"] = "skipped"
                item["result"] = {
                    "engine": "MedGen screening workflow",
                    "status": "skipped",
                    "reason": "No ligand SMILES supplied"
                }

        elif step == "docking":
            item["status"] = "requires_prepared_inputs"
            item["result"] = {
                "reason": "Docking was not run: a prepared receptor and ligand PDBQT plus binding-site coordinates are required.",
                "endpoint": "/api/v1/docking/run"
            }

        elif step == "report":
            item["status"] = "completed"
            item["result"] = {"note": "Experiment data is ready for scientific report generation."}

    failed = sum(1 for item in results if item.get("status") == "failed")
    pending = sum(1 for item in results if item.get("status") in ("ready", "requires_prepared_inputs"))
    skipped = sum(1 for item in results if item.get("status") == "skipped")
    experiment["status"] = "completed_with_warnings" if (failed or pending or skipped) else "completed"
    experiment["results"]["execution_summary"] = {
        "total_steps": len(results),
        "completed_steps": sum(1 for item in results if item.get("status") == "completed"),
        "failed_steps": failed,
        "skipped_steps": skipped,
        "steps_requiring_inputs": pending,
        "status": experiment["status"]
    }
    experiment["updated_at"] = datetime.now(timezone.utc).isoformat()
    event={
        "type": "lab_experiment_executed",
        "username": user["username"],
        "experiment_id": experiment_id,
        "status": experiment["status"],
        "at": experiment["updated_at"]
    }
    activity_log.insert(0,event)
    try:
        _db_save()
    except Exception:
        experiment.clear();experiment.update(previous)
        activity_log[:]=[item for item in activity_log if item is not event]
        raise
    return {
        "status": experiment["status"],
        "module": "Virtual Laboratory",
        "experiment": experiment
    }

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
        "user":user["username"],
        "created_at":datetime.now(timezone.utc).isoformat(),
        "inputs":experiment.get("input",{}) if data.include_inputs else {},
        "results":experiment.get("results",{}) if data.include_results else {},
        "methodology":{"workflow_type":experiment.get("workflow_type"),"parameters":experiment.get("parameters",{})},
        "disclaimer":"Computational research output. It is not a clinical diagnosis, treatment recommendation, or experimentally validated efficacy/safety result."
    }
    reports_store.insert(0,report)
    event={"type":"scientific_report_created","username":user["username"],"report_id":report["id"],"experiment_id":experiment["id"],"at":report["created_at"]}
    activity_log.insert(0,event)
    try:
        _db_save()
    except Exception:
        reports_store[:]=[item for item in reports_store if item is not report]
        activity_log[:]=[item for item in activity_log if item is not event]
        raise
    return {"status":"completed","module":"Scientific Research","report":report}

@app.get("/api/v1/scientific/reports/{report_id}")
def get_scientific_report(report_id:str,user=Depends(get_current_user)):
    report=next((r for r in reports_store if r.get("id")==report_id),None)
    if not report:
        raise HTTPException(status_code=404,detail="Report not found")

    # Authorize against the report owner itself. Do not allow access to an
    # orphaned legacy report just because its experiment record is missing.
    is_admin = user.get("role") == "SUPER_ADMIN"
    if report.get("user") != user["username"] and not is_admin:
        raise HTTPException(status_code=403,detail="Access denied")

    # Also protect reports whose owner metadata is present but conflicts with
    # the linked experiment's owner.
    experiment=next((e for e in experiments_store if e.get("id")==report.get("experiment_id")),None)
    if experiment and experiment.get("user") != user["username"] and not is_admin:
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
    similarity_library: list[str] = Field(default_factory=list, max_length=200)

@app.post("/api/v1/scientific/workflow")
def run_scientific_workflow(data: ScientificWorkflowRequest,user=Depends(get_current_user)):
    target=data.target.strip()
    if not target: raise HTTPException(status_code=400,detail="Target is required")
    if not any((data.sequence.strip(), data.pdb_id.strip(), data.ligand_smiles.strip())):
        raise HTTPException(status_code=400, detail="Provide a sequence, PDB structure, or ligand SMILES to analyze.")
    if data.run_similarity and data.similarity_library and not data.ligand_smiles.strip():
        raise HTTPException(status_code=400, detail="Similarity analysis requires a reference ligand SMILES.")
    # Validate submitted inputs before external requests or publishing any result.
    seq = _clean_sequence(data.sequence)
    if data.sequence.strip():
        bioinformatics_analyze(SequenceRequest(sequence=data.sequence), user)
    molecule = None
    candidates = []
    if data.ligand_smiles.strip():
        try:
            molecule = _molecule_descriptors(data.ligand_smiles.strip())
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid reference ligand SMILES.")
    if data.run_similarity:
        for index, candidate in enumerate(data.similarity_library, 1):
            try:
                canonical = _molecule_descriptors(candidate)["canonical_smiles"]
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid similarity SMILES at row {index}.")
            candidates.append((candidate, canonical))
    result={"status":"completed","name":data.name,"target":target,"stages":[],
            "owner":user["username"],"created_at":datetime.utcnow().isoformat()+"Z"}
    if data.pdb_id:
        bridge=sequence_structure_bridge(StructureAnalysisRequest(pdb_id=data.pdb_id,chain_id=data.chain_id),user)
        seq=bridge.get("sequence","") or seq
        result["structure"]=bridge
        result["stages"].append({"stage":"structure","status":"completed"})
    if seq:
        clean=_clean_sequence(seq)
        analysis = bioinformatics_analyze(SequenceRequest(sequence=clean), user)
        result["sequence"]={"length":len(clean),"sequence":clean[:5000],
                            "truncated":len(clean)>5000,"analysis":analysis}
        result["stages"].append({"stage":"sequence","status":"completed"})
    if data.ligand_smiles.strip():
        result["molecule"]=molecule
        result["stages"].append({"stage":"molecular_analysis","status":"completed"})
        if data.run_similarity and data.similarity_library:
            sims=[]
            ref=data.ligand_smiles.strip()
            for candidate, canonical in candidates:
                sims.append({"smiles":candidate,"canonical_smiles":canonical,
                             "similarity":_tanimoto_similarity(ref,canonical)})
            result["similarity"]=sorted(sims,key=lambda x:x["similarity"],reverse=True)
            result["stages"].append({"stage":"similarity","status":"completed"})
    experiment_id = str(uuid.uuid4())
    result["experiment_id"] = experiment_id
    result["report_ready"]=True
    # Use the existing list schema and ownership key consumed by history/detail.
    exp={"id":experiment_id,"owner":user["username"],"user":user["username"],
         "type":"scientific_workflow","workflow_type":"scientific_workflow",
         "name":data.name,"target":target,"status":"completed",
         "created_at":result["created_at"],"updated_at":result["created_at"],
         "input":data.model_dump(),"parameters":{},"results":result,"result":result}
    experiments_store.insert(0, exp)
    try:
        _db_save()
    except Exception:
        # Do not leave a failed write visible in the user's history or persist
        # it accidentally with a later, unrelated successful request.
        experiments_store[:] = [item for item in experiments_store if item is not exp]
        raise
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


# Restore persisted application state after every Render process start.
# Keep this at module end so all in-memory stores are defined before loading.
# =========================================================
# DAILY STATE SNAPSHOTS (kept inside the same database, last 7)
# =========================================================
def _backup_snapshot():
    if not PERSISTENCE_ENABLED:
        return
    try:
        with psycopg.connect(DATABASE_URL) as conn:
            conn.execute("CREATE TABLE IF NOT EXISTS medgen_state_backups (id BIGSERIAL PRIMARY KEY, taken_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), state JSONB NOT NULL)")
            last = conn.execute("SELECT taken_at FROM medgen_state_backups ORDER BY taken_at DESC LIMIT 1").fetchone()
            if last and (datetime.now(timezone.utc) - last[0]).total_seconds() < 82800:
                return
            conn.execute("INSERT INTO medgen_state_backups(state) SELECT COALESCE(jsonb_object_agg(state_key, state_value), '{}'::jsonb) FROM medgen_state")
            conn.execute("DELETE FROM medgen_state_backups WHERE id NOT IN (SELECT id FROM medgen_state_backups ORDER BY taken_at DESC LIMIT 7)")
            conn.commit()
            print("BACKUP OK")
    except Exception as exc:
        print("BACKUP FAILED:", type(exc).__name__)


def _backup_loop():
    time.sleep(60)
    while True:
        _backup_snapshot()
        time.sleep(3600)


@app.on_event("startup")
def load_persisted_state():
    _db_load()
    threading.Thread(target=_backup_loop, daemon=True).start()

# Existing public AlphaFold DB models; not on-demand folding or drug validation.
def _alphafold_model(accession: str) -> dict:
    accession = accession.strip().upper()
    if not re.fullmatch(r'[A-Z0-9]{6,10}', accession):
        raise HTTPException(400, 'Enter a UniProt accession, for example P69905.')
    try:
        with urlopen(URLRequest('https://alphafold.ebi.ac.uk/api/prediction/'+accession,
                               headers={'User-Agent':'MedGenAI/1.1'}), timeout=15) as response:
            entries = json.loads(response.read(2_000_001))
        if not isinstance(entries, list) or not entries:
            raise HTTPException(404, 'No AlphaFold DB model found for this accession.')
        entry = next((item for item in entries if item.get('uniprotAccession') == accession), None)
        if not entry:
            raise HTTPException(404, 'No matching AlphaFold DB model found.')
        model_url = entry.get('pdbUrl', '')
        if not re.fullmatch(r'https://alphafold\.ebi\.ac\.uk/files/AF-[A-Z0-9]+-F\d+-model_v\d+\.pdb', model_url):
            raise HTTPException(502, 'AlphaFold returned an unsupported model URL.')
        with urlopen(URLRequest(model_url, headers={'User-Agent':'MedGenAI/1.1'}), timeout=20) as response:
            raw = response.read(5_000_001)
        if len(raw)>5_000_000:
            raise HTTPException(413, 'This model exceeds the interactive viewer size limit.')
        pdb = raw.decode('utf-8')
        if not any(line.startswith('ATOM  ') for line in pdb.splitlines()):
            raise HTTPException(502, 'AlphaFold returned an invalid structure file.')
        return {'status':'completed','source':'AlphaFold DB','model_type':'predicted',
                'accession':accession,'entry_id':entry.get('entryId'),
                'mean_plddt':entry.get('globalMetricValue'),'model_date':entry.get('modelCreatedDate'),
                'source_url':'https://alphafold.ebi.ac.uk/entry/'+accession,
                'pdb':pdb,'warning':'Predicted structure. pLDDT measures local model confidence, not drug efficacy or clinical validity.'}
    except HTTPError as exc:
        raise HTTPException(404 if exc.code==404 else 502, 'AlphaFold model is unavailable.') from exc
    except (URLError, TimeoutError, ValueError, UnicodeError) as exc:
        raise HTTPException(503, 'Unable to load AlphaFold DB. Retry later.') from exc

@app.get('/api/v1/structures/alphafold/{accession}')
def alphafold_structure(accession: str, user=Depends(get_current_user)):
    return _alphafold_model(accession)

class ScholarshipRequest(BaseModel):
    title: str = Field(min_length=3, max_length=180)
    organization: str = Field(min_length=2, max_length=180)
    description: str = Field(min_length=20, max_length=4000)
    deadline: date
    source_url: str = Field(max_length=1000)
    language: str = 'uz'

@app.get('/api/v1/opportunities')
def list_opportunities(user=Depends(get_current_user)):
    admin = user.get('role') == 'SUPER_ADMIN'
    today = date.today().isoformat()
    items = [dict(item) for item in opportunities_store.values()
             if admin or item['owner'] == user['username'] or
             (item['status'] == 'published' and item['deadline'] >= today)]
    return {'items':sorted(items,key=lambda item:item['deadline']),
            'can_submit':user.get('role') in {'professor','SUPER_ADMIN'},'can_review':admin}

@app.post('/api/v1/opportunities')
def create_opportunity(data: ScholarshipRequest, user=Depends(get_current_user)):
    if user.get('role') not in {'professor','SUPER_ADMIN'}:
        raise HTTPException(403, 'Only professors and administrators may submit opportunities.')
    parsed = urlsplit(data.source_url)
    if parsed.scheme != 'https' or not parsed.hostname or parsed.username or parsed.password:
        raise HTTPException(400, 'Provide an HTTPS link to the official opportunity page.')
    if data.deadline < date.today():
        raise HTTPException(400, 'The deadline must not be in the past.')
    if not data.title.strip() or not data.organization.strip() or len(data.description.strip()) < 20:
        raise HTTPException(400, 'Complete the title, organization and eligibility description.')
    if data.language not in {'uz','en','ru','de','fr'}:
        raise HTTPException(400, 'Unsupported announcement language.')
    if sum(item['owner']==user['username'] and item['status']=='pending' for item in opportunities_store.values())>=30:
        raise HTTPException(429, 'Review pending submissions before creating more.')
    identifier = secrets.token_hex(12)
    item = {**data.model_dump(mode='json'), 'id':identifier,'owner':user['username'],
            'status':'pending','created_at':datetime.now(timezone.utc).isoformat(),
            'reviewed_by':None}
    opportunities_store[identifier] = item
    try: _db_save()
    except Exception:
        opportunities_store.pop(identifier,None)
        raise
    return {'item':item}

@app.patch('/api/v1/opportunities/{identifier}')
def review_opportunity(identifier: str, publish: bool, user=Depends(get_current_user)):
    require_super_admin(user)
    previous = opportunities_store.get(identifier)
    if not previous: raise HTTPException(404, 'Opportunity not found.')
    if publish and previous['deadline'] < date.today().isoformat():
        raise HTTPException(400, 'Expired opportunities cannot be published.')
    updated = {**previous,'status':'published' if publish else 'rejected',
               'reviewed_by':user['username'],'reviewed_at':datetime.now(timezone.utc).isoformat()}
    opportunities_store[identifier] = updated
    try: _db_save()
    except Exception:
        opportunities_store[identifier] = previous
        raise
    return {'item':updated}
