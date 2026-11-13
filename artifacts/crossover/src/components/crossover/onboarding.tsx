import { Sparkles, ArrowLeft, Mic, Square } from 'lucide-react';
import { Pill } from '@/components/crossover/shell';
import { useDictation } from '@/hooks/use-dictation';

const MAX = 1000;
const PLACEHOLDER =
  "I'm Priya, a junior at UT Austin studying industrial engineering. After graduation I want to work in supply chain strategy, ideally somewhere tackling climate logistics. Outside of class I run with a 5am club, build tiny Arduino projects, and volunteer teaching Excel at the public library.";

export function Onboarding({
  text, setText, remaining, onBuild, building, error, notice, hasDeck, onBackToDeck,
}: {
  text: string; setText: (v: string) => void; remaining: number; onBuild: () => void; building: boolean;
  error: string | null; notice: string | null; hasDeck: boolean; onBackToDeck: () => void;
}) {
  const dictation = useDictation(text, setText, MAX);
  const over = text.length > MAX;
  const disabled = building || dictation.active || !text.trim() || over || remaining <= 0;
  return (
    <section className="rise pt-6">
      {hasDeck && (
        <button type="button" onClick={onBackToDeck} data-testid="button-back-to-deck" className="mb-4 inline-flex items-center gap-1.5 rounded-full px-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back to your deck
        </button>
      )}
      <div className="flex items-center justify-between gap-2">
        <Pill tone="yours">Start here</Pill>
        <span data-testid="text-quota" className="rounded-full border border-border px-3 py-1 text-xs font-semibold text-muted-foreground">
          AI builds left this hour: {remaining} of 5
        </span>
      </div>
      <h1 className="mt-4 text-[36px] font-extrabold leading-[1.04] tracking-tight">
        Find people headed <span className="grad-text">where you're headed.</span>
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
        Share a little about yourself and we'll find ten students and young professionals worth meeting, including one wildcard.
      </p>

      <form
        className="mt-6 rounded-[24px] border border-card-border bg-card p-4"
        onSubmit={(e) => { e.preventDefault(); if (!disabled) onBuild(); }}
      >
        <label htmlFor="about" className="block text-sm font-semibold leading-snug">
          Tell us about you: your school, major, what you want to do after graduation, and what you're into outside of class. You can also paste a resume summary or LinkedIn About section.
        </label>
        <textarea
          id="about"
          data-testid="input-about"
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, MAX))}
          readOnly={dictation.active}
          maxLength={MAX}
          rows={7}
          placeholder={PLACEHOLDER}
          aria-describedby="about-count about-disclosure about-dictation-status"
          className="mt-3 w-full resize-none rounded-2xl border border-input bg-background/60 p-3.5 text-[15px] leading-relaxed placeholder:text-muted-foreground/60 focus:border-[hsl(var(--ring))] focus:outline-none"
        />
        <div className="mt-2">
          <button
            type="button"
            data-testid="button-dictate"
            aria-controls="about"
            aria-pressed={dictation.active}
            disabled={!dictation.supported || building || (!dictation.active && text.length >= MAX)}
            onClick={dictation.active ? dictation.stop : dictation.start}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[hsl(var(--ring))] disabled:cursor-not-allowed disabled:opacity-50 ${dictation.active ? 'border-primary bg-primary/10 text-primary' : 'border-border text-foreground hover:bg-muted'}`}
          >
            {dictation.active ? <Square className="h-4 w-4" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />}
            {dictation.active ? 'Stop dictation' : 'Dictate'}
          </button>
          <p id="about-dictation-status" role="status" aria-live="polite" className="mt-2 text-xs leading-relaxed text-muted-foreground">
            {dictation.message || (dictation.supported
              ? 'Speak instead of typing. Allow microphone access when asked. Your browser may process speech online. Dictation does not use AI builds.'
              : 'Voice dictation is not supported in this browser. You can still type, or use your keyboard’s microphone.')}
          </p>
        </div>
        <div className="mt-2 flex items-start justify-between gap-3">
          <p id="about-disclosure" className="text-xs leading-relaxed text-muted-foreground" data-testid="text-disclosure">
            What you enter and your results appear anonymously on the public History page. Don't include contact info.
          </p>
          <span id="about-count" data-testid="text-char-count" aria-live="polite" className={`shrink-0 font-mono text-xs ${text.length > 900 ? 'text-[hsl(45_95%_72%)]' : 'text-muted-foreground'}`}>
            {text.length}/{MAX}
          </span>
        </div>
        {notice && <p className="mt-3 rounded-2xl bg-[hsl(45_95%_60%/.12)] p-3 text-sm text-[hsl(45_95%_78%)]" data-testid="text-insufficient">{notice}</p>}
        {error && <p role="alert" className="mt-3 rounded-2xl bg-[hsl(352_85%_62%/.14)] p-3 text-sm text-[hsl(352_90%_82%)]" data-testid="text-build-error">{error}</p>}
        <button
          type="submit"
          disabled={disabled}
          data-testid="button-build"
          className="grad-accent mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-[15px] font-bold text-[hsl(250_30%_8%)] transition-transform active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Sparkles className="h-4 w-4" aria-hidden /> {hasDeck ? 'Build a new deck' : 'Build my deck'}
        </button>
        {remaining <= 0 && <p className="mt-2 text-center text-xs text-muted-foreground">You have reached the limit for this hour, try again later</p>}
      </form>
    </section>
  );
}
