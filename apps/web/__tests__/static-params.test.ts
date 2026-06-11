import { it, expect, vi, beforeEach } from 'vitest';

const supabaseConfigured = vi.fn(() => false);
vi.mock('@/lib/supabase/config', () => ({ supabaseConfigured: () => supabaseConfigured() }));

import { staticParamsFor } from '@/lib/static-params';

beforeEach(() => supabaseConfigured.mockReturnValue(false));

it('enumerates the given params when unconfigured (static export / mock)', () => {
  expect(staticParamsFor([{ ticketId: 'a' }, { ticketId: 'b' }])).toEqual([{ ticketId: 'a' }, { ticketId: 'b' }]);
});

it('returns [] when configured (route renders dynamically per request)', () => {
  supabaseConfigured.mockReturnValue(true);
  expect(staticParamsFor([{ ticketId: 'a' }])).toEqual([]);
});
