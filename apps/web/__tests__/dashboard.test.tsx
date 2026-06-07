import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Dashboard } from '@/components/widgets/dashboard';
import { registerWidget, clearRegistry } from '@/lib/widgets/registry';

function Box({ surface }: { surface: string }) { return <div>box-{surface}</div>; }

beforeEach(() => {
  localStorage.clear(); // jsdom provides localStorage; clear so tests don't share saved layouts
  clearRegistry();
  for (const id of ['kpi-strip', 'active-jobs', 'asset-tree', 'hydraulics']) {
    registerWidget(
      { id, title: id, description: 'd', category: 'data', defaultSize: { w: 4, h: 4 } },
      Box,
    );
  }
  registerWidget(
    { id: 'extra', title: 'Extra', description: 'd', category: 'compute', defaultSize: { w: 4, h: 4 } },
    Box,
  );
});

describe('Dashboard', () => {
  // jsdom can't simulate pointer drag/resize; grid interaction is covered manually / by a future Playwright pass.
  it.todo('persists layout on drag/resize (browser-only)');

  it('renders the default widgets', async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getAllByText('box-card').length).toBe(4));
    expect(screen.getByText('hydraulics')).toBeInTheDocument();
  });

  it('adds a widget via the catalog and removes one', async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getAllByText('box-card').length).toBe(4));
    fireEvent.click(screen.getByRole('button', { name: /add widget/i }));
    fireEvent.click(screen.getByRole('button', { name: /add extra/i }));
    await waitFor(() => expect(screen.getAllByText('box-card').length).toBe(5));
    fireEvent.click(screen.getAllByLabelText(/remove hydraulics/i)[0]!);
    await waitFor(() => expect(screen.getAllByText('box-card').length).toBe(4));
  });

  it('renders the Unknown-widget fallback for an unregistered widgetId', async () => {
    localStorage.setItem(
      'valor:dashboard:user-demo',
      JSON.stringify({ id: 'd', ownerId: 'user-demo', widgets: [{ instanceId: 'x1', widgetId: 'ghost', layout: { x: 0, y: 0, w: 4, h: 4 } }] }),
    );
    render(<Dashboard />);
    await waitFor(() => expect(screen.getByText(/Unknown widget: ghost/i)).toBeInTheDocument());
  });

  it('persists only finite y values when a widget is added (no Infinity/null)', async () => {
    render(<Dashboard />);
    await waitFor(() => expect(screen.getAllByText('box-card').length).toBe(4));
    fireEvent.click(screen.getByRole('button', { name: /add widget/i }));
    fireEvent.click(screen.getByRole('button', { name: /add extra/i }));
    await waitFor(() => expect(screen.getAllByText('box-card').length).toBe(5));
    const saved = JSON.parse(localStorage.getItem('valor:dashboard:user-demo')!);
    for (const w of saved.widgets) {
      expect(Number.isFinite(w.layout.y)).toBe(true);
    }
  });
});
