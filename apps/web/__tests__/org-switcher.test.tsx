import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const useActiveOrg = vi.fn();
vi.mock('@/components/active-org-provider', () => ({ useActiveOrg: () => useActiveOrg() }));

import { OrgSwitcher } from '@/components/org-switcher';

beforeEach(() => useActiveOrg.mockReset());

it('renders nothing without context (mock mode)', () => {
  useActiveOrg.mockReturnValue(null);
  const { container } = render(<OrgSwitcher />);
  expect(container).toBeEmptyDOMElement();
});

it('renders a static label for a single org (no dropdown)', () => {
  useActiveOrg.mockReturnValue({ orgs: [{ id: 'org-a', name: 'Valor (demo)' }], activeOrgId: 'org-a', setActiveOrg: vi.fn() });
  render(<OrgSwitcher />);
  expect(screen.getByText('Valor (demo)')).toBeInTheDocument();
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
});

it('renders a dropdown for multiple orgs and switches on change', () => {
  const setActiveOrg = vi.fn();
  useActiveOrg.mockReturnValue({ orgs: [{ id: 'org-a', name: 'Org A' }, { id: 'org-b', name: 'Org B' }], activeOrgId: 'org-a', setActiveOrg });
  render(<OrgSwitcher />);
  fireEvent.change(screen.getByRole('combobox', { name: /active organization/i }), { target: { value: 'org-b' } });
  expect(setActiveOrg).toHaveBeenCalledWith('org-b');
});
