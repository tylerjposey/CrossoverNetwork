import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MessageCircle, RefreshCw } from 'lucide-react';
import {
  useSimulateCrossoverReply, useGetCrossoverConnections, getGetCrossoverConnectionsQueryKey,
  getGetCrossoverStateQueryKey, getGetCrossoverHistoryQueryKey,
  type Connection, type ConnectionList, type VisitorState,
} from '@workspace/api-client-react';
import { apiErrorText, gradientFor, initials } from '@/lib/api-errors';
import { Pill } from '@/components/crossover/shell';

const BREAK = 'Our AI matchmaker is taking a break. Your info is saved, so try again in a few minutes.';

// Shows a persisted, clearly labeled SIMULATED reply from a fictional sample
// profile. Reads the live connection from the shared cache so edits made in the
// icebreaker editor (or a reply made elsewhere) are reflected immediately.
export function SimulatedReply({ connection, remaining }: { connection: Connection; remaining: number | null }) {
  const qc = useQueryClient();
  const key = getGetCrossoverConnectionsQueryKey();
  const listQ = useGetCrossoverConnections({ query: { queryKey: key, enabled: false } });
  const live = listQ.data?.connections.find((c) => c.id === connection.id) ?? connection;
  const ask = useSimulateCrossoverReply({ mutation: { retry: false } });
  const [fallback, setFallback] = useState<Connection['reply']>(null);
  const [err, setErr] = useState<string | null>(null);
  const reply = live.reply ?? fallback;
  const stale = !!reply && reply.replied_to.trim() !== live.icebreaker.trim();
  const name = live.profile.first_name;
  const noQuota = remaining === 0;

  const request = async (regenerate: boolean) => {
    setErr(null);
    try {
      const r = await ask.mutateAsync({ id: connection.id, data: regenerate ? { regenerate: true } : {} });
      setFallback(r.connection.reply);
      qc.setQueryData<ConnectionList>(key, (o) => (o ? {
        ...o, remaining_builds: r.remaining_builds,
        connections: o.connections.map((c) => (c.id === r.connection.id ? { ...c, reply: r.connection.reply } : c)),
      } : o));
      qc.setQueryData<VisitorState>(getGetCrossoverStateQueryKey(), (o) => (o ? { ...o, remaining_builds: r.remaining_builds } : o));
      if (!r.reused) void qc.invalidateQueries({ queryKey: getGetCrossoverHistoryQueryKey() });
    } catch (e) {
      setErr(apiErrorText(e, BREAK));
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: getGetCrossoverStateQueryKey() });
      void qc.invalidateQueries({ queryKey: getGetCrossoverHistoryQueryKey() });
    }
  };

  return (
    <section className="mt-4 border-t border-border pt-3" aria-label={`Simulated reply from ${name}`} data-testid={`section-reply-${connection.id}`}>
      <div aria-live="polite" className="sr-only">{ask.isPending ? `Writing a simulated reply from ${name}` : reply ? `Simulated reply from ${name} is ready` : ''}</div>
      {!reply && !ask.isPending && (
        <div>
          <button type="button" onClick={() => void request(false)} disabled={noQuota} data-testid={`button-see-reply-${connection.id}`}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-full border border-[hsl(195_85%_60%/.5)] px-3.5 py-2.5 text-sm font-bold text-[hsl(195_90%_78%)] transition-transform active:scale-[.98] disabled:opacity-40">
            <MessageCircle className="h-4 w-4" aria-hidden />See their reply
          </button>
          <p className="mt-1.5 text-center text-[11px] text-muted-foreground">
            {noQuota ? 'No AI calls left this hour, try again later.' : `A simulated reply to your saved draft. Uses 1 AI call${remaining != null ? ` (${remaining} left)` : ''}.`}
          </p>
        </div>
      )}
      {ask.isPending && (
        <div className="flex items-end gap-2" aria-busy="true" data-testid={`status-reply-loading-${connection.id}`}>
          <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-extrabold text-[hsl(250_30%_8%)]" style={{ background: gradientFor(live.profile.id) }}>{initials(name)}</span>
          <div className="rounded-2xl rounded-bl-md bg-secondary px-3 py-2 text-sm text-muted-foreground">
            <span className="motion-safe:animate-pulse">{name} is typing...</span>
          </div>
        </div>
      )}
      {reply && !ask.isPending && (
        <div data-testid={`reply-${connection.id}`}>
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill tone="sample" testId={`badge-simulated-reply-${connection.id}`}>Simulated reply</Pill>
            <span className="text-[11px] text-muted-foreground">AI-written from a fictional sample profile, not a real person.</span>
          </div>
          <p className="ml-auto mt-2 w-fit max-w-[85%] rounded-2xl rounded-br-md bg-[hsl(322_85%_62%/.16)] px-3 py-2 text-sm leading-snug line-clamp-3 break-words" data-testid={`text-replied-to-${connection.id}`}>
            <span className="sr-only">You wrote: </span>{reply.replied_to}
          </p>
          <div className="mt-2 flex items-end gap-2">
            <span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[10px] font-extrabold text-[hsl(250_30%_8%)]" style={{ background: gradientFor(live.profile.id) }}>{initials(name)}</span>
            <p className="max-w-[85%] rounded-2xl rounded-bl-md bg-secondary px-3 py-2 text-sm leading-snug break-words" data-testid={`text-reply-${connection.id}`}>
              <span className="sr-only">Simulated reply from {name}: </span>{reply.text}
            </p>
          </div>
          {stale && <p className="mt-2 text-[11px] text-[hsl(45_95%_72%)]" data-testid={`text-reply-stale-${connection.id}`}>You changed your draft since this reply.</p>}
          <button type="button" onClick={() => void request(true)} disabled={noQuota} data-testid={`button-regenerate-reply-${connection.id}`}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-bold transition-transform active:scale-95 disabled:opacity-40">
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />{stale ? 'Reply to my new draft' : 'Try another reply'}{remaining != null ? ` (${remaining} left)` : ''}
          </button>
        </div>
      )}
      {err && <p role="alert" className="mt-2 rounded-2xl bg-[hsl(352_85%_62%/.14)] p-2.5 text-xs text-[hsl(352_90%_82%)]" data-testid={`text-reply-error-${connection.id}`}>{err}</p>}
    </section>
  );
}
