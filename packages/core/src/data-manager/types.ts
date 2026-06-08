export type ChannelSource = 'WITS' | 'LAS' | 'Manual' | 'Calc';
export type ChannelDataType = 'number' | 'text';
export interface ChannelDef {
  id: string;
  channelId: string;   // assigned incoming wire/source channel (editable)
  mnemonic: string;    // editable short code
  label: string;
  unit: string;
  dataType: ChannelDataType;
  dp: number;
  source: ChannelSource;
  min: number; max: number;
  alarmLo?: number; alarmHi?: number;
  enabled: boolean;
}
export const CHANNEL_SOURCES: ChannelSource[] = ['WITS', 'LAS', 'Manual', 'Calc'];
