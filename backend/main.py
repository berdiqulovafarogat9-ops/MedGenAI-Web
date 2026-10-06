from datetime import datetime, timezone
import hashlib
import json
import xml.etree.ElementTree as ET
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
        "https://medgen-web.onrender.com",
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

ADMIN_PASSWORD = os.getenv(
    "MEDGEN_ADMIN_PASSWORD",
    "MedGenAI-Admin-2026",
)

SECRET_KEY = os.getenv(
    "MEDGEN_SECRET_KEY",
    "CHANGE-ME-IN-PRODUCTION",
)

tokens = {}
jobs_store = []
workflows_store = []
reports_store = []


# =========================================================
# MODELS
# =========================================================

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


# =========================================================
# AUTH FUNCTIONS
# =========================================================

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

    username = tokens.get(
        credentials.credentials
    )

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

    if (
        data.username != ADMIN_USERNAME
        or data.password != ADMIN_PASSWORD
    ):
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password",
        )

    token = make_token(
        data.username
    )

    tokens[token] = data.username

    return {
        "access_token": token,
        "token_type": "bearer",
    }


@app.get("/api/v1/auth/me")
def me(
    user=Depends(get_current_user),
):
    return user


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
        raise HTTPException(
            status_code=400,
            detail="SMILES is required",
        )

    uppercase_atoms = sum(
        1
        for char in smiles
        if char.isalpha()
        and char.isupper()
    )

    ring_digits = sum(
        1
        for char in smiles
        if char.isdigit()
    )

    formal_charge = (
        smiles.count("+")
        - smiles.count("-")
    )

    return {
        "status": "completed",
        "module": "Molecular Analysis",
        "smiles": smiles,
        "user": user["username"],
        "analysis": {
            "smiles_length": len(smiles),
            "heavy_atom_estimate": uppercase_atoms,
            "ring_digit_count": ring_digits,
            "estimated_rings": ring_digits // 2,
            "formal_charge_markers": formal_charge,
        },
        "message": (
            "Basic molecular analysis completed."
        ),
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
# RESEARCH
# =========================================================

@app.post(
    "/api/v1/research/search"
)
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


def calculate_molecule_score(smiles: str) -> dict:
    """
    Development-stage heuristic scoring.
    This is NOT a validated docking/ADMET model.
    """

    smiles = smiles.strip()

    if not smiles:
        return {
            "score": 0,
            "size_score": 0,
            "ring_score": 0,
            "charge_score": 0,
        }

    atom_count = sum(
        1
        for char in smiles
        if char.isalpha()
        and char.isupper()
    )

    ring_count = sum(
        1
        for char in smiles
        if char.isdigit()
    ) // 2

    charge_markers = (
        smiles.count("+")
        + smiles.count("-")
    )

    size_score = max(
        0,
        min(
            40,
            40 - abs(atom_count - 20) * 2
        )
    )

    ring_score = min(
        25,
        ring_count * 8
    )

    charge_score = max(
        0,
        20 - charge_markers * 10
    )

    complexity_score = min(
        15,
        len(smiles)
    )

    total = round(
        size_score
        + ring_score
        + charge_score
        + complexity_score,
        2,
    )

    return {
        "score": total,
        "atom_estimate": atom_count,
        "ring_estimate": ring_count,
        "charge_markers": charge_markers,
        "size_score": size_score,
        "ring_score": ring_score,
        "charge_score": charge_score,
        "complexity_score": complexity_score,
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
# DISCOVERY SESSION DETAILS
# =========================================================

@app.get(
    "/api/v1/discovery/sessions/{target}"
)
def discovery_target(
    target: str,
    user=Depends(get_current_user),
):

    target = target.strip()

    if not target:
        raise HTTPException(
            status_code=400,
            detail="Target is required",
        )

    return {
        "status": "ready",
        "module": "Drug Discovery",
        "target": target,
        "pipeline": [
            "Target definition",
            "Structure retrieval",
            "Molecule preparation",
            "Virtual screening",
            "Ranking",
            "Scientific report",
        ],
        "user": user["username"],
    }


# =========================================================
# SCIENTIFIC JOBS
# =========================================================

@app.get(
    "/api/v1/jobs/status"
)
def jobs_status(
    user=Depends(get_current_user),
):

    return {
        "status": "online",
        "worker": "development",
        "queue": "ready",
        "active_jobs": 0,
        "completed_jobs": 0,
        "failed_jobs": 0,
        "user": user["username"],
    }


# =========================================================
# RESEARCH ASSISTANT
# =========================================================

@app.post(
    "/api/v1/research/assistant"
)
def research_assistant(
    data: ResearchRequest,
    user=Depends(get_current_user),
):

    query = data.query.strip()

    if not query:
        raise HTTPException(
            status_code=400,
            detail="Research query is required",
        )

    return {
        "status": "completed",
        "module": "Research Assistant",
        "query": query,
        "results": [],
        "citations": [],
        "message": (
            "Research Assistant pipeline "
            "is ready for scientific database "
            "connectors."
        ),
        "user": user["username"],
    }


# =========================================================
# VIRTUAL LABORATORY
# =========================================================

@app.post(
    "/api/v1/lab/experiments"
)
def create_experiment(
    data: WorkflowRequest,
    user=Depends(get_current_user),
):

    return {
        "status": "created",
        "module": "Virtual Laboratory",
        "experiment_type": data.workflow_type,
        "input": data.input,
        "steps": [
            "Experiment created",
            "Input validation",
            "Execution pending",
            "Result generation",
            "Report generation",
        ],
        "user": user["username"],
    }


# =========================================================
# REPORT GENERATION
# =========================================================

@app.post(
    "/api/v1/reports/generate"
)
def generate_report(
    data: WorkflowRequest,
    user=Depends(get_current_user),
):

    report = {
        "id": secrets.token_hex(8),
        "status": "completed",
        "module": "Reports",
        "report_type": data.workflow_type,
        "input": data.input,
        "sections": [
            "Executive Summary",
            "Target",
            "Molecular Analysis",
            "Structural Information",
            "Screening Results",
            "Limitations",
        ],
        "user": user["username"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    reports_store.insert(0, report)
    return report
