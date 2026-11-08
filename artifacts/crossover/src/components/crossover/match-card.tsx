import type { ProfileMatch, SampleProfile } from '@workspace/api-client-react';
import { Pill } from '@/components/crossover/shell';
import { gradientFor, initials } from '@/lib/api-errors';

function ScoreRing({ score }: { score: number }) {
  const r = 22, c = 2 * Math.PI * r;
  const s = Math.max(0, Math.min(100, score));
  return (
    <div className="relative h-14 w-14 shrink-0" role="img" aria-label={`Match score ${s} out of 100`} data-testid="text-match-score">
      <svg viewBox="0 0 56 56" className="h-14 w-14 -rotate-90">
        <defs><linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="hsl(12 95% 64%)" /><stop offset="1" stopColor="hsl(160 85% 55%)" /></linearGradient></defs>
        <circle cx="28" cy="28" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="5" />
        <circle cx="28" cy="28" r={r} fill="none" stroke="url(#ring)" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - s / 100)} />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-sm font-extrabold">{s}</span>
    </div>
  );
}

export function MatchCard({ profile, match, wildcard, shared }: { profile: SampleProfile; match?: ProfileMatch; wildcard: boolean; shared: Set<string> }) {
  return (
    <article
      data-testid={`card-match-${profile.id}`}
      className={`h-full rounded-[28px] p-[1.5px] ${wildcard ? 'wildcard-border' : 'bg-card-border'}`}
    >
      <div className="flex h-full flex-col overflow-hidden rounded-[27px] bg-card p-5">
        <div className="flex items-start gap-3">
          <div aria-hidden className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl text-lg font-extrabold text-[hsl(250_30%_8%)]" style={{ background: gradientFor(profile.id) }}>{initials(profile.first_name)}</div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold leading-tight" data-testid={`text-match-name-${profile.id}`}>{profile.first_name}</h2>
            <div className="mt-1 flex flex-wrap gap-1">
              {profile.is_sample && <Pill tone="sample" testId={`badge-sample-${profile.id}`}>Sample profile</Pill>}
              {wildcard && <Pill tone="warn" testId="badge-wildcard">Wildcard</Pill>}
            </div>
          </div>
          {match && <ScoreRing score={match.match_score} />}
        </div>
        <ul className="mt-3 flex flex-wrap gap-1.5 text-xs">
          {[profile.school, profile.major, profile.year].map((t) => <li key={t} className="rounded-full bg-secondary px-2.5 py-1">{t}</li>)}
        </ul>
        <p className="mt-3 text-[15px] font-medium leading-snug">{profile.headline}</p>
        {match && (
          <div className="relative mt-3 rounded-2xl rounded-tl-md bg-[hsl(322_85%_62%/.12)] p-3 text-sm leading-relaxed ring-1 ring-[hsl(322_85%_62%/.25)]" data-testid="text-why-connect">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[hsl(322_90%_80%)]">Why connect</p>
            <p className="mt-1">{match.why_connect}</p>
          </div>
        )}
        <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Heading toward</p>
        <p className="mt-0.5 line-clamp-2 text-sm">{profile.career_goals}</p>
        {profile.interests.length > 0 && (
          <ul className="mt-auto flex flex-wrap gap-1.5 pt-3" aria-label="Interests">
            {profile.interests.map((t) => {
              const hit = shared.has(t.toLowerCase());
              return (
                <li key={t} className={`rounded-full px-2.5 py-1 text-xs ${hit ? 'bg-[hsl(160_85%_55%/.18)] font-semibold text-[hsl(160_85%_74%)] ring-1 ring-[hsl(160_85%_55%/.45)]' : 'border border-border text-muted-foreground'}`}>
                  {hit && <span className="sr-only">Shared interest: </span>}{t}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </article>
  );
}
