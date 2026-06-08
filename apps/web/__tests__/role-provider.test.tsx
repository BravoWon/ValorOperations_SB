// apps/web/__tests__/role-provider.test.tsx
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RoleProvider, useRole } from '@/components/role-provider';

function Probe() {
  const { role, setRole } = useRole();
  return (
    <div>
      <span data-testid="role">{role}</span>
      <button onClick={() => setRole('field')}>to-field</button>
    </div>
  );
}

describe('RoleProvider', () => {
  beforeEach(() => {
    document.cookie = 'valor_demo_role=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });

  it('defaults to owner on mount when no cookie', async () => {
    render(<RoleProvider><Probe /></RoleProvider>);
    await waitFor(() => expect(screen.getByTestId('role').textContent).toBe('owner'));
  });

  it('setRole writes the cookie and updates context', async () => {
    render(<RoleProvider><Probe /></RoleProvider>);
    fireEvent.click(screen.getByText('to-field'));
    await waitFor(() => expect(screen.getByTestId('role').textContent).toBe('field'));
    expect(document.cookie).toContain('valor_demo_role=field');
  });
});
