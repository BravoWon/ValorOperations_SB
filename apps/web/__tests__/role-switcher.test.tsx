import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const { supabaseConfigured } = vi.hoisted(() => ({ supabaseConfigured: vi.fn(() => false) }));
vi.mock('@/lib/supabase/config', () => ({ supabaseConfigured: () => supabaseConfigured() }));
vi.mock('@/components/role-provider', () => ({ useRole: () => ({ role: 'owner', setRole: () => {} }) }));

import { RoleSwitcher } from '@/components/role-switcher';

beforeEach(() => { supabaseConfigured.mockReturnValue(false); });

describe('RoleSwitcher', () => {
  it('renders the demo role select in mock mode', () => {
    supabaseConfigured.mockReturnValue(false);
    render(<RoleSwitcher />);
    expect(screen.getByLabelText('Demo role')).toBeInTheDocument();
  });

  it('is hidden in live (configured) mode', () => {
    supabaseConfigured.mockReturnValue(true);
    const { container } = render(<RoleSwitcher />);
    expect(container).toBeEmptyDOMElement();
  });
});
