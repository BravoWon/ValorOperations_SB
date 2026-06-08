import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { deriveNotifications, DEFAULT_RIG_DAY } from '@valor/core';
import { NotificationsPanel } from '@/components/notifications-panel';

it('renders a row per notification', () => {
  const ns = deriveNotifications(DEFAULT_RIG_DAY);
  const { getAllByTestId } = render(<NotificationsPanel notifications={ns} />);
  expect(getAllByTestId('notification').length).toBe(ns.length);
});
it('shows an all-clear empty state', () => {
  const { getByText } = render(<NotificationsPanel notifications={[]} />);
  expect(getByText(/all clear/i)).toBeTruthy();
});
