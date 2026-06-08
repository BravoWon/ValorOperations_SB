import { describe, it, expect } from 'vitest';
import { MockRepository } from '../src/mock-repository';
import { DEFAULT_CHANNELS } from '../src/data-manager/channels';

describe('MockRepository channels', () => {
  it('null before save', async () => { expect(await new MockRepository().loadChannels()).toBeNull(); });
  it('round-trips', async () => {
    const r = new MockRepository(); await r.saveChannels(DEFAULT_CHANNELS);
    expect((await r.loadChannels())?.length).toBe(DEFAULT_CHANNELS.length);
  });
});
