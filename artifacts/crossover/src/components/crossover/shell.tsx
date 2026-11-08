import { useEffect, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';

export function usePageMeta(title: string, description: string) {
  useEffect(() => {
    document.title = title;
    const set = (sel: string, attr: string, val: string) => {
      let el = document.head.querySelector<HTMLMetaElement>(sel);
      if (!el) {
        el = document.createElement('meta');
        const [k, v] = attr.split('=');
        el.setAttribute(k, v);
        document.head.appendChild(el);
      }
      el.setAttribute('content', val);
    };
    set('meta[name="description"]', 'name=description', description);
    set('meta[property="og:title"]', 'property=og:title', title);
    set('meta[property="og:description"]', 'property=og:description', description);
    set('meta[name="twitter:title"]', 'name=twitter:title', title);
    set('meta[name="twitter:description"]', 'name=twitter:description', description);
  }, [title, description]);
}

function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const [loc] = useLocation();
  const active = loc === href;
  return (
    <Link
      href={href}
      data-testid={`link-nav-${href === '/' ? 'home' : href.slice(1)}`}
      aria-current={active ? 'page' : undefined}
      className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
      }`}
    >
      {children}
    </Link>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-[100dvh] bg-background">
      <div className="glow-bg" aria-hidden />
      <div className="relative z-10 mx-auto flex min-h-[100dvh] w-full max-w-[430px] flex-col px-4">
        <header className="sticky top-0 z-20 -mx-4 flex items-center justify-between bg-background/80 px-4 py-3 backdrop-blur-md">
          <Link href="/" data-testid="link-logo" className="flex items-center gap-2 rounded-full">
            <span className="grad-accent relative grid h-8 w-8 place-items-center rounded-full" aria-hidden>
              <span className="absolute h-[2px] w-5 rotate-45 rounded bg-background" />
              <span className="absolute h-[2px] w-5 -rotate-45 rounded bg-background" />
            </span>
            <span className="text-lg font-bold tracking-tight">Crossover</span>
          </Link>
          <nav aria-label="Main" className="flex gap-1">
            <NavLink href="/">Home</NavLink>
            <NavLink href="/history">History</NavLink>
          </nav>
        </header>
        <main className="flex-1 pb-8 pt-2">{children}</main>
        <footer className="border-t border-border py-6 text-xs leading-relaxed text-muted-foreground">
          <p data-testid="text-footer-disclaimer">
            Sample profiles are fictional. AI-written icebreakers are drafts, so read and edit before you send.
          </p>
          <div className="mt-3 flex gap-4">
            <Link href="/" className="underline-offset-4 hover:text-foreground hover:underline" data-testid="link-footer-home">Home</Link>
            <Link href="/history" className="underline-offset-4 hover:text-foreground hover:underline" data-testid="link-footer-history">History</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}

export function Pill({ children, tone = 'neutral', testId }: { children: ReactNode; tone?: 'neutral' | 'sample' | 'yours' | 'ok' | 'warn' | 'bad'; testId?: string }) {
  const tones = {
    neutral: 'bg-secondary text-secondary-foreground',
    sample: 'bg-[hsl(265_85%_72%/.16)] text-[hsl(265_90%_84%)] ring-1 ring-[hsl(265_85%_72%/.35)]',
    yours: 'bg-[hsl(160_85%_55%/.14)] text-[hsl(160_85%_70%)] ring-1 ring-[hsl(160_85%_55%/.35)]',
    ok: 'bg-[hsl(160_85%_55%/.14)] text-[hsl(160_85%_70%)]',
    warn: 'bg-[hsl(45_95%_60%/.14)] text-[hsl(45_95%_72%)]',
    bad: 'bg-[hsl(352_85%_62%/.15)] text-[hsl(352_90%_78%)]',
  };
  return (
    <span data-testid={testId} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function ErrorCard({ message, onRetry, retrying }: { message: string; onRetry: () => void; retrying?: boolean }) {
  return (
    <div role="alert" className="rounded-[24px] border border-[hsl(352_85%_62%/.35)] bg-card p-5">
      <p className="font-semibold">{message}</p>
      <p className="mt-1 text-sm text-muted-foreground">Check your connection, then try again.</p>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        data-testid="button-retry"
        className="mt-4 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-transform active:scale-95 disabled:opacity-60"
      >
        {retrying ? 'Retrying...' : 'Retry'}
      </button>
    </div>
  );
}
