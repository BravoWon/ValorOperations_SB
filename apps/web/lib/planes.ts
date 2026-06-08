// apps/web/lib/planes.ts
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard, Activity, Clock, Layers, Gauge, Compass,
  Database, Building2, BarChart3, HardDrive,
  HardHat, Eye, SlidersHorizontal, Server,
} from 'lucide-react';
import type { Role } from '@/lib/role';
import { roleSatisfies } from '@/lib/role';

export interface PlaneItem {
  href: string;
  label: string;
  icon: LucideIcon;
  minRole: Role;
}

export interface Plane {
  id: 'operate' | 'visualize' | 'administer' | 'data';
  label: string;
  icon: LucideIcon;
  items: PlaneItem[];
}

export const PLANES: Plane[] = [
  {
    id: 'operate', label: 'Operate', icon: HardHat,
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, minRole: 'viewer' },
      { href: '/jobs', label: 'Active Jobs', icon: Activity, minRole: 'field' },
      { href: '/rig-day', label: 'Rig Day', icon: Clock, minRole: 'ops' },
      { href: '/assets', label: 'Assets', icon: Layers, minRole: 'viewer' },
    ],
  },
  {
    id: 'visualize', label: 'Visualize', icon: Eye,
    items: [
      { href: '/data-studio', label: 'Data Studio', icon: BarChart3, minRole: 'viewer' },
      { href: '/tools/hydraulics', label: 'Hydraulics', icon: Gauge, minRole: 'field' },
      { href: '/tools/directional', label: 'Directional', icon: Compass, minRole: 'field' },
    ],
  },
  {
    id: 'administer', label: 'Administer', icon: SlidersHorizontal,
    items: [
      { href: '/data-manager', label: 'Data Manager', icon: Database, minRole: 'admin' },
      { href: '/office-ops', label: 'Office Ops', icon: Building2, minRole: 'admin' },
    ],
  },
  {
    id: 'data', label: 'Data', icon: Server,
    items: [
      { href: '/local-db', label: 'Local Database', icon: HardDrive, minRole: 'admin' },
    ],
  },
];

/** Planes with their items filtered to those the role may see; empty planes dropped. */
export function planesForRole(role: Role): Plane[] {
  return PLANES
    .map((p) => ({ ...p, items: p.items.filter((i) => roleSatisfies(role, i.minRole)) }))
    .filter((p) => p.items.length > 0);
}

/** Minimum role for a pathname; routes not in the registry are visible to all (viewer). */
export function minRoleForPath(pathname: string): Role {
  for (const p of PLANES) {
    for (const i of p.items) {
      if (pathname === i.href || pathname.startsWith(`${i.href}/`)) return i.minRole;
    }
  }
  return 'viewer';
}
