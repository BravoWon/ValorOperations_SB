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
    expect(getByText('Production')).toBeTruthy();
    expect(getByText('Target Sand')).toBeTruthy();
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

  it('renders tubing, a perforation, and a wellhead element', () => {
    const model = projectWellbore(DEFAULT_WELL_SETUP);
    const { container, getByText } = render(
      <WellboreSchematic model={model} depthUnit="ft" diaUnit="in" />,
    );
    expect(container.querySelector('[data-testid="tubing"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="completion-perforation"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="completion-packer"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="completion-sssv"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="wellhead"]')).toBeTruthy();
    expect(getByText(/Target Sand Perfs/)).toBeTruthy();
  });

  it('renders a cement annulus shade with a sacks label', () => {
    const model = projectWellbore(DEFAULT_WELL_SETUP);
    const { container, getByText } = render(
      <WellboreSchematic model={model} depthUnit="ft" diaUnit="in" />,
    );
    expect(container.querySelector('[data-testid="cement"]')).toBeTruthy();
    expect(getByText(/765 sx/)).toBeTruthy();
  });

  it('omits new elements when their data is absent (back-compat)', () => {
    const bare = projectWellbore({
      header: { ...DEFAULT_WELL_SETUP.header },
      casings: DEFAULT_WELL_SETUP.casings.map((c) => ({
        ...c,
        cementSacks: undefined,
        cementLeadPpg: undefined,
        cementTailPpg: undefined,
      })),
      holes: DEFAULT_WELL_SETUP.holes,
      formations: DEFAULT_WELL_SETUP.formations,
    });
    const { container } = render(
      <WellboreSchematic model={bare} depthUnit="ft" diaUnit="in" />,
    );
    expect(container.querySelector('[data-testid="tubing"]')).toBeFalsy();
    expect(container.querySelector('[data-testid="wellhead"]')).toBeFalsy();
    expect(container.querySelector('[data-testid="cement"]')).toBeFalsy();
    expect(container.querySelector('svg')).toBeTruthy();
  });
});
