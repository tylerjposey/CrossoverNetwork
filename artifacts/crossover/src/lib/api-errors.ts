type Maybe = { status?: number; data?: unknown } | null | undefined;

export function apiErrorText(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  const e = err as Maybe;
  const data = e?.data as { error?: unknown } | null | undefined;
  if (data && typeof data.error === 'string' && data.error.trim()) return data.error;
  return fallback;
}

export function isConflict(err: unknown): boolean {
  const e = err as Maybe;
  const code = (e?.data as { code?: unknown } | null | undefined)?.code;
  return e?.status === 409 || code === 'stale_deck' || code === 'confirm_profile' || code === 'invalid_action';
}

export function gradientFor(seed: number) {
  const hues = [12, 322, 160, 265, 45, 195];
  const h = hues[Math.abs(seed) % hues.length];
  return `linear-gradient(135deg, hsl(${h} 90% 66%), hsl(${(h + 60) % 360} 85% 62%))`;
}

export function initials(name: string | null | undefined) {
  const n = (name ?? '').trim();
  if (!n) return 'You';
  return n.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
}
