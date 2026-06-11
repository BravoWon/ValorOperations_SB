import { it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const { signInWithMicrosoft, supabaseConfigured } = vi.hoisted(() => ({
  signInWithMicrosoft: vi.fn(async () => ({ error: null })),
  supabaseConfigured: vi.fn(() => true),
}));
vi.mock('@/lib/auth', () => ({ signInWithMicrosoft }));
vi.mock('@/lib/supabase/config', () => ({ supabaseConfigured: () => supabaseConfigured() }));

import LoginPage from '@/app/login/page';

beforeEach(() => { signInWithMicrosoft.mockClear(); supabaseConfigured.mockReturnValue(true); });

it('shows the Microsoft button and starts SSO on click when configured', () => {
  render(<LoginPage />);
  const btn = screen.getByRole('button', { name: /sign in with microsoft/i });
  fireEvent.click(btn);
  expect(signInWithMicrosoft).toHaveBeenCalledWith('/');
});

it('shows the demo affordance when Supabase is not configured', () => {
  supabaseConfigured.mockReturnValue(false);
  render(<LoginPage />);
  expect(screen.getByRole('button', { name: /continue \(demo mode\)/i })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /sign in with microsoft/i })).not.toBeInTheDocument();
});
