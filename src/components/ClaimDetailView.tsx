import { useClaims } from '../context/ClaimsContext';
import {
  Network,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  User,
  ShieldAlert,
  Layers,
  Activity,
  FileSpreadsheet,
  Zap,
  Pin,
  X,
  ShieldCheck,
  Info,
  Scale
} from 'lucide-react';

/**
 * Formats a raw number as INR currency.
 */
function formatInr(amount: any) {
  if (typeof amount !== 'number') return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Formats decimal score (0.0 - 1.0) as percentage string.
 */
function formatPercent(value: any) {
  if (typeof value !== 'number') return '0%';
  return `${Math.round(value * 100)}%`;
}

/**
 * ClaimDetailView — AgriGuard Deep-Dive Detail Inspector
 * Presents claim network findings alongside the symbolic inference logical proof.
 */
export function ClaimDetailView() {
  const { state, selectClaim, togglePinClaim, setInvestigatorNotes } = useClaims();
  const selectedClaim = state.claims.find((c) => c.metadata.claimId === state.selectedClaimId);

  const handleClose = () => {
    selectClaim(null);
  };

  if (!selectedClaim) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full bg-app-panel text-app-ink p-8 text-center rounded-xl border border-app-line shadow-sm select-none">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-app-safe-soft text-app-safe mb-4">
          <Network className="h-7 w-7" />
        </div>
        <h3 className="font-heading text-lg font-bold tracking-tight text-app-ink">
          No Claim Selected
        </h3>
        <p className="text-xs text-app-muted mt-1.5 max-w-sm">
          Select an agricultural insurance claim from the triage ledger to inspect GNN network topology and symbolic logical proofs.
        </p>

        <div className="mt-6 flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-app-panel px-3.5 py-2 text-xs text-app-muted border border-app-line shadow-sm">
            <span>Awaiting claim selection from active ledger…</span>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-2 gap-3 w-full max-w-md text-left">
          <div className="p-3.5 rounded-lg bg-app-panel border border-app-line">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-app-safe uppercase tracking-wider">
              <Network className="h-3.5 w-3.5" /> Claim Network Topology
            </div>
            <p className="text-[11px] text-app-subtle mt-1">HeteroGraphSAGE relational links & shared adjuster hubs</p>
          </div>
          <div className="p-3.5 rounded-lg bg-app-panel border border-app-line">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-app-primary uppercase tracking-wider">
              <Scale className="h-3.5 w-3.5" /> Symbolic Inference
            </div>
            <p className="text-[11px] text-app-subtle mt-1">Propositional deduction via the 9 laws of inference</p>
          </div>
        </div>
      </div>
    );
  }

  const { metadata, riskScore, anomalies, investigatorNotes, isPinned, lastAnalyzedAt, proofTrace = [], rulesFired = [] } = selectedClaim;

  // Extract GNN anomaly finding
  const gnnAnomaly = anomalies?.find((a: any) => a.pillar === 'gnn');

  // Severity helper styles
  const getSeverityBadge = (severity: any) => {
    switch (severity) {
      case 'critical':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-app-investigate-soft px-2 py-0.5 text-[10px] font-bold text-app-investigate border border-app-investigate uppercase tracking-wider">
            <AlertTriangle className="h-3 w-3" /> Critical Anomaly
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-app-review-soft px-2 py-0.5 text-[10px] font-bold text-app-review border border-app-review uppercase tracking-wider">
            <AlertTriangle className="h-3 w-3" /> High Risk
          </span>
        );
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 rounded bg-app-panel-soft px-2 py-0.5 text-[10px] font-bold text-app-ink border border-app-line uppercase tracking-wider">
            <Info className="h-3 w-3" /> Medium Warning
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded bg-app-safe-soft px-2 py-0.5 text-[10px] font-bold text-app-safe border border-app-safe uppercase tracking-wider">
            <CheckCircle2 className="h-3 w-3" /> Low Risk / Normal
          </span>
        );
    }
  };

  const getTierBadge = (tier: any) => {
    switch (tier) {
      case 'investigate':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-app-investigate px-3 py-1 text-xs font-bold text-white shadow-sm uppercase tracking-wider">
            <ShieldAlert className="h-3.5 w-3.5" /> INVESTIGATE
          </span>
        );
      case 'review':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-app-review px-3 py-1 text-xs font-bold text-white shadow-sm uppercase tracking-wider">
            <AlertTriangle className="h-3.5 w-3.5" /> REVIEW REQUIRED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-app-safe px-3 py-1 text-xs font-bold text-white shadow-sm uppercase tracking-wider">
            <ShieldCheck className="h-3.5 w-3.5" /> SAFE / CLEARED
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-app-panel text-app-ink rounded-xl border border-app-line shadow-sm overflow-hidden font-sans">
      
      {/* ── HEADER BAR ──────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-app-line bg-app-canvas p-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-app-primary-fill text-white text-sm font-bold shadow-md">
            AG
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-mono text-lg font-bold tracking-tight text-app-ink">
                {metadata.claimId}
              </h2>
              {getTierBadge(riskScore.tier)}
            </div>
            <p className="text-xs text-app-subtle font-mono mt-0.5">
              Policy #{metadata.policyNumber} • {metadata.policyType}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {togglePinClaim && (
            <button
              onClick={() => togglePinClaim(metadata.claimId)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-colors ${
                isPinned
                  ? 'bg-app-review-soft border-app-review text-app-review'
                  : 'bg-app-panel border-app-line text-app-muted hover:bg-app-canvas'
              }`}
            >
              <Pin className={`h-3.5 w-3.5 ${isPinned ? 'fill-app-review text-app-review' : ''}`} />
              <span>{isPinned ? 'Pinned' : 'Pin Claim'}</span>
            </button>
          )}
          
          <button
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-app-line bg-app-panel text-app-subtle hover:text-app-ink hover:bg-app-canvas transition-colors"
            title="Close inspector"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
        
        {/* ── METRICS SUMMARY & RISK SCORE BANNER ────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          
          {/* Composite Score Card */}
          <div className="rounded-xl border border-app-investigate-soft bg-app-investigate-soft p-4 relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-app-subtle">
                Risk Score
              </span>
              <Activity className="h-4 w-4 text-app-investigate" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-3xl font-extrabold text-app-investigate">
                {formatPercent(riskScore.composite)}
              </span>
            </div>
            <div className="mt-2 w-full bg-app-panel-soft h-2 rounded-full overflow-hidden">
              <div
                className="h-full bg-app-investigate rounded-full"
                style={{ width: `${riskScore.composite * 100}%` }}
              />
            </div>
          </div>

          {/* Financial Liability Card */}
          <div className="rounded-xl border border-app-line bg-app-panel p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-app-subtle block">
              Claimed Indemnity Value
            </span>
            <div className="mt-2 font-mono text-2xl font-bold text-app-ink">
              {formatInr(metadata.claimAmountInr)}
            </div>
            <p className="text-[11px] text-app-subtle mt-1 font-mono">
              Estimated Coverage: {formatInr(metadata.policyValueInr)}
            </p>
          </div>

          {/* Crop & Peril Card */}
          <div className="rounded-xl border border-app-line bg-app-panel p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-app-subtle block">
              Insured Commodity & Peril
            </span>
            <div className="mt-2 font-semibold text-sm text-app-ink flex items-center gap-1.5">
              <Zap className="h-4 w-4 text-app-review" />
              <span>{metadata.cropType}</span>
            </div>
            <p className="text-xs text-app-subtle mt-1">
              Peril: <strong className="text-app-muted font-medium">{metadata.perilType}</strong> ({metadata.cropYear})
            </p>
          </div>

          {/* Location & Assessor Card */}
          <div className="rounded-xl border border-app-line bg-app-panel p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-app-subtle block">
              Parcel & Assessor Metadata
            </span>
            <div className="mt-1 text-xs text-app-muted space-y-1">
              <div className="flex items-center gap-1">
                <User className="h-3.5 w-3.5 text-app-subtle" />
                <span className="truncate">{metadata.farmerName} ({metadata.farmerId})</span>
              </div>
              <div className="flex items-center gap-1 text-[11px] font-mono text-app-subtle">
                <MapPin className="h-3.5 w-3.5 text-app-safe" />
                <span>PMFBY Farmland Parcel ({metadata.parcel.insuredAcres} ac) • District: {metadata.parcel.district} • Taluka: {metadata.parcel.taluka}</span>
              </div>
            </div>
          </div>

        </div>

        {/* ── EXPLAINABILITY & SYMBOLIC LOGICAL PROOF ───────────────────────── */}
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-app-line pb-2">
            <h3 className="font-heading text-sm font-bold uppercase tracking-wider text-app-ink flex items-center gap-2">
              <Layers className="h-4 w-4 text-app-primary" />
              <span>Deductive & Topological Explainability</span>
            </h3>
            <span className="text-xs text-app-subtle font-mono">
              Graph risk score • Classical Symbolic Inference (9 Laws)
            </span>
          </div>

          <div className="grid grid-cols-1 gap-6">

            {/* ═════════════════════════════════════════════════════════════════
                PILLAR 1: NETWORK SIGNALS (Graph connections, shared adjusters)
               ═════════════════════════════════════════════════════════════════ */}
            <div className="rounded-xl border border-app-line bg-app-panel p-5 shadow-sm space-y-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 bottom-0 w-1 bg-app-safe" />
              
              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-app-line pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-app-safe-soft text-app-safe">
                    <Network className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-heading font-bold text-base text-app-ink flex items-center gap-2">
                      1. Claim Network Topology Findings
                    </h4>
                    <p className="text-xs text-app-subtle font-mono">
                      Graph Neural Topology • Shared Adjusters • Spatial Clustering
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {gnnAnomaly && getSeverityBadge(gnnAnomaly.severity)}
                  <span className="rounded-full bg-app-safe-soft px-2.5 py-1 text-xs font-mono font-bold text-app-safe">
                    Raw Risk: {formatPercent(riskScore.pillars.gnn.raw)}
                  </span>
                </div>
              </div>

              {/* Anomaly Body & Technical Metric Grid */}
              {gnnAnomaly ? (
                <div className="space-y-4">
                  <div>
                    <h5 className="font-semibold text-sm text-app-ink mb-1">
                      {gnnAnomaly.title}
                    </h5>
                    <p className="text-xs text-app-muted leading-relaxed">
                      {gnnAnomaly.description}
                    </p>
                  </div>

                  {/* High-Density Technical Metric Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-app-canvas p-3.5 rounded-lg border border-app-line">
                    <div>
                      <span className="text-[10px] font-mono uppercase text-app-subtle block">
                        Assessor Hub Flag
                      </span>
                      <span className={`inline-flex items-center gap-1 text-xs font-bold mt-1 font-mono ${gnnAnomaly.sharedAssessorFlag ? 'text-app-investigate' : 'text-app-safe'}`}>
                        {gnnAnomaly.sharedAssessorFlag ? '⚠️ FLAGGED HUB' : '✓ Normal Load'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono uppercase text-app-subtle block">
                        District Claims (24mo)
                      </span>
                      <span className="text-xs font-mono font-bold text-app-ink mt-1 block">
                        {gnnAnomaly.assessorClaimCountInCounty24Mo} Claims
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono uppercase text-app-subtle block">
                        Spatial Proximity
                      </span>
                      <span className="text-xs font-mono font-bold text-app-ink mt-1 block">
                        {gnnAnomaly.multiClaimProximityKm} km Avg Dist
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] font-mono uppercase text-app-subtle block">
                        Zone Cluster ID
                      </span>
                      <span className="inline-block mt-1 font-mono text-[11px] font-bold px-2 py-0.5 rounded bg-app-safe-soft text-app-safe">
                        {gnnAnomaly.communityClusterId || 'N/A'}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-app-subtle italic">
                  No precomputed network signal is attached to this claim.
                </p>
              )}
            </div>

            {/* ═════════════════════════════════════════════════════════════════
                PILLAR 2: LOGICAL PROOF PANEL (Symbolic Inference Layer)
               ═════════════════════════════════════════════════════════════════ */}
            <div className="rounded-xl border border-app-line bg-app-panel p-5 shadow-sm space-y-4 relative overflow-hidden">
              <div className="absolute top-0 left-0 bottom-0 w-1 bg-app-primary-fill" />

              {/* Header */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-app-line pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-app-primary-soft text-app-primary">
                    <Scale className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-heading font-bold text-base text-app-ink flex items-center gap-2">
                      2. Logical Proof (Laws of Inference)
                    </h4>
                    <p className="text-xs text-app-subtle font-mono">
                      Propositional Calculus • 9 Deductive Laws • Step-by-Step Proof Trace
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-app-primary-soft px-2.5 py-1 text-xs font-mono font-bold text-app-primary">
                    {rulesFired.length} Rules Fired
                  </span>
                </div>
              </div>

              {/* Rules Fired Tags */}
              {rulesFired.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[10px] font-mono uppercase text-app-subtle mr-1">
                    Inference Rules:
                  </span>
                  {rulesFired.map((ruleName, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center rounded-md bg-app-canvas px-2 py-0.5 text-[11px] font-mono font-semibold text-app-ink border border-app-line"
                    >
                      {ruleName}
                    </span>
                  ))}
                </div>
              )}

              {/* Numbered Logical Proof Trace Steps */}
              {proofTrace.length > 0 ? (
                <div className="space-y-2.5 pt-2">
                  <span className="text-[10px] font-mono uppercase text-app-subtle block">
                    Sequential Deduction Steps:
                  </span>
                  <div className="space-y-2">
                    {proofTrace.map((step, idx) => {
                      const colonIdx = step.indexOf(':');
                      const rulePrefix = colonIdx !== -1 ? step.substring(0, colonIdx) : '';
                      const stepContent = colonIdx !== -1 ? step.substring(colonIdx + 1).trim() : step;

                      return (
                        <div
                          key={idx}
                          className="flex items-start gap-3 rounded-lg border border-app-line bg-app-canvas p-3 transition-colors hover:bg-app-panel"
                        >
                          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-app-safe-soft text-app-safe font-mono text-[11px] font-bold mt-0.5">
                            {idx + 1}
                          </div>
                          <div className="flex-1 space-y-1">
                            {rulePrefix && (
                              <div className="text-[11px] font-mono font-bold text-app-primary uppercase tracking-wide">
                                {rulePrefix}
                              </div>
                            )}
                            <div className="font-mono text-xs text-app-ink leading-relaxed break-words">
                              {stepContent}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-app-subtle italic">
                  No symbolic inference proof steps recorded for this claim.
                </p>
              )}
            </div>

          </div>
        </div>

        {/* ── INVESTIGATOR FIELD NOTES & AUDIT TRAIL ────────────────────────── */}
        <div className="rounded-xl border border-app-line bg-app-canvas p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="font-heading text-xs font-bold uppercase tracking-wider text-app-ink flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-app-safe" />
              <span>SIU Investigator Field Notes</span>
            </h4>
            <span className="text-[11px] font-mono text-app-subtle">
              Analyzed: {new Date(lastAnalyzedAt).toLocaleString()}
            </span>
          </div>

          <textarea
            rows={3}
            value={investigatorNotes ?? ''}
            onChange={(e) => setInvestigatorNotes && setInvestigatorNotes(metadata.claimId, e.target.value)}
            placeholder="Record SIU field verification findings, network cross-checks, or referral notes..."
            className="w-full rounded-lg border border-app-line bg-app-panel p-3 text-xs text-app-ink placeholder-app-subtle focus:border-app-safe focus:ring-1 focus:ring-app-primary focus:outline-none transition-all font-sans"
          />

          <div className="flex items-center justify-between text-[11px] text-app-subtle font-mono pt-1">
            <span>Audit Trail Engine: AgriGuard Risk Scores + Symbolic Logic</span>
            <span>CLU: {metadata.parcel.cluTractId}</span>
          </div>
        </div>

      </div>
    </div>
  );
}

export default ClaimDetailView;
