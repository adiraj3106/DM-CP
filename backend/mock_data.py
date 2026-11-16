"""
AgriGuard Claims & Graph Data Store
Loaded at startup from Maharashtra synthetic PMFBY dataset in agriguard_gnn_build.
"""

import os
import sys
import pandas as pd
from typing import Dict, Any, List, Set, Optional
from datetime import date, timedelta

try:
    from schemas import NetworkGraph, NetworkNode, NetworkEdge
except ImportError:
    from .schemas import NetworkGraph, NetworkNode, NetworkEdge

# Resolve path to data directory
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
POSSIBLE_DIRS = [
    os.path.normpath(os.path.join(CURRENT_DIR, "..", "agriguard_gnn_build")),
    os.path.normpath(os.path.join(CURRENT_DIR, "agriguard_gnn_build")),
    os.path.normpath(os.path.join(os.getcwd(), "agriguard_gnn_build")),
    os.path.normpath(os.path.join(os.getcwd(), "..", "agriguard_gnn_build")),
]

DATA_DIR = next((d for d in POSSIBLE_DIRS if os.path.exists(os.path.join(d, "claims.csv"))), POSSIBLE_DIRS[0])

# Location names are deterministic demo talukas selected within each producer district.
DEMO_TALUKAS = {
    "Akola": ["Akot", "Balapur", "Murtijapur", "Patur"],
    "Beed": ["Georai", "Ashti", "Parli", "Ambajogai"],
    "Jalna": ["Ambad", "Bhokardan", "Partur", "Badnapur"],
    "Latur": ["Udgir", "Ausa", "Nilanga", "Ahmedpur"],
    "Nashik": ["Niphad", "Sinnar", "Dindori", "Yeola"],
    "Pune": ["Baramati", "Shirur", "Junnar", "Indapur", "Daund"],
    "Sangli": ["Miraj", "Tasgaon", "Vita", "Jat"],
    "Satara": ["Karad", "Wai", "Phaltan", "Patan"],
    "Solapur": ["Pandharpur", "Barshi", "Akkalkot", "Karmala"],
    "Yavatmal": ["Pusad", "Darwha", "Umarkhed", "Digras"],
}

def demo_taluka(district: str, farmer_id: str) -> str:
    options = DEMO_TALUKAS.get(district, ["Rural Taluka"])
    suffix = int("".join(ch for ch in farmer_id if ch.isdigit()) or "0")
    return options[suffix % len(options)]

# Load CSV files at startup
claims_path = os.path.join(DATA_DIR, "claims.csv")
farmers_path = os.path.join(DATA_DIR, "farmers.csv")
assessors_path = os.path.join(DATA_DIR, "assessors.csv")
claim_scores_path = os.path.join(DATA_DIR, "claim_scores.csv")
claim_proofs_path = os.path.join(DATA_DIR, "claim_proofs.csv")
graph_edges_path = os.path.join(DATA_DIR, "graph_edges.csv")
graph_nodes_path = os.path.join(DATA_DIR, "graph_nodes.csv")

# 1. Farmers mapping & Family group index
farmers_df = pd.read_csv(farmers_path) if os.path.exists(farmers_path) else pd.DataFrame()
farmers_dict: Dict[str, str] = (
    dict(zip(farmers_df["farmer_id"].astype(str), farmers_df["name"].astype(str)))
    if not farmers_df.empty
    else {}
)
farmer_details: Dict[str, Dict[str, Any]] = (
    {str(row["farmer_id"]): row.to_dict() for _, row in farmers_df.iterrows()}
    if not farmers_df.empty else {}
)
farmer_to_family: Dict[str, str] = {}
family_to_farmers: Dict[str, List[str]] = {}
if not farmers_df.empty and "family_group_id" in farmers_df.columns:
    for _, f_row in farmers_df.iterrows():
        fid = str(f_row["farmer_id"])
        fam_val = f_row.get("family_group_id")
        if pd.notna(fam_val) and str(fam_val).strip():
            fam_id = str(fam_val).strip()
            farmer_to_family[fid] = fam_id
            family_to_farmers.setdefault(fam_id, []).append(fid)

# 2. Assessors mapping
assessors_df = pd.read_csv(assessors_path) if os.path.exists(assessors_path) else pd.DataFrame()
assessors_dict: Dict[str, str] = (
    dict(zip(assessors_df["assessor_id"].astype(str), assessors_df["name"].astype(str)))
    if not assessors_df.empty
    else {}
)

# Weather-zone metadata is part of the bundled synthetic demo dataset.
zones_path = os.path.join(DATA_DIR, "weather_zones.csv")
zones_df = pd.read_csv(zones_path) if os.path.exists(zones_path) else pd.DataFrame()
zones_dict = {str(row["zone_id"]): row.to_dict() for _, row in zones_df.iterrows()} if not zones_df.empty else {}
# 3. Claim scores mapping
scores_dict: Dict[str, Dict[str, Any]] = {}
if os.path.exists(claim_scores_path):
    scores_df = pd.read_csv(claim_scores_path)
    for _, s_row in scores_df.iterrows():
        cid = str(s_row["claim_id"])
        scores_dict[cid] = {
            "risk_score": float(s_row.get("risk_score", 50.0)),
            "triage_tier": str(s_row.get("triage_tier", "review")),
            "graph_note": str(s_row.get("graph_note", "Standard graph topology.")),
        }

# 3b. Symbolic proof traces mapping
proofs_dict: Dict[str, Dict[str, Any]] = {}
if os.path.exists(claim_proofs_path):
    proofs_df = pd.read_csv(claim_proofs_path)
    for _, p_row in proofs_df.iterrows():
        cid = str(p_row["claim_id"])
        trace_str = str(p_row.get("proof_trace", ""))
        rules_str = str(p_row.get("rules_fired", ""))
        trace_list = [step.strip() for step in trace_str.split(" | ") if step.strip()] if trace_str else []
        rules_list = [r.strip() for r in rules_str.split(";") if r.strip()] if rules_str else []
        proofs_dict[cid] = {
            "proof_trace": trace_list,
            "rules_fired": rules_list,
            "risk_flag": int(p_row.get("risk_flag", 0)),
            "split": str(p_row.get("split", "train")),
        }

# 4. Graph nodes and edges for network construction
graph_nodes_dict: Dict[str, Dict[str, Any]] = {}
if os.path.exists(graph_nodes_path):
    nodes_df = pd.read_csv(graph_nodes_path)
    for _, n_row in nodes_df.iterrows():
        nid = str(n_row["node_id"])
        graph_nodes_dict[nid] = {
            "type": str(n_row.get("type", "")),
            "name": str(n_row.get("name", "")),
            "event": str(n_row.get("event", "")) if pd.notna(n_row.get("event")) else "",
        }

graph_edges_list: List[Dict[str, Any]] = []
if os.path.exists(graph_edges_path):
    edges_df = pd.read_csv(graph_edges_path)
    for _, e_row in edges_df.iterrows():
        graph_edges_list.append({
            "source": str(e_row["source"]),
            "target": str(e_row["target"]),
            "weight": min(1.0, max(0.0, float(e_row.get("weight", 1.0)))),
            "relation": str(e_row.get("relation", "connected_to")),
        })

# 5. Populate MOCK_CLAIMS_RAW
MOCK_CLAIMS_RAW: List[Dict[str, Any]] = []
claims_df = pd.read_csv(claims_path) if os.path.exists(claims_path) else pd.DataFrame()

# Precompute index of claims by farmer, assessor, and zone for network lookups
claims_by_farmer: Dict[str, List[str]] = {}
claims_by_assessor: Dict[str, List[str]] = {}
claims_by_zone: Dict[str, List[str]] = {}

for _, c_row in claims_df.iterrows():
    cid = str(c_row["claim_id"])
    fid = str(c_row["farmer_id"])
    aid = str(c_row["assessor_id"])
    zid = str(c_row["zone_id"])
    crop = str(c_row["crop_type"])
    payout = float(c_row["claimed_payout_amount"])

    farmer_name = farmers_dict.get(fid, fid)
    farmer_info = farmer_details.get(fid, {})
    assessor_name = assessors_dict.get(aid, aid)

    score_info = scores_dict.get(cid, {})
    risk_score = float(score_info.get("risk_score", 50.0))
    triage_tier = str(score_info.get("triage_tier", "review"))
    graph_note = str(score_info.get("graph_note", f"Claim evaluated for {farmer_name}."))

    proof_info = proofs_dict.get(cid, {})
    proof_trace = proof_info.get("proof_trace", [])
    rules_fired = proof_info.get("rules_fired", [])
    risk_flag = proof_info.get("risk_flag", 0)

    claim_record = {
        "claim_id": cid,
        "farmer_name": farmer_name,
        "assessor_name": assessor_name,
        "crop_type": crop,
        "claimed_damage_pct": float(c_row.get("claimed_damage_pct", 0.0)),
        "insured_acres": float(farmer_info.get("land_holding_acres", 0.0)),
        "taluka": demo_taluka(str(farmer_info.get("district", "")), fid),
        "district": str(farmer_info.get("district", "")),
        "peril_type": str(zones_dict.get(zid, {}).get("event_type", "Weather event")),
        "zone_severity": float(zones_dict.get(zid, {}).get("severity_index", 0.0)),
        "claimed_payout_amount": payout,
        "claim_date": (date(2024, 6, 1) + timedelta(days=(int(cid[1:]) * 17) % 210)).isoformat(),
        "risk_score": risk_score,
        "triage_tier": triage_tier,
        "farmer_id": fid,
        "assessor_id": aid,
        "zone_id": zid,
        "explainability": {
            "graph_note": graph_note,
        },
        "proof_trace": proof_trace,
        "rules_fired": rules_fired,
        "risk_flag": risk_flag,
        "policy_number": f"PMFBY-MH-2024-25-{cid}",
        "inspection_date": "",
        "crop_year": 2024,
        "policy_value": payout / max(float(c_row.get("claimed_damage_pct", 0.0)) / 100.0, 0.2),
        "gnn_available": os.path.exists(os.path.join(DATA_DIR, "pipeline_metrics.json")),
    }
    claim_record["inspection_date"] = (date.fromisoformat(claim_record["claim_date"]) + timedelta(days=7 + (int(cid[1:]) % 8))).isoformat()
    # Note: is_fraud is NEVER included in claim_record or exposed
    MOCK_CLAIMS_RAW.append(claim_record)

    claims_by_farmer.setdefault(fid, []).append(cid)
    claims_by_assessor.setdefault(aid, []).append(cid)
    claims_by_zone.setdefault(zid, []).append(cid)

CLAIMS_MAP: Dict[str, Dict[str, Any]] = {c["claim_id"]: c for c in MOCK_CLAIMS_RAW}


def clear_active_dataset() -> None:
    """Start the API with an empty portfolio; uploads populate it for this session."""
    global DATA_DIR, farmers_df, assessors_df, zones_df, claims_df

    DATA_DIR = ""
    farmers_df = pd.DataFrame()
    assessors_df = pd.DataFrame()
    zones_df = pd.DataFrame()
    claims_df = pd.DataFrame()
    for mapping in (
        farmers_dict, farmer_details, farmer_to_family, family_to_farmers,
        assessors_dict, zones_dict, scores_dict, proofs_dict, graph_nodes_dict,
        claims_by_farmer, claims_by_assessor, claims_by_zone, CLAIMS_MAP,
    ):
        mapping.clear()
    graph_edges_list.clear()
    MOCK_CLAIMS_RAW.clear()


def activate_dataset(data_dir: str) -> None:
    """Replace the in-memory portfolio after a dataset has been analyzed."""
    global DATA_DIR, farmers_df, farmers_dict, farmer_details
    global farmer_to_family, family_to_farmers, assessors_df, assessors_dict
    global zones_df, zones_dict, scores_dict, proofs_dict, graph_nodes_dict
    global graph_edges_list, claims_by_farmer, claims_by_assessor, claims_by_zone

    data_dir = os.path.abspath(data_dir)

    def value_or(value: Any, default: Any = "") -> Any:
        return default if pd.isna(value) or str(value).strip() == "" else value
    claims_file = os.path.join(data_dir, "claims.csv")
    farmers_file = os.path.join(data_dir, "farmers.csv")
    assessors_file = os.path.join(data_dir, "assessors.csv")
    zones_file = os.path.join(data_dir, "weather_zones.csv")
    scores_file = os.path.join(data_dir, "claim_scores.csv")
    proofs_file = os.path.join(data_dir, "claim_proofs.csv")

    next_claims = pd.read_csv(claims_file)
    next_farmers_df = pd.read_csv(farmers_file)
    next_assessors_df = pd.read_csv(assessors_file)
    next_zones_df = pd.read_csv(zones_file)
    scores_df = pd.read_csv(scores_file)
    proofs_df = pd.read_csv(proofs_file) if os.path.exists(proofs_file) else pd.DataFrame()
    claim_ids = set(next_claims.claim_id.astype(str))
    if set(scores_df.claim_id.astype(str)) != claim_ids:
        raise ValueError("Generated score IDs do not match the uploaded claim IDs")
    if not proofs_df.empty and not set(proofs_df.claim_id.astype(str)).issubset(claim_ids):
        raise ValueError("Generated proof file contains claim IDs absent from the uploaded claims")

    next_farmers_dict = dict(zip(next_farmers_df.farmer_id.astype(str), next_farmers_df.name.astype(str)))
    next_farmer_details = {str(row.farmer_id): row._asdict() for row in next_farmers_df.itertuples(index=False)}
    next_farmer_to_family = {}
    next_family_to_farmers = {}
    if "family_group_id" in next_farmers_df.columns:
        for row in next_farmers_df.itertuples(index=False):
            fid = str(row.farmer_id)
            family_id = str(value_or(getattr(row, "family_group_id", ""))).strip()
            if family_id and family_id.lower() != "nan":
                next_farmer_to_family[fid] = family_id
                next_family_to_farmers.setdefault(family_id, []).append(fid)

    next_assessors_dict = dict(zip(next_assessors_df.assessor_id.astype(str), next_assessors_df.name.astype(str)))
    next_zones_dict = {str(row.zone_id): row._asdict() for row in next_zones_df.itertuples(index=False)}
    next_scores_dict = {
        str(row.claim_id): {
            "risk_score": float(row.risk_score),
            "triage_tier": str(row.triage_tier),
            "graph_note": str(getattr(row, "graph_note", "Graph score generated by the trained model.")),
        }
        for row in scores_df.itertuples(index=False)
    }

    next_proofs_dict = {}
    if not proofs_df.empty:
        for row in proofs_df.itertuples(index=False):
            trace_value = str(value_or(getattr(row, "proof_trace", "")))
            rules_value = str(value_or(getattr(row, "rules_fired", "")))
            next_proofs_dict[str(row.claim_id)] = {
                "proof_trace": [step.strip() for step in trace_value.split(" | ") if step.strip()],
                "rules_fired": [rule.strip() for rule in rules_value.split(";") if rule.strip()],
                "risk_flag": int(value_or(getattr(row, "risk_flag", 0), 0)),
                "split": str(getattr(row, "split", "")),
            }

    next_graph_nodes_dict = {}
    next_graph_edges_list = []
    nodes_file = os.path.join(data_dir, "graph_nodes.csv")
    edges_file = os.path.join(data_dir, "graph_edges.csv")
    if os.path.exists(nodes_file):
        for row in pd.read_csv(nodes_file).itertuples(index=False):
            next_graph_nodes_dict[str(row.node_id)] = {
                "type": str(getattr(row, "type", "")),
                "name": str(getattr(row, "name", "")),
                "event": str(getattr(row, "event", "") or ""),
            }
    if os.path.exists(edges_file):
        for row in pd.read_csv(edges_file).itertuples(index=False):
            next_graph_edges_list.append({
                "source": str(row.source), "target": str(row.target),
                "weight": min(1.0, max(0.0, float(getattr(row, "weight", 1.0)))),
                "relation": str(getattr(row, "relation", "connected_to")),
            })

    next_claims_by_farmer = {}
    next_claims_by_assessor = {}
    next_claims_by_zone = {}
    next_records = []
    base_date = date(2024, 6, 1)
    for row_index, row in enumerate(next_claims.to_dict(orient="records")):
        cid = str(row["claim_id"])
        fid, aid, zid = str(row["farmer_id"]), str(row["assessor_id"]), str(row["zone_id"])
        farmer = next_farmer_details.get(fid, {})
        zone = next_zones_dict.get(zid, {})
        score = next_scores_dict[cid]
        proof = next_proofs_dict.get(cid, {})
        payout = float(row["claimed_payout_amount"])
        damage = float(row["claimed_damage_pct"])
        reported = str(value_or(row.get("claim_date"), (base_date + timedelta(days=(row_index * 17) % 210)).isoformat()))
        try:
            date.fromisoformat(reported)
        except ValueError:
            reported = (base_date + timedelta(days=(row_index * 17) % 210)).isoformat()
        inspection = str(value_or(row.get("inspection_date"), (
            date.fromisoformat(reported) + timedelta(days=7 + row_index % 8)
        ).isoformat()))
        next_records.append({
            "claim_id": cid,
            "farmer_name": next_farmers_dict.get(fid, fid),
            "assessor_name": next_assessors_dict.get(aid, aid),
            "crop_type": str(row["crop_type"]),
            "claimed_damage_pct": damage,
            "insured_acres": float(farmer.get("land_holding_acres", 0.0)),
            "taluka": str(value_or(farmer.get("village"), demo_taluka(str(farmer.get("district", "")), fid))),
            "district": str(farmer.get("district", "")),
            "peril_type": str(zone.get("event_type", "Weather event")),
            "zone_severity": float(zone.get("severity_index", 0.0)),
            "claimed_payout_amount": payout,
            "claim_date": reported,
            "risk_score": score["risk_score"],
            "triage_tier": score["triage_tier"],
            "farmer_id": fid,
            "assessor_id": aid,
            "zone_id": zid,
            "explainability": {"graph_note": score["graph_note"]},
            "proof_trace": proof.get("proof_trace", []),
            "rules_fired": proof.get("rules_fired", []),
            "risk_flag": proof.get("risk_flag", 0),
            "policy_number": str(value_or(row.get("policy_number"), f"PMFBY-MH-2024-25-{cid}")),
            "inspection_date": inspection,
            "crop_year": int(value_or(row.get("crop_year"), 2024)),
            "policy_value": float(value_or(row.get("policy_value"), payout / max(damage / 100.0, 0.2))),
            "gnn_available": True,
        })
        next_claims_by_farmer.setdefault(fid, []).append(cid)
        next_claims_by_assessor.setdefault(aid, []).append(cid)
        next_claims_by_zone.setdefault(zid, []).append(cid)

    DATA_DIR = data_dir
    farmers_df = next_farmers_df
    assessors_df = next_assessors_df
    zones_df = next_zones_df
    farmers_dict = next_farmers_dict
    farmer_details = next_farmer_details
    farmer_to_family = next_farmer_to_family
    family_to_farmers = next_family_to_farmers
    assessors_dict = next_assessors_dict
    zones_dict = next_zones_dict
    scores_dict = next_scores_dict
    proofs_dict = next_proofs_dict
    graph_nodes_dict = next_graph_nodes_dict
    graph_edges_list = next_graph_edges_list
    claims_by_farmer = next_claims_by_farmer
    claims_by_assessor = next_claims_by_assessor
    claims_by_zone = next_claims_by_zone
    MOCK_CLAIMS_RAW[:] = next_records
    CLAIMS_MAP.clear()
    CLAIMS_MAP.update({record["claim_id"]: record for record in next_records})


def generate_claim_network(claim_data: Dict[str, Any]) -> NetworkGraph:
    """
    Builds a relationship network for the specified claim, returning the claim,
    its farmer, assessor and zone, plus up to 6 other claims by the same farmer
    or family group, and up to 6 by the same assessor, ordered by risk_score descending.
    Marks each node with its type and risk_score. Never exposes is_fraud.
    """
    claim_id = str(claim_data["claim_id"])
    farmer_id = str(claim_data.get("farmer_id", ""))
    assessor_id = str(claim_data.get("assessor_id", ""))
    zone_id = str(claim_data.get("zone_id", ""))

    # If missing from claim_data, resolve from CLAIMS_MAP
    if not (farmer_id and assessor_id and zone_id) and claim_id in CLAIMS_MAP:
        rec = CLAIMS_MAP[claim_id]
        farmer_id = farmer_id or rec.get("farmer_id", "")
        assessor_id = assessor_id or rec.get("assessor_id", "")
        zone_id = zone_id or rec.get("zone_id", "")

    # 1. Claims by the same farmer or family group (up to 6, ordered by risk_score desc)
    fam_id = farmer_to_family.get(farmer_id, "")
    related_farmer_ids = set(family_to_farmers.get(fam_id, [])) if fam_id else set()
    related_farmer_ids.add(farmer_id)

    farmer_candidate_cids: List[str] = []
    for fid in related_farmer_ids:
        for cid in claims_by_farmer.get(fid, []):
            if cid != claim_id and cid not in farmer_candidate_cids:
                farmer_candidate_cids.append(cid)

    # Order by risk_score descending
    farmer_candidate_cids.sort(
        key=lambda c: CLAIMS_MAP.get(c, {}).get("risk_score", 0.0),
        reverse=True
    )
    selected_farmer_claims = farmer_candidate_cids[:6]

    # 2. Claims by the same assessor (up to 6, ordered by risk_score desc, excluding already selected)
    assessor_candidate_cids: List[str] = []
    for cid in claims_by_assessor.get(assessor_id, []):
        if cid != claim_id and cid not in selected_farmer_claims and cid not in assessor_candidate_cids:
            assessor_candidate_cids.append(cid)

    # Order by risk_score descending
    assessor_candidate_cids.sort(
        key=lambda c: CLAIMS_MAP.get(c, {}).get("risk_score", 0.0),
        reverse=True
    )
    selected_assessor_claims = assessor_candidate_cids[:6]

    nodes: List[NetworkNode] = []

    # 1. Main claim node
    main_risk = float(claim_data.get("risk_score", 50.0))
    nodes.append(
        NetworkNode(
            id=claim_id,
            label=f"Claim {claim_id}",
            kind="claim",
            type="claim",
            risk_score=main_risk,
            triage_tier=str(claim_data.get("triage_tier", "approve")),
        )
    )

    # 2. Farmer node
    farmer_name = claim_data.get("farmer_name") or farmers_dict.get(farmer_id, farmer_id)
    farmer_all_cids = claims_by_farmer.get(farmer_id, [])
    farmer_risk = (
        round(sum(CLAIMS_MAP[c]["risk_score"] for c in farmer_all_cids) / len(farmer_all_cids), 1)
        if farmer_all_cids
        else main_risk
    )
    nodes.append(
        NetworkNode(
            id=farmer_id,
            label=farmer_name,
            kind="farmer",
            type="farmer",
            risk_score=farmer_risk,
            triage_tier=None,
        )
    )

    # 3. Assessor node
    assessor_name = claim_data.get("assessor_name") or assessors_dict.get(assessor_id, assessor_id)
    assessor_all_cids = claims_by_assessor.get(assessor_id, [])
    assessor_risk = (
        round(sum(CLAIMS_MAP[c]["risk_score"] for c in assessor_all_cids) / len(assessor_all_cids), 1)
        if assessor_all_cids
        else main_risk
    )
    nodes.append(
        NetworkNode(
            id=assessor_id,
            label=assessor_name,
            kind="assessor",
            type="assessor",
            risk_score=assessor_risk,
            triage_tier=None,
        )
    )

    # 4. Zone node
    zone_event = graph_nodes_dict.get(zone_id, {}).get("event", "")
    zone_label = f"Zone {zone_id} ({zone_event})" if zone_event else f"Zone {zone_id}"
    zone_all_cids = claims_by_zone.get(zone_id, [])
    zone_risk = (
        round(sum(CLAIMS_MAP[c]["risk_score"] for c in zone_all_cids) / len(zone_all_cids), 1)
        if zone_all_cids
        else main_risk
    )
    nodes.append(
        NetworkNode(
            id=zone_id,
            label=zone_label,
            kind="zone",
            type="zone",
            risk_score=zone_risk,
            triage_tier=None,
        )
    )

    # 5. Other claims (up to 6 by farmer/family + up to 6 by assessor)
    other_claims = selected_farmer_claims + selected_assessor_claims
    for oid in other_claims:
        odata = CLAIMS_MAP.get(oid, {})
        o_risk = float(odata.get("risk_score", 50.0))
        nodes.append(
            NetworkNode(
                id=oid,
                label=f"Claim {oid}",
                kind="claim",
                type="claim",
                risk_score=o_risk,
                triage_tier=str(odata.get("triage_tier", "approve")),
            )
        )

    # Build edges between all active nodes
    active_node_ids = {n.id for n in nodes}
    edges: List[NetworkEdge] = []
    seen_edge_keys: Set[tuple] = set()

    for e in graph_edges_list:
        src = e["source"]
        tgt = e["target"]
        if src in active_node_ids and tgt in active_node_ids:
            key = (src, tgt, e["relation"])
            rev_key = (tgt, src, e["relation"])
            if key not in seen_edge_keys and rev_key not in seen_edge_keys:
                seen_edge_keys.add(key)
                
                # Anomaly flag if connected to investigated claim
                is_anom = False
                for cid in [src, tgt]:
                    if cid in CLAIMS_MAP and CLAIMS_MAP[cid].get("triage_tier") == "investigate":
                        is_anom = True
                        break

                edges.append(
                    NetworkEdge(
                        source=src,
                        target=tgt,
                        relationship=e["relation"],
                        weight=e["weight"],
                        is_anomalous=is_anom,
                    )
                )

    # Ensure baseline direct edges for the main claim
    base_edges = [
        (farmer_id, claim_id, "filed_by"),
        (assessor_id, claim_id, "verified_by"),
        (zone_id, claim_id, "in_zone"),
    ]
    is_main_investigate = (claim_data.get("triage_tier") == "investigate")
    for s, t, r in base_edges:
        if s and t and (s, t, r) not in seen_edge_keys and (t, s, r) not in seen_edge_keys:
            seen_edge_keys.add((s, t, r))
            edges.append(
                NetworkEdge(
                    source=s,
                    target=t,
                    relationship=r,
                    weight=1.0,
                    is_anomalous=is_main_investigate,
                )
            )

    # Connect other farmer/family claims
    for oid in selected_farmer_claims:
        o_fid = CLAIMS_MAP.get(oid, {}).get("farmer_id", farmer_id)
        rel = "filed_by" if o_fid == farmer_id else "family_claim"
        key = (farmer_id, oid, rel)
        rev_key = (oid, farmer_id, rel)
        if key not in seen_edge_keys and rev_key not in seen_edge_keys:
            seen_edge_keys.add(key)
            edges.append(
                NetworkEdge(
                    source=farmer_id,
                    target=oid,
                    relationship=rel,
                    weight=0.9,
                    is_anomalous=(CLAIMS_MAP.get(oid, {}).get("triage_tier") == "investigate"),
                )
            )

    # Connect other assessor claims
    for oid in selected_assessor_claims:
        key = (assessor_id, oid, "verified_by")
        rev_key = (oid, assessor_id, "verified_by")
        if key not in seen_edge_keys and rev_key not in seen_edge_keys:
            seen_edge_keys.add(key)
            edges.append(
                NetworkEdge(
                    source=assessor_id,
                    target=oid,
                    relationship="verified_by",
                    weight=0.9,
                    is_anomalous=(CLAIMS_MAP.get(oid, {}).get("triage_tier") == "investigate"),
                )
            )

    return NetworkGraph(nodes=nodes, edges=edges)
