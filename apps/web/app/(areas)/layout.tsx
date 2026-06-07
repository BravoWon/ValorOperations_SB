import Link from 'next/link';
import { Home } from 'lucide-react';

/**
 * Route-group shell for the not-yet-built workspace areas. Keeps the navy brand
 * background and provides a top "Workspaces" back link to the launcher so each
 * coming-soon page can be walked into and back out of.
 */
export default function AreasLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="px-6 py-5 sm:px-10">
        <div className="page-container">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 font-mono text-[0.6875rem] uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-gold-light"
          >
            <Home className="h-3.5 w-3.5" />
            Workspaces
          </Link>
        </div>
      </header>
      <main className="px-6 pb-12 sm:px-10">
        <div className="page-container">{children}</div>
      </main>
    </div>
  );
}
