import { useEffect, useRef, useState } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { useGetCrossoverHistory, getGetCrossoverHistoryQueryKey, type HistoryRecord } from '@workspace/api-client-react';
import { ErrorCard, Pill, Shell, usePageMeta } from '@/components/crossover/shell';

const POLL_MS = 15000;
const MAX_POLLS = 20;

const STATUS: Record<HistoryRecord['status'], { label: string; tone: 'ok' | 'warn' | 'bad' }> = {
  success: { label: 'Success', tone: 'ok' },
  error: { label: 'Error', tone: 'bad' },
  rate_limited: { label: 'Rate limited', tone: 'warn' },
  invalid_input: { label: 'Invalid input', tone: 'warn' },
};

function prettyJson(s: string) {
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

function RecordCard({ r, i }: { r: HistoryRecord; i: number }) {
  const [open, setOpen] = useState(false);
  const d = new Date(r.created_at);
  const valid = !isNaN(d.getTime());
  const st = STATUS[r.status] ?? { label: r.status, tone: 'warn' as const };
  const matches = r.top_matches.slice(0, 3);
  const panelId = `record-detail-${r.id}`;

  return (
    <article data-testid={`card-history-${r.id}`} className="rise rounded-[24px] border border-card-border bg-card p-5" style={{ animationDelay: `${Math.min(i, 8) * 50}ms` }}>
      <div className="flex flex-wrap items-center gap-1.5">
        <Pill tone={st.tone} testId={`status-history-${r.id}`}>{st.label}</Pill>
        {r.is_sample && <Pill tone="sample" testId={`badge-sample-record-${r.id}`}>Sample record</Pill>}
        {r.is_yours && <Pill tone="yours" testId={`badge-your-run-${r.id}`}>Your run</Pill>}
        <time dateTime={r.created_at} title={valid ? format(d, 'PPpp') : r.created_at} className="ml-auto text-xs text-muted-foreground" data-testid={`text-time-${r.id}`}>
          {valid ? formatDistanceToNow(d, { addSuffix: true }) : r.created_at}
        </time>
      </div>

      <p className={`mt-3 text-[15px] leading-snug ${open ? '' : 'line-clamp-2'}`} data-testid={`text-input-${r.id}`}>
        {r.input_text || <span className="text-muted-foreground">No input text</span>}
      </p>

      {matches.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Top matches</p>
          <ol className="mt-2 flex flex-wrap gap-1.5">
            {matches.map((m, idx) => (
              <li key={`${m}-${idx}`} className="flex items-center gap-1.5 rounded-full bg-secondary py-1 pl-1 pr-3 text-sm font-medium" data-testid={`text-match-${r.id}-${idx}`}>
                <span className="grad-accent grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold text-[hsl(250_30%_8%)]">{idx + 1}</span>
                {m}
              </li>
            ))}
          </ol>
        </div>
      )}

      {r.career_tip && (
        <div className="mt-4 rounded-2xl border-l-2 border-[hsl(322_85%_62%)] bg-muted/60 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Career tip</p>
          <p className="mt-1 text-sm leading-relaxed" data-testid={`text-tip-${r.id}`}>{r.career_tip}</p>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={panelId}
        data-testid={`button-toggle-detail-${r.id}`}
        className="mt-4 inline-flex items-center gap-1.5 rounded-full px-1 text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} aria-hidden />
        {open ? 'Hide details' : 'Full input and redacted JSON'}
      </button>
      {open && (
        <div id={panelId} className="rise mt-3">
          <pre className="max-h-80 overflow-auto rounded-2xl bg-background p-4 font-mono text-xs leading-relaxed text-muted-foreground" data-testid={`text-json-${r.id}`}>
            {prettyJson(r.output_json)}
          </pre>
        </div>
      )}
    </article>
  );
}

function Stat({ label, value, id }: { label: string; value: number; id: string }) {
  return (
    <div className="rounded-2xl bg-secondary/70 px-3 py-3">
      <p className="text-2xl font-extrabold tabular-nums" data-testid={`stat-${id}`}>{value}</p>
      <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

export default function History() {
  usePageMeta(
    'Activity history - Crossover',
    'A public, redacted record of every Crossover run: inputs, top matches, career tips and status, newest first.',
  );
  const polls = useRef(0);
  const [polling, setPolling] = useState(true);
  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } = useGetCrossoverHistory({
    query: {
      queryKey: getGetCrossoverHistoryQueryKey(),
      refetchInterval: polling ? POLL_MS : false,
      refetchOnWindowFocus: true,
    },
  });

  useEffect(() => {
    if (!dataUpdatedAt) return;
    polls.current += 1;
    if (polls.current >= MAX_POLLS) setPolling(false);
  }, [dataUpdatedAt]);

  const refresh = () => {
    polls.current = 0;
    setPolling(true);
    refetch();
  };

  return (
    <Shell>
      <section className="rise pt-6">
        <h1 className="text-[34px] font-extrabold leading-tight tracking-tight">
          Everything that <span className="grad-text">happened here.</span>
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Public and redacted, newest first. Runs from this browser are marked as yours.</p>
      </section>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground" aria-live="polite" data-testid="text-poll-status">
          {polling ? 'Live: checking every 15s' : 'Auto-refresh paused'}
          {dataUpdatedAt ? ` · updated ${format(new Date(dataUpdatedAt), 'p')}` : ''}
        </p>
        <button
          type="button"
          onClick={refresh}
          disabled={isFetching}
          data-testid="button-refresh"
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-sm font-semibold transition-transform hover:bg-secondary active:scale-95 disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} aria-hidden />
          Refresh
        </button>
      </div>

      {data && (
        <div className="rise mt-4 grid grid-cols-2 gap-2">
          <Stat label="Runs" value={data.total} id="total" />
          <Stat label="Sample runs" value={data.sample_count} id="sample-count" />
          <Stat label="Sample people" value={data.profile_count} id="profile-count" />
          <Stat label="Schools" value={data.school_count} id="school-count" />
        </div>
      )}

      <div className="mt-5 space-y-4" aria-busy={isLoading}>
        {isLoading &&
          [0, 1, 2].map((i) => (
            <div key={i} className="rounded-[24px] border border-card-border bg-card p-5" data-testid={`skeleton-history-${i}`}>
              <div className="skel h-5 w-1/3 rounded-full" />
              <div className="skel mt-4 h-4 w-full rounded" /><div className="skel mt-2 h-4 w-3/4 rounded" />
              <div className="mt-4 flex gap-2"><div className="skel h-7 w-20 rounded-full" /><div className="skel h-7 w-24 rounded-full" /></div>
            </div>
          ))}
        {isError && !data && <ErrorCard message="We could not load the history." onRetry={refresh} retrying={isFetching} />}
        {isError && data && (
          <p role="status" className="text-xs text-[hsl(352_90%_78%)]">Latest refresh failed. Showing the last loaded history.</p>
        )}
        {data && data.records.length === 0 && (
          <div className="rounded-[24px] border border-dashed border-border p-8 text-center" data-testid="empty-history">
            <p className="font-semibold">Nothing here yet</p>
            <p className="mt-1 text-sm text-muted-foreground">When runs happen, they show up here within seconds.</p>
          </div>
        )}
        {data?.records.map((r, i) => <RecordCard key={r.id} r={r} i={i} />)}
      </div>
    </Shell>
  );
}
