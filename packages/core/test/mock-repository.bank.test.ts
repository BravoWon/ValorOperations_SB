import { describe, it, expect } from 'vitest';
import { MockRepository } from '../src/mock-repository';
import { BANK_SEED } from '../src/well-setup/bank';

describe('MockRepository bank codes', () => {
  it('null before save', async () => {
    expect(await new MockRepository().loadBankCodes()).toBeNull();
  });

  it('round-trips and returns an independent clone', async () => {
    const r = new MockRepository();
    await r.saveBankCodes(BANK_SEED);
    const loaded = await r.loadBankCodes();
    expect(loaded?.length).toBe(BANK_SEED.length);
    expect(loaded![0]!.code).toBe(BANK_SEED[0]!.code);
    loaded![0]!.code = 'MUTATED';
    const again = await r.loadBankCodes();
    expect(again![0]!.code).toBe(BANK_SEED[0]!.code);
  });

  it('resetLocalDb clears persisted bank codes (in-memory path)', async () => {
    const r = new MockRepository();
    await r.saveBankCodes(BANK_SEED);
    await r.resetLocalDb();
    expect(await r.loadBankCodes()).toBeNull();
  });

  it('round-trips bank codes through export/import snapshot', async () => {
    const a = new MockRepository();
    await a.saveBankCodes(BANK_SEED);
    const snap = await a.exportSnapshot();
    expect(snap.collections.bankCodes?.length).toBe(BANK_SEED.length);
    const b = new MockRepository();
    await b.importSnapshot(snap);
    expect((await b.loadBankCodes())?.length).toBe(BANK_SEED.length);
  });
});
