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
from typing import List
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware

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
    from mock_data import MOCK_CLAIMS_RAW, generate_claim_network
except ImportError:
    from .schemas import (
        ClaimSummary,
        ClaimDetail,
        NetworkGraph,
    )
    from .scoring import compute_claim_risk
    from .mock_data import MOCK_CLAIMS_RAW, generate_claim_network


# ─── FASTAPI APPLICATION ──────────────────────────────────────────────────────

app = FastAPI(
    title="AgriGuard API",
    description=(
        "Agricultural crop-insurance API with illustrative portfolio records. "
        "Provides typed claim triage listings, precomputed graph-risk rationale, "
        "symbolic logic proof traces, and force-directed fraud collusion network subgraphs."
    ),
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)


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
        "dataset": "Illustrative Maharashtra PMFBY portfolio data",
        "scoring": "Precomputed risk scores; trained GNN inference is not connected",
        "version": "1.0.0",
        "docs_url": "/docs",
        "endpoints": [
            "GET /claims",
            "GET /claims/{claim_id}",
            "GET /claims/{claim_id}/network",
            "GET /health",
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


@app.get(
    "/claims",
    response_model=List[ClaimSummary],
    summary="List all insurance claims",
    description=(
        "Returns a list of claims with triage tier classification, calibrated risk score (0-100), "
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
        "precomputed graph-risk note, and symbolic inference proof_trace and rules_fired."
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
        evidence_note="Illustrative portfolio data with precomputed scores; it is not connected to a trained GNN or live PMFBY records.",
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
