import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const { supabaseConfigured, resolveActiveOrgClient, writeActiveOrgCookie } = vi.hoisted(() => ({
  supabaseConfigured: vi.fn(() => true),
  resolveActiveOrgClient: vi.fn(() => 'org-a'),
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
beforeEach(() => {
  supabaseConfigured.mockReturnValue(true);
  resolveActiveOrgClient.mockReturnValue('org-a');
  writeActiveOrgCookie.mockClear();
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
  rows = [{ org_id: 'org-a', orgs: { name: 'Valor (demo)' } }];
  resolveActiveOrgClient.mockReturnValue('org-a');
  render(<ActiveOrgProvider><Consumer /></ActiveOrgProvider>);
  await waitFor(() => expect(screen.getByText(/active:org-a count:1/)).toBeInTheDocument());
  expect(writeActiveOrgCookie).not.toHaveBeenCalled();
  expect(reload).not.toHaveBeenCalled();
});

it('heals an invalid active org: sets the default cookie and reloads once', async () => {
  rows = [{ org_id: 'org-b', orgs: { name: 'Org B' } }];
  resolveActiveOrgClient.mockReturnValue('org-a'); // not in [org-b]
  render(<ActiveOrgProvider><Consumer /></ActiveOrgProvider>);
  await waitFor(() => expect(writeActiveOrgCookie).toHaveBeenCalledWith('org-b'));
  expect(reload).toHaveBeenCalledTimes(1);
});
