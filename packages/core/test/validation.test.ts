import { describe, it, expect } from 'vitest';
import { validateFieldValue } from '../src/validation';
import type { TemplateFieldDef } from '../src/types';

function def(partial: Partial<TemplateFieldDef>): TemplateFieldDef {
  return {
    id: 'fd',
    templateId: 't1',
    scope: 'job',
    key: 'k',
    label: 'Field',
    dataType: 'text',
    required: false,
    sortOrder: 0,
    ...partial,
  };
}

describe('validateFieldValue', () => {
  it('coerces a numeric string to a number', () => {
    const r = validateFieldValue(def({ dataType: 'number', label: 'Target WOB' }), '25');
    expect(r.ok).toBe(true);
    expect(r.coerced).toBe(25);
  });

  it('rejects a non-numeric value for a number field', () => {
    const r = validateFieldValue(def({ dataType: 'number' }), 'abc');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/must be a number/);
  });

  it('warns (but accepts) when above max', () => {
    const r = validateFieldValue(
      def({ dataType: 'number', label: 'Target WOB', unit: 'klbf', maxValue: 60 }),
      75,
    );
    expect(r.ok).toBe(true);
    expect(r.coerced).toBe(75);
    expect(r.warning).toMatch(/above max 60/);
  });

  it('errors when a required field is empty', () => {
    const r = validateFieldValue(def({ required: true, label: 'AFE' }), '');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/required/);
  });

  it('accepts an empty optional field', () => {
    const r = validateFieldValue(def({ required: false }), '');
    expect(r.ok).toBe(true);
    expect(r.coerced).toBeUndefined();
  });

  it('parses booleans from common strings', () => {
    expect(validateFieldValue(def({ dataType: 'bool' }), 'yes').coerced).toBe(true);
    expect(validateFieldValue(def({ dataType: 'bool' }), '0').coerced).toBe(false);
  });

  it('rejects an enum value outside its options', () => {
    const r = validateFieldValue(def({ dataType: 'enum', enumOptions: ['J-55', 'L-80'] }), 'P-110');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/one of/);
  });

  it('rejects an invalid date', () => {
    const r = validateFieldValue(def({ dataType: 'date' }), 'not-a-date');
    expect(r.ok).toBe(false);
  });
});
