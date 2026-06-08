import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DEFAULT_RIG_DAY, deriveProgress } from '@valor/core';
import { RigDayLanes } from '@/components/rig-day-lanes';

describe('RigDayLanes', () => {
  it('renders a bar per person + equipment and a progress path', () => {
    const { getAllByTestId, container } = render(
      <RigDayLanes day={DEFAULT_RIG_DAY} progress={deriveProgress(DEFAULT_RIG_DAY.blocks)} />,
    );
    expect(getAllByTestId('person-item').length).toBe((DEFAULT_RIG_DAY.people ?? []).length);
    expect(getAllByTestId('equipment-item').length).toBe((DEFAULT_RIG_DAY.equipment ?? []).length);
    expect(container.querySelector('[data-testid="progress-path"]')).toBeTruthy();
  });

  it('shows an empty progress state when there are no depth points', () => {
    const { container, getByText } = render(
      <RigDayLanes
        day={{ id: 'x', label: 'Empty', blocks: [], people: [], equipment: [] }}
        progress={[]}
      />,
    );
    expect(container.querySelector('[data-testid="progress-path"]')).toBeNull();
    expect(getByText(/no depth/i)).toBeTruthy();
  });
});
