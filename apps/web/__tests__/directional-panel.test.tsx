import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DEFAULT_SURVEY } from '@valor/core';
import { DirectionalPanel } from '@/components/directional-panel';

describe('DirectionalPanel', () => {
  it('renders one computed-trajectory row per station + the TD summary', () => {
    render(<DirectionalPanel />);
    expect(screen.getAllByTestId('traj-row')).toHaveLength(DEFAULT_SURVEY.length);
    // Summary TD (MD) reflects the deepest station.
    expect(screen.getByText('5000')).toBeInTheDocument();
  });

  it('adds and removes survey stations', () => {
    render(<DirectionalPanel />);
    const start = DEFAULT_SURVEY.length;

    fireEvent.click(screen.getByRole('button', { name: /add station/i }));
    expect(screen.getAllByTestId('traj-row')).toHaveLength(start + 1);

    fireEvent.click(screen.getByRole('button', { name: /remove station 1/i }));
    expect(screen.getAllByTestId('traj-row')).toHaveLength(start);
  });

  it('recomputes without crashing when a station inclination is edited', () => {
    render(<DirectionalPanel />);
    const incInput = screen.getByLabelText('Inc row 3');
    fireEvent.change(incInput, { target: { value: '0' } });
    // Full trajectory still renders, same station count.
    expect(screen.getAllByTestId('traj-row')).toHaveLength(DEFAULT_SURVEY.length);
  });
});
