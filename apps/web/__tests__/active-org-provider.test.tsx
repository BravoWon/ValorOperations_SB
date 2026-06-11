import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const { supabaseConfigured, resolveActiveOrgClient, writeActiveOrgCookie } = vi.hoisted(() => ({
  supabaseConfigured: vi.fn(() => true),
  resolveActiveOrgClient: vi.fn(),
  writeActiveOrgCookie: vi.fn(),
}));
vi.mock('@/lib/supabase/config', () => ({ supabaseConfigured: () => supabaseConfigured() }));
vi.mock('@/lib/active-org', () => ({
  ACTIVE_ORG_COOKIE: 'valor_active_org',
  resolveActiveOrgClient: () => resolveActiveOrgClient(),
  writeActiveOrgCookie: (id: string) => writeActiveOrgCookie(id),
}));
vi.mock('@/lib/auth', () => ({ signOut: vi.fn() }));

let session: unknown = { user: { id: 'u1' } };
let rows: unknown[] = [];
let queryError: unknown = null;
const select = vi.fn(async () => ({ data: rows, error: queryError }));
vi.mock('@/lib/supabase/browser', () => ({
  createSupabaseBrowserClient: () => ({
    auth: { getSession: async () => ({ data: { session } }) },
    from: () => ({ select }),
  }),
}));

import { ActiveOrgProvider, useActiveOrg } from '@/components/active-org-provider';

const reload = vi.fn();
// `resolveActiveOrgClient()` reads this; `writeActiveOrgCookie(id)` persists into it
// (unless cookies are "blocked") — so the provider's write-then-verify heal logic is exercised.
let resolvedOrg = 'org-a';
let cookiesBlocked = false;
beforeEach(() => {
  supabaseConfigured.mockReturnValue(true);
  resolvedOrg = 'org-a';
  cookiesBlocked = false;
  resolveActiveOrgClient.mockImplementation(() => resolvedOrg);
  writeActiveOrgCookie.mockReset();
  writeActiveOrgCookie.mockImplementation((id: string) => { if (!cookiesBlocked) resolvedOrg = id; });
  reload.mockClear();
  select.mockClear();
  session = { user: { id: 'u1' } };
  rows = [];
  queryError = null;
  Object.defineProperty(window, 'location', { configurable: true, value: { reload } });
});

function Consumer() {
  const ctx = useActiveOrg();
  return <div>active:{ctx?.activeOrgId ?? 'none'} count:{ctx?.orgs.length ?? -1}</div>;
}

function Switcher() {
  const ctx = useActiveOrg();
  if (!ctx) return null;
  return (
    <>
      <button onClick={() => ctx.setActiveOrg(ctx.activeOrgId)}>same</button>
      <button onClick={() => ctx.setActiveOrg('nope')}>unknown</button>
      <button onClick={() => ctx.setActiveOrg('org-c')}>other</button>
    </>
  );
}

it('passes children through in mock mode (unconfigured)', () => {
  supabaseConfigured.mockReturnValue(false);
  render(<ActiveOrgProvider><div>app</div></ActiveOrgProvider>);
  expect(screen.getByText('app')).toBeInTheDocument();
});

it('renders NotProvisioned when the user has no orgs', async () => {
  rows = [];
  render(<ActiveOrgProvider><div>app</div></ActiveOrgProvider>);
  await waitFor(() => expect(screen.getByText(/access not provisioned/i)).toBeInTheDocument());
  expect(screen.queryByText('app')).not.toBeInTheDocument();
});

it('shows the retry state on a memberships query error', async () => {
  queryError = { message: 'network' };
  render(<ActiveOrgProvider><div>app</div></ActiveOrgProvider>);
  await waitFor(() => expect(screen.getByText(/unable to verify access/i)).toBeInTheDocument());
});

it('provides the org context + children when the active org is valid', async () => {
  rows = [{ org_id: 'org-a', orgs: { name: 'Valor (demo)' } }]; // resolvedOrg defaults to 'org-a' (valid)
  render(<ActiveOrgProvider><Consumer /></ActiveOrgProvider>);
  await waitFor(() => expect(screen.getByText(/active:org-a count:1/)).toBeInTheDocument());
  expect(writeActiveOrgCookie).not.toHaveBeenCalled();
  expect(reload).not.toHaveBeenCalled();
});

it('heals an invalid active org: sets the default cookie and reloads once', async () => {
  rows = [{ org_id: 'org-b', orgs: { name: 'Org B' } }]; // resolvedOrg 'org-a' is not in [org-b]
  render(<ActiveOrgProvider><Consumer /></ActiveOrgProvider>);
  await waitFor(() => expect(writeActiveOrgCookie).toHaveBeenCalledWith('org-b'));
  expect(reload).toHaveBeenCalledTimes(1);
});

it('errors (no reload loop) when the heal cookie write is blocked', async () => {
  rows = [{ org_id: 'org-b', orgs: { name: 'Org B' } }];
  cookiesBlocked = true; // writeActiveOrgCookie is a no-op, so the cookie stays invalid
  render(<ActiveOrgProvider><Consumer /></ActiveOrgProvider>);
  await waitFor(() => expect(screen.getByText(/unable to verify access/i)).toBeInTheDocument());
  expect(reload).not.toHaveBeenCalled();
});

it('setActiveOrg validates: ignores the same/unknown org, switches on a valid change', async () => {
  rows = [{ org_id: 'org-a', orgs: { name: 'A' } }, { org_id: 'org-c', orgs: { name: 'C' } }];
  render(<ActiveOrgProvider><Switcher /></ActiveOrgProvider>);
  await waitFor(() => expect(screen.getByText('same')).toBeInTheDocument());
  fireEvent.click(screen.getByText('same'));    // same as active → ignored
  fireEvent.click(screen.getByText('unknown')); // not in orgs → ignored
  expect(writeActiveOrgCookie).not.toHaveBeenCalled();
  expect(reload).not.toHaveBeenCalled();
  fireEvent.click(screen.getByText('other'));   // valid + different → switch
  expect(writeActiveOrgCookie).toHaveBeenCalledWith('org-c');
  expect(reload).toHaveBeenCalledTimes(1);
});
