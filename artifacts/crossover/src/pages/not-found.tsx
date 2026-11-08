import { Link } from 'wouter';
import { Shell, usePageMeta } from '@/components/crossover/shell';

export default function NotFound() {
  usePageMeta('Page not found - Crossover', 'This Crossover page does not exist.');
  return (
    <Shell>
      <div className="rise rounded-[24px] border border-card-border bg-card p-6 mt-8">
        <p className="grad-text text-5xl font-extrabold">404</p>
        <h1 className="mt-2 text-xl font-bold">Wrong hallway.</h1>
        <p className="mt-1 text-sm text-muted-foreground">This page does not exist.</p>
        <Link href="/" data-testid="link-404-home" className="mt-4 inline-block rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background">Back home</Link>
      </div>
    </Shell>
  );
}
