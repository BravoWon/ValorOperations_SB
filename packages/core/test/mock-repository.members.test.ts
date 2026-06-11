import { describe, it, expect } from 'vitest';
import { MockRepository } from '../src/mock-repository';
import { DEMO_ORG_ID } from '../src/seed';

describe('MockRepository — members', () => {
  it('lists the seeded demo members sorted by createdAt', async () => {
    const members = await new MockRepository().listOrgMembers(DEMO_ORG_ID);
    expect(members.map((m) => m.role)).toEqual(['owner', 'admin', 'viewer']);
    expect(members[0]!.email).toBe('owner@valor.demo');
  });

  it('returns [] for an unknown org', async () => {
    expect(await new MockRepository().listOrgMembers('nope')).toEqual([]);
  });

  it('invite adds a new email and is case-insensitive on the repeat', async () => {
    const repo = new MockRepository();
    expect(await repo.inviteMember(DEMO_ORG_ID, 'new@x.com', 'viewer')).toBe('added');
    expect(await repo.inviteMember(DEMO_ORG_ID, 'NEW@x.com', 'viewer')).toBe('already_member');
    expect((await repo.listOrgMembers(DEMO_ORG_ID)).some((m) => m.email === 'new@x.com')).toBe(true);
  });

  it('setMemberRole changes a role but refuses to demote the last owner', async () => {
    const repo = new MockRepository();
    await repo.setMemberRole(DEMO_ORG_ID, 'demo-viewer', 'admin');
    expect((await repo.listOrgMembers(DEMO_ORG_ID)).find((m) => m.userId === 'demo-viewer')?.role).toBe('admin');
    await expect(repo.setMemberRole(DEMO_ORG_ID, 'demo-owner', 'viewer')).rejects.toThrow(/last owner/);
  });

  it('removeMember deletes a member but refuses to remove the last owner', async () => {
    const repo = new MockRepository();
    await repo.removeMember(DEMO_ORG_ID, 'demo-viewer');
    expect((await repo.listOrgMembers(DEMO_ORG_ID)).some((m) => m.userId === 'demo-viewer')).toBe(false);
    await expect(repo.removeMember(DEMO_ORG_ID, 'demo-owner')).rejects.toThrow(/last owner/);
  });
});
