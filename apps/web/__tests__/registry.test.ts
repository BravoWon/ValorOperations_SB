import { describe, it, expect, beforeEach } from 'vitest';
import { registerWidget, getWidget, listWidgets, clearRegistry } from '@/lib/widgets/registry';
import type { WidgetDefinition } from '@valor/core';

const def: WidgetDefinition = {
  id: 'demo', title: 'Demo', description: 'd', category: 'data', defaultSize: { w: 4, h: 4 },
};
function Demo() { return null; }

describe('widget registry', () => {
  beforeEach(() => clearRegistry());

  it('registers and looks up a widget', () => {
    registerWidget(def, Demo);
    expect(getWidget('demo')?.def.title).toBe('Demo');
    expect(getWidget('demo')?.Component).toBe(Demo);
  });

  it('lists registered widget definitions', () => {
    registerWidget(def, Demo);
    expect(listWidgets().map((d) => d.id)).toEqual(['demo']);
  });

  it('returns undefined for an unknown id', () => {
    expect(getWidget('nope')).toBeUndefined();
  });
});
