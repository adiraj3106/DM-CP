# ═══════════════════════════════════════════════════════════════════════════════
# AgriGuard Agricultural Risk API
#
# QUICK START INSTRUCTIONS:
#   1. Install dependencies:
#      pip install -r requirements.txt
#
#   2. Run the development server using uvicorn:
#      From the 'backend' folder:
#        uvicorn main:app --reload --port 8000
#      Or from the project root folder:
#        uvicorn backend.main:app --reload --port 8000
#
#   3. Access interactive documentation:
#      Swagger UI: http://localhost:8000/docs
#      ReDoc:      http://localhost:8000/redoc
# ═══════════════════════════════════════════════════════════════════════════════

import os
import sys
import io
import json
import uuid
import subprocess
import logging
import queue
import threading
import time
import numpy as np
from pathlib import Path
from typing import List
import pandas as pd
from fastapi import FastAPI, HTTPException, UploadFile, File, status
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool

# Use Uvicorn's configured terminal handler so dataset progress is visible next
# to request logs when the API is launched from the demo terminal.
logger = logging.getLogger("uvicorn.error")
logger.setLevel(logging.INFO)


def log_dataset_progress(message: str) -> None:
    """Write upload milestones directly to the Uvicorn terminal, without filters."""
    print(f"[AgriGuard] {message}", flush=True)

# Ensure backend package can resolve modules whether run from root or within backend/
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

try:
    from schemas import (
        ClaimSummary,
        ClaimDetail,
        NetworkGraph,
    )
    from scoring import compute_claim_risk
    import mock_data as data_store
    from mock_data import MOCK_CLAIMS_RAW, generate_claim_network, activate_dataset
except ImportError:
    from .schemas import (
        ClaimSummary,
        ClaimDetail,
        NetworkGraph,
    )
    from .scoring import compute_claim_risk
    from . import mock_data as data_store
    from .mock_data import MOCK_CLAIMS_RAW, generate_claim_network
    from .mock_data import activate_dataset

# Every backend process starts clean. A CSV upload populates the portfolio for
# that server session; restarting the backend returns the app to zero claims.
data_store.clear_active_dataset()


# ─── FASTAPI APPLICATION ──────────────────────────────────────────────────────

app = FastAPI(
    title="AgriGuard API",
    description=(
        "Agricultural crop-insurance API with synthetic portfolio records. "
        "Provides typed claim triage listings, generated GraphSAGE scores, "
        "symbolic logic proof traces, and force-directed fraud collusion network subgraphs."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATASET_UPLOAD_ROOT = Path(__file__).resolve().parent / "uploads"
PIPELINE_SCRIPT = PROJECT_ROOT / "agriguard_gnn_build" / "train_final.py"
ACTIVE_DATASET: dict = {
    "dataset_id": None,
    "dataset_name": "No portfolio loaded",
    "model_generated": False,
    "metrics": None,
}

INFERENCE_LAWS = [
    {"name": "Modus Ponens", "premises": ["P → Q", "P"], "conclusion": "Q"},
    {"name": "Modus Tollens", "premises": ["P → Q", "¬Q"], "conclusion": "¬P"},
    {"name": "Hypothetical Syllogism", "premises": ["P → Q", "Q → R"], "conclusion": "P → R"},
    {"name": "Disjunctive Syllogism", "premises": ["P ∨ Q", "¬P"], "conclusion": "Q"},
    {"name": "Addition", "premises": ["P"], "conclusion": "P ∨ Q"},
    {"name": "Simplification", "premises": ["P ∧ Q"], "conclusion": "P"},
    {"name": "Conjunction", "premises": ["P", "Q"], "conclusion": "P ∧ Q"},
    {"name": "Constructive Dilemma", "premises": ["(P → Q) ∧ (R → S)", "P ∨ R"], "conclusion": "Q ∨ S"},
    {"name": "Destructive Dilemma", "premises": ["(P → Q) ∧ (R → S)", "¬Q ∨ ¬S"], "conclusion": "¬P ∨ ¬R"},
]


# ─── CORS CONFIGURATION ───────────────────────────────────────────────────────
# Enable Cross-Origin Resource Sharing so React/Vite frontends on localhost
# (or any local port) can query endpoints directly without proxying issues.

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5174",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "*",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── HELPER / DATA ACCESS ────────────────────────────────────────────────────

def get_claim_by_id_or_404(claim_id: str) -> dict:
    """Finds raw claim dictionary by ID or raises an HTTP 404 error."""
    claim = next((c for c in MOCK_CLAIMS_RAW if c["claim_id"].upper() == claim_id.upper()), None)
    if not claim:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Claim with identifier '{claim_id}' was not found in AgriGuard database.",
        )
    return claim


# ─── API ENDPOINTS ────────────────────────────────────────────────────────────

@app.get(
    "/",
    summary="Root Health & Index",
    tags=["System"],
)
def get_root():
    """Welcome endpoint providing health status and documentation links."""
    return {
        "status": "online",
        "service": "AgriGuard API",
        "dataset": ACTIVE_DATASET["dataset_name"],
        "scoring": "Generated GraphSAGE score outputs" if ACTIVE_DATASET["model_generated"] else "Waiting for a CSV portfolio upload",
        "version": "1.0.0",
        "docs_url": "/docs",
        "endpoints": [
            "GET /claims",
            "GET /claims/{claim_id}",
            "GET /claims/{claim_id}/network",
            "GET /health",
            "GET /logic/laws",
            "GET /dataset/status",
            "POST /datasets/analyze",
        ],
    }


@app.get(
    "/health",
    summary="Service Health Check",
    tags=["System"],
)
def get_health():
    """Standard liveness probe."""
    return {"status": "ok", "service": "agriguard-api"}


@app.get("/logic/laws", tags=["Discrete Mathematics"])
def list_inference_laws():
    return {"laws": INFERENCE_LAWS}


def _validate_dataset_frames(claims: pd.DataFrame, farmers: pd.DataFrame,
                             assessors: pd.DataFrame, zones: pd.DataFrame) -> None:
    required = {
        "claims": {"claim_id", "farmer_id", "assessor_id", "zone_id", "crop_type",
                   "claimed_damage_pct", "claimed_payout_amount", "is_fraud"},
        "farmers": {"farmer_id", "name", "district", "land_holding_acres"},
        "assessors": {"assessor_id", "name", "years_of_service"},
        "weather_zones": {"zone_id", "event_type", "severity_index"},
    }
    frames = {"claims": claims, "farmers": farmers, "assessors": assessors, "weather_zones": zones}
    for name, expected in required.items():
        missing = expected.difference(frames[name].columns)
        if missing:
            raise ValueError(f"{name}.csv is missing columns: {', '.join(sorted(missing))}")
        if frames[name].empty:
            raise ValueError(f"{name}.csv has no data rows")

    if len(claims) < 30:
        raise ValueError("claims.csv must contain at least 30 rows for the train/validation/test split")
    for frame, key, name in [
        (claims, "claim_id", "claims.csv"), (farmers, "farmer_id", "farmers.csv"),
        (assessors, "assessor_id", "assessors.csv"), (zones, "zone_id", "weather_zones.csv"),
    ]:
        if frame[key].isna().any() or frame[key].astype(str).str.strip().eq("").any():
            raise ValueError(f"{name} contains a blank {key}")
        if frame[key].astype(str).duplicated().any():
            raise ValueError(f"{name} contains duplicate {key} values")

    for column in ["claimed_damage_pct", "claimed_payout_amount", "is_fraud"]:
        try:
            claims[column] = pd.to_numeric(claims[column], errors="raise")
        except (TypeError, ValueError) as exc:
            raise ValueError(f"claims.csv column {column} must be numeric") from exc
        if not np.isfinite(claims[column].to_numpy(dtype=float)).all():
            raise ValueError(f"claims.csv column {column} contains a missing or non-finite value")
    for frame, column, label in [
        (farmers, "land_holding_acres", "farmers.csv"),
        (assessors, "years_of_service", "assessors.csv"),
        (zones, "severity_index", "weather_zones.csv"),
    ]:
        try:
            frame[column] = pd.to_numeric(frame[column], errors="raise")
        except (TypeError, ValueError) as exc:
            raise ValueError(f"{label} column {column} must be numeric") from exc
        if not np.isfinite(frame[column].to_numpy(dtype=float)).all():
            raise ValueError(f"{label} column {column} contains a missing or non-finite value")
    if not claims.is_fraud.isin([0, 1]).all():
        raise ValueError("claims.csv is_fraud values must be 0 or 1")
    if claims.is_fraud.value_counts().reindex([0, 1], fill_value=0).min() < 5:
        raise ValueError("claims.csv needs at least five examples of each is_fraud class")
    if not claims.claimed_damage_pct.between(0, 100).all():
        raise ValueError("claimed_damage_pct must be between 0 and 100")
    if (claims.claimed_payout_amount < 0).any():
        raise ValueError("claimed_payout_amount cannot be negative")
    if (farmers.land_holding_acres < 0).any():
        raise ValueError("land_holding_acres cannot be negative")
    if not zones.severity_index.between(0, 1).all():
        raise ValueError("weather zone severity_index must be between 0 and 1")

    for name, values, frame, key in [
        ("farmer_id", claims.farmer_id, farmers, "farmer_id"),
        ("assessor_id", claims.assessor_id, assessors, "assessor_id"),
        ("zone_id", claims.zone_id, zones, "zone_id"),
    ]:
        unknown = set(values.astype(str)).difference(set(frame[key].astype(str)))
        if unknown:
            examples = ", ".join(sorted(unknown)[:5])
            raise ValueError(f"claims.csv references unknown {name} values: {examples}")


async def _read_csv_upload(upload: UploadFile, label: str) -> pd.DataFrame:
    if upload.filename and not upload.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=415, detail=f"{label} must be a CSV file")
    content = await upload.read(25 * 1024 * 1024 + 1)
    if len(content) > 25 * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"{label} exceeds the 25 MB limit")
    try:
        return pd.read_csv(io.BytesIO(content))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse {label}: {exc}") from exc


@app.get("/dataset/status", tags=["Dataset"])
def get_dataset_status():
    return {
        **ACTIVE_DATASET,
        "claims_count": len(MOCK_CLAIMS_RAW),
    }


@app.post("/datasets/analyze", tags=["Dataset"])
async def analyze_uploaded_dataset(
    claims_file: UploadFile = File(...),
    farmers_file: UploadFile = File(...),
    assessors_file: UploadFile = File(...),
    weather_zones_file: UploadFile = File(...),
):
    """Validate a four-file dataset, train/evaluate GraphSAGE, derive proofs, activate it."""
    global ACTIVE_DATASET
    log_dataset_progress("CSV analysis request received; reading the four dataset files.")
    claims = await _read_csv_upload(claims_file, "claims.csv")
    farmers = await _read_csv_upload(farmers_file, "farmers.csv")
    assessors = await _read_csv_upload(assessors_file, "assessors.csv")
    zones = await _read_csv_upload(weather_zones_file, "weather_zones.csv")
    try:
        _validate_dataset_frames(claims, farmers, assessors, zones)
    except ValueError as exc:
        logger.warning("CSV analysis rejected during validation: %s", exc)
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    log_dataset_progress(
        f"CSV validation passed: {len(claims)} claims, {len(farmers)} farmers, "
        f"{len(assessors)} assessors, {len(zones)} weather zones."
    )

    dataset_id = uuid.uuid4().hex[:12]
    dataset_dir = DATASET_UPLOAD_ROOT / dataset_id
    dataset_dir.mkdir(parents=True, exist_ok=False)
    for filename, frame in [
        ("claims.csv", claims), ("farmers.csv", farmers),
        ("assessors.csv", assessors), ("weather_zones.csv", zones),
    ]:
        frame.to_csv(dataset_dir / filename, index=False)

    def run_pipeline():
        command = [sys.executable, "-u", str(PIPELINE_SCRIPT), str(dataset_dir)]
        log_dataset_progress(f"[dataset {dataset_id}] Starting GraphSAGE training and inference.")
        process = subprocess.Popen(
            command,
            cwd=str(PROJECT_ROOT),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
            env={**os.environ, "PYTHONUNBUFFERED": "1"},
        )
        output_queue: queue.Queue[str | None] = queue.Queue()
        recent_output: list[str] = []

        def forward_output():
            assert process.stdout is not None
            for output_line in process.stdout:
                output_queue.put(output_line)
            output_queue.put(None)

        threading.Thread(target=forward_output, daemon=True).start()
        deadline = time.monotonic() + 600
        output_closed = False
        while not output_closed or process.poll() is None:
            if time.monotonic() >= deadline:
                process.kill()
                process.wait()
                raise subprocess.TimeoutExpired(
                    command, 600, output="\n".join(recent_output)
                )
            try:
                output_line = output_queue.get(timeout=0.2)
            except queue.Empty:
                continue
            if output_line is None:
                output_closed = True
                continue
            clean_line = output_line.rstrip()
            if clean_line:
                log_dataset_progress(f"[dataset {dataset_id}] {clean_line}")
                recent_output.append(clean_line)
                if len(recent_output) > 80:
                    recent_output.pop(0)

        return subprocess.CompletedProcess(
            command, process.returncode, stdout="\n".join(recent_output), stderr=""
        )

    try:
        result = await run_in_threadpool(run_pipeline)
    except subprocess.TimeoutExpired as exc:
        logger.error("[dataset %s] Analysis exceeded the 10-minute limit.", dataset_id)
        raise HTTPException(status_code=504, detail="Analysis exceeded the 10-minute limit") from exc
    if result.returncode != 0:
        detail = (result.stderr or result.stdout or "Pipeline failed without an error message")[-5000:]
        logger.error("[dataset %s] Pipeline failed: %s", dataset_id, detail[-1200:])
        raise HTTPException(status_code=500, detail=f"Analysis failed: {detail}")

    metrics_path = dataset_dir / "pipeline_metrics.json"
    if not (dataset_dir / "claim_scores.csv").exists() or not (dataset_dir / "claim_proofs.csv").exists() or not metrics_path.exists():
        raise HTTPException(status_code=500, detail="Pipeline completed without producing all required outputs")
    metrics = json.loads(metrics_path.read_text(encoding="utf-8"))
    log_dataset_progress(
        f"[dataset {dataset_id}] Pipeline complete: test F1 {metrics['test']['f1']:.3f}, "
        f"test AUC {metrics['test']['auc']:.3f}. Activating portfolio."
    )
    try:
        activate_dataset(str(dataset_dir))
    except Exception as exc:
        logger.exception("[dataset %s] Could not activate analyzed portfolio.", dataset_id)
        raise HTTPException(status_code=500, detail=f"Could not activate analyzed dataset: {exc}") from exc

    ACTIVE_DATASET = {
        "dataset_id": dataset_id,
        "dataset_name": f"Uploaded portfolio {dataset_id}",
        "model_generated": True,
        "metrics": metrics,
    }
    log_dataset_progress(f"[dataset {dataset_id}] Portfolio active in dashboard ({len(MOCK_CLAIMS_RAW)} claims).")
    return {
        **ACTIVE_DATASET,
        "claims_count": len(MOCK_CLAIMS_RAW),
        "message": "Portfolio analyzed and loaded into the dashboard.",
    }


@app.get(
    "/claims",
    response_model=List[ClaimSummary],
    summary="List all insurance claims",
    description=(
        "Returns a list of claims with triage tier classification, model risk score (0-100), "
        "farmer & assessor details, and claimed payout amounts."
    ),
    tags=["Claims"],
)
def list_claims() -> List[ClaimSummary]:
    """
    Returns summary records for all claims.
    Risk score and triage tier are evaluated through the scoring module stub.
    """
    results: List[ClaimSummary] = []
    for raw in MOCK_CLAIMS_RAW:
        # Score claim through model interface
        risk_score, triage_tier, _ = compute_claim_risk(raw)
        results.append(
            ClaimSummary(
                claim_id=raw["claim_id"],
                farmer_name=raw["farmer_name"],
                assessor_name=raw["assessor_name"],
                crop_type=raw["crop_type"],
                claimed_payout_amount=raw["claimed_payout_amount"],
                claim_date=raw["claim_date"],
                risk_score=risk_score,
                triage_tier=triage_tier,
                policy_number=raw["policy_number"],
                farmer_id=raw["farmer_id"],
                assessor_id=raw["assessor_id"],
                district=raw["district"],
                taluka=raw["taluka"],
                zone_id=raw["zone_id"],
                peril_type=raw["peril_type"],
                claimed_damage_pct=raw["claimed_damage_pct"],
                insured_acres=raw["insured_acres"],
                estimated_coverage=raw["policy_value"],
                inspection_date=raw["inspection_date"],
                crop_year=raw["crop_year"],
                gnn_available=raw["gnn_available"],
                risk_flag=raw.get("risk_flag", 0),
            )
        )
    return results


@app.get(
    "/claims/{claim_id}",
    response_model=ClaimDetail,
    summary="Get detailed claim by ID",
    description=(
        "Returns full detail for a single claim, including all base summary fields, "
        "generated graph-risk rationale and symbolic inference proof_trace and rules_fired."
    ),
    tags=["Claims"],
)
def get_claim_detail(claim_id: str) -> ClaimDetail:
    """
    Returns full detail for one claim including the explainability and proof trace.
    Raises 404 if claim does not exist.
    """
    raw = get_claim_by_id_or_404(claim_id)
    risk_score, triage_tier, explainability = compute_claim_risk(raw)

    return ClaimDetail(
        claim_id=raw["claim_id"],
        farmer_name=raw["farmer_name"],
        assessor_name=raw["assessor_name"],
        crop_type=raw["crop_type"],
        claimed_payout_amount=raw["claimed_payout_amount"],
        claim_date=raw["claim_date"],
        risk_score=risk_score,
        triage_tier=triage_tier,
        explainability=explainability,
        proof_trace=raw.get("proof_trace", []),
        rules_fired=raw.get("rules_fired", []),
        policy_number=raw["policy_number"],
        farmer_id=raw["farmer_id"],
        assessor_id=raw["assessor_id"],
        district=raw["district"],
        taluka=raw["taluka"],
        zone_id=raw["zone_id"],
        peril_type=raw["peril_type"],
        claimed_damage_pct=raw["claimed_damage_pct"],
        insured_acres=raw["insured_acres"],
        estimated_coverage=raw["policy_value"],
        inspection_date=raw["inspection_date"],
        crop_year=raw["crop_year"],
        gnn_available=raw["gnn_available"],
        risk_flag=raw.get("risk_flag", 0),
        evidence_note=(
            "Synthetic input records scored by the trained GraphSAGE pipeline."
            if ACTIVE_DATASET["model_generated"]
            else "Bundled portfolio outputs; upload a dataset to run the trained scoring pipeline."
        ),
    )


@app.get(
    "/claims/{claim_id}/network",
    response_model=NetworkGraph,
    summary="Get claim relationship network graph",
    description=(
        "Returns a small graph object (nodes and edges) representing the claim's connections "
        "to other claims, assessors, and farmers in a structure ready for force-directed graph visualization."
    ),
    tags=["Network Topology"],
)
def get_claim_network(claim_id: str) -> NetworkGraph:
    """
    Returns the network graph topology for the specified claim.
    Raises 404 if claim does not exist.
    """
    raw = get_claim_by_id_or_404(claim_id)
    return generate_claim_network(raw)
