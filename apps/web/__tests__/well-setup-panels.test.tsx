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

  it('does NOT unit-convert non-length numbers (weight) when the depth unit changes', () => {
    const onChange = vi.fn();
    const { getAllByLabelText } = render(
      <WellSetupPanels setup={DEFAULT_WELL_SETUP} onChange={onChange} depthUnit="m" diaUnit="mm" />,
    );
    // Conductor weight is 54 lb/ft — must display as 54 regardless of depth/dia unit.
    const weight = getAllByLabelText(/Weight/i)[0] as HTMLInputElement;
    expect(weight.value).toBe('54');
    // Editing stores the raw value, no conversion.
    fireEvent.change(weight, { target: { value: '60' } });
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next.casings[0].weightPpf).toBe(60);
  });

  it('still converts length columns (OD) with the diameter unit', () => {
    const onChange = vi.fn();
    const { getAllByLabelText } = render(
      <WellSetupPanels setup={DEFAULT_WELL_SETUP} onChange={onChange} depthUnit="ft" diaUnit="mm" />,
    );
    // Conductor OD 13.375 in → 339.725 mm.
    const od = getAllByLabelText(/^OD$/i)[0] as HTMLInputElement;
    expect(Number(od.value)).toBeCloseTo(339.725, 1);
  });

  it('renders tubing, completions, and wellhead groups', () => {
    const onChange = vi.fn();
    const { getByText } = render(
      <WellSetupPanels setup={DEFAULT_WELL_SETUP} onChange={onChange} depthUnit="ft" diaUnit="in" />,
    );
    expect(getByText(/^Completions$/i)).toBeTruthy();
    expect(getByText(/Tubing String/i)).toBeTruthy();
    expect(getByText(/^Wellhead$/i)).toBeTruthy();
  });

  it('renders cement columns that are NOT unit-converted', () => {
    const onChange = vi.fn();
    const { getAllByLabelText } = render(
      <WellSetupPanels setup={DEFAULT_WELL_SETUP} onChange={onChange} depthUnit="m" diaUnit="mm" />,
    );
    // Production casing carries cementSacks 765 — must display as 765 regardless of units.
    const sacks = getAllByLabelText(/Cement \(sx\)/i) as HTMLInputElement[];
    expect(sacks.some((i) => i.value === '765')).toBe(true);
  });

  it('edits a completion name and stores it via onChange', () => {
    const onChange = vi.fn();
    const { getAllByLabelText } = render(
      <WellSetupPanels setup={DEFAULT_WELL_SETUP} onChange={onChange} depthUnit="ft" diaUnit="in" />,
    );
    // Completion "Name" cells (one per completion row).
    const names = getAllByLabelText(/^Name$/i);
    expect(names.length).toBeGreaterThan(0);
    fireEvent.change(names[0] as HTMLInputElement, { target: { value: 'Renamed Perfs' } });
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next.completions[0].name).toBe('Renamed Perfs');
  });

  it('adds a completion row with a deterministic comp-N id', () => {
    const onChange = vi.fn();
    const { getByText } = render(
      <WellSetupPanels setup={DEFAULT_WELL_SETUP} onChange={onChange} depthUnit="ft" diaUnit="in" />,
    );
    fireEvent.click(getByText(/Add completion/i));
    const next = onChange.mock.calls.at(-1)?.[0];
    const ids = next.completions.map((c: { id: string }) => c.id);
    expect(ids).toContain('comp-4');
    expect(next.completions.at(-1).type).toBe('perforation');
  });

  it('edits the tubing OD with diameter-unit conversion', () => {
    const onChange = vi.fn();
    const { getAllByLabelText } = render(
      <WellSetupPanels setup={DEFAULT_WELL_SETUP} onChange={onChange} depthUnit="ft" diaUnit="mm" />,
    );
    // Tubing OD 2.875 in → ~73.025 mm. The last /^OD$/ input is the tubing one.
    const ods = getAllByLabelText(/^OD$/i);
    const tubingOd = ods[ods.length - 1] as HTMLInputElement;
    expect(Number(tubingOd.value)).toBeCloseTo(73.025, 1);
    fireEvent.change(tubingOd, { target: { value: '254' } }); // 254 mm → 10 in
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next.tubing.odIn).toBeCloseTo(10, 4);
  });

  it('edits the wellhead working pressure', () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <WellSetupPanels setup={DEFAULT_WELL_SETUP} onChange={onChange} depthUnit="ft" diaUnit="in" />,
    );
    fireEvent.change(getByLabelText(/Working pressure/i), { target: { value: '7500' } });
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next.wellhead.workingPressurePsi).toBe(7500);
  });
});
