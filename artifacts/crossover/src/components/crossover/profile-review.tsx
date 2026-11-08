import { useState, type KeyboardEvent } from 'react';
import { Pencil, X, ArrowRight, ArrowLeft } from 'lucide-react';
import type { VisitorProfile } from '@workspace/api-client-react';
import { Pill } from '@/components/crossover/shell';
import { gradientFor, initials } from '@/lib/api-errors';

const field = 'mt-1 w-full rounded-xl border border-input bg-background/60 px-3 py-2 text-sm focus:border-[hsl(var(--ring))] focus:outline-none';

export function ProfileReview({
  profile, confirmed, onSave, onContinue, onBackToDeck, onEditInput, saving, confirming, error,
}: {
  profile: VisitorProfile; confirmed: boolean; onSave: (p: VisitorProfile) => Promise<boolean>;
  onContinue: () => void; onBackToDeck: () => void; onEditInput: () => void;
  saving: boolean; confirming: boolean; error: string | null;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<VisitorProfile>(profile);
  const [tag, setTag] = useState('');

  const set = <K extends keyof VisitorProfile>(k: K, v: VisitorProfile[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const nullable = (v: string) => (v.trim() ? v : null);
  const addTag = () => {
    const t = tag.trim().slice(0, 100);
    if (!t || draft.interests.length >= 12 || draft.interests.includes(t)) { setTag(''); return; }
    set('interests', [...draft.interests, t]); setTag('');
  };
  const onTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(); }
  };
  const meta = [profile.major, profile.year, profile.school].filter(Boolean).join(' · ');

  return (
    <section className="rise pt-6">
      <Pill tone="yours">Your card</Pill>
      <h1 className="mt-3 text-[30px] font-extrabold leading-tight tracking-tight">Here's how we see you, <span className="grad-text">tap to edit</span></h1>

      {!editing ? (
        <button
          type="button"
          onClick={() => { setDraft(profile); setEditing(true); }}
          data-testid="button-edit-profile"
          className="group mt-5 block w-full rounded-[28px] bg-[linear-gradient(135deg,hsl(12_95%_64%/.5),hsl(322_85%_62%/.4),hsl(160_85%_55%/.4))] p-[1.5px] text-left transition-transform active:scale-[.99]"
        >
          <div className="rounded-[27px] bg-card p-5">
            <div className="flex items-center gap-3">
              <div aria-hidden className="grid h-14 w-14 place-items-center rounded-2xl text-lg font-extrabold text-[hsl(250_30%_8%)]" style={{ background: gradientFor(7) }}>{initials(profile.first_name)}</div>
              <div className="min-w-0 flex-1">
                <p className="text-xl font-bold" data-testid="text-visitor-name">{profile.first_name || 'Add your name'}</p>
                <p className="text-sm text-muted-foreground">{meta || 'Add school, major, year'}</p>
              </div>
              <Pencil className="h-4 w-4 text-muted-foreground transition-transform group-hover:-rotate-12" aria-hidden />
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Heading toward</p>
            <p className="mt-1 text-[15px] leading-snug" data-testid="text-visitor-goals">{profile.career_goals || 'Tell us your goals'}</p>
            {profile.interests.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {profile.interests.map((t) => <li key={t} className="rounded-full bg-[hsl(160_85%_55%/.14)] px-2.5 py-1 text-xs text-[hsl(160_85%_74%)]">{t}</li>)}
              </ul>
            )}
          </div>
        </button>
      ) : (
        <form
          className="mt-5 space-y-3 rounded-[28px] border border-card-border bg-card p-5"
          onSubmit={async (e) => { e.preventDefault(); if (await onSave(draft)) setEditing(false); }}
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs font-semibold text-muted-foreground">First name<input data-testid="input-first-name" maxLength={100} className={field} value={draft.first_name ?? ''} onChange={(e) => set('first_name', nullable(e.target.value))} /></label>
            <label className="text-xs font-semibold text-muted-foreground">Year<input data-testid="input-year" maxLength={100} className={field} value={draft.year ?? ''} onChange={(e) => set('year', nullable(e.target.value))} /></label>
          </div>
          <label className="block text-xs font-semibold text-muted-foreground">School<input data-testid="input-school" maxLength={150} className={field} value={draft.school ?? ''} onChange={(e) => set('school', nullable(e.target.value))} /></label>
          <label className="block text-xs font-semibold text-muted-foreground">Major<input data-testid="input-major" maxLength={150} className={field} value={draft.major ?? ''} onChange={(e) => set('major', nullable(e.target.value))} /></label>
          <label className="block text-xs font-semibold text-muted-foreground">Career goals<textarea data-testid="input-career-goals" maxLength={600} rows={3} className={`${field} resize-none`} value={draft.career_goals} onChange={(e) => set('career_goals', e.target.value)} /></label>
          <div>
            <label htmlFor="tag" className="text-xs font-semibold text-muted-foreground">Interests ({draft.interests.length}/12)</label>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {draft.interests.map((t) => (
                <li key={t} className="inline-flex items-center gap-1 rounded-full bg-secondary py-1 pl-2.5 pr-1 text-xs">
                  {t}
                  <button type="button" aria-label={`Remove ${t}`} data-testid={`button-remove-interest-${t}`} onClick={() => set('interests', draft.interests.filter((x) => x !== t))} className="grid h-5 w-5 place-items-center rounded-full hover:bg-background"><X className="h-3 w-3" aria-hidden /></button>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex gap-2">
              <input id="tag" data-testid="input-interest" maxLength={100} value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={onTagKey} placeholder="Add an interest" className={`${field} mt-0`} disabled={draft.interests.length >= 12} />
              <button type="button" onClick={addTag} data-testid="button-add-interest" className="shrink-0 rounded-xl bg-secondary px-3 text-sm font-semibold">Add</button>
            </div>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">Saving doesn't use AI or change your current deck. Your next Build uses these edits plus any newly added text.</p>
          {error && <p role="alert" className="rounded-2xl bg-[hsl(352_85%_62%/.14)] p-3 text-sm text-[hsl(352_90%_82%)]" data-testid="text-profile-error">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={() => setEditing(false)} data-testid="button-cancel-edit" className="flex-1 rounded-full border border-border py-2.5 text-sm font-semibold">Cancel</button>
            <button type="submit" disabled={saving} data-testid="button-save-profile" className="flex-1 rounded-full bg-foreground py-2.5 text-sm font-bold text-background disabled:opacity-60">{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      )}

      {!editing && error && <p role="alert" className="mt-3 rounded-2xl bg-[hsl(352_85%_62%/.14)] p-3 text-sm text-[hsl(352_90%_82%)]">{error}</p>}

      {!editing && (
        <div className="mt-5 space-y-2">
          {confirmed ? (
            <button type="button" onClick={onBackToDeck} data-testid="button-back-to-deck" className="grad-accent inline-flex w-full items-center justify-center gap-2 rounded-full py-3 font-bold text-[hsl(250_30%_8%)] active:scale-[.97]">
              <ArrowLeft className="h-4 w-4" aria-hidden /> Back to your deck
            </button>
          ) : (
            <button type="button" onClick={onContinue} disabled={confirming} data-testid="button-continue" className="grad-accent inline-flex w-full items-center justify-center gap-2 rounded-full py-3 font-bold text-[hsl(250_30%_8%)] active:scale-[.97] disabled:opacity-60">
              {confirming ? 'Dealing your deck...' : <>Looks right, show my deck <ArrowRight className="h-4 w-4" aria-hidden /></>}
            </button>
          )}
          <button type="button" onClick={onEditInput} data-testid="button-edit-input" className="w-full rounded-full py-2.5 text-sm font-semibold text-muted-foreground hover:text-foreground">Edit what I wrote</button>
        </div>
      )}
    </section>
  );
}
