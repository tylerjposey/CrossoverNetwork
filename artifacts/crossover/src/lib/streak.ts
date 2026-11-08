const KEY = 'crossover.streak.v1';
export type Streak = { count: number; last: string };

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parse(raw: string | null): Streak | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== 'object') return null;
    const { count, last } = v as Record<string, unknown>;
    if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > 100000) return null;
    if (typeof last !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(last)) return null;
    const [y, m, d] = last.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (dayKey(dt) !== last) return null;
    return { count, last };
  } catch { return null; }
}

/** Records today's open locally and returns the consecutive-day streak, or null if storage is unavailable. */
export function recordOpen(now = new Date()): Streak | null {
  try {
    const ls = window.localStorage;
    const today = dayKey(now);
    const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    const prev = parse(ls.getItem(KEY));
    let next: Streak;
    if (prev && prev.last === today) next = prev;
    else if (prev && prev.last === dayKey(y)) next = { count: prev.count + 1, last: today };
    else next = { count: 1, last: today };
    ls.setItem(KEY, JSON.stringify(next));
    return next;
  } catch { return null; }
}
