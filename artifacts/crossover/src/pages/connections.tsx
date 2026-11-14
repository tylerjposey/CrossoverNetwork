import { Link } from 'wouter';
import { Star, Heart, Users } from 'lucide-react';
import {
  useGetCrossoverState, getGetCrossoverStateQueryKey, useGetCrossoverConnections, getGetCrossoverConnectionsQueryKey,
} from '@workspace/api-client-react';
import { ErrorCard, Pill, Shell, usePageMeta } from '@/components/crossover/shell';
import { IcebreakerEditor } from '@/components/crossover/icebreaker-editor';
import { NextStepCard } from '@/components/crossover/next-step';
import { SimulatedReply } from '@/components/crossover/simulated-reply';
import { gradientFor, initials } from '@/lib/api-errors';

function Skeleton() {
  return <div className="space-y-3 pt-6" aria-busy="true" data-testid="skeleton-connections">
    {[0, 1, 2].map((i) => <div key={i} className="skel h-40 w-full rounded-[24px]" />)}
  </div>;
}

export default function Connections() {
  usePageMeta('Your connections - Crossover', 'Everyone you connected with this session, with editable icebreaker drafts.');
  const stateQ = useGetCrossoverState({ query: { queryKey: getGetCrossoverStateQueryKey(), retry: 1, staleTime: 15_000 } });
  const connQ = useGetCrossoverConnections({ query: {
    queryKey: getGetCrossoverConnectionsQueryKey(), enabled: !!stateQ.data,
    refetchOnWindowFocus: true, refetchInterval: 30_000,
  } });
  const list = connQ.data?.connections ?? [];
  const sorted = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const currentDeck = stateQ.data?.deck_id;

  let body;
  if (stateQ.isLoading || (stateQ.data && connQ.isLoading)) body = <Skeleton />;
  else if (!stateQ.data) body = <div className="pt-6"><ErrorCard message="We could not load your session." onRetry={() => stateQ.refetch()} retrying={stateQ.isFetching} /></div>;
  else if (!connQ.data) body = <div className="pt-6"><ErrorCard message="We could not load your connections." onRetry={() => connQ.refetch()} retrying={connQ.isFetching} /></div>;
  else if (sorted.length === 0) body = (
    <div className="rise mt-6 rounded-[28px] border border-dashed border-border p-8 text-center" data-testid="status-connections-empty">
      <div className="mx-auto flex w-max" aria-hidden>
        <span className="h-12 w-12 rounded-full bg-secondary ring-4 ring-background" />
        <span className="grad-accent -ml-3 h-12 w-12 rounded-full opacity-60 ring-4 ring-background" />
      </div>
      <h2 className="mt-4 text-xl font-extrabold">No connections yet</h2>
      <p className="mt-1 text-sm text-muted-foreground">Swipe right or Super Connect on someone in your deck. They will land here with a draft icebreaker.</p>
      <Link href="/" data-testid="link-empty-home" className="grad-accent mt-5 inline-block rounded-full px-5 py-2.5 text-sm font-bold text-[hsl(250_30%_8%)]">Go to my deck</Link>
    </div>
  );
  else body = (
    <ul className="mt-4 space-y-3">
      {sorted.map((c, i) => (
        <li key={c.id} className="rise rounded-[24px] border border-card-border bg-card p-4" style={{ animationDelay: `${Math.min(i, 6) * 50}ms` }} data-testid={`card-connection-${c.id}`}>
          <div className="flex items-start gap-3">
            <div aria-hidden className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl font-extrabold text-[hsl(250_30%_8%)]" style={{ background: gradientFor(c.profile.id) }}>{initials(c.profile.first_name)}</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <h2 className="font-bold" data-testid={`text-connection-name-${c.id}`}>{c.profile.first_name}</h2>
                <Pill tone="sample">Sample profile</Pill>
                {c.direction === 'super'
                  ? <Pill tone="warn"><Star className="h-3 w-3" fill="currentColor" aria-hidden />Super</Pill>
                  : <Pill tone="ok"><Heart className="h-3 w-3" fill="currentColor" aria-hidden />Connect</Pill>}
                {c.deck_id !== currentDeck && <Pill>Earlier deck</Pill>}
              </div>
              <p className="truncate text-xs text-muted-foreground">{c.profile.major}, {c.profile.school}</p>
            </div>
            <span className="text-sm font-black tabular-nums" data-testid={`text-connection-score-${c.id}`}>{c.match_score}</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{c.why_connect}</p>
          <NextStepCard step={c.next_step} testId={`text-next-step-${c.id}`} />
          <IcebreakerEditor connection={c} remaining={connQ.data!.remaining_builds} />
          <SimulatedReply connection={c} remaining={connQ.data!.remaining_builds} />
        </li>
      ))}
    </ul>
  );

  return <Shell>
    <div className="rise pt-4">
      <h1 className="flex items-center gap-2 text-2xl font-extrabold"><Users className="h-5 w-5" aria-hidden />Connections</h1>
      <p className="mt-1 text-sm text-muted-foreground" data-testid="text-connections-count">
        {connQ.data ? `${list.length} saved this session, across every deck.` : 'Everyone you connected with this session.'}
      </p>
    </div>
    {body}
  </Shell>;
}
