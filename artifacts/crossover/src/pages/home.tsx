import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetCrossoverState, getGetCrossoverStateQueryKey, useGetCrossoverProfiles, getGetCrossoverProfilesQueryKey,
  getGetCrossoverHistoryQueryKey, useBuildCrossoverDeck, useUpdateCrossoverProfile, useConfirmCrossoverProfile,
  useCreateCrossoverSwipe, useUndoCrossoverSwipe, useGetCrossoverConnections, getGetCrossoverConnectionsQueryKey,
  type Connection, type ConnectionList, type VisitorProfile, type VisitorState,
} from '@workspace/api-client-react';
import { ErrorCard, Shell, usePageMeta } from '@/components/crossover/shell';
import { Onboarding } from '@/components/crossover/onboarding';
import { BuildLoading } from '@/components/crossover/build-loading';
import { ProfileReview } from '@/components/crossover/profile-review';
import { SwipeDeck } from '@/components/crossover/swipe-deck';
import { apiErrorText, isConflict } from '@/lib/api-errors';
import { Celebration } from '@/components/crossover/celebration';
import { useToast } from '@/hooks/use-toast';

type Mode = 'auto' | 'input' | 'profile';

function PageSkeleton() {
  return (
    <div className="space-y-4 pt-6" aria-busy="true" data-testid="skeleton-home">
      <div className="skel h-6 w-40 rounded-full" />
      <div className="skel h-10 w-4/5 rounded-xl" />
      <div className="skel h-64 w-full rounded-[24px]" />
    </div>
  );
}

export default function Home() {
  usePageMeta(
    'Crossover - Connect and advance your career',
    'Meet students and young professionals who share your goals and interests. Build a deck, swipe, and start a conversation.',
  );
  const qc = useQueryClient();
  const key = getGetCrossoverStateQueryKey();
  const stateQ = useGetCrossoverState({ query: {
    queryKey: key, retry: 1, staleTime: 15_000, refetchInterval: 30_000, refetchOnWindowFocus: true,
  } });
  const state = stateQ.data;
  const profilesQ = useGetCrossoverProfiles({ query: { enabled: !!state, queryKey: getGetCrossoverProfilesQueryKey() } });

  const connKey = getGetCrossoverConnectionsQueryKey();
  const connQ = useGetCrossoverConnections({ query: { queryKey: connKey, enabled: !!state } });
  const { toast } = useToast();
  const [celebrate, setCelebrate] = useState<Connection | null>(null);
  const announcement = useRef(0);
  useEffect(() => () => { announcement.current++; }, []);

  const build = useBuildCrossoverDeck({ mutation: { retry: false } });
  const update = useUpdateCrossoverProfile();
  const confirm = useConfirmCrossoverProfile();
  const swipe = useCreateCrossoverSwipe();
  const undo = useUndoCrossoverSwipe();

  const [mode, setMode] = useState<Mode>('auto');
  const [text, setText] = useState('');
  const [buildErr, setBuildErr] = useState<string | null>(null);
  const [profileErr, setProfileErr] = useState<string | null>(null);
  const [deckErr, setDeckErr] = useState<string | null>(null);
  const seeded = useRef(false);

  useEffect(() => {
    if (state && !seeded.current) { seeded.current = true; setText(state.input_text ?? ''); }
  }, [state]);

  const put = (s: VisitorState) => qc.setQueryData(key, s);
  const handle = (e: unknown, set: (m: string) => void) => {
    set(apiErrorText(e));
    if (isConflict(e)) void qc.invalidateQueries({ queryKey: key });
  };

  const onBuild = async () => {
    setBuildErr(null);
    try {
      await build.mutateAsync({ data: { input_text: text } });
      void qc.invalidateQueries({ queryKey: getGetCrossoverHistoryQueryKey() });
      await qc.invalidateQueries({ queryKey: key });
      setMode('auto');
    } catch (e) {
      setBuildErr(apiErrorText(e, 'Our AI matchmaker is taking a break. Your info is saved, so try again in a few minutes.'));
      void qc.invalidateQueries({ queryKey: key });
    }
  };

  const onSave = async (profile: VisitorProfile) => {
    if (!state?.deck_id) return false;
    setProfileErr(null);
    try { put(await update.mutateAsync({ data: { deck_id: state.deck_id, profile } })); return true; }
    catch (e) { handle(e, setProfileErr); return false; }
  };
  const onConfirm = async () => {
    if (!state?.deck_id) return;
    setProfileErr(null);
    try { put(await confirm.mutateAsync({ data: { deck_id: state.deck_id } })); setMode('auto'); }
    catch (e) { handle(e, setProfileErr); }
  };
  const onSwipe = async (profile_id: number, direction: 'left' | 'right' | 'super') => {
    if (!state?.deck_id) return false;
    const token = ++announcement.current;
    const alreadySaved = state.swipes.some((s) => s.profile_id === profile_id);
    setDeckErr(null);
    let next: VisitorState;
    try { next = await swipe.mutateAsync({ data: { deck_id: state.deck_id, profile_id, direction } }); put(next); }
    catch (e) { handle(e, setDeckErr); return false; }
    if (direction !== 'left' && !alreadySaved) await announce(next, profile_id, direction, token);
    return true;
  };
  const announce = async (next: VisitorState, profile_id: number, direction: 'right' | 'super', token: number) => {
    const sw = [...next.swipes].reverse().find((x) => x.profile_id === profile_id && x.direction === direction);
    await qc.invalidateQueries({ queryKey: connKey });
    if (announcement.current !== token) return;
    const list = qc.getQueryData<ConnectionList>(connKey);
    let conn = list?.connections.find((c) => (sw ? c.id === sw.id : c.profile.id === profile_id && c.deck_id === next.deck_id));
    const m = next.deck?.matches.find((x) => x.profile_id === profile_id);
    const p = profilesQ.data?.find((x) => x.id === profile_id);
    if (!conn && sw && m && p && next.deck_id) {
      conn = { id: sw.id, deck_id: next.deck_id, profile: p, visitor_profile: next.visitor_profile, match_score: m.match_score,
        why_connect: m.why_connect, icebreaker: m.icebreaker, direction, created_at: sw.created_at };
    }
    const score = conn?.match_score ?? m?.match_score ?? 0;
    if (conn && (direction === 'super' || score >= 75)) setCelebrate(conn);
    else toast({ title: `Connected with ${p?.first_name ?? 'them'}`, description: 'Saved to Connections with a draft icebreaker.' });
  };
  const onUndo = async () => {
    announcement.current++;
    const last = state?.swipes[state.swipes.length - 1];
    if (!state?.deck_id || !last) return;
    setDeckErr(null);
    try {
      put(await undo.mutateAsync({ data: { deck_id: state.deck_id, swipe_id: last.id } }));
      qc.setQueryData<ConnectionList>(connKey, (o) => (o ? { ...o, connections: o.connections.filter((c) => c.id !== last.id) } : o));
      if (celebrate?.id === last.id) setCelebrate(null);
      void qc.invalidateQueries({ queryKey: connKey });
    }
    catch (e) { handle(e, setDeckErr); }
  };

  let body;
  if (build.isPending) body = <BuildLoading />;
  else if (stateQ.isLoading) body = <PageSkeleton />;
  else if (!state) body = <div className="pt-6"><ErrorCard message="We could not load your session." onRetry={() => stateQ.refetch()} retrying={stateQ.isFetching} /></div>;
  else {
    const deck = state.deck;
    const usable = !!state.deck_id && !!deck && !deck.insufficient_input && !!state.visitor_profile;
    const notice = deck?.insufficient_input ? deck.reason ?? 'We need a bit more to go on. Add your goals and interests.' : null;
    if (!usable || mode === 'input') {
      body = (
        <Onboarding text={text} setText={setText} remaining={state.remaining_builds} onBuild={onBuild} building={build.isPending}
          error={buildErr} notice={mode === 'input' ? null : notice} hasDeck={usable} onBackToDeck={() => setMode('auto')} />
      );
    } else if (!state.profile_confirmed || mode === 'profile') {
      body = (
        <ProfileReview key={state.deck_id} profile={state.visitor_profile!} confirmed={state.profile_confirmed}
          onSave={onSave} onContinue={onConfirm} onBackToDeck={() => setMode('auto')} onEditInput={() => setMode('input')}
          saving={update.isPending} confirming={confirm.isPending} error={profileErr} />
      );
    } else if (profilesQ.isLoading) body = <PageSkeleton />;
    else if (profilesQ.isError || !profilesQ.data) body = <div className="pt-6"><ErrorCard message="We could not load your deck's people." onRetry={() => profilesQ.refetch()} retrying={profilesQ.isFetching} /></div>;
    else {
      body = (
        <SwipeDeck state={state} profiles={profilesQ.data} onSwipe={onSwipe} onUndo={onUndo}
          pending={swipe.isPending || undo.isPending} error={deckErr}
          onEditProfile={() => { setProfileErr(null); setMode('profile'); }} onEditInput={() => setMode('input')} />
      );
    }
  }

  return <Shell>
    {state?.deck_id && mode !== 'input' && !build.isPending && (
      <p className="mt-3 w-fit rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground">
        AI builds left this hour: {state.remaining_builds} of 5
      </p>
    )}
    {body}
    {celebrate && <Celebration connection={celebrate} remaining={state?.remaining_builds ?? null} onClose={() => setCelebrate(null)} />}
  </Shell>;
}
