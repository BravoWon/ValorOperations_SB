import type { Vendor } from './types';
export { VENDOR_STATUSES, VENDOR_CATEGORIES } from './types';

export const DEFAULT_VENDORS: Vendor[] = [
  { id: 'v-1', name: 'Drilling Contractor Inc.', category: 'Drilling',    status: 'active',  contacts: [{ name: 'Rig Manager', role: 'Operations', phone: '555-0101' }] },
  { id: 'v-2', name: 'Mud Services Co.',          category: 'Mud',         status: 'active',  contacts: [{ name: 'Mud Engineer', role: 'Field', phone: '555-0102' }] },
  { id: 'v-3', name: 'Cementing Partners',        category: 'Cement',      status: 'active',  contacts: [{ name: 'Cement Supervisor', role: 'Field', phone: '555-0103' }] },
  { id: 'v-4', name: 'Directional Services',      category: 'Directional', status: 'active',  contacts: [{ name: 'DD Coordinator', role: 'Office', phone: '555-0104' }] },
  { id: 'v-5', name: 'Wireline & Logging',        category: 'Wireline',    status: 'pending', contacts: [{ name: 'Field Engineer', role: 'Field', phone: '555-0105' }] },
  { id: 'v-6', name: 'Inspection Group',          category: 'Inspection',  status: 'active',  contacts: [{ name: 'Lead Inspector', role: 'QA', phone: '555-0106' }] },
];

export function blankVendor(seq: number): Vendor {
  return { id: `v-${seq}`, name: '', category: 'Other', status: 'pending', contacts: [], note: '' };
}
