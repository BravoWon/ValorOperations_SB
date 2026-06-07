import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WidgetCatalog } from '@/components/widgets/widget-catalog';
import { registerWidget, clearRegistry } from '@/lib/widgets/registry';

function Noop() { return null; }

describe('WidgetCatalog', () => {
  beforeEach(() => {
    clearRegistry();
    registerWidget({ id: 'a', title: 'Calc A', description: 'd', category: 'compute', defaultSize: { w: 4, h: 4 } }, Noop);
    registerWidget({ id: 'b', title: 'Data B', description: 'd', category: 'data', defaultSize: { w: 4, h: 4 } }, Noop);
  });

  it('lists registered widgets under their category headings', () => {
    render(<WidgetCatalog onAdd={() => {}} onClose={() => {}} />);
    expect(screen.getByText('Calculators')).toBeInTheDocument();
    expect(screen.getByText('Calc A')).toBeInTheDocument();
    expect(screen.getByText('Data B')).toBeInTheDocument();
  });

  it('calls onAdd with the widget id', () => {
    const onAdd = vi.fn();
    render(<WidgetCatalog onAdd={onAdd} onClose={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /add calc a/i }));
    expect(onAdd).toHaveBeenCalledWith('a');
  });
});
