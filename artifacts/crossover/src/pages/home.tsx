import { Link } from 'wouter';
import { ArrowRight } from 'lucide-react';
import { useGetCrossoverProfiles, type SampleProfile } from '@workspace/api-client-react';
import { ErrorCard, Pill, Shell, usePageMeta } from '@/components/crossover/shell';

const HUES = [12, 322, 160, 265, 45, 195];

function ProfileCard({ p, i }: { p: SampleProfile; i: number }) {
  const hue = HUES[p.id % HUES.length];
  return (
    <article
      data-testid={`card-profile-${p.id}`}
      className="rise group rounded-[24px] border border-card-border bg-card p-5 transition-transform duration-300 hover:-translate-y-0.5"
      style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}
    >
      <div className="flex items-start gap-3">
        <div
          aria-hidden
          className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-lg font-bold text-[hsl(250_30%_8%)] transition-transform duration-300 group-hover:rotate-6"
          style={{ background: `linear-gradient(135deg, hsl(${hue} 90% 66%), hsl(${(hue + 60) % 360} 85% 62%))` }}
        >
          {p.first_name.charAt(0)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-bold" data-testid={`text-profile-name-${p.id}`}>{p.first_name}</h3>
            <Pill tone="sample" testId={`badge-sample-profile-${p.id}`}>Sample profile</Pill>
          </div>
          <p className="text-sm text-muted-foreground">{p.major} &middot; {p.year} &middot; {p.school}</p>
        </div>
      </div>
      <p className="mt-4 text-[15px] font-medium leading-snug">{p.headline}</p>
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Heading toward</dt>
          <dd className="mt-0.5">{p.career_goals}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Ask me about</dt>
          <dd className="mt-0.5">{p.ask_me_about}</dd>
        </div>
      </dl>
      {p.interests.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Interests">
          {p.interests.map((t) => (
            <li key={t} className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">{t}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

export default function Home() {
  usePageMeta(
    'Crossover - Meet people outside your major',
    'Crossover is a playful career space for students and young professionals to meet across disciplines. Phase one previews fictional sample people.',
  );
  const { data, isLoading, isError, refetch, isFetching } = useGetCrossoverProfiles();

  return (
    <Shell>
      <section className="rise pt-6">
        <Pill tone="yours">Phase one</Pill>
        <h1 className="mt-4 text-[40px] font-extrabold leading-[1.02] tracking-tight">
          The best career advice is in a <span className="grad-text">different major.</span>
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">
          Crossover is for students and early-career people who want to meet the nurse, the coder and the set designer they would never find in their own department. Not a directory. More of a hallway.
        </p>
      </section>

      <section className="rise mt-6 rounded-[24px] border border-card-border bg-card p-5" style={{ animationDelay: '80ms' }}>
        <h2 className="font-bold">What works today</h2>
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />A preview of fictional sample people below.</li>
          <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />A public, redacted activity history.</li>
          <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />Your own profile and matching arrive in a later phase.</li>
        </ul>
        <Link href="/history" data-testid="link-hero-history" className="grad-accent mt-5 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-[hsl(250_30%_8%)] transition-transform hover:translate-x-0.5 active:scale-95">
          See the history <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </section>

      <section className="mt-10" aria-labelledby="people-heading">
        <div className="flex items-end justify-between">
          <h2 id="people-heading" className="text-xl font-bold tracking-tight">People you could cross paths with</h2>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Every person here is made up, so you can see the shape of things.</p>

        <div className="mt-5 space-y-4" aria-busy={isLoading}>
          {isLoading &&
            [0, 1, 2].map((i) => (
              <div key={i} className="rounded-[24px] border border-card-border bg-card p-5" data-testid={`skeleton-profile-${i}`}>
                <div className="flex gap-3"><div className="skel h-12 w-12 rounded-2xl" /><div className="flex-1 space-y-2"><div className="skel h-4 w-1/3 rounded" /><div className="skel h-3 w-2/3 rounded" /></div></div>
                <div className="skel mt-4 h-4 w-full rounded" /><div className="skel mt-2 h-4 w-4/5 rounded" />
              </div>
            ))}
          {isError && <ErrorCard message="We could not load the sample people." onRetry={() => refetch()} retrying={isFetching} />}
          {data && data.length === 0 && (
            <div className="rounded-[24px] border border-dashed border-border p-8 text-center" data-testid="empty-profiles">
              <p className="font-semibold">No sample people yet</p>
              <p className="mt-1 text-sm text-muted-foreground">The preview cast has not arrived. Check back soon.</p>
            </div>
          )}
          {data?.map((p, i) => <ProfileCard key={p.id} p={p} i={i} />)}
        </div>
      </section>
    </Shell>
  );
}
