import { Coffee, MessageCircleQuestion, Sparkles } from 'lucide-react';
import type { NextStep } from '@workspace/api-client-react';

const ICONS = { coffee_chat: Coffee, shared_interest: Sparkles, ask_about: MessageCircleQuestion };

export function NextStepCard({ step, testId }: { step: NextStep | null | undefined; testId?: string }) {
  if (!step) return null;
  const Icon = ICONS[step.kind] ?? Sparkles;
  return (
    <div className="mt-3 flex gap-2.5 rounded-2xl bg-[hsl(160_85%_55%/.08)] p-3 text-left ring-1 ring-[hsl(160_85%_55%/.3)]" data-testid={testId}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(160_85%_66%)]" aria-hidden />
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[hsl(160_85%_70%)]">Next step</p>
        <p className="mt-0.5 text-sm font-semibold leading-snug">{step.title}</p>
        <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{step.text}</p>
      </div>
    </div>
  );
}
