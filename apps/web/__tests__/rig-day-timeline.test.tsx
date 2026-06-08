import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DEFAULT_RIG_DAY } from '@valor/core';
import { RigDayTimeline } from '@/components/rig-day-timeline';

describe('RigDayTimeline', () => {
  it('renders a track with a block per entry', () => {
    const { container, getAllByTestId } = render(<RigDayTimeline day={DEFAULT_RIG_DAY} />);
    expect(container.querySelector('[data-testid="rig-day-track"]')).toBeTruthy();
    expect(getAllByTestId('rig-block').length).toBe(DEFAULT_RIG_DAY.blocks.length);
  });
});
