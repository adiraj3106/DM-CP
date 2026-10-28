import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight, BarChart3, CircleDollarSign, FileText, MapPinned, Sprout } from 'lucide-react';
import { useClaims } from '../context/ClaimsContext';
import { formatInr, formatRiskPercent } from '../utils/formatters';
import type { AgriGuardClaim } from '../types';

type BarListProps = { title: string; caption: string; values: Array<[string, number]>; icon: typeof Sprout };

function BarList({ title, caption, values, icon: Icon }: BarListProps) {
  const max = Math.max(...values.map(([, value]) => value), 1);
  return <section className="rounded-2xl border border-app-line bg-app-panel p-5 shadow-[0_4px_18px_rgba(24,40,28,0.035)]">
    <div className="flex items-start justify-between">
      <div><h3 className="font-heading text-sm font-semibold text-app-ink">{title}</h3><p className="mt-1 text-[11px] text-app-muted">{caption}</p></div>
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-app-primary-soft text-app-primary"><Icon size={17} /></span>
    </div>
    <div className="mt-5 space-y-4">{values.length ? values.map(([label, value], index) => <div key={label}>
      <div className="mb-1.5 flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-app-muted"><span className="w-4 font-mono text-[10px] text-app-subtle">{String(index + 1).padStart(2, '0')}</span>{label}</span><b className="font-mono font-semibold text-app-ink">{value.toLocaleString('en-IN')}</b></div>
      <div className="h-1.5 overflow-hidden rounded-full bg-app-track"><div className="h-full rounded-full bg-app-safe transition-[width] duration-500" style={{ width: `${Math.max(3, value / max * 100)}%` }} /></div>
    </div>) : <p className="py-6 text-center text-xs text-app-muted">No claims in the current selection.</p>}</div>
  </section>;
}

export function AnalyticsPanel({ claims }: { claims: AgriGuardClaim[] }) {
  const { stats } = useClaims();
  const byCrop = useMemo(() => {
    const counts = new Map<string, number>();
    claims.forEach((claim) => counts.set(claim.metadata.cropType, (counts.get(claim.metadata.cropType) ?? 0) + 1));
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 7);
  }, [claims]);
  const byDistrict = useMemo(() => {
    const counts = new Map<string, number>();
    claims.forEach((claim) => counts.set(claim.metadata.parcel.district, (counts.get(claim.metadata.parcel.district) ?? 0) + 1));
    return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [claims]);
  const tiers = [
    { label: 'Investigate', count: stats.tierCounts.investigate, color: 'var(--ag-investigate)', track: 'var(--ag-investigate-soft)' },
    { label: 'Review', count: stats.tierCounts.review, color: 'var(--ag-review)', track: 'var(--ag-review-soft)' },
    { label: 'Safe / Approve', count: stats.tierCounts.safe, color: 'var(--ag-safe)', track: 'var(--ag-safe-soft)' },
  ];
  const triageTotal = stats.totalClaims;
  const meanRisk = claims.length ? claims.reduce((sum, claim) => sum + claim.riskScore.composite, 0) / claims.length : 0;
  const riskFlags = claims.filter((claim) => claim.riskFlag === 1).length;
  const cards = [
    { label: 'Claims in view', value: claims.length.toLocaleString('en-IN'), note: `of ${stats.totalClaims.toLocaleString('en-IN')} total claims`, icon: FileText, tint: 'var(--ag-primary-soft)', color: 'var(--ag-primary)' },
    { label: 'Claimed indemnity', value: formatInr(claims.reduce((sum, claim) => sum + claim.metadata.claimAmountInr, 0)), note: 'Across the current selection', icon: CircleDollarSign, tint: 'var(--ag-safe-soft)', color: 'var(--ag-safe)' },
    { label: 'Mean risk score', value: formatRiskPercent(meanRisk), note: 'Average for claims in view', icon: BarChart3, tint: 'var(--ag-review-soft)', color: 'var(--ag-review)' },
    { label: 'Risk rule flags', value: riskFlags.toLocaleString('en-IN'), note: 'Claims with a derived Risk', icon: ArrowUpRight, tint: 'var(--ag-investigate-soft)', color: 'var(--ag-investigate)' },
  ];
  return <main className="analytics-content flex-1 overflow-y-auto bg-app-canvas p-6 lg:p-8">
    <div className="mx-auto max-w-[1440px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.2em] text-app-safe">Portfolio overview</p><h2 className="mt-2 font-heading text-[28px] font-semibold tracking-tight text-app-ink">Claims analytics</h2><p className="mt-1.5 text-sm text-app-muted">A filtered view of portfolio performance and claim distribution.</p></div>
        <div className="flex items-center gap-2 rounded-full border border-app-line bg-app-panel px-3.5 py-2 text-xs text-app-muted shadow-sm"><span className="h-2 w-2 rounded-full bg-app-safe" /> Showing <b className="text-app-ink">{claims.length.toLocaleString('en-IN')}</b> filtered of {stats.totalClaims.toLocaleString('en-IN')}</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, note, icon: Icon, tint, color }) => <article key={label} className="rounded-2xl border border-app-line bg-app-panel p-5 shadow-[0_4px_18px_rgba(24,40,28,0.035)]">
          <div className="flex items-start justify-between"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-app-muted">{label}</p><span className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ backgroundColor: tint, color }}><Icon size={17} /></span></div>
          <p className="mt-4 truncate font-heading text-[25px] font-semibold tracking-tight text-app-ink">{value}</p><p className="mt-1 text-[11px] text-app-muted">{note}</p>
        </article>)}
      </div>
      <div className="grid items-stretch gap-4 xl:grid-cols-[1.05fr_1fr_1fr]">
        <section className="rounded-2xl border border-app-line bg-app-panel p-5 shadow-[0_4px_18px_rgba(24,40,28,0.035)]">
          <div className="flex items-start justify-between gap-3"><div><h3 className="font-heading text-sm font-semibold text-app-ink">Portfolio triage</h3><p className="mt-1 text-[11px] text-app-muted">Full portfolio tier mix</p></div><span className="rounded-full bg-app-panel-soft px-2.5 py-1 text-[10px] font-medium text-app-muted">{triageTotal.toLocaleString('en-IN')} claims</span></div>
          <div className="mt-6 flex h-2.5 w-full overflow-hidden rounded-full bg-app-track" role="img" aria-label={`Portfolio triage distribution across ${triageTotal} claims`}>
            {tiers.map((tier) => <div key={tier.label} title={`${tier.label}: ${tier.count.toLocaleString('en-IN')}`} style={{ width: triageTotal ? `${tier.count / triageTotal * 100}%` : '0%', backgroundColor: tier.color }} />)}
          </div>
          <div className="mt-6 space-y-4">{tiers.map((tier) => <div key={tier.label}>
            <div className="mb-1.5 flex items-center justify-between text-xs"><span className="flex items-center gap-2 text-app-muted"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: tier.color }} />{tier.label}</span><span className="font-mono text-app-ink"><b className="font-semibold">{tier.count.toLocaleString('en-IN')}</b><span className="ml-2 text-[10px] text-app-subtle">{triageTotal ? `${(tier.count / triageTotal * 100).toFixed(1)}%` : '0.0%'}</span></span></div>
            <div className="h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: tier.track }}><div className="h-full rounded-full transition-[width] duration-500" style={{ width: triageTotal ? `${tier.count / triageTotal * 100}%` : '0%', backgroundColor: tier.color }} /></div>
          </div>)}</div>
        </section>
        <BarList title="Claims by crop" caption="Top crops in the current selection" values={byCrop} icon={Sprout} />
        <BarList title="Claims by district" caption="Leading districts in the current selection" values={byDistrict} icon={MapPinned} />
      </div>
      <p className="flex items-start gap-2 rounded-xl border border-app-line bg-app-panel px-4 py-3 text-[11px] leading-relaxed text-app-muted"><ArrowDownRight size={14} className="mt-0.5 shrink-0 text-app-safe" />Portfolio records are illustrative and risk scores are precomputed. “Risk rule flags” counts claims where the supplied propositional premises derive Risk; a zero means no configured rule fired, not a proof of ¬Risk.</p>
    </div>
  </main>;
}
