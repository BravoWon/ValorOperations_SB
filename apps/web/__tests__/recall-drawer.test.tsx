import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { RECALL_LIBRARY, findLikeItems } from '@valor/core';
import type { TimeBlock } from '@valor/core';
import { RecallDrawer } from '@/components/recall-drawer';

const block: TimeBlock = { id: 'b1', code: RECALL_LIBRARY[0]!.code, startMin: 0, endMin: 60 };

describe('RecallDrawer', () => {
  it('lists like-items and fires reuse + qc', () => {
    const onReuse = vi.fn();
    const onQc = vi.fn();
    const onClose = vi.fn();
    const { getAllByTestId, getByRole } = render(
      <RecallDrawer block={block} onReuse={onReuse} onQc={onQc} onClose={onClose} />,
    );
    expect(getAllByTestId('like-item').length).toBe(findLikeItems(block.code).length);
    fireEvent.click(getAllByTestId('reuse-btn')[0]!);
    expect(onReuse).toHaveBeenCalled();
    fireEvent.click(getByRole('button', { name: /approve/i }));
    expect(onQc).toHaveBeenCalledWith({ status: 'approved' });
  });

  it('renders nothing when no block selected', () => {
    const { container } = render(
      <RecallDrawer block={null} onReuse={vi.fn()} onQc={vi.fn()} onClose={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('prefills the QC note from an existing block.qc.note', () => {
    const qcBlock: TimeBlock = { ...block, qc: { status: 'flagged', note: 'Watch washout' } };
    const { getByLabelText } = render(
      <RecallDrawer block={qcBlock} onReuse={vi.fn()} onQc={vi.fn()} onClose={vi.fn()} />,
    );
    expect((getByLabelText(/QC note/i) as HTMLInputElement).value).toBe('Watch washout');
  });
});
