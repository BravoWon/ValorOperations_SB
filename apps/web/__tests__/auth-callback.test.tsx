import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }), useSearchParams: () => new URLSearchParams('next=/tickets') }));

vi.mock('@/lib/supabase/config', () => ({ supabaseConfigured: () => true }));

const exchangeCodeForSession = vi.fn(async () => ({ error: null }));
vi.mock('@/lib/supabase/browser', () => ({
  createSupabaseBrowserClient: () => ({ auth: { exchangeCodeForSession } }),
}));

import CallbackPage from '@/app/auth/callback/page';

beforeEach(() => { replace.mockClear(); exchangeCodeForSession.mockClear(); });

it('exchanges the code and redirects to next on success', async () => {
  exchangeCodeForSession.mockResolvedValue({ error: null });
  render(<CallbackPage />);
  await waitFor(() => expect(exchangeCodeForSession).toHaveBeenCalled());
  await waitFor(() => expect(replace).toHaveBeenCalledWith('/tickets'));
});

it('shows an error and does not redirect on failure', async () => {
  exchangeCodeForSession.mockResolvedValue({ error: { message: 'bad code' } } as unknown as Awaited<ReturnType<typeof exchangeCodeForSession>>);
  render(<CallbackPage />);
  await waitFor(() => expect(screen.getByText(/couldn/i)).toBeInTheDocument());
  expect(replace).not.toHaveBeenCalled();
});
