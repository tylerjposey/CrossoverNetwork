import type { DeckFilter, DeckFilterOption } from '@workspace/api-client-react';

export const FILTER_LABELS: Record<DeckFilter, string> = {
  all: 'All',
  other_schools: 'Other schools',
  other_majors: 'Other majors',
  shared_interests: 'Shared interests',
  similar_goals: 'Similar goals',
};
const NEEDS: Partial<Record<DeckFilter, string>> = {
  other_schools: 'Add your school under My card to use this filter.',
  other_majors: 'Add your major under My card to use this filter.',
  shared_interests: 'Add an interest under My card to use this filter.',
  similar_goals: 'Add your goals under My card to use this filter.',
};

// Filters only choose which unswiped card comes next. They never use AI.
export function DeckFilterBar({ active, options, disabled, onChange }: {
  active: DeckFilter; options: DeckFilterOption[]; disabled: boolean; onChange: (f: DeckFilter) => void;
}) {
  if (!options.length) return null;
  return (
    <div role="group" aria-label="Filter your deck" className="mt-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]" data-testid="group-deck-filter">
      {options.map((o) => {
        const on = o.id === active;
        const empty = !o.available || (o.remaining === 0 && !on);
        const hint = !o.available ? NEEDS[o.id] : o.remaining === 0 && !on ? 'No cards left in this filter.' : undefined;
        return (
          <button key={o.id} type="button" aria-pressed={on} disabled={disabled || empty} title={hint}
            aria-label={`${FILTER_LABELS[o.id]}, ${o.remaining} ${o.remaining === 1 ? 'card' : 'cards'} left${hint ? `. ${hint}` : ''}`}
            onClick={() => { if (!on) onChange(o.id); }} data-testid={`button-filter-${o.id}`}
            className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-40 ${
              on ? 'bg-foreground text-background' : 'border border-border text-muted-foreground hover:text-foreground'}`}>
            {FILTER_LABELS[o.id]}
            <span className={`tabular-nums ${on ? 'opacity-70' : ''}`} aria-hidden>{o.remaining}</span>
          </button>
        );
      })}
    </div>
  );
}
