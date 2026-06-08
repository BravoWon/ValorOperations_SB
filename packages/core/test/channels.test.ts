import { describe, it, expect } from 'vitest';
import { DEFAULT_CHANNELS, validateChannels, blankChannel, CHANNEL_SOURCES } from '../src/data-manager/channels';

describe('channels', () => {
  it('seed has unique mnemonics + channelIds', () => {
    expect(new Set(DEFAULT_CHANNELS.map((c) => c.mnemonic)).size).toBe(DEFAULT_CHANNELS.length);
    expect(new Set(DEFAULT_CHANNELS.map((c) => c.channelId)).size).toBe(DEFAULT_CHANNELS.length);
  });
  it('exposes the source set', () => { expect(CHANNEL_SOURCES).toContain('WITS'); });
  it('validate flags duplicate mnemonic', () => {
    const dup = [blankChannel(1), blankChannel(2)].map((c) => ({ ...c, mnemonic: 'X' }));
    expect(validateChannels(dup).some((w) => /mnemonic/i.test(w))).toBe(true);
  });
  it('validate flags min>=max', () => {
    const bad = [{ ...blankChannel(1), mnemonic: 'A', channelId: '1', min: 10, max: 5 }];
    expect(validateChannels(bad).some((w) => /min/i.test(w))).toBe(true);
  });
  it('blankChannel is deterministic by seq', () => {
    expect(blankChannel(3).id).toBe(blankChannel(3).id);
  });
});
