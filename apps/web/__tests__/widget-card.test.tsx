import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WidgetCard } from '@/components/widgets/widget-card';

describe('WidgetCard', () => {
  it('renders the title and body', () => {
    render(<WidgetCard title="Active Jobs">body-here</WidgetCard>);
    expect(screen.getByText('Active Jobs')).toBeInTheDocument();
    expect(screen.getByText('body-here')).toBeInTheDocument();
  });

  it('calls onRemove when the remove button is clicked', () => {
    const onRemove = vi.fn();
    render(<WidgetCard title="Active Jobs" onRemove={onRemove}>x</WidgetCard>);
    fireEvent.click(screen.getByLabelText(/remove active jobs/i));
    expect(onRemove).toHaveBeenCalledOnce();
  });
});
