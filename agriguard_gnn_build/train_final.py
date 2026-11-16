import os
import sys
import copy
import pickle
import json
from datetime import datetime, timezone
import warnings
import numpy as np
import pandas as pd
import torch
import torch.nn.functional as F
from torch_geometric.data import HeteroData
from torch_geometric.nn import HeteroConv, SAGEConv
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.metrics import f1_score, roc_auc_score, precision_score, recall_score
from xgboost import XGBClassifier

warnings.filterwarnings("ignore")

# 1. Resolve CSV Folder
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
if len(sys.argv) > 1 and os.path.exists(os.path.join(sys.argv[1], "claims.csv")):
    FOLDER = sys.argv[1]
elif os.path.exists(os.path.join(SCRIPT_DIR, "claims.csv")):
    FOLDER = SCRIPT_DIR
elif os.path.exists("claims.csv"):
    FOLDER = "."
elif os.path.exists(os.path.join("agriguard_gnn_build", "claims.csv")):
    FOLDER = os.path.join("agriguard_gnn_build")
else:
    FOLDER = SCRIPT_DIR

print(f"Loading CSV data from: {FOLDER}")
claims = pd.read_csv(os.path.join(FOLDER, "claims.csv"))
farmers = pd.read_csv(os.path.join(FOLDER, "farmers.csv"))
assessors = pd.read_csv(os.path.join(FOLDER, "assessors.csv"))
zones = pd.read_csv(os.path.join(FOLDER, "weather_zones.csv"))

print(f"Loaded: claims={len(claims)}, farmers={len(farmers)}, assessors={len(assessors)}, zones={len(zones)}")
print(f"Fraud rate: {claims.is_fraud.mean():.3f}")

# Keep a final holdout that is never used to select the checkpoint. Graph
# structure and unlabeled features remain visible to the transductive model.
all_idx = np.arange(len(claims))
train_val_idx, test_idx = train_test_split(
    all_idx, test_size=0.20, stratify=claims.is_fraud, random_state=42
)
tr, va = train_test_split(
    train_val_idx, test_size=0.25,
    stratify=claims.is_fraud.iloc[train_val_idx], random_state=42
)
split_labels = np.full(len(claims), "train", dtype=object)
split_labels[va] = "validation"
split_labels[test_idx] = "test"
train_claims = claims.iloc[tr]

# 2. Extract & Scale Features (Identical to run_gnn_part.py)
crop_encoder = LabelEncoder()
crop_encoder.fit(claims.crop_type)
crop = crop_encoder.transform(claims.crop_type)
claim_raw = np.stack([claims.claimed_damage_pct, claims.claimed_payout_amount / 1000.0, crop], 1).astype(np.float32)
claim_scaler = StandardScaler()
claim_scaler.fit(claim_raw[tr])
claim_x = claim_scaler.transform(claim_raw)

a_cnt = train_claims.assessor_id.value_counts()
assessor_mean_load = float(a_cnt.mean()) if len(a_cnt) else 1.0
assessors["load"] = assessors.assessor_id.map(a_cnt).fillna(0) / max(assessor_mean_load, 1.0)
assessor_scaler = StandardScaler()
assessor_raw = assessors[["years_of_service", "load"]].values.astype(np.float32)
train_assessors = assessors.assessor_id.isin(set(train_claims.assessor_id))
assessor_scaler.fit(assessor_raw[train_assessors])
assessor_x = assessor_scaler.transform(assessor_raw)

farmer_scaler = StandardScaler()
farmer_raw = farmers[["land_holding_acres"]].values.astype(np.float32)
train_farmers = farmers.farmer_id.isin(set(train_claims.farmer_id))
farmer_scaler.fit(farmer_raw[train_farmers])
farmer_x = farmer_scaler.transform(farmer_raw)

zone_x = zones[["severity_index"]].values.astype(np.float32)

# 3. Create Integer Mappings & Edges
fi = {k: i for i, k in enumerate(farmers.farmer_id)}
ai = {k: i for i, k in enumerate(assessors.assessor_id)}
zi = {k: i for i, k in enumerate(zones.zone_id)}
ci = {k: i for i, k in enumerate(claims.claim_id)}
n = len(claims)
cidx = torch.arange(n, dtype=torch.long)

e_f = torch.stack([cidx, torch.tensor([fi[k] for k in claims.farmer_id], dtype=torch.long)])
e_a = torch.stack([cidx, torch.tensor([ai[k] for k in claims.assessor_id], dtype=torch.long)])
e_z = torch.stack([cidx, torch.tensor([zi[k] for k in claims.zone_id], dtype=torch.long)])

# 4. Assemble HeteroData
data = HeteroData()
data["claim"].x = torch.tensor(claim_x, dtype=torch.float)
data["farmer"].x = torch.tensor(farmer_x, dtype=torch.float)
data["assessor"].x = torch.tensor(assessor_x, dtype=torch.float)
data["zone"].x = torch.tensor(zone_x, dtype=torch.float)

data["claim", "filed_by", "farmer"].edge_index = e_f
data["claim", "verified_by", "assessor"].edge_index = e_a
data["claim", "in_zone", "zone"].edge_index = e_z

data["farmer", "rev_filed_by", "claim"].edge_index = e_f.flip(0)
data["assessor", "rev_verified_by", "claim"].edge_index = e_a.flip(0)
data["zone", "rev_in_zone", "claim"].edge_index = e_z.flip(0)

y = torch.tensor(claims.is_fraud.values, dtype=torch.long)


# 5. HeteroGraphSAGE Architecture (Identical to run_gnn_part.py)
class HeteroGraphSAGE(torch.nn.Module):
    def __init__(self, hidden_dim=32):
        super().__init__()
        self.conv1 = HeteroConv({
            ('claim', 'filed_by', 'farmer'): SAGEConv((-1, -1), hidden_dim),
            ('claim', 'verified_by', 'assessor'): SAGEConv((-1, -1), hidden_dim),
            ('claim', 'in_zone', 'zone'): SAGEConv((-1, -1), hidden_dim),
            ('farmer', 'rev_filed_by', 'claim'): SAGEConv((-1, -1), hidden_dim),
            ('assessor', 'rev_verified_by', 'claim'): SAGEConv((-1, -1), hidden_dim),
            ('zone', 'rev_in_zone', 'claim'): SAGEConv((-1, -1), hidden_dim),
        }, aggr='sum')

        self.conv2 = HeteroConv({
            ('claim', 'filed_by', 'farmer'): SAGEConv((-1, -1), hidden_dim),
            ('claim', 'verified_by', 'assessor'): SAGEConv((-1, -1), hidden_dim),
            ('claim', 'in_zone', 'zone'): SAGEConv((-1, -1), hidden_dim),
            ('farmer', 'rev_filed_by', 'claim'): SAGEConv((-1, -1), 2),
            ('assessor', 'rev_verified_by', 'claim'): SAGEConv((-1, -1), 2),
            ('zone', 'rev_in_zone', 'claim'): SAGEConv((-1, -1), 2),
        }, aggr='sum')

    def forward(self, x_dict, edge_index_dict):
        x_dict = self.conv1(x_dict, edge_index_dict)
        x_dict = {k: F.relu(v) for k, v in x_dict.items()}
        x_dict = {k: F.dropout(v, p=0.3, training=self.training) for k, v in x_dict.items()}
        x_dict = self.conv2(x_dict, edge_index_dict)
        return x_dict["claim"]


# 6. Train/validation/test indices
tr_tensor = torch.tensor(tr, dtype=torch.long)
va_tensor = torch.tensor(va, dtype=torch.long)

# Same class weights as run_gnn_part.py
cnt = np.bincount(y[tr_tensor].numpy())
class_weights = torch.tensor([1.0, cnt[0] / max(cnt[1], 1)], dtype=torch.float)

# Seed & Model Initialization
torch.manual_seed(42)
np.random.seed(42)
model = HeteroGraphSAGE(hidden_dim=32)

# Initialize lazy conv layers
_ = model(data.x_dict, data.edge_index_dict)

# Same optimizer and lr as run_gnn_part.py: lr=0.01, weight_decay=5e-4
opt = torch.optim.Adam(model.parameters(), lr=0.01, weight_decay=5e-4)

# 7. Training loop (checkpoint selected on validation only)
EPOCHS = max(1, int(os.environ.get("AGRIGUARD_EPOCHS", "150")))
best_f1 = -1.0
best_auc = 0.0
best_epoch = -1
best_state_dict = None

print(f"\nTraining HeteroGraphSAGE for {EPOCHS} epochs on 60/20/20 train/validation/test splits...")
for ep in range(1, EPOCHS + 1):
    model.train()
    opt.zero_grad()
    out = model(data.x_dict, data.edge_index_dict)
    loss = F.cross_entropy(out[tr_tensor], y[tr_tensor], weight=class_weights)
    loss.backward()
    opt.step()

    model.eval()
    with torch.no_grad():
        logits = model(data.x_dict, data.edge_index_dict)
        prob = F.softmax(logits, dim=1)[:, 1].cpu().numpy()

    y_val = y[va_tensor].cpu().numpy()
    p_val = prob[va]
    pred_val = (p_val > 0.5).astype(int)
    vf1 = f1_score(y_val, pred_val, zero_division=0)
    vauc = roc_auc_score(y_val, p_val)

    if vf1 > best_f1:
        best_f1 = vf1
        best_auc = vauc
        best_epoch = ep
        best_state_dict = copy.deepcopy(model.state_dict())

    if ep % 25 == 0 or ep == 1:
        print(f"Epoch {ep:3d}/{EPOCHS} | Loss: {loss.item():.4f} | Val F1: {vf1:.4f} | Val AUC: {vauc:.4f}")

# 8. Evaluate the selected checkpoint once on the untouched test split
model.load_state_dict(best_state_dict)
model.eval()
with torch.no_grad():
    final_logits = model(data.x_dict, data.edge_index_dict)
    final_prob = F.softmax(final_logits, dim=1)[:, 1].cpu().numpy()

test_labels = y[test_idx].cpu().numpy()
test_prob = final_prob[test_idx]
test_pred = (test_prob >= 0.5).astype(int)
test_metrics = {
    "claims": int(len(test_idx)),
    "fraud_labels": int(test_labels.sum()),
    "f1": float(f1_score(test_labels, test_pred, zero_division=0)),
    "auc": float(roc_auc_score(test_labels, test_prob)),
    "precision": float(precision_score(test_labels, test_pred, zero_division=0)),
    "recall": float(recall_score(test_labels, test_pred, zero_division=0)),
}

# A tabular baseline on the same fixed split provides a fair check that graph
# message passing contributes value beyond claim-level features alone.
baseline_features = np.column_stack([claim_raw[:, 0], claim_raw[:, 1], crop]).astype(np.float32)
train_labels = y[tr].cpu().numpy()
baseline_weight = (train_labels == 0).sum() / max((train_labels == 1).sum(), 1)
baseline = XGBClassifier(
    n_estimators=150, max_depth=4, learning_rate=0.05,
    subsample=0.9, colsample_bytree=0.9,
    objective="binary:logistic", eval_metric="logloss", random_state=42, n_jobs=1,
    scale_pos_weight=baseline_weight,
)
baseline.fit(baseline_features[tr], train_labels)
baseline_prob = baseline.predict_proba(baseline_features[test_idx])[:, 1]
baseline_pred = (baseline_prob >= 0.5).astype(int)
baseline_metrics = {
    "model": "XGBoost (claim features only)",
    "f1": float(f1_score(test_labels, baseline_pred, zero_division=0)),
    "auc": float(roc_auc_score(test_labels, baseline_prob)),
    "precision": float(precision_score(test_labels, baseline_pred, zero_division=0)),
    "recall": float(recall_score(test_labels, baseline_pred, zero_division=0)),
}

print("\n" + "=" * 50)
print(f"Best Validation Epoch: {best_epoch}")
print(f"Validation F1: {best_f1:.4f} | Validation AUC: {best_auc:.4f}")
print(f"Untouched test F1: {test_metrics['f1']:.4f} | Test AUC: {test_metrics['auc']:.4f}")
print(f"Tabular baseline F1: {baseline_metrics['f1']:.4f} | Baseline AUC: {baseline_metrics['auc']:.4f}")
print("=" * 50)

# Publish fresh portfolio scores from the selected trained checkpoint.
score_rows = claims[["claim_id", "farmer_id", "assessor_id", "zone_id"]].copy()
score_rows["risk_score"] = np.round(final_prob * 100.0, 1)
score_rows["triage_tier"] = np.where(
    score_rows.risk_score >= 70.0, "investigate",
    np.where(score_rows.risk_score >= 40.0, "review", "approve")
)
score_rows["split"] = split_labels

graph_notes = []
for row in score_rows.itertuples(index=False):
    peers = score_rows[
        ((score_rows.assessor_id == row.assessor_id) |
         (score_rows.farmer_id == row.farmer_id) |
         (score_rows.zone_id == row.zone_id)) &
        (score_rows.claim_id != row.claim_id)
    ]
    elevated = int((peers.risk_score >= 70.0).sum())
    graph_notes.append(
        f"GraphSAGE score {row.risk_score:.1f}/100. "
        f"{elevated} of {len(peers)} claims sharing a farmer, assessor, or zone "
        "also scored at least 70."
    )
score_rows["graph_note"] = graph_notes
score_path = os.path.join(FOLDER, "claim_scores.csv")
score_rows[["claim_id", "risk_score", "triage_tier", "graph_note", "split"]].to_csv(score_path, index=False)
print(f"Generated {len(score_rows)} claim scores: {score_path}")

# 9. Save Artifacts into models/
scaler_and_ids = {
    "claim_scaler": claim_scaler,
    "assessor_scaler": assessor_scaler,
    "farmer_scaler": farmer_scaler,
    "crop_encoder": crop_encoder,
    "claim_id_map": ci,
    "farmer_id_map": fi,
    "assessor_id_map": ai,
    "zone_id_map": zi,
    "scalers": {
        "claim": claim_scaler,
        "assessor": assessor_scaler,
        "farmer": farmer_scaler,
        "crop_encoder": crop_encoder,
    },
    "id_maps": {
        "claim": ci,
        "farmer": fi,
        "assessor": ai,
        "zone": zi,
    },
    "assessor_load_counts": a_cnt,
    "assessor_mean_load": assessor_mean_load,
    "selected_epoch": best_epoch,
    "random_seed": 42,
}

model_dir = os.path.join(FOLDER, "models")
os.makedirs(model_dir, exist_ok=True)
torch.save(best_state_dict, os.path.join(model_dir, "graphsage_model.pt"))
torch.save(data, os.path.join(model_dir, "hetero_graph.pt"))
with open(os.path.join(model_dir, "scaler_and_ids.pkl"), "wb") as f:
    pickle.dump(scaler_and_ids, f)

metrics_payload = {
    "model": "Heterogeneous GraphSAGE",
    "evaluation_scope": "synthetic, transductive graph split",
    "split_counts": {
        "train": int(len(tr)), "validation": int(len(va)), "test": int(len(test_idx))
    },
    "selected_epoch": int(best_epoch),
    "validation": {"f1": float(best_f1), "auc": float(best_auc)},
    "test": test_metrics,
    "baseline": baseline_metrics,
    "generated_at": datetime.now(timezone.utc).isoformat(),
}
with open(os.path.join(FOLDER, "pipeline_metrics.json"), "w", encoding="utf-8") as f:
    json.dump(metrics_payload, f, indent=2)

from inference_engine import run_symbolic_inference
proof_path = os.path.join(FOLDER, "claim_proofs.csv")
run_symbolic_inference(os.path.join(FOLDER, "claims.csv"), score_path, proof_path)
print(f"Saved trained model artifacts to {model_dir}/")

if __name__ == "__main__":
    pass
