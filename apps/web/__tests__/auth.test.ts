import { it, expect, vi, beforeEach } from 'vitest';

const signInWithOAuth = vi.fn(async () => ({ error: null }));
const signOutFn = vi.fn(async () => ({ error: null }));
vi.mock('@/lib/supabase/browser', () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInWithOAuth, signOut: signOutFn } }),
}));

beforeEach(() => { signInWithOAuth.mockClear(); signOutFn.mockClear(); });

it('signInWithMicrosoft requests the azure provider with the callback redirect', async () => {
  vi.resetModules();
  const { signInWithMicrosoft } = await import('@/lib/auth');
  await signInWithMicrosoft('/tickets');
  const arg = (signInWithOAuth.mock.calls[0] as unknown as [{ provider: string; options: { redirectTo: string } }])[0];
  expect(arg.provider).toBe('azure');
  expect(arg.options.redirectTo).toMatch(/\/auth\/callback\?next=%2Ftickets$/);
});

it('signOut calls supabase auth.signOut', async () => {
  vi.resetModules();
  const { signOut } = await import('@/lib/auth');
  await signOut();
  expect(signOutFn).toHaveBeenCalled();
});
