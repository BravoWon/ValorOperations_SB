import { Launcher } from '@/components/launcher';

/**
 * Post-login landing: the workspace launcher. (The demo auth gate in
 * middleware.ts redirects unauthenticated visitors to /login first.)
 */
export default function Home() {
  return <Launcher />;
}
