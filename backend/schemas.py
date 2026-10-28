from enum import Enum
from typing import List, Optional, Literal
from pydantic import BaseModel, Field, ConfigDict


class TriageTier(str, Enum):
    APPROVE = "approve"
    REVIEW = "review"
    INVESTIGATE = "investigate"


class ExplainabilityNotes(BaseModel):
    """
    Graph rationale sentence explaining GNN network topology and entity risk patterns.
    """
    graph_note: str = Field(
        ...,
        description="Rationale sentence regarding entity relationships, cluster collusion, or co-assessor patterns."
    )


class ClaimSummary(BaseModel):
    """
    Summary view of an insurance claim returned in claim listings.
    """
    model_config = ConfigDict(populate_by_name=True)

    claim_id: str = Field(..., description="Unique claim identifier, e.g. 'C00001'")
    farmer_name: str = Field(..., description="Full legal name of the producer")
    assessor_name: str = Field(..., description="Assigned loss-adjuster name")
    crop_type: str = Field(..., description="Insured crop classification")
    claimed_payout_amount: float = Field(..., description="Claimed indemnity amount in INR")
    claim_date: str = Field(..., description="Date the loss was reported (YYYY-MM-DD)")
    risk_score: float = Field(..., ge=0.0, le=100.0, description="Risk score calibrated from 0 to 100")
    triage_tier: TriageTier = Field(..., description="Operational triage routing: 'approve', 'review', or 'investigate'")
    policy_number: str
    farmer_id: str
    assessor_id: str
    district: str
    taluka: str
    zone_id: str
    peril_type: str
    claimed_damage_pct: float
    insured_acres: float
    estimated_coverage: float
    inspection_date: str
    crop_year: int
    gnn_available: bool
    risk_flag: int


class ClaimDetail(ClaimSummary):
    """
    Detailed claim record containing base summary fields, GNN graph explainability,
    and symbolic inference proof trace steps.
    """
    explainability: ExplainabilityNotes = Field(
        ...,
        description="GNN network explainability rationale"
    )
    proof_trace: List[str] = Field(
        default_factory=list,
        description="Sequential logical deduction steps derived from the 9 laws of inference"
    )
    rules_fired: List[str] = Field(
        default_factory=list,
        description="List of symbolic deduction rules that fired for this claim"
    )
    evidence_note: str


class NetworkNodeKind(str, Enum):
    CLAIM = "claim"
    FARMER = "farmer"
    ASSESSOR = "assessor"
    FARMLAND = "farmland"


class NetworkNode(BaseModel):
    """
    Node in the force-directed relationship graph.
    """
    id: str = Field(..., description="Unique node identifier")
    label: str = Field(..., description="Human-readable display label")
    kind: str = Field(..., description="Entity kind: 'claim', 'farmer', 'assessor', 'zone' or 'farmland'")
    type: str = Field(..., description="Entity type: 'claim', 'farmer', 'assessor', 'zone' or 'farmland'")
    risk_score: Optional[float] = Field(None, ge=0.0, le=100.0, description="Risk score (0-100)")
    triage_tier: Optional[str] = Field(None, description="Triage tier if node is a claim")


class NetworkEdge(BaseModel):
    """
    Directed or undirected connection between entities in the fraud network graph.
    """
    source: str = Field(..., description="Source node ID")
    target: str = Field(..., description="Target node ID")
    relationship: str = Field(..., description="Relationship type: 'filed_by', 'assessed_by', 'owns', 'co_assessed', 'adjacent_to'")
    weight: float = Field(1.0, ge=0.0, le=1.0, description="Connection strength / weight between 0.0 and 1.0")
    is_anomalous: bool = Field(False, description="Flag indicating whether this connection is flagged as suspicious")


class NetworkGraph(BaseModel):
    """
    Graph representation compatible with D3/SVG force-directed graph visualizers.
    """
    nodes: List[NetworkNode]
    edges: List[NetworkEdge]
