import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import {
  DEFAULT_VENDORS,
  DEFAULT_AFE,
  summarizeAfe,
  VENDOR_CATEGORIES,
  VENDOR_STATUSES,
  AFE_CATEGORIES,
} from '@valor/core';
import { VendorDirectory } from '@/components/vendor-directory';
import { AfeTable } from '@/components/afe-table';
import { AfeSummaryStrip } from '@/components/afe-summary-strip';

describe('VendorDirectory', () => {
  it('vendor directory edits a name + filters by search', () => {
    const onChange = vi.fn();
    const { getAllByTestId, getAllByLabelText, getByLabelText } = render(
      <VendorDirectory vendors={DEFAULT_VENDORS} onChange={onChange} />,
    );
    fireEvent.change(getAllByLabelText(/Vendor name/i)[0] as HTMLInputElement, {
      target: { value: 'New Co.' },
    });
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next[0].name).toBe('New Co.');

    fireEvent.change(getByLabelText(/search/i), { target: { value: 'Mud' } });
    expect(getAllByTestId('vendor-row').length).toBe(1);
  });

  it('changes the category + status via selects', () => {
    const onChange = vi.fn();
    const { getAllByLabelText } = render(
      <VendorDirectory vendors={DEFAULT_VENDORS} onChange={onChange} />,
    );
    const cat = getAllByLabelText(/Vendor category/i)[0] as HTMLSelectElement;
    expect(cat.querySelectorAll('option').length).toBe(VENDOR_CATEGORIES.length);
    fireEvent.change(cat, { target: { value: 'Cement' } });
    expect(onChange.mock.calls.at(-1)?.[0][0].category).toBe('Cement');

    const status = getAllByLabelText(/Vendor status/i)[0] as HTMLSelectElement;
    expect(status.querySelectorAll('option').length).toBe(VENDOR_STATUSES.length);
    fireEvent.change(status, { target: { value: 'inactive' } });
    expect(onChange.mock.calls.at(-1)?.[0][0].status).toBe('inactive');
  });

  it('edits the primary contact, creating it when absent', () => {
    const onChange = vi.fn();
    const vendors = [
      { id: 'v-1', name: 'No Contact Co.', category: 'Other', status: 'active' as const, contacts: [] },
    ];
    const { getByLabelText } = render(<VendorDirectory vendors={vendors} onChange={onChange} />);
    fireEvent.change(getByLabelText(/Contact name/i), { target: { value: 'Jane' } });
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next[0].contacts.length).toBe(1);
    expect(next[0].contacts[0].name).toBe('Jane');
  });

  it('adds a vendor with a non-colliding id and removes a row', () => {
    const onChange = vi.fn();
    const { getByText, getAllByLabelText } = render(
      <VendorDirectory vendors={DEFAULT_VENDORS} onChange={onChange} />,
    );
    fireEvent.click(getByText(/Add vendor/i));
    let next = onChange.mock.calls.at(-1)?.[0];
    expect(next.length).toBe(DEFAULT_VENDORS.length + 1);
    const ids = next.map((v: { id: string }) => v.id);
    expect(new Set(ids).size).toBe(ids.length);

    fireEvent.click(getAllByLabelText(/Remove vendor/i)[0] as HTMLElement);
    next = onChange.mock.calls.at(-1)?.[0];
    expect(next.length).toBe(DEFAULT_VENDORS.length - 1);
  });
});

describe('AfeTable', () => {
  it('afe table edits a budget', () => {
    const onChange = vi.fn();
    const { getAllByLabelText } = render(<AfeTable lines={DEFAULT_AFE} onChange={onChange} />);
    fireEvent.change(getAllByLabelText(/Budget/i)[0] as HTMLInputElement, {
      target: { value: '999' },
    });
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)?.[0][0].budget).toBe(999);
  });

  it('changes the category via the select', () => {
    const onChange = vi.fn();
    const { getAllByLabelText } = render(<AfeTable lines={DEFAULT_AFE} onChange={onChange} />);
    const cat = getAllByLabelText(/AFE category/i)[0] as HTMLSelectElement;
    expect(cat.querySelectorAll('option').length).toBe(AFE_CATEGORIES.length);
    fireEvent.change(cat, { target: { value: 'Mud' } });
    expect(onChange.mock.calls.at(-1)?.[0][0].category).toBe('Mud');
  });

  it('adds a line with a non-colliding id and removes a row', () => {
    const onChange = vi.fn();
    const { getByText, getAllByLabelText } = render(
      <AfeTable lines={DEFAULT_AFE} onChange={onChange} />,
    );
    fireEvent.click(getByText(/Add line/i));
    let next = onChange.mock.calls.at(-1)?.[0];
    expect(next.length).toBe(DEFAULT_AFE.length + 1);
    const ids = next.map((l: { id: string }) => l.id);
    expect(new Set(ids).size).toBe(ids.length);

    fireEvent.click(getAllByLabelText(/Remove line/i)[0] as HTMLElement);
    next = onChange.mock.calls.at(-1)?.[0];
    expect(next.length).toBe(DEFAULT_AFE.length - 1);
  });
});

describe('AfeSummaryStrip', () => {
  it('summary strip shows totals', () => {
    const { getByText } = render(<AfeSummaryStrip summary={summarizeAfe(DEFAULT_AFE)} />);
    expect(getByText(/Variance/i)).toBeTruthy();
    expect(getByText(/Total Budget/i)).toBeTruthy();
    expect(getByText(/Total Actual/i)).toBeTruthy();
  });

  it('renders a row per category', () => {
    const summary = summarizeAfe(DEFAULT_AFE);
    const { getAllByTestId } = render(<AfeSummaryStrip summary={summary} />);
    expect(getAllByTestId('afe-cat').length).toBe(summary.byCategory.length);
  });
});
