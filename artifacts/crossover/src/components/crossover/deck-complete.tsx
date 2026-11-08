import { Link } from 'wouter';
import { Undo2, Sparkles, Users } from 'lucide-react';
import type { DeckSummary } from '@workspace/api-client-react';

export function DeckComplete({ summary, remaining, error, canUndo, onUndo, onNewDeck }: {
  summary: DeckSummary; remaining: number; error: string | null; canUndo: boolean; onUndo: () => void; onNewDeck: () => void;
}) {
  const n = summary.connections_made;
  return (
    <div className="rise mt-6 rounded-[28px] border border-card-border bg-card p-6 text-center" data-testid="status-deck-complete">
      <div className="grad-accent mx-auto grid h-14 w-14 place-items-center rounded-full text-[hsl(250_30%_8%)]"><Sparkles className="h-6 w-6" aria-hidden /></div>
      <h2 className="mt-4 text-2xl font-extrabold">Deck complete</h2>
      <dl className="mt-5 grid grid-cols-2 gap-2 text-left">
        <div className="rounded-2xl bg-secondary/60 p-3">
          <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Connections</dt>
          <dd className="mt-1 text-3xl font-black tabular-nums" data-testid="text-summary-connections">{n}</dd>
        </div>
        <div className="rounded-2xl bg-secondary/60 p-3">
          <dt className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Top shared interest</dt>
          <dd className="mt-1 break-words text-sm font-bold leading-snug" data-testid="text-summary-interest">
            {summary.top_shared_interest ?? <span className="font-medium text-muted-foreground">None among your connections</span>}
          </dd>
        </div>
      </dl>
      <p className="mt-3 text-sm text-muted-foreground">{n === 0 ? 'No connections this time. Undo the last card or try a different angle.' : 'Your drafts are waiting. Edit them before you reach out.'}</p>
      {error && <p role="alert" className="mt-3 rounded-2xl bg-[hsl(352_85%_62%/.14)] p-3 text-sm text-[hsl(352_90%_82%)]">{error}</p>}
      <div className="mt-5 grid gap-2">
        <button type="button" onClick={onNewDeck} disabled={remaining <= 0} data-testid="button-new-deck"
          className="grad-accent rounded-full py-3 text-sm font-bold text-[hsl(250_30%_8%)] transition-transform active:scale-[.98] disabled:opacity-50">
          {remaining > 0 ? `Build a new deck (${remaining} of 5 AI builds left)` : 'No AI builds left this hour'}
        </button>
        <div className="flex gap-2">
          <button type="button" onClick={onUndo} disabled={!canUndo} data-testid="button-undo" className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border py-2.5 text-sm font-semibold disabled:opacity-50"><Undo2 className="h-4 w-4" aria-hidden />Undo</button>
          <Link href="/connections" data-testid="link-summary-connections" className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-border py-2.5 text-sm font-semibold"><Users className="h-4 w-4" aria-hidden />Connections</Link>
        </div>
      </div>
    </div>
  );
}
