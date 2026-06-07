import type { TemplateFieldDef } from './types';

export interface FieldValidationResult {
  ok: boolean;
  coerced?: number | string | boolean;
  warning?: string;
  error?: string;
}

function isEmpty(raw: unknown): boolean {
  return raw === null || raw === undefined || raw === '';
}

export function validateFieldValue(def: TemplateFieldDef, raw: unknown): FieldValidationResult {
  if (isEmpty(raw)) {
    return def.required
      ? { ok: false, error: `${def.label} is required` }
      : { ok: true, coerced: undefined };
  }

  switch (def.dataType) {
    case 'number': {
      const n = typeof raw === 'number' ? raw : Number(String(raw).trim());
      if (Number.isNaN(n)) return { ok: false, error: `${def.label} must be a number` };
      const unit = def.unit ? ` ${def.unit}` : '';
      let warning: string | undefined;
      if (def.minValue != null && n < def.minValue) {
        warning = `${def.label} ${n}${unit} is below min ${def.minValue}`;
      }
      if (def.maxValue != null && n > def.maxValue) {
        warning = `${def.label} ${n}${unit} is above max ${def.maxValue}`;
      }
      return { ok: true, coerced: n, warning };
    }
    case 'bool': {
      if (typeof raw === 'boolean') return { ok: true, coerced: raw };
      const s = String(raw).trim().toLowerCase();
      if (['true', '1', 'yes', 'y'].includes(s)) return { ok: true, coerced: true };
      if (['false', '0', 'no', 'n'].includes(s)) return { ok: true, coerced: false };
      return { ok: false, error: `${def.label} must be true/false` };
    }
    case 'date': {
      const s = String(raw);
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return { ok: false, error: `${def.label} must be a valid date` };
      return { ok: true, coerced: s };
    }
    case 'enum': {
      const s = String(raw);
      if (def.enumOptions && !def.enumOptions.includes(s)) {
        return { ok: false, error: `${def.label} must be one of: ${def.enumOptions.join(', ')}` };
      }
      return { ok: true, coerced: s };
    }
    case 'text':
    default:
      return { ok: true, coerced: String(raw) };
  }
}
