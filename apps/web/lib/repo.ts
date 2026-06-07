import { MockRepository, DEMO_ORG_ID } from '@valor/core';

// In-process singleton for the dev/mock data layer ONLY. The real adapter (Plan 4,
// SupabaseRepository) will be constructed per request, not held as a module singleton.
let instance: MockRepository | null = null;

export function getRepo(): MockRepository {
  if (!instance) instance = new MockRepository();
  return instance;
}

export { DEMO_ORG_ID };
