import { AREAS } from '@/lib/areas';
import { AreaCard } from '@/components/area-card';
import { SignOutLink } from '@/components/sign-out-link';

/**
 * The post-login workspace launcher: a full-screen branded grid of the four
 * top-level Valor workspaces. Field Operations is live; the rest link to their
 * branded coming-soon pages so the whole intended system can be walked.
 */
export function Launcher() {
  return (
    <main className="relative min-h-screen px-6 py-10 sm:px-10 sm:py-14 lg:px-16">
      <div className="page-container">
        {/* Header */}
        <header className="animate-fade-up mb-10 flex flex-wrap items-end justify-between gap-6 sm:mb-14">
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-gold/40 bg-gold/10 font-display text-xl text-gold-light shadow-[0_0_22px_-8px_rgba(201,168,76,0.7)]">
              V
            </span>
            <div>
              <div className="eyebrow mb-1.5">Operations Hub</div>
              <h1 className="font-display text-3xl font-medium tracking-tight text-cream sm:text-4xl">
                Valor Operations
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose a workspace to get started.
              </p>
            </div>
          </div>

          <SignOutLink />
        </header>

        {/* Workspace grid */}
        <div className="stagger grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-2">
          {AREAS.map((area) => (
            <AreaCard key={area.id} area={area} />
          ))}
        </div>

        {/* Footer mark */}
        <footer className="mt-14 flex flex-col items-center gap-1">
          <div className="font-mono text-[0.625rem] uppercase tracking-[0.18em] text-muted-foreground/50">
            Valor Energy Partners
          </div>
          <div className="font-mono text-[0.625rem] text-muted-foreground/30">
            operations.valorenp.com
          </div>
        </footer>
      </div>
    </main>
  );
}
