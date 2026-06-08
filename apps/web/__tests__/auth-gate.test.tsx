import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const replace = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

import { AuthGate } from '@/components/auth-gate';

describe('AuthGate', () => {
  beforeEach(() => {
    replace.mockClear();
    document.cookie = 'valor_demo_auth=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
  });

  it('renders children when the demo cookie is present', async () => {
    document.cookie = 'valor_demo_auth=1; path=/';
    render(
      <AuthGate>
        <div>protected</div>
      </AuthGate>,
    );
    await waitFor(() => expect(screen.getByText('protected')).toBeInTheDocument());
    expect(replace).not.toHaveBeenCalled();
  });

  it('redirects to /login and hides children when the cookie is absent', async () => {
    render(
      <AuthGate>
        <div>protected</div>
      </AuthGate>,
    );
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'));
    expect(screen.queryByText('protected')).not.toBeInTheDocument();
  });
});
