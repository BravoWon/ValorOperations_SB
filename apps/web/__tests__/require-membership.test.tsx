import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const supabaseConfigured = vi.fn(() => true);
vi.mock('@/lib/supabase/config', () => ({ supabaseConfigured: () => supabaseConfigured() }));
vi.mock('@/lib/auth', () => ({ signOut: vi.fn() }));

let membershipRows: unknown[] = [];
let membershipError: unknown = null;
let session: unknown = { user: { id: 'u1' } };
const limit = vi.fn(async () => ({ data: membershipRows, error: membershipError }));
vi.mock('@/lib/supabase/browser', () => ({
  createSupabaseBrowserClient: () => ({
    auth: { getSession: async () => ({ data: { session } }) },
    from: () => ({ select: () => ({ eq: () => ({ limit }) }) }),
  }),
}));

import { RequireMembership } from '@/components/require-membership';

beforeEach(() => { supabaseConfigured.mockReturnValue(true); membershipRows = []; membershipError = null; session = { user: { id: 'u1' } }; process.env.NEXT_PUBLIC_SUPABASE_ORG_ID = '00000000-0000-0000-0000-000000000001'; });

it('passes children through when unconfigured (mock mode)', () => {
  supabaseConfigured.mockReturnValue(false);
  render(<RequireMembership><div>app</div></RequireMembership>);
  expect(screen.getByText('app')).toBeInTheDocument();
});

it('renders children when the user has a membership in the active org', async () => {
  membershipRows = [{ org_id: '00000000-0000-0000-0000-000000000001' }];
  render(<RequireMembership><div>app</div></RequireMembership>);
  await waitFor(() => expect(screen.getByText('app')).toBeInTheDocument());
});

it('renders NotProvisioned when the user has no membership', async () => {
  membershipRows = [];
  render(<RequireMembership><div>app</div></RequireMembership>);
  await waitFor(() => expect(screen.getByText(/access not provisioned/i)).toBeInTheDocument());
  expect(screen.queryByText('app')).not.toBeInTheDocument();
});

it('renders children when the membership query errors (transient)', async () => {
  membershipError = { message: 'network' };
  render(<RequireMembership><div>app</div></RequireMembership>);
  await waitFor(() => expect(screen.getByText('app')).toBeInTheDocument());
});
