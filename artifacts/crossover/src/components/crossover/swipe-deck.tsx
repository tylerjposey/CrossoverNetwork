import { useEffect, useMemo, useRef, useState } from 'react';
import { animate, motion, useMotionValue, useReducedMotion, useTransform, type PanInfo } from 'framer-motion';
import { X, Star, Heart, Undo2, Compass, UserRound, PenLine } from 'lucide-react';
import type { SampleProfile, VisitorState } from '@workspace/api-client-react';
import { MatchCard } from '@/components/crossover/match-card';
import { DeckComplete } from '@/components/crossover/deck-complete';

type Dir = 'left' | 'right' | 'super';

export function SwipeDeck({
  state, profiles, onSwipe, onUndo, pending, error, onEditProfile, onEditInput,
}: {
  state: VisitorState; profiles: SampleProfile[]; onSwipe: (id: number, d: Dir) => Promise<boolean>;
  onUndo: () => void; pending: boolean; error: string | null; onEditProfile: () => void; onEditInput: () => void;
}) {
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-220, 220], [-14, 14]);
  const connectOp = useTransform(x, [30, 110], [0, 1]);
  const passOp = useTransform(x, [-110, -30], [1, 0]);
  const superOp = useTransform(y, [-110, -30], [1, 0]);
  const [busy, setBusy] = useState(false);

  const swiped = useMemo(() => new Set(state.swipes.map((s) => s.profile_id)), [state.swipes]);
  const order = state.deck_order;
  const currentId = order.find((id) => !swiped.has(id));
  const position = order.findIndex((id) => id === currentId);
  const byId = useMemo(() => new Map(profiles.map((p) => [p.id, p])), [profiles]);
  const current = currentId != null ? byId.get(currentId) : undefined;
  const nextP = position >= 0 && order[position + 1] != null ? byId.get(order[position + 1]) : undefined;
  const match = state.deck?.matches.find((m) => m.profile_id === currentId);
  const tip = state.deck?.career_tip ?? null;
  const wildcard = !!tip && tip.profile_id === currentId;
  const shared = useMemo(
    () => new Set((state.visitor_profile?.interests ?? []).map((t) => t.toLowerCase())),
    [state.visitor_profile],
  );
  const reviewed = state.swipes.length;
  const total = order.length;
  const locked = busy || pending;

  useEffect(() => { x.set(0); y.set(0); }, [currentId, x, y]);

  const commit = async (d: Dir) => {
    if (currentId == null || locked) return;
    if (d === 'super' && state.super_connects_left <= 0) return;
    setBusy(true);
    const tx = d === 'left' ? -520 : d === 'right' ? 520 : 0;
    const ty = d === 'super' ? -620 : 0;
    const out = reduce ? { duration: 0 } : { duration: 0.28, ease: [0.4, 0, 0.2, 1] as const };
    animate(x, tx, out);
    await animate(y, ty, out);
    const ok = await onSwipe(currentId, d);
    if (!ok) {
      const spring = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 420, damping: 28 };
      animate(x, 0, spring); animate(y, 0, spring);
    }
    setBusy(false);
  };
  const commitRef = useRef(commit);
  commitRef.current = commit;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.closest('input,textarea,select,[contenteditable="true"],[role="dialog"]') || t.isContentEditable)) return;
      if (document.querySelector('[role="dialog"]')) return;
      const map: Record<string, Dir> = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'super' };
      const d = map[e.key];
      if (!d) return;
      e.preventDefault();
      void commitRef.current(d);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const dx = info.offset.x, v = info.velocity.x;
    if (dx > 110 || v > 700) void commit('right');
    else if (dx < -110 || v < -700) void commit('left');
    else {
      const spring = reduce ? { duration: 0 } : { type: 'spring' as const, stiffness: 500, damping: 26 };
      animate(x, 0, spring); animate(y, 0, spring);
    }
  };

  const last = state.swipes[state.swipes.length - 1];

  return (
    <section className="rise pt-4" aria-label="Your deck">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold" data-testid="text-progress">{Math.min(reviewed + (current ? 1 : 0), total)} of {total}</p>
        <div className="flex gap-1">
          <button type="button" onClick={onEditProfile} data-testid="button-open-profile" className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"><UserRound className="h-3.5 w-3.5" aria-hidden />My card</button>
          <button type="button" onClick={onEditInput} data-testid="button-open-input" className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"><PenLine className="h-3.5 w-3.5" aria-hidden />Edit input</button>
        </div>
      </div>
      <div className="mt-2 flex gap-1" aria-hidden>
        {order.map((id, i) => <span key={id} className={`h-1 flex-1 rounded-full transition-colors ${i < reviewed ? 'grad-accent' : i === reviewed ? 'bg-foreground/60' : 'bg-muted'}`} />)}
      </div>

      {current ? (
        <>
          {wildcard && tip && (
            <div className="rise mt-4 flex gap-2.5 rounded-2xl bg-[hsl(45_95%_60%/.1)] p-3 ring-1 ring-[hsl(45_95%_60%/.35)]" data-testid="text-career-tip">
              <Compass className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(45_95%_70%)]" aria-hidden />
              <p className="text-sm leading-snug"><span className="font-bold text-[hsl(45_95%_76%)]">Wildcard: {tip.field}.</span> <span className="text-muted-foreground">{tip.reason}</span></p>
            </div>
          )}
          <div className="relative mt-4 h-[480px]">
            {nextP && (
              <div className="pointer-events-none absolute inset-0 origin-top scale-[.95] translate-y-3 opacity-50" aria-hidden>
                <MatchCard profile={nextP} wildcard={false} shared={new Set()} />
              </div>
            )}
            <motion.div
              key={current.id}
              className="absolute inset-0 cursor-grab touch-pan-y active:cursor-grabbing"
              style={{ x, y, rotate }}
              drag={locked ? false : 'x'}
              dragSnapToOrigin={false}
              dragElastic={0.9}
              onDragEnd={onDragEnd}
              initial={reduce ? false : { scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.25 }}
            >
              <MatchCard profile={current} match={match} wildcard={wildcard} shared={shared} />
              <motion.span style={{ opacity: connectOp }} className="pointer-events-none absolute left-5 top-8 -rotate-12 rounded-xl border-[3px] border-[hsl(160_85%_60%)] px-3 py-1 text-2xl font-black tracking-widest text-[hsl(160_85%_66%)]" aria-hidden>CONNECT</motion.span>
              <motion.span style={{ opacity: passOp }} className="pointer-events-none absolute right-5 top-8 rotate-12 rounded-xl border-[3px] border-[hsl(352_85%_66%)] px-3 py-1 text-2xl font-black tracking-widest text-[hsl(352_90%_72%)]" aria-hidden>PASS</motion.span>
              <motion.span style={{ opacity: superOp }} className="pointer-events-none absolute inset-x-0 bottom-16 mx-auto w-max rounded-xl border-[3px] border-[hsl(45_95%_62%)] px-3 py-1 text-2xl font-black tracking-widest text-[hsl(45_95%_70%)]" aria-hidden>SUPER</motion.span>
            </motion.div>
          </div>

          {error && <p role="alert" className="mt-3 rounded-2xl bg-[hsl(352_85%_62%/.14)] p-3 text-sm text-[hsl(352_90%_82%)]" data-testid="text-swipe-error">{error}</p>}

          <div className="mt-5 flex items-center justify-center gap-4">
            <button type="button" aria-label="Pass" title="Pass (Left arrow)" disabled={locked} onClick={() => void commit('left')} data-testid="button-pass" className="grid h-14 w-14 place-items-center rounded-full border border-border bg-card text-[hsl(352_90%_74%)] transition-transform hover:scale-105 active:scale-90 disabled:opacity-50"><X className="h-6 w-6" aria-hidden /></button>
            <button type="button" aria-label={`Super Connect, ${state.super_connects_left} left`} title="Super Connect (Up arrow)" disabled={locked || state.super_connects_left <= 0} onClick={() => void commit('super')} data-testid="button-super" className="relative grid h-12 w-12 place-items-center rounded-full border border-[hsl(45_95%_60%/.5)] bg-card text-[hsl(45_95%_70%)] transition-transform hover:scale-105 active:scale-90 disabled:opacity-40">
              <Star className="h-5 w-5" fill="currentColor" aria-hidden />
              <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-[hsl(45_95%_60%)] px-1 text-[10px] font-black text-[hsl(250_30%_8%)]" data-testid="text-super-left">{state.super_connects_left}</span>
            </button>
            <button type="button" aria-label="Connect" title="Connect (Right arrow)" disabled={locked} onClick={() => void commit('right')} data-testid="button-connect" className="grad-accent grid h-14 w-14 place-items-center rounded-full text-[hsl(250_30%_8%)] transition-transform hover:scale-105 active:scale-90 disabled:opacity-50"><Heart className="h-6 w-6" fill="currentColor" aria-hidden /></button>
          </div>
          <div className="mt-3 flex items-center justify-center gap-3 text-xs text-muted-foreground">
            <button type="button" onClick={onUndo} disabled={!last || locked} data-testid="button-undo" className="inline-flex items-center gap-1 rounded-full px-2 py-1 font-semibold hover:text-foreground disabled:opacity-40"><Undo2 className="h-3.5 w-3.5" aria-hidden />Undo</button>
            <span className="hidden sm:inline">Arrow keys: left pass, right connect, up super</span>
          </div>
        </>
      ) : (
        <DeckComplete summary={state.deck_summary} remaining={state.remaining_builds} error={error}
          canUndo={!!last && !locked} onUndo={onUndo} onNewDeck={onEditInput} />
      )}
    </section>
  );
}
