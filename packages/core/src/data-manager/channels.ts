import type { ChannelDef } from './types';
export { CHANNEL_SOURCES } from './types';

export const DEFAULT_CHANNELS: ChannelDef[] = [
  { id: 'ch-1',  channelId: '0108', mnemonic: 'BDEP', label: 'Bit Depth',           unit: 'ft',     dataType: 'number', dp: 1, source: 'WITS',   min: 0,   max: 40000, enabled: true },
  { id: 'ch-2',  channelId: '0110', mnemonic: 'HDEP', label: 'Hole Depth',          unit: 'ft',     dataType: 'number', dp: 1, source: 'WITS',   min: 0,   max: 40000, enabled: true },
  { id: 'ch-3',  channelId: '0142', mnemonic: 'WOB',  label: 'Weight on Bit',       unit: 'klbf',   dataType: 'number', dp: 1, source: 'WITS',   min: 0,   max: 100,   alarmHi: 60, enabled: true },
  { id: 'ch-4',  channelId: '0113', mnemonic: 'ROP',  label: 'Rate of Penetration', unit: 'ft/hr',  dataType: 'number', dp: 1, source: 'WITS',   min: 0,   max: 500,   enabled: true },
  { id: 'ch-5',  channelId: '0120', mnemonic: 'RPM',  label: 'Rotary Speed',        unit: 'rpm',    dataType: 'number', dp: 0, source: 'WITS',   min: 0,   max: 250,   enabled: true },
  { id: 'ch-6',  channelId: '0117', mnemonic: 'TRQ',  label: 'Rotary Torque',       unit: 'kft-lb', dataType: 'number', dp: 1, source: 'WITS',   min: 0,   max: 50,    alarmHi: 40, enabled: true },
  { id: 'ch-7',  channelId: '0148', mnemonic: 'SPP',  label: 'Standpipe Pressure',  unit: 'psi',    dataType: 'number', dp: 0, source: 'WITS',   min: 0,   max: 7500,  alarmHi: 5000, enabled: true },
  { id: 'ch-8',  channelId: '0124', mnemonic: 'FLWI', label: 'Flow In',             unit: 'gpm',    dataType: 'number', dp: 0, source: 'WITS',   min: 0,   max: 1500,  enabled: true },
  { id: 'ch-9',  channelId: '0125', mnemonic: 'FLWO', label: 'Flow Out',            unit: '%',      dataType: 'number', dp: 0, source: 'WITS',   min: 0,   max: 100,   alarmLo: 20, enabled: true },
  { id: 'ch-10', channelId: '0123', mnemonic: 'SPM1', label: 'Pump 1 Strokes/min',  unit: 'spm',    dataType: 'number', dp: 0, source: 'WITS',   min: 0,   max: 200,   enabled: true },
  { id: 'ch-11', channelId: '0140', mnemonic: 'HKLD', label: 'Hookload',            unit: 'klbf',   dataType: 'number', dp: 1, source: 'WITS',   min: 0,   max: 600,   enabled: true },
  { id: 'ch-12', channelId: '0171', mnemonic: 'BPOS', label: 'Block Position',      unit: 'ft',     dataType: 'number', dp: 1, source: 'WITS',   min: 0,   max: 150,   enabled: true },
  { id: 'ch-13', channelId: '0708', mnemonic: 'MWI',  label: 'Mud Weight In',       unit: 'ppg',    dataType: 'number', dp: 1, source: 'Manual', min: 7,   max: 20,    enabled: true },
  { id: 'ch-14', channelId: '0709', mnemonic: 'MWO',  label: 'Mud Weight Out',      unit: 'ppg',    dataType: 'number', dp: 1, source: 'Manual', min: 7,   max: 20,    enabled: true },
  { id: 'ch-15', channelId: '0821', mnemonic: 'TGAS', label: 'Total Gas',           unit: '%',      dataType: 'number', dp: 2, source: 'WITS',   min: 0,   max: 100,   alarmHi: 50, enabled: true },
  { id: 'ch-16', channelId: '5716', mnemonic: 'ECD',  label: 'Equiv. Circ. Density',unit: 'ppg',    dataType: 'number', dp: 2, source: 'Calc',   min: 7,   max: 20,    enabled: true },
];

export function blankChannel(seq: number): ChannelDef {
  return { id: `ch-${seq}`, channelId: '', mnemonic: '', label: '', unit: '', dataType: 'number', dp: 2, source: 'WITS', min: 0, max: 0, enabled: true };
}

export function validateChannels(channels: ChannelDef[]): string[] {
  const warnings: string[] = [];
  const seenM = new Map<string, number>();
  const seenC = new Map<string, number>();
  for (const c of channels) {
    if (c.mnemonic.trim()) seenM.set(c.mnemonic, (seenM.get(c.mnemonic) ?? 0) + 1);
    if (c.channelId.trim()) seenC.set(c.channelId, (seenC.get(c.channelId) ?? 0) + 1);
    if (Number.isFinite(c.min) && Number.isFinite(c.max) && c.min >= c.max) {
      warnings.push(`${c.mnemonic || c.id}: min (${c.min}) must be less than max (${c.max}).`);
    }
    if (!Number.isInteger(c.dp) || c.dp < 0) warnings.push(`${c.mnemonic || c.id}: decimal places must be a non-negative integer.`);
  }
  for (const [m, n] of seenM) if (n > 1) warnings.push(`Duplicate mnemonic "${m}" (${n}×).`);
  for (const [cid, n] of seenC) if (n > 1) warnings.push(`Duplicate channel assignment "${cid}" (${n}×).`);
  return warnings;
}
