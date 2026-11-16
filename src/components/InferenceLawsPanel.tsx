import { useEffect, useState } from 'react';
import { BookOpenCheck, CircleAlert, LoaderCircle } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

type InferenceLaw = { name: string; premises: string[]; conclusion: string };

export function InferenceLawsPanel() {
  const [laws, setLaws] = useState<InferenceLaw[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    fetch(`${API_BASE_URL}/logic/laws`)
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.detail || 'Could not load inference laws.');
        return body as { laws: InferenceLaw[] };
      })
      .then((body) => { if (current) setLaws(body.laws); })
      .catch((cause) => { if (current) setError(cause instanceof Error ? cause.message : 'Could not load inference laws.'); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, []);

  return (
    <main className="flex-1 overflow-y-auto bg-app-canvas px-6 py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex items-start gap-4">
          <div className="rounded-2xl bg-app-primary-soft p-3 text-app-primary"><BookOpenCheck size={22} /></div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-app-primary">Discrete mathematics</p>
            <h2 className="mt-1 font-heading text-2xl font-semibold text-app-ink">Laws of inference</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-app-muted">Each form is shown with its premises and conclusion. A claim’s proof trace includes only deductions whose premises hold for that claim.</p>
          </div>
        </div>

        {loading && <div className="flex items-center gap-2 rounded-xl border border-app-line bg-app-panel p-4 text-xs text-app-muted"><LoaderCircle size={15} className="animate-spin" />Loading rule reference…</div>}
        {error && <div role="alert" className="flex items-center gap-2 rounded-xl border border-app-investigate/30 bg-app-investigate-soft p-4 text-xs text-app-investigate"><CircleAlert size={15} />{error}</div>}
        {!loading && !error && (
          <div className="grid gap-3 md:grid-cols-2">
            {laws.map((law, index) => (
              <article key={law.name} className="rounded-2xl border border-app-line bg-app-panel p-4 shadow-sm">
                <div className="flex items-center gap-2"><span className="font-mono text-[10px] text-app-primary">{String(index + 1).padStart(2, '0')}</span><h3 className="font-heading text-sm font-semibold text-app-ink">{law.name}</h3></div>
                <div className="mt-3 space-y-1 text-xs text-app-muted">
                  {law.premises.map((premise) => <p key={premise} className="font-mono">{premise}</p>)}
                </div>
                <p className="mt-3 border-t border-app-line pt-3 text-xs font-semibold text-app-ink"><span className="mr-2 text-app-primary">∴</span><span className="font-mono">{law.conclusion}</span></p>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
