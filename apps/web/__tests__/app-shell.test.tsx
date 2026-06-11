// apps/web/__tests__/app-shell.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

const h = vi.hoisted(() => ({ role: 'viewer' as string }));
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard' }));
vi.mock('@/lib/use-effective-role', () => ({ useEffectiveRole: () => h.role }));

import { AppShell } from '@/components/app-shell';

describe('AppShell plane-grouped + role-gated nav', () => {
  it('viewer sees viewer routes but not admin routes or empty plane groups', () => {
    h.role = 'viewer';
    render(<AppShell tree={[]}>x</AppShell>);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Operate')).toBeInTheDocument();
    expect(screen.queryByText('Data Manager')).not.toBeInTheDocument();
    expect(screen.queryByText('Administer')).not.toBeInTheDocument();
  });

  it('owner sees every plane group and route', () => {
    h.role = 'owner';
    render(<AppShell tree={[]}>x</AppShell>);
    for (const label of ['Operate', 'Visualize', 'Administer', 'Data']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getByText('Data Manager')).toBeInTheDocument();
    expect(screen.getByText('Local Database')).toBeInTheDocument();
  });
});
