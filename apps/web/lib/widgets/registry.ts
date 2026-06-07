import type { ComponentType } from 'react';
import type { WidgetDefinition } from '@valor/core';

export type WidgetSurface = 'card' | 'page';
export interface WidgetProps {
  config?: Record<string, unknown>;
  surface: WidgetSurface;
}
export type WidgetComponent = ComponentType<WidgetProps>;

export interface RegistryEntry {
  def: WidgetDefinition;
  Component: WidgetComponent;
}

const registry = new Map<string, RegistryEntry>();

export function registerWidget(def: WidgetDefinition, Component: WidgetComponent): void {
  registry.set(def.id, { def, Component });
}
export function getWidget(id: string): RegistryEntry | undefined {
  return registry.get(id);
}
export function listWidgets(): WidgetDefinition[] {
  return [...registry.values()].map((e) => e.def);
}
/** Test-only: reset the module-global registry between tests. */
export function clearRegistry(): void {
  registry.clear();
}
