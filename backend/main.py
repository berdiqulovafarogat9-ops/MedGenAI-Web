from datetime import datetime, timezone
import hashlib
import json
import os
import secrets
from typing import Any
from urllib.parse import quote
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel


app = FastAPI(
    title="MedGen AI API",
    version="1.1.0",
    docs_url="/api/docs",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://medgen-web.onrender.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer(auto_error=False)

ADMIN_USERNAME = os.getenv("MEDGEN_ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv(
    "MEDGEN_ADMIN_PASSWORD",
    "MedGenAI-Admin-2026",
)
SECRET_KEY = os.getenv(
    "MEDGEN_SECRET_KEY",
    "CHANGE-ME-IN-PRODUCTION",
)

tokens = {}


# =========================
# MODELS
# =========================

class LoginRequest(BaseModel):
    username: str
    password: str


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


class DiscoveryRequest(BaseModel):
    target: str


class SequenceRequest(BaseModel):
    sequence: str
    sequence_type: str = "AUTO"


# =========================
# AUTH
# =========================

def make_token(username: str) -> str:
    raw = (
        f"{username}:"
        f"{datetime.now(timezone.utc).timestamp()}:"
        f"{secrets.token_hex(16)}:"
        f"{SECRET_KEY}"
    )

    return hashlib.sha256(raw.encode()).hexdigest()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    if not credentials:
        raise HTTPException(
            status_code=401,
            detail="Authentication required",
        )

    username = tokens.get(credentials.credentials)

    if not username:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
        )

    return {
        "username": username,
        "role": (
            "SUPER_ADMIN"
            if username == ADMIN_USERNAME
            else "USER"
        ),
    }


# =========================
# HEALTH
# =========================

@app.get("/api/v1/health/live")
def health_live():
    return {
        "status": "ok",
        "service": "medgen-api",
        "version": "1.1.0",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# =========================
# AUTH
# =========================

@app.post("/api/v1/auth/login")
def login(data: LoginRequest):
    if (
        data.username != ADMIN_USERNAME
        or data.password != ADMIN_PASSWORD
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    token = make_token(data.username)
    tokens[token] = data.username

    return {
        "access_token": token,
        "token_type": "bearer",
    }


@app.get("/api/v1/auth/me")
def me(user=Depends(get_current_user)):
    return user


# =========================
# MOLECULAR ANALYSIS
# =========================

@app.post("/api/v1/molecules/analyze")
def molecule_analyze(
    data: MoleculeRequest,
    user=Depends(get_current_user),
):
    smiles = data.smiles.strip()

    if not smiles:
        raise HTTPException(
            status_code=400,
            detail="SMILES is required",
        )

    result = {
        "status": "completed",
        "module": "Molecular Analysis",
        "smiles": smiles,
        "user": user["username"],
        "analysis": {
            "length": len(smiles),
            "heavy_atom_estimate": sum(
                1 for c in smiles
                if c.isalpha() and c.isupper()
            ),
            "rings": sum(
                1 for c in smiles
                if c.isdigit()
            ) // 2,
            "formal_charge_markers": (
                smiles.count("+") - smiles.count("-")
            ),
        },
        "message": (
            "Basic molecular analysis completed. "
            "Advanced RDKit analysis can be added next."
        ),
    }

    return result


# =========================
# BIOINFORMATICS
# =========================

def detect_sequence_type(sequence: str) -> str:
    clean = sequence.upper().replace(" ", "").replace("\n", "")

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


@app.post("/api/v1/bioinformatics/analyze")
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

    detected = detect_sequence_type(sequence)

    if data.sequence_type.upper() != "AUTO":
        detected = data.sequence_type.upper()

    gc_count = sequence.count("G") + sequence.count("C")
    at_count = sequence.count("A") + sequence.count("T")

    gc_content = (
        round((gc_count / len(sequence)) * 100, 2)
        if sequence
        else 0
    )

    return {
        "status": "completed",
        "module": "Bioinformatics",
        "user": user["username"],
        "sequence_type": detected,
        "length": len(sequence),
        "composition": {
            "A": sequence.count("A"),
            "C": sequence.count("C"),
            "G": sequence.count("G"),
            "T": sequence.count("T"),
            "U": sequence.count("U"),
        },
        "gc_content_percent": gc_content,
        "at_content_percent": (
            round((at_count / len(sequence)) * 100, 2)
            if sequence
            else 0
        ),
        "message": "Sequence analysis completed.",
    }


@app.post("/api/v1/workflows/bioinformatics")
def bioinformatics_workflow(
    data: SequenceRequest,
    user=Depends(get_current_user),
):
    return bioinformatics_analyze(data, user)


# =========================
# PDB / STRUCTURE
# =========================

@app.get("/api/v1/pdb/structures/{pdb_id}")
def pdb_structure(
    pdb_id: str,
    user=Depends(get_current_user),
):
    pdb_id = pdb_id.strip().upper()

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

        with urlopen(request, timeout=15) as response:
            raw = response.read().decode("utf-8")

        data = json.loads(raw)

    except HTTPError as exc:
        if exc.code == 404:
            raise HTTPException(
                status_code=404,
                detail=f"PDB structure {pdb_id} not found.",
            )

        raise HTTPException(
            status_code=502,
            detail="RCSB PDB service returned an error.",
        )

    except (URLError, TimeoutError):
        raise HTTPException(
            status_code=503,
            detail="Unable to connect to RCSB PDB.",
        )

    entry = data.get("struct", {})
    rcsb_id = data.get("rcsb_id", pdb_id)

    return {
        "status": "completed",
        "module": "PDB & Structure",
        "user": user["username"],
        "pdb_id": rcsb_id,
        "title": entry.get("title"),
        "deposition_date": entry.get(
            "pdbx_descriptor"
        ),
        "source": "RCSB Protein Data Bank",
        "data": data,
    }


# =========================
# JOBS
# =========================

@app.get("/api/v1/jobs")
def list_jobs(user=Depends(get_current_user)):
    return {
        "jobs": [],
        "count": 0,
        "user": user["username"],
    }


@app.post("/api/v1/jobs")
def create_job(
    data: JobRequest,
    user=Depends(get_current_user),
):
    return {
        "status": "submitted",
        "job_type": data.job_type,
        "input": data.input,
        "user": user["username"],
        "created_at": datetime.now(
            timezone.utc
        ).isoformat(),
    }


# =========================
# REPORTS
# =========================

@app.get("/api/v1/reports")
def reports(user=Depends(get_current_user)):
    return {
        "reports": [],
        "count": 0,
        "user": user["username"],
    }


# =========================
# WORKFLOWS
# =========================

@app.post("/api/v1/workflows")
def create_workflow(
    data: WorkflowRequest,
    user=Depends(get_current_user),
):
    return {
        "status": "submitted",
        "workflow_type": data.workflow_type,
        "input": data.input,
        "user": user["username"],
    }


@app.get("/api/v1/workflows")
def list_workflows(user=Depends(get_current_user)):
    return {
        "workflows": [],
        "count": 0,
        "user": user["username"],
    }


# =========================
# DRUG DISCOVERY
# =========================

@app.post("/api/v1/discovery/sessions")
def discovery_session(
    data: DiscoveryRequest,
    user=Depends(get_current_user),
):
    return {
        "status": "created",
        "target": data.target,
        "user": user["username"],
        "message": (
            "Drug Discovery session created."
        ),
    }


# =========================
# RESEARCH
# =========================

@app.post("/api/v1/research/search")
def research_search(
    data: ResearchRequest,
    user=Depends(get_current_user),
):
    return {
        "status": "completed",
        "query": data.query,
        "limit": data.limit,
        "results": [],
        "user": user["username"],
        "message": (
            "Research search endpoint is ready "
            "for external scientific databases."
        ),
    }
