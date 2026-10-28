# AgriGuard — Discrete Mathematics Risk Analytics

AgriGuard is a local dashboard for an illustrative Maharashtra crop-insurance portfolio. It connects PMFBY-style claim, producer, assessor, crop, village, weather-zone and payout records to precomputed graph-risk scores and a propositional-logic inference trace.

**Portfolio records and scores are illustrative, not live PMFBY/RMA records.** The running API reads the CSVs in `agriguard_gnn_build/`. The bundled risk scores are precomputed values; the application does not load a trained GNN model. “Coverage” values in the UI are illustrative estimates derived from the claim amount and reported loss percentage, not source policy records.

## Run locally

In one terminal, install the API dependencies and start FastAPI from the repository root:

```bash
python -m pip install fastapi uvicorn pandas
python -m uvicorn backend.main:app --reload --port 8000
```

In a second terminal, install frontend dependencies and start Vite:

```bash
npm install
npm run dev -- --host 0.0.0.0
```

Open the local address printed by Vite. The frontend calls `http://localhost:8000` by default. To use another API address, set `VITE_API_BASE_URL` before starting Vite.

## Features

- Search claims by claim ID, producer, assessor, district, village, crop, peril, policy, or weather zone.
- Filter by risk tier, pin claims, inspect claim details, and view the claim relationship graph.
- Explore filtered portfolio analytics and export the current filtered results as CSV.
- Save analyst notes and pinned claims in the current browser.
- Read generated proof traces from `claim_proofs.csv`. The inference pipeline only applies a rule when its premises are available. A zero risk flag means no configured risk trigger was derived; it does not prove `¬Risk`.

## Regenerate the symbolic proof traces

The 2,500 illustrative claim proof records can be regenerated from the bundled claims and precomputed risk scores:

```bash
python -m pip install numpy pandas scikit-learn
python agriguard_gnn_build/inference_engine.py
```

The training scripts are research artifacts; model training and scoring are not part of the local dashboard startup flow.
