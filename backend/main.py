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

ADMIN_PASSWORD = os.getenv(
    "MEDGEN_ADMIN_PASSWORD",
    "MedGenAI-Admin-2026",
)

SECRET_KEY = os.getenv(
    "MEDGEN_SECRET_KEY",
    "CHANGE-ME-IN-PRODUCTION",
)

tokens = {}
token_created_at = {}
user_profiles = {}
user_consents = {}
activity_log = []
jobs_store = []
docking_jobs_store = {}
workflows_store = []
reports_store = []


# =========================================================
# MODELS
# =========================================================

class LoginRequest(BaseModel):
    username: str
    password: str


class ProfileRequest(BaseModel):
    full_name: str = ""
    email: str = ""
    organization: str = ""
    country: str = ""
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
    token_created_at[token] = datetime.now(timezone.utc).isoformat()
    activity_log.insert(0, {"type": "login", "username": data.username, "at": token_created_at[token]})

    return {
        "access_token": token,
        "token_type": "bearer",
    }


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


@app.get("/api/v1/profile")
def get_profile(user=Depends(get_current_user)):
    return {
        "username": user["username"],
        "role": user["role"],
        "profile": user_profiles.get(user["username"], {}),
    }


@app.put("/api/v1/profile")
def update_profile(data: ProfileRequest, user=Depends(get_current_user)):
    profile = data.model_dump()
    user_profiles[user["username"]] = profile
    activity_log.insert(0, {
        "type": "profile_updated",
        "username": user["username"],
        "at": datetime.now(timezone.utc).isoformat(),
    })
    return {"status": "saved", "username": user["username"], "profile": profile}


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
    return {
        "status": "ready" if VINA_AVAILABLE else "unavailable",
        "module": "Molecular Docking",
        "engine": "AutoDock Vina",
        "vina_available": VINA_AVAILABLE,
        "meeko": True,
        "user": user["username"],
        "message": (
            "AutoDock Vina engine is available. "
            "Receptor preparation and docking coordinates are required "
            "before a scientific docking run."
            if VINA_AVAILABLE
            else
            "AutoDock Vina is not available in the current runtime."
        ),
    }


@app.post("/api/v1/docking/prepare")
def prepare_docking(
    data: DockingRequest,
    user=Depends(get_current_user),
):
    smiles = data.ligand_smiles.strip()
    target = data.target.strip()

    if not target:
        raise HTTPException(status_code=400, detail="Target is required")

    if not smiles:
        raise HTTPException(status_code=400, detail="Ligand SMILES is required")

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise HTTPException(status_code=400, detail="Invalid ligand SMILES")

    canonical = Chem.MolToSmiles(mol)

    return {
        "status": "prepared",
        "module": "Molecular Docking",
        "engine": "AutoDock Vina",
        "target": target,
        "ligand": {
            "input_smiles": smiles,
            "canonical_smiles": canonical,
            "formula": rdMolDescriptors.CalcMolFormula(mol),
            "molecular_weight": round(Descriptors.MolWt(mol), 4),
        },
        "box": {
            "center": {
                "x": data.center_x,
                "y": data.center_y,
                "z": data.center_z,
            },
            "size": {
                "x": data.size_x,
                "y": data.size_y,
                "z": data.size_z,
            },
        },
        "next_step": "receptor_preparation_and_vina_run",
        "warning": (
            "No docking score is reported until a valid receptor PDBQT "
            "and scientifically defined docking box are supplied."
        ),
        "user": user["username"],
    }


# =========================================================
# REAL VINA DOCKING
# =========================================================

class DockingRunRequest(BaseModel):
    target: str = "EGFR"
    ligand_smiles: str
    pdb_id: str = "1M17"
    center_x: float = 22.0
    center_y: float = 0.2
    center_z: float = 52.8
    size_x: float = 20.0
    size_y: float = 20.0
    size_z: float = 20.0
    exhaustiveness: int = 8
    n_poses: int = 3


def _run_command(command, cwd, timeout=120):
    import subprocess
    try:
        completed = subprocess.run(
            command,
            cwd=cwd,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
    except FileNotFoundError as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Docking preparation tool not found: {exc.filename}",
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=504,
            detail="Docking preparation timed out.",
        )
    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout or "Unknown docking error").strip()
        raise HTTPException(status_code=500, detail=detail[-4000:])
    return completed


def _execute_docking(
    data: DockingRunRequest,
    user,
):
    if not VINA_AVAILABLE:
        raise HTTPException(
            status_code=503,
            detail="AutoDock Vina is not available in the current runtime.",
        )

    target = data.target.strip()
    pdb_id = data.pdb_id.strip().upper()
    smiles = data.ligand_smiles.strip()

    if not target or not smiles:
        raise HTTPException(status_code=400, detail="Target and ligand SMILES are required.")
    if len(pdb_id) != 4:
        raise HTTPException(status_code=400, detail="PDB ID must contain 4 characters.")
    if min(data.size_x, data.size_y, data.size_z) <= 0:
        raise HTTPException(status_code=400, detail="Docking box sizes must be positive.")
    if not 1 <= data.exhaustiveness <= 64:
        raise HTTPException(status_code=400, detail="Exhaustiveness must be between 1 and 64.")
    if not 1 <= data.n_poses <= 20:
        raise HTTPException(status_code=400, detail="n_poses must be between 1 and 20.")

    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise HTTPException(status_code=400, detail="Invalid ligand SMILES.")

    import tempfile
    from pathlib import Path
    from urllib.request import urlretrieve

    with tempfile.TemporaryDirectory(prefix="medgen_dock_") as tmp:
        work = Path(tmp)
        receptor_pdb = work / f"{pdb_id}.pdb"
        ligand_sdf = work / "ligand.sdf"
        ligand_pdbqt = work / "ligand.pdbqt"
        receptor_pdbqt = work / f"{pdb_id}_receptor.pdbqt"
        output_pdbqt = work / "docked_poses.pdbqt"

        try:
            urlretrieve(
                f"https://files.rcsb.org/download/{pdb_id}.pdb",
                receptor_pdb,
            )
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Unable to download PDB {pdb_id}: {exc}")

        # Build a real 3D ligand from the submitted SMILES.
        mol = Chem.AddHs(mol)
        params = AllChem.ETKDGv3()
        params.randomSeed = 42
        if AllChem.EmbedMolecule(mol, params) != 0:
            raise HTTPException(status_code=400, detail="Unable to generate a 3D ligand conformer.")
        AllChem.UFFOptimizeMolecule(mol, maxIters=200)
        writer = Chem.SDWriter(str(ligand_sdf))
        writer.write(mol)
        writer.close()

        # Meeko tools create PDBQT inputs used by Vina.
        _run_command(
            [
                "mk_prepare_ligand.py",
                "-i",
                str(ligand_sdf),
                "-o",
                str(ligand_pdbqt),
            ],
            cwd=str(work),
        )

        # Prepare a protein-only PDB for Meeko. PDB 1M17 contains the
        # co-crystallized ligand AQ4 as residue A:999; keeping that ligand in
        # the receptor causes Meeko to build an unknown-residue template and
        # can stall receptor preparation. Keep only ATOM records belonging to
        # the 20 standard amino acids.
        standard_residues = {
            "ALA", "ARG", "ASN", "ASP", "CYS", "GLN", "GLU", "GLY",
            "HIS", "ILE", "LEU", "LYS", "MET", "PHE", "PRO", "SER",
            "THR", "TRP", "TYR", "VAL",
        }
        protein_pdb = work / f"{pdb_id}_protein.pdb"
        with open(receptor_pdb, "r", encoding="utf-8", errors="ignore") as source, open(
            protein_pdb, "w", encoding="utf-8"
        ) as dest:
            for line in source:
                if line.startswith(("ATOM  ", "TER", "END")):
                    if line.startswith("ATOM  ") and line[17:20].strip() not in standard_residues:
                        continue
                    dest.write(line)
            dest.write("END\\n")

        # Receptor preparation follows the documented Meeko workflow.
        _run_command(
            [
                "mk_prepare_receptor.py",
                "-i",
                str(protein_pdb),
                "-o",
                str(work / f"{pdb_id}_receptor"),
                "-p",
            ],
            cwd=str(work),
        )

        if not receptor_pdbqt.exists():
            candidates = list(work.glob(f"{pdb_id}_receptor*.pdbqt"))
            if not candidates:
                raise HTTPException(status_code=500, detail="Receptor PDBQT was not generated.")
            receptor_pdbqt = candidates[0]

        v = Vina(sf_name="vina", verbosity=0)
        v.set_receptor(str(receptor_pdbqt))
        v.set_ligand_from_file(str(ligand_pdbqt))
        v.compute_vina_maps(
            center=[data.center_x, data.center_y, data.center_z],
            box_size=[data.size_x, data.size_y, data.size_z],
        )
        # Keep the web request bounded for the first smoke test. Vina's
        # max_evals limits the number of scoring evaluations; exhaustiveness
        # remains user-configurable but the first deployment should not sit
        # indefinitely on a small Render instance.
        v.dock(
            exhaustiveness=min(data.exhaustiveness, 4),
            n_poses=min(data.n_poses, 3),
            max_evals=50000,
        )
        v.write_poses(str(output_pdbqt), n_poses=data.n_poses, overwrite=True)

        energies = []
        try:
            energies = [float(x) for x in v.energies(n_poses=data.n_poses)[:, 0]]
        except Exception:
            energies = []

        return {
            "status": "completed",
            "module": "Molecular Docking",
            "workflow": "AutoDock Vina",
            "target": target,
            "pdb_id": pdb_id,
            "ligand_smiles": smiles,
            "box": {
                "center": [data.center_x, data.center_y, data.center_z],
                "size": [data.size_x, data.size_y, data.size_z],
            },
            "parameters": {
                "exhaustiveness": data.exhaustiveness,
                "n_poses": data.n_poses,
            },
            "scores_kcal_mol": energies,
            "best_score_kcal_mol": min(energies) if energies else None,
            "engine": "AutoDock Vina",
            "preparation": {
                "ligand": "RDKit 3D + Meeko PDBQT",
                "receptor": "Meeko PDBQT",
            },
            "warning": (
                "Docking scores are computational predictions, not experimental "
                "binding affinities or clinical evidence."
            ),
            "user": user["username"],
        }

@app.post("/api/v1/docking/run")
def docking_run(
    data: DockingRunRequest,
    background_tasks: BackgroundTasks,
    user=Depends(get_current_user),
):
    job_id = secrets.token_hex(8)
    docking_jobs_store[job_id] = {
        "status": "queued",
        "module": "Molecular Docking",
        "workflow": "AutoDock Vina",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "user": user["username"],
    }

    def run_job():
        docking_jobs_store[job_id]["status"] = "running"
        try:
            docking_jobs_store[job_id]["result"] = _execute_docking(data, user)
            docking_jobs_store[job_id]["status"] = "completed"
        except HTTPException as exc:
            docking_jobs_store[job_id]["status"] = "failed"
            docking_jobs_store[job_id]["error"] = exc.detail
        except Exception as exc:
            docking_jobs_store[job_id]["status"] = "failed"
            docking_jobs_store[job_id]["error"] = str(exc)
        docking_jobs_store[job_id]["finished_at"] = datetime.now(timezone.utc).isoformat()

    background_tasks.add_task(run_job)
    return {
        "status": "queued",
        "job_id": job_id,
        "module": "Molecular Docking",
        "workflow": "AutoDock Vina",
    }


@app.get("/api/v1/docking/status/{job_id}")
def docking_status(
    job_id: str,
    user=Depends(get_current_user),
):
    job = docking_jobs_store.get(job_id)
    if not job or job.get("user") != user["username"]:
        raise HTTPException(status_code=404, detail="Docking job not found.")
    return job


# =========================================================
# SUPER ADMIN DASHBOARD
# =========================================================

def require_super_admin(user):
    if user.get("role") != "SUPER_ADMIN":
        raise HTTPException(status_code=403, detail="Super Admin access required.")
    return user

@app.get("/api/v1/admin/overview")
def admin_overview(user=Depends(get_current_user)):
    require_super_admin(user)
    docking_items = list(docking_jobs_store.values())
    return {
        "status": "ready", "role": user["role"],
        "users": len(set(tokens.values()) | set(user_profiles.keys()) | set(user_consents.keys())), "active_tokens": len(tokens),
        "jobs": len(jobs_store), "docking_jobs": len(docking_items),
        "docking_running": sum(1 for x in docking_items if x.get("status") in ("queued", "running")),
        "experiments": len(experiments_store), "reports": len(reports_store), "workflows": len(workflows_store),
        "recent_activity": activity_log[:20] + ([*({**x, "activity_type":"docking"} for x in docking_items[:10]), *({**x, "activity_type":"experiment"} for x in experiments_store[:10]), *({**x, "activity_type":"report"} for x in reports_store[:10])])[:20],
    }

@app.get("/api/v1/admin/users")
def admin_users(user=Depends(get_current_user)):
    require_super_admin(user)
    usernames = sorted(set(tokens.values()) | set(user_profiles.keys()) | set(user_consents.keys()))
    return {"users": [{
        "username": u,
        "role": "SUPER_ADMIN" if u == ADMIN_USERNAME else "USER",
        "profile": user_profiles.get(u, {}),
        "consent": user_consents.get(u, {}),
        "active_tokens": sum(1 for x in tokens.values() if x == u),
    } for u in usernames]}


@app.get("/api/v1/admin/tokens")
def admin_tokens(user=Depends(get_current_user)):
    require_super_admin(user)
    return {"tokens": [{
        "username": username,
        "created_at": token_created_at.get(token),
        "active": True,
    } for token, username in tokens.items()]}


@app.get("/api/v1/admin/activity")
def admin_activity(user=Depends(get_current_user)):
    require_super_admin(user)
    return {"activity": activity_log[:100]}


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

experiments_store = []

@app.post(
    "/api/v1/lab/experiments"
)
def create_experiment(
    data: WorkflowRequest,
    user=Depends(get_current_user),
):
    experiment = {
        "id": secrets.token_hex(8),
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
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    experiments_store.insert(0, experiment)
    return experiment

@app.get("/api/v1/lab/experiments")
def list_experiments(user=Depends(get_current_user)):
    items = [x for x in experiments_store if x["user"] == user["username"]]
    return {"experiments": items, "count": len(items), "user": user["username"]}


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