import { useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, CircleAlert, FileUp, LoaderCircle, UploadCloud } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

type DatasetMetrics = {
  model: string;
  evaluation_scope: string;
  split_counts: { train: number; validation: number; test: number };
  selected_epoch: number;
  test: { claims: number; f1: number; auc: number; precision: number; recall: number };
  baseline?: { model: string; f1: number; auc: number; precision: number; recall: number };
};

type AnalyzeResult = {
  dataset_id: string;
  dataset_name: string;
  claims_count: number;
  message: string;
  metrics: DatasetMetrics;
};

type DatasetFiles = {
  claims_file: File | null;
  farmers_file: File | null;
  assessors_file: File | null;
  weather_zones_file: File | null;
};

const FILE_FIELDS: { key: keyof DatasetFiles; title: string; hint: string }[] = [
  { key: 'claims_file', title: 'Claims', hint: 'Claim records and synthetic is_fraud labels' },
  { key: 'farmers_file', title: 'Farmers', hint: 'Producer IDs, names, district, and land area' },
  { key: 'assessors_file', title: 'Assessors', hint: 'Assessor IDs, names, and years of service' },
  { key: 'weather_zones_file', title: 'Weather zones', hint: 'Zone IDs, event type, and severity index' },
];

export function DatasetImportPanel({ onOpenDashboard }: { onOpenDashboard: () => void }) {
  const [files, setFiles] = useState<DatasetFiles>({
    claims_file: null, farmers_file: null, assessors_file: null, weather_zones_file: null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [dragging, setDragging] = useState<keyof DatasetFiles | null>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  const assignFile = (key: keyof DatasetFiles, file?: File) => {
    setError('');
    setResult(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError(`${file.name} is not a CSV file.`);
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setError(`${file.name} is larger than the 25 MB per-file limit.`);
      return;
    }
    setFiles((current) => ({ ...current, [key]: file }));
  };

  const analyze = async () => {
    if (FILE_FIELDS.some(({ key }) => !files[key])) return;
    setBusy(true);
    setError('');
    setResult(null);
    const form = new FormData();
    for (const { key } of FILE_FIELDS) form.append(key, files[key] as File);
    try {
      const response = await fetch(`${API_BASE_URL}/datasets/analyze`, { method: 'POST', body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail || `Analysis failed (${response.status})`);
      setResult(body as AnalyzeResult);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not analyze the uploaded dataset.');
    } finally {
      setBusy(false);
    }
  };

  const allSelected = FILE_FIELDS.every(({ key }) => files[key]);

  return (
    <main className="flex-1 overflow-y-auto bg-app-canvas px-6 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-app-primary-soft p-3 text-app-primary"><FileUp size={22} /></div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-app-primary">Portfolio data</p>
            <h2 className="mt-1 font-heading text-2xl font-semibold text-app-ink">Import and analyze a dataset</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-app-muted">
              Upload the four related CSV files. AgriGuard validates their IDs and columns, trains and evaluates GraphSAGE,
              derives inference traces, then loads the analyzed claims into the workspace.
            </p>
          </div>
        </div>

        <section className="rounded-2xl border border-app-line bg-app-panel p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-heading text-sm font-semibold text-app-ink">Dataset files</h3>
              <p className="mt-1 text-xs text-app-muted">CSV only, up to 25 MB each. Claim labels are used for synthetic model training and evaluation.</p>
            </div>
            <UploadCloud className="text-app-muted" size={18} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {FILE_FIELDS.map(({ key, title, hint }) => (
              <div
                key={key}
                onDragOver={(event) => { event.preventDefault(); setDragging(key); }}
                onDragLeave={() => setDragging(null)}
                onDrop={(event) => { event.preventDefault(); setDragging(null); assignFile(key, event.dataTransfer.files[0]); }}
                className={`rounded-xl border p-4 transition-colors ${dragging === key ? 'border-app-primary bg-app-primary-soft/50' : 'border-app-line bg-app-panel-soft'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <label className="text-xs font-semibold text-app-ink">{title}</label>
                    <p className="mt-1 text-[11px] leading-4 text-app-muted">{hint}</p>
                  </div>
                  {files[key] && <CheckCircle2 size={16} className="shrink-0 text-app-safe" />}
                </div>
                <input
                  ref={(element) => { inputs.current[key] = element; }}
                  type="file"
                  accept=".csv,text/csv"
                  className="mt-3 block w-full text-[11px] text-app-muted file:mr-3 file:rounded-lg file:border-0 file:bg-app-panel file:px-3 file:py-1.5 file:text-[11px] file:font-medium file:text-app-ink hover:file:bg-app-primary-soft"
                  onChange={(event) => assignFile(key, event.target.files?.[0])}
                />
                {files[key] && <p className="mt-2 truncate text-[10px] text-app-primary">{files[key]?.name}</p>}
              </div>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-app-line pt-4">
            <p className="text-[11px] text-app-muted">Required claim columns: claim_id, farmer_id, assessor_id, zone_id, crop_type, claimed_damage_pct, claimed_payout_amount, is_fraud.</p>
            <button
              type="button"
              onClick={analyze}
              disabled={!allSelected || busy}
              className="inline-flex items-center gap-2 rounded-xl bg-app-primary-fill px-4 py-2.5 text-xs font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
            >
              {busy ? <LoaderCircle size={14} className="animate-spin" /> : <FileUp size={14} />}
              {busy ? 'Training and analyzing…' : 'Analyze portfolio'}
            </button>
          </div>
          {busy && <p className="mt-3 text-[11px] text-app-muted">This can take a few minutes. The current dashboard stays active until analysis finishes successfully.</p>}
        </section>

        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-app-investigate/30 bg-app-investigate-soft p-4 text-xs text-app-investigate">
            <CircleAlert size={16} className="mt-0.5 shrink-0" /><span>{error}</span>
          </div>
        )}

        {result && (
          <section className="rounded-2xl border border-app-safe/30 bg-app-panel p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <CheckCircle2 size={19} className="mt-0.5 text-app-safe" />
                <div>
                  <h3 className="font-heading text-sm font-semibold text-app-ink">Analysis complete</h3>
                  <p className="mt-1 text-xs text-app-muted">{result.claims_count.toLocaleString()} claims are now loaded into the dashboard.</p>
                </div>
              </div>
              <button onClick={onOpenDashboard} className="inline-flex items-center gap-2 rounded-lg bg-app-primary-fill px-3 py-2 text-xs font-semibold text-white">
                Open dashboard <ArrowRight size={13} />
              </button>
            </div>
            {result.metrics && (
              <div className="mt-5 grid gap-3 border-t border-app-line pt-4 sm:grid-cols-2 lg:grid-cols-5">
                <Metric label="Model" value={result.metrics.model} />
                <Metric label="GraphSAGE test F1" value={result.metrics.test.f1.toFixed(3)} />
                <Metric label="GraphSAGE test AUC" value={result.metrics.test.auc.toFixed(3)} />
                {result.metrics.baseline && <Metric label="Tabular baseline F1" value={result.metrics.baseline.f1.toFixed(3)} />}
                <Metric label="Test claims" value={result.metrics.test.claims.toLocaleString()} />
              </div>
            )}
            <p className="mt-4 text-[10px] text-app-muted">Metrics measure performance against the uploaded synthetic labels. Portfolio scores and proof traces were generated by this analysis run.</p>
          </section>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-app-panel-soft p-3"><p className="text-[10px] uppercase tracking-wider text-app-muted">{label}</p><p className="mt-1 text-sm font-semibold text-app-ink">{value}</p></div>;
}
