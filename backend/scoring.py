"""
AgriGuard Scoring Adapter
===============================================================================
This module serves as the boundary between the API presentation layer and
the internal machine learning pipeline (GNN model + symbolic inference).

When the trained production model is ready:
1. Load your model weights / pipeline (e.g. PyTorch, ONNX) in this module.
2. Update `compute_claim_risk()` to pass graph adjacency and claim features
   into the model.
3. Return the calibrated risk score (0-100), the derived triage tier, and
   the GNN explainability notes.

The API endpoints and Pydantic schemas in `schemas.py` and `main.py` will
remain completely unchanged.
===============================================================================
"""

from typing import Dict, Any, Tuple

try:
    from schemas import TriageTier, ExplainabilityNotes
except ImportError:
    from .schemas import TriageTier, ExplainabilityNotes


def derive_triage_tier(risk_score: float) -> TriageTier:
    """
    Derives the triage routing tier from calibrated risk score thresholds:
    - 0 to <40:   APPROVE (Safe / normal loss)
    - 40 to <70:  REVIEW (Requires loss-adjuster secondary sign-off)
    - 70 to 100:  INVESTIGATE (High likelihood of synthetic, padded, or fraudulent claim)
    """
    if risk_score >= 70.0:
        return TriageTier.INVESTIGATE
    elif risk_score >= 40.0:
        return TriageTier.REVIEW
    else:
        return TriageTier.APPROVE


def compute_claim_risk(claim_data: Dict[str, Any]) -> Tuple[float, TriageTier, ExplainabilityNotes]:
    """
    Scoring adapter using the bundled precomputed portfolio scores.

    Args:
        claim_data: Dictionary containing claim metadata (crop, payout, peril, assessor, etc.)

    Returns:
        Tuple of:
          - risk_score: float between 0.0 and 100.0
          - triage_tier: TriageTier ('approve', 'review', 'investigate')
          - explainability: ExplainabilityNotes (graph_note)
    """
    # If the mock record already provides a designated score, use it as baseline
    risk_score = float(claim_data.get("risk_score", 50.0))
    tier = claim_data.get("triage_tier")

    if not isinstance(tier, TriageTier):
        tier = derive_triage_tier(risk_score)

    # Explainability notes provided by mock data or generated from score tier
    default_notes = claim_data.get("explainability", {})

    if tier == TriageTier.INVESTIGATE:
        graph_note = default_notes.get(
            "graph_note",
            "Precomputed graph-risk score placed this claim in the investigate tier; no trained model inference is connected."
        )
    elif tier == TriageTier.REVIEW:
        graph_note = default_notes.get(
            "graph_note",
            "Precomputed graph-risk score placed this claim in the review tier; inspect the linked entities for context."
        )
    else:  # APPROVE
        graph_note = default_notes.get(
            "graph_note",
            "Precomputed graph-risk score placed this claim in the approve tier; this score is not a live model finding."
        )

    explainability = ExplainabilityNotes(
        graph_note=graph_note,
    )

    return risk_score, tier, explainability
