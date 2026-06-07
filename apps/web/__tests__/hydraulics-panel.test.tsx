import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HYDRAULICS_FIELDS, HYDRAULICS_OUTPUTS } from '@valor/core';
import { HydraulicsPanel } from '@/components/hydraulics-panel';

describe('HydraulicsPanel', () => {
  it('renders every input (labelled) and every output row', () => {
    render(<HydraulicsPanel />);
    for (const f of HYDRAULICS_FIELDS) {
      // each input is reachable by its label text (proves htmlFor/id association).
      // Escape regex special chars so labels like "Measured depth (MD)" don't throw.
      const escaped = f.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expect(screen.getByLabelText(new RegExp(escaped, 'i'))).toBeInTheDocument();
    }
    for (const o of HYDRAULICS_OUTPUTS) {
      expect(screen.getByText(o.label)).toBeInTheDocument();
    }
  });

  it('never renders the literal "NaN" when an input is cleared', () => {
    render(<HydraulicsPanel />);
    const input = screen.getByLabelText(/Hole diameter/i);
    fireEvent.change(input, { target: { value: '' } });
    expect(document.body.textContent).not.toMatch(/NaN/);
  });

  it('surfaces a warning when hole diameter does not exceed pipe OD', () => {
    render(<HydraulicsPanel />);
    const hole = screen.getByLabelText(/Hole diameter/i);
    fireEvent.change(hole, { target: { value: '4' } }); // pipe OD default is 5
    expect(screen.getByText(/exceed pipe OD/i)).toBeInTheDocument();
  });

  it('surfaces a soft out-of-range warning for an over-max input', () => {
    render(<HydraulicsPanel />);
    const spm = screen.getByLabelText(/Pump speed/i);
    fireEvent.change(spm, { target: { value: '500' } }); // max is 200
    expect(screen.getByText(/above the expected maximum/i)).toBeInTheDocument();
  });
});
