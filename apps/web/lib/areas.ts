import type { ComponentType } from 'react';
import { HardHat, Building2, Database, BarChart3 } from 'lucide-react';

/**
 * Workspace registry for the Valor Operations Hub launcher.
 *
 * Each "area" is a top-level workspace. Today only Field Operations is `active`
 * (it wraps the existing hub at /dashboard); the rest are `soon` placeholders
 * that render a branded coming-soon screen so the whole intended system can be
 * walked end-to-end and error-punchlisted.
 */
export type AreaStatus = 'active' | 'soon';

export interface AreaDef {
  id: string;
  title: string;
  tagline: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
  status: AreaStatus;
  href: string;
  capabilities: string[];
}

export const AREAS: AreaDef[] = [
  {
    id: 'field-operations',
    title: 'Field Operations',
    tagline: 'On-site execution',
    status: 'active',
    href: '/dashboard',
    icon: HardHat,
    description:
      'Job setup, execution & stage tracking, the superintendent’s dashboard, asset hierarchy, and field calculators.',
    capabilities: [
      'Composable operations dashboard',
      'Active jobs by lifecycle phase',
      'Asset hierarchy (fields → pads → wells)',
      'Well detail: formations & casing',
      'Hydraulics & circulation calculator',
    ],
  },
  {
    id: 'office-ops',
    title: 'Office Ops',
    tagline: 'Back-office consolidation',
    status: 'active',
    href: '/office-ops',
    icon: Building2,
    description:
      'Business & operations consolidation — AFE/cost tracking, vendors & contacts, scheduling, and reporting.',
    capabilities: [
      'AFE & cost tracking',
      'Vendors & contacts',
      'Scheduling & logistics',
      'Daily/weekly reporting',
      'Document consolidation',
    ],
  },
  {
    id: 'data-manager',
    title: 'Data Manager',
    tagline: 'Field data pipeline',
    status: 'active',
    href: '/data-manager',
    icon: Database,
    description:
      'Ingest & manage field data — EDR/WITS/LAS channels, documents, and an editable channel registry.',
    capabilities: [
      'EDR/WITS/LAS ingestion',
      'Editable mnemonic & channel assignment',
      'Units, precision & calibration',
      'Document & file management',
      'Data quality & provenance',
    ],
  },
  {
    id: 'data-studio',
    title: 'Data Studio',
    tagline: 'Analytics & visualization',
    status: 'soon',
    href: '/data-studio',
    icon: BarChart3,
    description:
      'Analytics & visualization — operational dashboards and Power BI-style exploration of operational data.',
    capabilities: [
      'Operational KPIs & trends',
      'Power BI-style exploration',
      'NPT & performance analytics',
      'Cross-asset roll-ups',
    ],
  },
];

export const getArea = (id: string) => AREAS.find((a) => a.id === id);
