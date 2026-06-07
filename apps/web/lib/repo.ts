import { MockRepository, DEMO_ORG_ID } from '@valor/core';

let instance: MockRepository | null = null;

export function getRepo(): MockRepository {
  if (!instance) instance = new MockRepository();
  return instance;
}

export { DEMO_ORG_ID };
