import type {
  Asset,
  CasingString,
  Formation,
  Job,
  JobTemplate,
  Pad,
  Stage,
  TemplateFieldDef,
  TemplateStageDef,
  Well,
  Wellbore,
} from './types';

export const DEMO_ORG_ID = 'org-valor';
export const DEMO_USER_ID = 'user-demo';

export interface SeedData {
  assets: Asset[];
  pads: Pad[];
  wells: Well[];
  wellbores: Wellbore[];
  formations: Formation[];
  casingStrings: CasingString[];
  templates: JobTemplate[];
  templateStageDefs: TemplateStageDef[];
  templateFieldDefs: TemplateFieldDef[];
  jobs: Job[];
  stages: Stage[];
}

/** Fresh, deep-cloned seed so each MockRepository instance is isolated. */
export function createSeed(): SeedData {
  const org = DEMO_ORG_ID;

  const assets: Asset[] = [
    { id: 'asset-ross', orgId: org, name: 'Ross County Field', region: 'Appalachia / Ohio' },
  ];

  const pads: Pad[] = [
    { id: 'pad-1', orgId: org, assetId: 'asset-ross', name: 'Lease Free Pad', surfaceLat: 39.3664747, surfaceLong: -83.2625135 },
  ];

  const wells: Well[] = [
    {
      id: 'well-lf1', orgId: org, padId: 'pad-1', name: 'Lease Free #1',
      apiNumber: '34-141-2-0059-00-00', permitNumber: 'PR2026032400122',
      state: 'Ohio', county: 'Ross', township: 'Buckskin', section: 'VMS 2309',
      surfaceLat: 39.3664747, surfaceLong: -83.2625135,
      groundElevFt: 906, kbHeightFt: 8, status: 'permitted',
    },
  ];

  const wellbores: Wellbore[] = [
    { id: 'wb-lf1', orgId: org, wellId: 'well-lf1', designation: 'Original Hole', totalMdFt: 2000, totalTvdFt: 2000, type: 'vertical' },
  ];

  const formations: Formation[] = [
    { id: 'fm-1', orgId: org, wellboreId: 'wb-lf1', name: 'Ohio Shale', topMdFt: 130, bottomMdFt: 268, targetZone: false, sortOrder: 1 },
    { id: 'fm-2', orgId: org, wellboreId: 'wb-lf1', name: 'Packer Shell', topMdFt: 268, bottomMdFt: 716, targetZone: false, sortOrder: 2 },
    { id: 'fm-3', orgId: org, wellboreId: 'wb-lf1', name: 'Trenton Limestone', topMdFt: 1944, bottomMdFt: 2114, targetZone: true, sortOrder: 3 },
    { id: 'fm-4', orgId: org, wellboreId: 'wb-lf1', name: 'Black River Group', topMdFt: 2114, bottomMdFt: 2458, targetZone: false, sortOrder: 4 },
  ];

  const casingStrings: CasingString[] = [
    { id: 'csg-1', orgId: org, wellboreId: 'wb-lf1', stringType: 'conductor', holeDiaIn: 17.5, setMdFt: 114, csgOdIn: 13.375, csgIdIn: 12.615, weightPpf: 54, grade: 'J-55', connection: '8rd', tocFt: 0, cementWeightPpg: 15.7, cementSacks: 125, sortOrder: 1 },
    { id: 'csg-2', orgId: org, wellboreId: 'wb-lf1', stringType: 'surface', holeDiaIn: 12.25, setMdFt: 359, csgOdIn: 7, csgIdIn: 6.366, weightPpf: 23, grade: 'J-55', connection: '8rd', tocFt: 0, cementWeightPpg: 15.7, cementSacks: 266, sortOrder: 2 },
    { id: 'csg-3', orgId: org, wellboreId: 'wb-lf1', stringType: 'production', holeDiaIn: 6, setMdFt: 2000, csgOdIn: 4.5, csgIdIn: 3.875, weightPpf: 11.6, grade: 'L-80', connection: '8rd', tocFt: 0, cementWeightPpg: 12, cementSacks: 765, sortOrder: 3 },
  ];

  const templates: JobTemplate[] = [
    { id: 'tmpl-drill-vert', orgId: org, name: 'Vertical Well — Drill & Case', jobType: 'drilling', version: 1, isActive: true },
  ];

  const templateStageDefs: TemplateStageDef[] = [
    { id: 'tsd-1', templateId: 'tmpl-drill-vert', name: 'Conductor', stageType: 'drill_case', defaultSortOrder: 10 },
    { id: 'tsd-2', templateId: 'tmpl-drill-vert', name: 'Surface', stageType: 'drill_case', defaultSortOrder: 20 },
    { id: 'tsd-3', templateId: 'tmpl-drill-vert', name: 'Production', stageType: 'drill_case', defaultSortOrder: 30 },
  ];

  const templateFieldDefs: TemplateFieldDef[] = [
    { id: 'tfd-1', templateId: 'tmpl-drill-vert', scope: 'job', key: 'target_wob', label: 'Target WOB', dataType: 'number', unit: 'klbf', minValue: 0, maxValue: 60, required: false, sortOrder: 1 },
    { id: 'tfd-2', templateId: 'tmpl-drill-vert', scope: 'job', key: 'target_rop', label: 'Target ROP', dataType: 'number', unit: 'ft/hr', minValue: 0, maxValue: 300, required: false, sortOrder: 2 },
    { id: 'tfd-3', templateId: 'tmpl-drill-vert', scope: 'job', key: 'spud_mud_weight', label: 'Spud Mud Weight', dataType: 'number', unit: 'ppg', minValue: 8, maxValue: 18, required: false, sortOrder: 3 },
    { id: 'tfd-4', templateId: 'tmpl-drill-vert', scope: 'stage', key: 'depth_in', label: 'Depth In', dataType: 'number', unit: 'ft', required: false, sortOrder: 1 },
    { id: 'tfd-5', templateId: 'tmpl-drill-vert', scope: 'stage', key: 'depth_out', label: 'Depth Out', dataType: 'number', unit: 'ft', required: false, sortOrder: 2 },
  ];

  const jobs: Job[] = [
    { id: 'job-1', orgId: org, wellId: 'well-lf1', wellboreId: 'wb-lf1', templateId: 'tmpl-drill-vert', name: 'Conductor & Surface Drilling', jobType: 'drilling', status: 'executing', afeNumber: 'AFE-2026-014', createdBy: DEMO_USER_ID },
    { id: 'job-2', orgId: org, wellId: 'well-lf1', wellboreId: 'wb-lf1', templateId: 'tmpl-drill-vert', name: 'Production Hole — Air Drill', jobType: 'drilling', status: 'planned', afeNumber: 'AFE-2026-021', createdBy: DEMO_USER_ID },
    { id: 'job-3', orgId: org, wellId: 'well-lf1', wellboreId: 'wb-lf1', templateId: 'tmpl-drill-vert', name: 'Rig Up & Mobilization', jobType: 'drilling', status: 'mobilized', afeNumber: 'AFE-2026-009', createdBy: DEMO_USER_ID },
  ];

  // Seeded jobs intentionally have no stages — stages are created only via createJobFromTemplate.
  const stages: Stage[] = [];

  return {
    assets, pads, wells, wellbores, formations, casingStrings,
    templates, templateStageDefs, templateFieldDefs, jobs, stages,
  };
}
