import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { DEFAULT_RIG_DAY } from '@valor/core';
import { RigDayTimeline } from '@/components/rig-day-timeline';

describe('RigDayTimeline', () => {
  it('renders a track with a block per entry', () => {
    const { container, getAllByTestId } = render(<RigDayTimeline day={DEFAULT_RIG_DAY} />);
    expect(container.querySelector('[data-testid="rig-day-track"]')).toBeTruthy();
    expect(getAllByTestId('rig-block').length).toBe(DEFAULT_RIG_DAY.blocks.length);
  });

  it('fires onSelect when a block is clicked', () => {
    const onSelect = vi.fn();
    const { getAllByTestId } = render(<RigDayTimeline day={DEFAULT_RIG_DAY} onSelect={onSelect} />);
    fireEvent.click(getAllByTestId('rig-block')[0]!);
    expect(onSelect).toHaveBeenCalled();
  });
});
