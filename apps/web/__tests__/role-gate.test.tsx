// apps/web/__tests__/role-gate.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({ path: '/data-manager', role: 'viewer' as string }));
vi.mock('next/navigation', () => ({ usePathname: () => h.path }));
vi.mock('@/components/role-provider', () => ({ useRole: () => ({ role: h.role, setRole: () => {} }) }));

import { RoleGate } from '@/components/role-gate';

describe('RoleGate', () => {
  it('blocks a route above the current role', () => {
    h.path = '/data-manager'; h.role = 'viewer';
    render(<RoleGate><div>secret</div></RoleGate>);
    expect(screen.queryByText('secret')).not.toBeInTheDocument();
    expect(screen.getByText(/Not available for your role/i)).toBeInTheDocument();
  });

  it('renders children for a route at/below the current role', () => {
    h.path = '/dashboard'; h.role = 'viewer';
    render(<RoleGate><div>secret</div></RoleGate>);
    expect(screen.getByText('secret')).toBeInTheDocument();
  });
});
