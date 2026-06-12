'use client';

import { useEffect, useState } from 'react';
import { Trash2, UserPlus } from 'lucide-react';
import type { OrgMember } from '@valor/core';
import { ALL_ROLES, isRole, type Role } from '@/lib/role';
import { getRepo, DEMO_ORG_ID } from '@/lib/repo';
import { useActiveOrg } from '@/components/active-org-provider';
import { PageHeader } from '@/components/ui/page-header';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoadingState } from '@/components/ui/states';

const SELECT_CLASS =
  'rounded-md border border-white/[0.08] bg-background/40 px-2 py-1 font-mono text-[0.6875rem] uppercase tracking-wider text-cream outline-none transition-colors focus:border-gold/50';

function lastOwnerGuard(err: unknown): boolean {
  return err instanceof Error && /last owner/i.test(err.message);
}

export function MembersAdmin() {
  const activeOrg = useActiveOrg();
  const orgId = activeOrg?.activeOrgId ?? DEMO_ORG_ID;

  const [members, setMembers] = useState<OrgMember[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('viewer');
  const [inviteMsg, setInviteMsg] = useState<string | null>(null);

  async function refresh() {
    try {
      const list = await getRepo().listOrgMembers(orgId);
      setMembers(list);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }

  useEffect(() => {
    let active = true;
    // Clear the prior org's rows up-front so a slow or failed load for a new
    // orgId can't leave stale members on screen (acting against the new orgId).
    setMembers(null);
    setLoadError(false);
    getRepo().listOrgMembers(orgId)
      .then((list) => { if (active) { setMembers(list); setLoadError(false); } })
      .catch(() => { if (active) { setMembers(null); setLoadError(true); } });
    return () => { active = false; };
  }, [orgId]);

  async function onChangeRole(userId: string, role: Role) {
    setRowError(null);
    setBusy(true);
    try {
      await getRepo().setMemberRole(orgId, userId, role);
      await refresh();
    } catch (err) {
      setRowError(lastOwnerGuard(err) ? 'An org must keep at least one owner.' : "Couldn't update that member — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onRemove(userId: string) {
    setRowError(null);
    setBusy(true);
    try {
      await getRepo().removeMember(orgId, userId);
      await refresh();
    } catch (err) {
      setRowError(lastOwnerGuard(err) ? 'An org must keep at least one owner.' : "Couldn't remove that member — try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onInvite(e: React.FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email) return;
    setInviteMsg(null);
    setBusy(true);
    try {
      const result = await getRepo().inviteMember(orgId, email, inviteRole);
      if (result === 'added') {
        setInviteEmail('');
        setInviteMsg(`Added ${email}.`);
        await refresh();
      } else if (result === 'already_member') {
        setInviteMsg(`${email} is already a member of this org.`);
      } else {
        setInviteMsg(`No Valor account for ${email} yet — they need to sign in once via Microsoft, then invite again.`);
      }
    } catch {
      setInviteMsg("Couldn't send that invite — try again.");
    } finally {
      setBusy(false);
    }
  }

  const header = (
    <PageHeader
      eyebrow="Administer · Members"
      title="Members"
      subtitle="Manage who can access this organization — change roles, remove members, or invite an existing Valor user."
    />
  );

  if (members === null && loadError) {
    return (
      <div>
        {header}
        <Card><CardContent>
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load members.{' '}
            <button type="button" onClick={refresh} className="text-gold-light underline underline-offset-2">Retry</button>
          </p>
        </CardContent></Card>
      </div>
    );
  }

  if (members === null) {
    return <div>{header}<LoadingState /></div>;
  }

  return (
    <div>
      {header}
      {rowError && <p role="alert" className="mb-4 text-sm text-red-300">{rowError}</p>}
      {loadError && (
        <p role="alert" className="mb-4 text-sm text-red-300">
          Couldn&apos;t refresh the member list &mdash; it may be out of date.{' '}
          <button type="button" onClick={refresh} className="underline underline-offset-2">Retry</button>
        </p>
      )}
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Members</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-2 font-medium">Email</th>
                  <th className="py-2 font-medium">Role</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.userId} className="border-t border-white/[0.06]">
                    <td className="py-2 text-cream">{m.email}</td>
                    <td className="py-2">
                      <select
                        aria-label={`Role for ${m.email}`}
                        value={m.role}
                        disabled={busy}
                        onChange={(e) => { if (isRole(e.target.value)) onChangeRole(m.userId, e.target.value); }}
                        className={SELECT_CLASS}
                      >
                        {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        aria-label={`Remove ${m.email}`}
                        disabled={busy}
                        onClick={() => onRemove(m.userId)}
                        className="inline-flex items-center gap-1 rounded-md border border-red-400/30 bg-red-400/[0.06] px-2 py-1 font-mono text-[0.625rem] uppercase tracking-wider text-red-200 transition-colors hover:bg-red-400/[0.12] disabled:opacity-40"
                      >
                        <Trash2 className="h-3 w-3" strokeWidth={2} aria-hidden="true" /> Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Invite a member</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={onInvite} className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground/70">Email</span>
                <input
                  type="email"
                  required
                  aria-label="Invite email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="rounded-md border border-white/[0.08] bg-background/40 px-2 py-1 text-sm text-cream outline-none transition-colors focus:border-gold/50"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="font-mono text-[0.625rem] uppercase tracking-wider text-muted-foreground/70">Role</span>
                <select
                  aria-label="Invite role"
                  value={inviteRole}
                  onChange={(e) => { if (isRole(e.target.value)) setInviteRole(e.target.value); }}
                  className={SELECT_CLASS}
                >
                  {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              </label>
              <button
                type="submit"
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-md border border-gold/30 bg-gold/[0.06] px-3 py-1.5 font-mono text-[0.6875rem] uppercase tracking-wider text-gold-light transition-colors hover:bg-gold/[0.12] disabled:opacity-40"
              >
                <UserPlus className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" /> Invite
              </button>
            </form>
            {inviteMsg && <p role="status" className="mt-3 text-sm text-muted-foreground">{inviteMsg}</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
