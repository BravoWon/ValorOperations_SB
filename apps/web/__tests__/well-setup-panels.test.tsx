import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { DEFAULT_WELL_SETUP } from '@valor/core';
import { WellSetupPanels } from '@/components/well-setup-panels';

describe('WellSetupPanels', () => {
  it('edits the well name via onChange', () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <WellSetupPanels setup={DEFAULT_WELL_SETUP} onChange={onChange} depthUnit="ft" diaUnit="in" />,
    );
    fireEvent.change(getByLabelText(/Well name/i), { target: { value: 'New Name' } });
    expect(onChange).toHaveBeenCalled();
  });

  it('renders Bank codes in the job-code picker', () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <WellSetupPanels setup={DEFAULT_WELL_SETUP} onChange={onChange} depthUnit="ft" diaUnit="in" />,
    );
    const select = getByLabelText(/Job code/i) as HTMLSelectElement;
    expect(select.querySelectorAll('option').length).toBeGreaterThan(3);
  });

  it('converts a number field back to canonical via convertLength', () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <WellSetupPanels setup={DEFAULT_WELL_SETUP} onChange={onChange} depthUnit="ft" diaUnit="mm" />,
    );
    // Diameter is canonical inches; displayed in mm. 254 mm → 10 in.
    fireEvent.change(getByLabelText(/Diameter/i), { target: { value: '254' } });
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next.header.diameterIn).toBeCloseTo(10, 5);
  });
});
