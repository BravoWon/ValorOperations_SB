import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { DEFAULT_TEMPLATE_BUNDLES, BANK_SEED } from '@valor/core';
import { TemplateBuilder } from '@/components/template-builder';

const bankCodes = BANK_SEED.map((b) => b.code);

describe('TemplateBuilder', () => {
  it('renders the template name', () => {
    const onChange = vi.fn();
    const { getByDisplayValue } = render(
      <TemplateBuilder bundles={DEFAULT_TEMPLATE_BUNDLES} bankCodes={bankCodes} onChange={onChange} />,
    );
    expect(getByDisplayValue('Vertical Well — Drill & Case')).toBeTruthy();
  });

  it('adds a stage row via onChange', () => {
    const onChange = vi.fn();
    const { getByText } = render(
      <TemplateBuilder bundles={DEFAULT_TEMPLATE_BUNDLES} bankCodes={bankCodes} onChange={onChange} />,
    );
    fireEvent.click(getByText(/Add stage/i));
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next[0].stageDefs.length).toBe(DEFAULT_TEMPLATE_BUNDLES[0]!.stageDefs.length + 1);
  });

  it('adds a field row via onChange', () => {
    const onChange = vi.fn();
    const { getByText } = render(
      <TemplateBuilder bundles={DEFAULT_TEMPLATE_BUNDLES} bankCodes={bankCodes} onChange={onChange} />,
    );
    fireEvent.click(getByText(/Add field/i));
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next[0].fieldDefs.length).toBe(DEFAULT_TEMPLATE_BUNDLES[0]!.fieldDefs.length + 1);
  });

  it('edits a field-def label via onChange', () => {
    const onChange = vi.fn();
    const { getAllByLabelText } = render(
      <TemplateBuilder bundles={DEFAULT_TEMPLATE_BUNDLES} bankCodes={bankCodes} onChange={onChange} />,
    );
    fireEvent.change(getAllByLabelText(/^Field label$/i)[0] as HTMLInputElement, { target: { value: 'Target WOB X' } });
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next[0].fieldDefs[0].label).toBe('Target WOB X');
  });

  it('removes a field row', () => {
    const onChange = vi.fn();
    const { getAllByLabelText } = render(
      <TemplateBuilder bundles={DEFAULT_TEMPLATE_BUNDLES} bankCodes={bankCodes} onChange={onChange} />,
    );
    fireEvent.click(getAllByLabelText(/Remove field/i)[0] as HTMLElement);
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next[0].fieldDefs.length).toBe(DEFAULT_TEMPLATE_BUNDLES[0]!.fieldDefs.length - 1);
  });

  it('offers bank codes as stage defaultCode datalist options', () => {
    const onChange = vi.fn();
    const { container } = render(
      <TemplateBuilder bundles={DEFAULT_TEMPLATE_BUNDLES} bankCodes={bankCodes} onChange={onChange} />,
    );
    expect(container.querySelectorAll('datalist option').length).toBe(bankCodes.length);
  });

  it('changes the template jobType via the select', () => {
    const onChange = vi.fn();
    const { getByLabelText } = render(
      <TemplateBuilder bundles={DEFAULT_TEMPLATE_BUNDLES} bankCodes={bankCodes} onChange={onChange} />,
    );
    fireEvent.change(getByLabelText(/Job type/i), { target: { value: 'completion' } });
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next[0].template.jobType).toBe('completion');
  });
});
