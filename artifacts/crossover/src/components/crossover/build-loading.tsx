import { useEffect, useState } from 'react';

const LINES = ['Scanning schools...', 'Comparing career goals...', 'Finding your wildcard...'];

export function BuildLoading() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % LINES.length), 1900);
    return () => clearInterval(t);
  }, []);
  return (
    <section aria-busy="true" aria-live="polite" className="rise pt-6" data-testid="status-building">
      <p key={i} className="rise text-center text-sm font-semibold grad-text" data-testid="text-build-status">{LINES[i]}</p>
      <div className="relative mx-auto mt-6 h-[420px] w-full">
        {[2, 1, 0].map((d) => (
          <div
            key={d}
            className="absolute inset-x-0 top-0 rounded-[28px] border border-card-border bg-card p-5"
            style={{ transform: `translateY(${d * 14}px) scale(${1 - d * 0.04})`, opacity: 1 - d * 0.3, height: 400 }}
          >
            {d === 0 && (
              <>
                <div className="flex gap-3"><div className="skel h-14 w-14 rounded-2xl" /><div className="flex-1 space-y-2 pt-1"><div className="skel h-4 w-1/3 rounded" /><div className="skel h-3 w-2/3 rounded" /></div><div className="skel h-14 w-14 rounded-full" /></div>
                <div className="mt-5 flex gap-2"><div className="skel h-6 w-20 rounded-full" /><div className="skel h-6 w-24 rounded-full" /><div className="skel h-6 w-14 rounded-full" /></div>
                <div className="skel mt-6 h-20 w-full rounded-2xl" />
                <div className="skel mt-4 h-4 w-full rounded" /><div className="skel mt-2 h-4 w-4/5 rounded" />
                <div className="mt-6 flex gap-2"><div className="skel h-6 w-16 rounded-full" /><div className="skel h-6 w-20 rounded-full" /></div>
              </>
            )}
          </div>
        ))}
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">This can take up to a minute. Keep this tab open.</p>
    </section>
  );
}
