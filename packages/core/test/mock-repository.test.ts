import { describe, it, expect } from 'vitest';
import { MockRepository } from '../src/mock-repository';
import { DEMO_ORG_ID, DEMO_USER_ID } from '../src/seed';
import { TransitionError } from '../src/transitions';

function repo() {
  return new MockRepository();
}

describe('MockRepository', () => {
  it('lists the seeded jobs for the demo org', async () => {
    const jobs = await repo().listJobs(DEMO_ORG_ID);
    expect(jobs).toHaveLength(3);
  });

  it('returns the seeded Lease Free #1 well with its API number', async () => {
    const well = await repo().getWell('well-lf1');
    expect(well?.name).toBe('Lease Free #1');
    expect(well?.apiNumber).toBe('34-141-2-0059-00-00');
  });

  it('creates a job from a template in planned status with numbered stages', async () => {
    const r = repo();
    const job = await r.createJobFromTemplate({
      orgId: DEMO_ORG_ID,
      wellId: 'well-lf1',
      wellboreId: 'wb-lf1',
      templateId: 'tmpl-drill-vert',
      name: 'New Drill Job',
      createdBy: DEMO_USER_ID,
    });
    expect(job.status).toBe('planned');

    const full = await r.getJob(job.id);
    expect(full?.stages.map((s) => s.stageNo)).toEqual([1, 2, 3]);
    expect(full?.stages.map((s) => s.name)).toEqual(['Conductor', 'Surface', 'Production']);
  });

  it('advances a legal status transition and records history', async () => {
    const r = repo();
    const job = await r.createJobFromTemplate({
      orgId: DEMO_ORG_ID, wellId: 'well-lf1', templateId: 'tmpl-drill-vert',
      name: 'X', createdBy: DEMO_USER_ID,
    });
    const updated = await r.advanceJobStatus(job.id, 'mobilized', DEMO_USER_ID);
    expect(updated.status).toBe('mobilized');

    const full = await r.getJob(job.id);
    expect(full?.statusHistory.at(-1)).toMatchObject({ fromStatus: 'planned', toStatus: 'mobilized' });
  });

  it('rejects an illegal status transition', async () => {
    const r = repo();
    const job = await r.createJobFromTemplate({
      orgId: DEMO_ORG_ID, wellId: 'well-lf1', templateId: 'tmpl-drill-vert',
      name: 'Y', createdBy: DEMO_USER_ID,
    });
    await expect(r.advanceJobStatus(job.id, 'executing', DEMO_USER_ID)).rejects.toThrow(TransitionError);
  });

  it('isolates state between instances', async () => {
    const a = repo();
    await a.createJobFromTemplate({
      orgId: DEMO_ORG_ID, wellId: 'well-lf1', templateId: 'tmpl-drill-vert',
      name: 'Z', createdBy: DEMO_USER_ID,
    });
    const b = repo();
    expect(await b.listJobs(DEMO_ORG_ID)).toHaveLength(3);
  });
});
