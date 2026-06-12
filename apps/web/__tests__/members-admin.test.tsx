import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';

const { listOrgMembers, setMemberRole, removeMember, inviteMember } = vi.hoisted(() => ({
  listOrgMembers: vi.fn(),
  setMemberRole: vi.fn(),
  removeMember: vi.fn(),
  inviteMember: vi.fn(),
}));
vi.mock('@/lib/repo', () => ({
  DEMO_ORG_ID: 'org-demo',
  getRepo: () => ({ listOrgMembers, setMemberRole, removeMember, inviteMember }),
}));
vi.mock('@/components/active-org-provider', () => ({ useActiveOrg: () => null }));

import { MembersAdmin } from '@/components/members-admin';

const SEED = [
  { userId: 'u-owner', email: 'owner@valor.demo', role: 'owner', createdAt: '2099-01-01T00:00:00.000Z' },
  { userId: 'u-viewer', email: 'viewer@valor.demo', role: 'viewer', createdAt: '2099-01-01T00:00:00.000Z' },
];

beforeEach(() => {
  listOrgMembers.mockReset().mockResolvedValue(SEED);
  setMemberRole.mockReset().mockResolvedValue(undefined);
  removeMember.mockReset().mockResolvedValue(undefined);
  inviteMember.mockReset().mockResolvedValue('added');
});

describe('MembersAdmin', () => {
  it('lists members on mount, scoped to DEMO_ORG_ID in mock mode', async () => {
    render(<MembersAdmin />);
    await waitFor(() => expect(screen.getByText('owner@valor.demo')).toBeInTheDocument());
    expect(screen.getByText('viewer@valor.demo')).toBeInTheDocument();
    expect(listOrgMembers).toHaveBeenCalledWith('org-demo');
  });

  it('changes a role and refetches', async () => {
    render(<MembersAdmin />);
    await waitFor(() => screen.getByText('viewer@valor.demo'));
    fireEvent.change(screen.getByLabelText('Role for viewer@valor.demo'), { target: { value: 'admin' } });
    await waitFor(() => expect(setMemberRole).toHaveBeenCalledWith('org-demo', 'u-viewer', 'admin'));
    await waitFor(() => expect(listOrgMembers).toHaveBeenCalledTimes(2)); // mount + refetch
  });

  it('removes a member and refetches', async () => {
    render(<MembersAdmin />);
    await waitFor(() => screen.getByText('viewer@valor.demo'));
    fireEvent.click(screen.getByLabelText('Remove viewer@valor.demo'));
    await waitFor(() => expect(removeMember).toHaveBeenCalledWith('org-demo', 'u-viewer'));
    await waitFor(() => expect(listOrgMembers).toHaveBeenCalledTimes(2)); // mount + refetch
  });

  it('does not special-case the own/owner row (actions enabled)', async () => {
    render(<MembersAdmin />);
    await waitFor(() => screen.getByText('owner@valor.demo'));
    expect(screen.getByLabelText('Role for owner@valor.demo')).not.toBeDisabled();
    expect(screen.getByLabelText('Remove owner@valor.demo')).not.toBeDisabled();
  });

  it('surfaces the last-owner guard inline (no unhandled throw)', async () => {
    removeMember.mockRejectedValue(new Error('cannot remove the last owner'));
    render(<MembersAdmin />);
    await waitFor(() => screen.getByText('owner@valor.demo'));
    fireEvent.click(screen.getByLabelText('Remove owner@valor.demo'));
    await waitFor(() => expect(screen.getByText(/at least one owner/i)).toBeInTheDocument());
  });

  it('invites an existing user (added), clears the field, and refetches', async () => {
    render(<MembersAdmin />);
    await waitFor(() => screen.getByText('owner@valor.demo'));
    fireEvent.change(screen.getByLabelText('Invite email'), { target: { value: 'new@valor.demo' } });
    fireEvent.click(screen.getByRole('button', { name: /invite/i }));
    await waitFor(() => expect(inviteMember).toHaveBeenCalledWith('org-demo', 'new@valor.demo', 'viewer'));
    await waitFor(() => expect(screen.getByText(/added new@valor.demo/i)).toBeInTheDocument());
    expect(screen.getByLabelText('Invite email')).toHaveValue('');
    await waitFor(() => expect(listOrgMembers).toHaveBeenCalledTimes(2)); // mount + refetch
  });

  it('messages already_member', async () => {
    inviteMember.mockResolvedValue('already_member');
    render(<MembersAdmin />);
    await waitFor(() => screen.getByText('owner@valor.demo'));
    fireEvent.change(screen.getByLabelText('Invite email'), { target: { value: 'owner@valor.demo' } });
    fireEvent.click(screen.getByRole('button', { name: /invite/i }));
    await waitFor(() => expect(screen.getByText(/already a member/i)).toBeInTheDocument());
  });

  it('messages not_found with sign-in guidance', async () => {
    inviteMember.mockResolvedValue('not_found');
    render(<MembersAdmin />);
    await waitFor(() => screen.getByText('owner@valor.demo'));
    fireEvent.change(screen.getByLabelText('Invite email'), { target: { value: 'ghost@valor.demo' } });
    fireEvent.click(screen.getByRole('button', { name: /invite/i }));
    await waitFor(() => expect(screen.getByText(/sign in once via Microsoft/i)).toBeInTheDocument());
  });

  it('shows a retry affordance when the initial load fails', async () => {
    listOrgMembers.mockReset().mockRejectedValueOnce(new Error('network')).mockResolvedValue(SEED);
    render(<MembersAdmin />);
    await waitFor(() => expect(screen.getByText(/couldn't load members/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    await waitFor(() => expect(screen.getByText('owner@valor.demo')).toBeInTheDocument());
  });
});
