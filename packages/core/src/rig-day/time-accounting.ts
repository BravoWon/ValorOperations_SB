import { DAY_MINUTES } from './types';
export { DAY_MINUTES };
export function snapTo5(min: number): number {
  if (!Number.isFinite(min)) return 0;
  const clamped = Math.max(0, Math.min(DAY_MINUTES, min));
  return Math.round(clamped / 5) * 5;
}
