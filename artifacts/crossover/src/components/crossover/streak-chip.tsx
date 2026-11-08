import { useEffect, useState } from 'react';
import { Flame } from 'lucide-react';
import { recordOpen, type Streak } from '@/lib/streak';

export function StreakChip() {
  const [s, setS] = useState<Streak | null>(null);
  useEffect(() => { setS(recordOpen()); }, []);
  if (!s) return null;
  const label = `${s.count} day opening streak, saved on this device only`;
  return (
    <span title={label} aria-label={label} data-testid="text-streak"
      className="rise inline-flex items-center gap-0.5 rounded-full bg-[hsl(45_95%_60%/.12)] px-1.5 py-0.5 text-[11px] font-bold text-[hsl(45_95%_72%)] ring-1 ring-[hsl(45_95%_60%/.3)]">
      <Flame className="h-3 w-3" aria-hidden />{s.count}d
    </span>
  );
}
