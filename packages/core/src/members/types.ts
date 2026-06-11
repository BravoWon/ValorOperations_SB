import type { Role } from '../enums';

/** A member of an org, as shown in the admin members view. */
export interface OrgMember {
  userId: string;
  email: string;
  role: Role;
  createdAt: string;
}

/** Result of inviting an existing user by email. */
export type InviteResult = 'added' | 'already_member' | 'not_found';
