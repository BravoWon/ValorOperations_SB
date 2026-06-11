import { it, expect, vi, beforeEach } from 'vitest';

const createBrowserClient = vi.fn(() => ({ tag: 'browser' }));
const createServerClient = vi.fn(() => ({ tag: 'server' }));
vi.mock('@supabase/ssr', () => ({ createBrowserClient, createServerClient }));

const cookieStore = { getAll: () => [{ name: 'sb', value: '1' }], set: vi.fn() };
vi.mock('next/headers', () => ({ cookies: async () => cookieStore }));

beforeEach(() => {
  createBrowserClient.mockClear();
  createServerClient.mockClear();
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://x.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key';
});

it('createSupabaseBrowserClient passes url + anon key to createBrowserClient', async () => {
  vi.resetModules();
  const { createSupabaseBrowserClient } = await import('@/lib/supabase/browser');
  const c = createSupabaseBrowserClient();
  expect(c).toEqual({ tag: 'browser' });
  expect(createBrowserClient).toHaveBeenCalledWith('https://x.supabase.co', 'anon-key');
});

it('createSupabaseServerClient wires the cookie adapter', async () => {
  vi.resetModules();
  const { createSupabaseServerClient } = await import('@/lib/supabase/server');
  const c = await createSupabaseServerClient();
  expect(c).toEqual({ tag: 'server' });
  const [url, key, opts] = createServerClient.mock.calls[0] as unknown as [string, string, { cookies: { getAll(): unknown; setAll(c: unknown): void } }];
  expect(url).toBe('https://x.supabase.co');
  expect(key).toBe('anon-key');
  expect(opts.cookies.getAll()).toEqual([{ name: 'sb', value: '1' }]);
});
