import { useEffect, useRef } from 'react';
import { Link } from 'wouter';
import { ArrowLeft, Star } from 'lucide-react';
import { useReducedMotion } from 'framer-motion';
import type { Connection } from '@workspace/api-client-react';
import { gradientFor, initials } from '@/lib/api-errors';
import { IcebreakerEditor } from '@/components/crossover/icebreaker-editor';
import { Pill } from '@/components/crossover/shell';
import { NextStepCard } from '@/components/crossover/next-step';

const COLORS = ['hsl(12 95% 64%)', 'hsl(322 85% 62%)', 'hsl(160 85% 55%)', 'hsl(45 95% 60%)', 'hsl(265 85% 72%)'];
const BITS = Array.from({ length: 28 }, (_, i) => ({
  left: (i * 37) % 100, delay: (i % 7) * 0.12, dur: 2.2 + ((i * 13) % 10) / 10, c: COLORS[i % 5], r: (i * 47) % 360, w: i % 3 === 0 ? 10 : 6,
}));

export function Celebration({ connection, remaining, onClose }: { connection: Connection; remaining: number | null; onClose: () => void }) {
  const reduce = useReducedMotion();
  const btn = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    btn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current(); }
      if (e.key === 'Tab') {
        const items = Array.from(dialog.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],textarea:not(:disabled),[tabindex="0"]',
        ) ?? []);
        const first = items[0], last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener('keydown', onKey);
    const ov = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = ov;
      const fallback = document.querySelector<HTMLElement>('[data-testid="button-connect"],[data-testid="status-deck-complete"] button');
      (prev && document.contains(prev) ? prev : fallback)?.focus?.();
    };
  }, []);

  const p = connection.profile;
  const v = connection.visitor_profile;
  const isSuper = connection.direction === 'super';
  return (
    <div ref={dialog} role="dialog" aria-modal="true" aria-labelledby="celebrate-title" data-testid="dialog-connection"
      className="fixed inset-0 z-50 overflow-y-auto bg-[hsl(250_30%_6%/.94)] backdrop-blur-md">
      <div className="glow-bg" aria-hidden />
      {!reduce && (
        <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
          {BITS.map((b, i) => (
            <span key={i} className="confetti" style={{ left: `${b.left}%`, background: b.c, width: b.w, height: b.w * 1.6, animationDelay: `${b.delay}s`, animationDuration: `${b.dur}s`, rotate: `${b.r}deg` }} />
          ))}
        </div>
      )}
      <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col px-4">
        <div className="flex items-center py-3">
          <button type="button" onClick={onClose} aria-label="Back to deck" data-testid="button-celebration-back"
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-1.5 text-sm font-semibold text-muted-foreground hover:bg-secondary hover:text-foreground"><ArrowLeft className="h-4 w-4" aria-hidden />Back</button>
        </div>
        <div className="flex-1 pt-4 text-center">
          <div className="flex items-center justify-center" aria-hidden>
            <div className="pair-left grid h-20 w-20 place-items-center rounded-full text-2xl font-extrabold text-[hsl(250_30%_8%)] ring-4 ring-background" style={{ background: gradientFor(9999) }}>{initials(v?.first_name)}</div>
            <div className="pair-right -ml-4 grid h-20 w-20 place-items-center rounded-full text-2xl font-extrabold text-[hsl(250_30%_8%)] ring-4 ring-background" style={{ background: gradientFor(p.id) }}>{initials(p.first_name)}</div>
          </div>
          {isSuper && <p className="rise mt-4 inline-flex items-center gap-1 rounded-full bg-[hsl(45_95%_60%/.14)] px-3 py-1 text-xs font-bold uppercase tracking-wider text-[hsl(45_95%_72%)]"><Star className="h-3 w-3" fill="currentColor" aria-hidden />Super Connect</p>}
          <h2 id="celebrate-title" className="rise grad-text mt-3 text-4xl font-black tracking-tight" data-testid="text-celebration-title">It's a Connection!</h2>
          <div className="mt-2"><Pill tone="sample">Sample profile</Pill></div>
          <p className="rise mt-2 text-sm text-muted-foreground" data-testid="text-celebration-sub">
            You and <span className="font-semibold text-foreground">{p.first_name}</span> ({p.major}, {p.school}) - {connection.match_score} match
          </p>
          <p className="rise mx-auto mt-3 max-w-[34ch] text-sm leading-relaxed">{connection.why_connect}</p>
          <div className="rise mx-auto max-w-[36ch]"><NextStepCard step={connection.next_step} testId="text-celebration-next-step" /></div>
        </div>
        <div className="rise mt-5 rounded-[24px] border border-card-border bg-card p-4 text-left">
          <IcebreakerEditor connection={connection} remaining={remaining} />
        </div>
        <button ref={btn} type="button" onClick={onClose} data-testid="button-celebration-continue"
          className="grad-accent mt-5 w-full rounded-full py-3 text-sm font-bold text-[hsl(250_30%_8%)] transition-transform active:scale-[.98]">Continue swiping</button>
        <Link href="/connections" className="mt-2 block rounded-full py-2 text-center text-sm font-semibold text-muted-foreground hover:text-foreground" data-testid="link-celebration-connections">See all connections</Link>
        <footer className="mt-4 border-t border-border py-5 text-xs leading-relaxed text-muted-foreground">
          <p data-testid="text-celebration-disclaimer">Sample profiles are fictional. AI-written icebreakers are drafts, so read and edit before you send.</p>
          <Link href="/history" className="mt-2 inline-block underline-offset-4 hover:text-foreground hover:underline" data-testid="link-celebration-history">History</Link>
        </footer>
      </div>
    </div>
  );
}
