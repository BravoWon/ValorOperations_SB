import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const { supabaseConfigured, useRole, useActiveOrg } = vi.hoisted(() => ({
  supabaseConfigured: vi.fn(() => false),
  useRole: vi.fn(() => ({ role: 'owner', setRole: () => {} })),
  useActiveOrg: vi.fn(() => null as null | { activeRole: string }),
}));
vi.mock('@/lib/supabase/config', () => ({ supabaseConfigured: () => supabaseConfigured() }));
vi.mock('@/components/role-provider', () => ({ useRole: () => useRole() }));
vi.mock('@/components/active-org-provider', () => ({ useActiveOrg: () => useActiveOrg() }));

import { useEffectiveRole } from '@/lib/use-effective-role';

beforeEach(() => {
  supabaseConfigured.mockReturnValue(false);
  useRole.mockReturnValue({ role: 'owner', setRole: () => {} });
  useActiveOrg.mockReturnValue(null);
});

describe('useEffectiveRole', () => {
  it('returns the demo role in mock mode (unconfigured)', () => {
    supabaseConfigured.mockReturnValue(false);
    useRole.mockReturnValue({ role: 'field', setRole: () => {} });
    const { result } = renderHook(() => useEffectiveRole());
    expect(result.current).toBe('field');
  });

  it('returns the active-org membership role in live mode', () => {
    supabaseConfigured.mockReturnValue(true);
    useActiveOrg.mockReturnValue({ activeRole: 'admin' });
    const { result } = renderHook(() => useEffectiveRole());
    expect(result.current).toBe('admin');
  });

  it('falls back to viewer in live mode with no active-org context', () => {
    supabaseConfigured.mockReturnValue(true);
    useActiveOrg.mockReturnValue(null);
    const { result } = renderHook(() => useEffectiveRole());
    expect(result.current).toBe('viewer');
  });
});
