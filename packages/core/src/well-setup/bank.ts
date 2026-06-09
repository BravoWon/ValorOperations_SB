import { asTrimmed } from '../internal/coerce';

export interface BankCode {
  code: string;        // selected code, e.g. 'DRL'
  label: string;       // human label
  category: string;    // 'Make Hole' | 'Pipe Movement' | 'Casing/Cement' | 'Pressure/BOP' | 'Evaluation' | 'Trouble (NPT)' | 'Service'
  npt: boolean;        // true = non-productive time
  billable: boolean;
}

export const BANK_SEED: BankCode[] = [
  { code: 'DRL', label: 'Drilling', category: 'Make Hole', npt: false, billable: true },
  { code: 'CONN', label: 'Connection', category: 'Make Hole', npt: false, billable: true },
  { code: 'REAM', label: 'Reaming', category: 'Make Hole', npt: false, billable: true },
  { code: 'TIH', label: 'Tripping In', category: 'Pipe Movement', npt: false, billable: true },
  { code: 'TOH', label: 'Tripping Out', category: 'Pipe Movement', npt: false, billable: true },
  { code: 'CIRC', label: 'Circulating', category: 'Make Hole', npt: false, billable: true },
  { code: 'CSG', label: 'Run Casing', category: 'Casing/Cement', npt: false, billable: true },
  { code: 'CMT', label: 'Cementing', category: 'Casing/Cement', npt: false, billable: true },
  { code: 'WOC', label: 'Wait on Cement', category: 'Casing/Cement', npt: false, billable: true },
  { code: 'BOP', label: 'Nipple Up / Test BOP', category: 'Pressure/BOP', npt: false, billable: true },
  { code: 'SVY', label: 'Survey / Directional', category: 'Evaluation', npt: false, billable: true },
  { code: 'RIGREP', label: 'Rig Repair', category: 'Trouble (NPT)', npt: true, billable: false },
  { code: 'STUCK', label: 'Stuck Pipe', category: 'Trouble (NPT)', npt: true, billable: false },
  { code: 'WOW', label: 'Wait on Weather', category: 'Trouble (NPT)', npt: true, billable: false },
];

export function findBankCode(code: string): BankCode | undefined {
  return BANK_SEED.find((b) => b.code === code);
}
export function listBankByCategory(category: string): BankCode[] {
  return BANK_SEED.filter((b) => b.category === category);
}
export const BANK_CATEGORIES: string[] = [...new Set(BANK_SEED.map((b) => b.category))];

/**
 * Advisory validation for an edited Bank catalog. Never throws; returns warnings[].
 * Fields are coerced defensively because the catalog can be loaded from untrusted
 * persisted JSON (localStorage / snapshot import) where a value may not be a string.
 */
export function validateBankCodes(codes: BankCode[]): string[] {
  const warnings: string[] = [];
  // Per-row empties, in array order.
  for (const c of codes) {
    const code = asTrimmed(c.code);
    if (!code) warnings.push('Code cannot be empty.');
    if (!asTrimmed(c.label)) warnings.push(`${code || '(unnamed)'}: label cannot be empty.`);
  }
  // Duplicate codes (case-insensitive, trimmed), reported in first-seen order.
  const counts = new Map<string, { display: string; n: number }>();
  for (const c of codes) {
    const code = asTrimmed(c.code);
    if (!code) continue;
    const key = code.toLowerCase();
    const entry = counts.get(key);
    if (entry) entry.n += 1;
    // First-seen spelling wins for `display`; codes are folded case-insensitively for the key.
    else counts.set(key, { display: code, n: 1 });
  }
  for (const { display, n } of counts.values()) {
    if (n > 1) warnings.push(`Duplicate code "${display}" (${n}×).`);
  }
  return warnings;
}
