export type VendorStatus = 'active' | 'pending' | 'inactive';
export interface Contact { name: string; role: string; phone?: string; email?: string; }
export interface Vendor { id: string; name: string; category: string; status: VendorStatus; contacts: Contact[]; note?: string; }
export interface AfeLine { id: string; code: string; description: string; category: string; budget: number; actual: number; }
export interface AfeCategoryRoll { category: string; budget: number; actual: number; variance: number; }
export interface AfeSummary { totalBudget: number; totalActual: number; variance: number; byCategory: AfeCategoryRoll[]; }
export const VENDOR_STATUSES: VendorStatus[] = ['active', 'pending', 'inactive'];
export const VENDOR_CATEGORIES: string[] = ['Drilling', 'Mud', 'Cement', 'Wireline', 'Directional', 'Logistics', 'Inspection', 'Rental', 'Other'];
export const AFE_CATEGORIES: string[] = ['Drilling', 'Mud', 'Cement', 'Directional', 'Tubulars', 'Wireline', 'Logistics', 'Other'];
