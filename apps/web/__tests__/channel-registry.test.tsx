import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { DEFAULT_CHANNELS, CHANNEL_SOURCES } from '@valor/core';
import { ChannelRegistry } from '@/components/channel-registry';

describe('ChannelRegistry', () => {
  it('edits a mnemonic via onChange', () => {
    const onChange = vi.fn();
    const { getAllByLabelText } = render(
      <ChannelRegistry channels={DEFAULT_CHANNELS} onChange={onChange} />,
    );
    fireEvent.change(getAllByLabelText(/Mnemonic/i)[0] as HTMLInputElement, {
      target: { value: 'WOBX' },
    });
    expect(onChange).toHaveBeenCalled();
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next[0].mnemonic).toBe('WOBX');
  });

  it('filters by search', () => {
    const onChange = vi.fn();
    const { getByLabelText, getAllByTestId } = render(
      <ChannelRegistry channels={DEFAULT_CHANNELS} onChange={onChange} />,
    );
    fireEvent.change(getByLabelText(/search/i), { target: { value: 'ROP' } });
    expect(getAllByTestId('channel-row').length).toBe(1);
  });

  it('changes the source via the select', () => {
    const onChange = vi.fn();
    const { getAllByLabelText } = render(
      <ChannelRegistry channels={DEFAULT_CHANNELS} onChange={onChange} />,
    );
    const select = getAllByLabelText(/Source/i)[0] as HTMLSelectElement;
    // every source option from core should be present
    expect(select.querySelectorAll('option').length).toBe(CHANNEL_SOURCES.length);
    fireEvent.change(select, { target: { value: 'Calc' } });
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next[0].source).toBe('Calc');
  });

  it('adds a row with a non-colliding id', () => {
    const onChange = vi.fn();
    const { getByText } = render(
      <ChannelRegistry channels={DEFAULT_CHANNELS} onChange={onChange} />,
    );
    fireEvent.click(getByText(/Add channel/i));
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next.length).toBe(DEFAULT_CHANNELS.length + 1);
    // new id must not collide with any existing id
    const ids = next.map((c: { id: string }) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('removes a row', () => {
    const onChange = vi.fn();
    const { getAllByLabelText } = render(
      <ChannelRegistry channels={DEFAULT_CHANNELS} onChange={onChange} />,
    );
    fireEvent.click(getAllByLabelText(/Remove channel/i)[0] as HTMLElement);
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next.length).toBe(DEFAULT_CHANNELS.length - 1);
    const firstId = DEFAULT_CHANNELS[0]!.id;
    expect(next.some((c: { id: string }) => c.id === firstId)).toBe(false);
  });

  it('toggles enabled via the checkbox', () => {
    const onChange = vi.fn();
    const { getAllByLabelText } = render(
      <ChannelRegistry channels={DEFAULT_CHANNELS} onChange={onChange} />,
    );
    const checkbox = getAllByLabelText(/Enabled/i)[0] as HTMLInputElement;
    fireEvent.click(checkbox);
    const next = onChange.mock.calls.at(-1)?.[0];
    expect(next[0].enabled).toBe(!DEFAULT_CHANNELS[0]!.enabled);
  });
});
