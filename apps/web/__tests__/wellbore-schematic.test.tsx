import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { projectWellbore, DEFAULT_WELL_SETUP } from '@valor/core';
import { WellboreSchematic } from '@/components/wellbore-schematic';

describe('WellboreSchematic', () => {
  it('renders a casing label and a formation name', () => {
    const model = projectWellbore(DEFAULT_WELL_SETUP);
    const { container, getByText } = render(
      <WellboreSchematic model={model} depthUnit="ft" diaUnit="in" />,
    );
    expect(container.querySelector('svg')).toBeTruthy();
    expect(getByText(/Production/)).toBeTruthy();
    expect(getByText(/Target Sand/)).toBeTruthy();
  });

  it('exposes a viewBox', () => {
    const model = projectWellbore(DEFAULT_WELL_SETUP);
    const { container } = render(
      <WellboreSchematic model={model} depthUnit="ft" diaUnit="in" />,
    );
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBeTruthy();
  });

  it('renders gracefully when totalDepthFt is 0', () => {
    const empty = projectWellbore({
      header: { ...DEFAULT_WELL_SETUP.header, jobCode: 'DRL' },
      casings: [],
      holes: [],
      formations: [],
    });
    const { container } = render(
      <WellboreSchematic model={empty} depthUnit="ft" diaUnit="in" />,
    );
    expect(container.querySelector('svg')).toBeTruthy();
  });
});
