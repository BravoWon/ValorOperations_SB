import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { LocalDbWorkbench } from '@/components/local-db-workbench';

const collections = [
  { key: 'channels', label: 'Channels', count: 16 },
  { key: 'vendors', label: 'Vendors', count: 6 },
];

it('renders a row per collection and fires export', () => {
  const onExport = vi.fn(); const onImport = vi.fn(); const onReset = vi.fn();
  const { getAllByTestId, getByRole } = render(
    <LocalDbWorkbench collections={collections} onExport={onExport} onImport={onImport} onReset={onReset} />,
  );
  expect(getAllByTestId('collection-row').length).toBe(2);
  fireEvent.click(getByRole('button', { name: /export/i }));
  expect(onExport).toHaveBeenCalled();
});

describe('LocalDbWorkbench', () => {
  it('renders the correct count for each collection', () => {
    const onExport = vi.fn(); const onImport = vi.fn(); const onReset = vi.fn();
    const { getAllByTestId } = render(
      <LocalDbWorkbench collections={collections} onExport={onExport} onImport={onImport} onReset={onReset} />,
    );
    const rows = getAllByTestId('collection-row');
    expect(rows[0]?.textContent).toMatch('16');
    expect(rows[1]?.textContent).toMatch('6');
  });

  it('fires onReset when Reset button is clicked', () => {
    const onExport = vi.fn(); const onImport = vi.fn(); const onReset = vi.fn();
    const { getByRole } = render(
      <LocalDbWorkbench collections={collections} onExport={onExport} onImport={onImport} onReset={onReset} />,
    );
    fireEvent.click(getByRole('button', { name: /reset/i }));
    expect(onReset).toHaveBeenCalled();
  });

  it('renders Import button', () => {
    const onExport = vi.fn(); const onImport = vi.fn(); const onReset = vi.fn();
    const { getByRole } = render(
      <LocalDbWorkbench collections={collections} onExport={onExport} onImport={onImport} onReset={onReset} />,
    );
    expect(getByRole('button', { name: /import/i })).toBeTruthy();
  });
});
