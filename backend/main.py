from datetime import datetime, timedelta, timezone
import hashlib
import os
import secrets

from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from typing import Any


app = FastAPI(
    title="MedGen AI API",
    version="1.0.0",
    docs_url="/api/docs",
)

security = HTTPBearer(auto_error=False)

ADMIN_USERNAME = os.getenv("MEDGEN_ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("MEDGEN_ADMIN_PASSWORD", "MedGenAI-Admin-2026")
SECRET_KEY = os.getenv("MEDGEN_SECRET_KEY", "CHANGE-ME-IN-PRODUCTION")


tokens = {}


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


def make_token(username: str) -> str:
    raw = f"{username}:{datetime.now(timezone.utc).timestamp()}:{secrets.token_hex(16)}:{SECRET_KEY}"
    return hashlib.sha256(raw.encode()).hexdigest()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
):
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")

    username = tokens.get(credentials.credentials)

    if not username:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return {
        "username": username,
        "role": "SUPER_ADMIN" if username == ADMIN_USERNAME else "USER",
    }


@app.get("/api/v1/health/live")
def health_live():
    return {
        "status": "ok",
        "service": "medgen-api",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


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


@app.post("/api/v1/molecules/analyze")
def molecule_analyze(
    data: MoleculeRequest,
    user=Depends(get_current_user),
):
    return {
        "status": "received",
        "module": "Molecular Analysis",
        "smiles": data.smiles,
        "user": user["username"],
        "message": "Molecular analysis endpoint is connected.",
    }


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
        "created_at": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/v1/reports")
def reports(user=Depends(get_current_user)):
    return {
        "reports": [],
        "count": 0,
        "user": user["username"],
    }


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


@app.get("/api/v1/pdb/structures/{pdb_id}")
def pdb_structure(
    pdb_id: str,
    user=Depends(get_current_user),
):
    return {
        "status": "received",
        "pdb_id": pdb_id.upper(),
        "message": "PDB integration point is connected.",
        "user": user["username"],
    }


@app.post("/api/v1/discovery/sessions")
def discovery_session(
    data: DiscoveryRequest,
    user=Depends(get_current_user),
):
    return {
        "status": "created",
        "target": data.target,
        "user": user["username"],
        "message": "Drug Discovery session endpoint is connected.",
    }


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
    }
