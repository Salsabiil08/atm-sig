import { ROLE_LEVELS, ROLES, type RoleName } from '@/lib/constants/rbac'
import type { SessionUser } from '@/lib/auth/session'

export function canManageUsers(user: Pick<SessionUser, 'role'>): boolean {
  return user.role === ROLES.SM || user.role === ROLES.GM || user.role === ROLES.SUPER_ADMIN
}

const ROLE_NAMES = new Set<string>(Object.values(ROLES))

export function isRoleName(value: string): value is RoleName {
  return ROLE_NAMES.has(value)
}

export function canManageUser(
  actor: Pick<SessionUser, 'id' | 'role' | 'roleLevel' | 'orgUnitId'>,
  target: { id: string; role: RoleName; orgUnitId: number },
  manageableOrgUnitIds: readonly number[],
): boolean {
  if (!canManageUsers(actor) || actor.id === target.id) return false
  if (target.role === ROLES.SUPER_ADMIN && actor.role !== ROLES.SUPER_ADMIN) return false
  if (actor.roleLevel >= ROLE_LEVELS.GM) return true

  return manageableOrgUnitIds.includes(target.orgUnitId)
}

export function manageableOrgUnitIds(
  actor: Pick<SessionUser, 'role' | 'orgUnitId'>,
  orgUnits: readonly { id: number; parentId: number | null }[],
): number[] {
  if (actor.role !== ROLES.SM) return orgUnits.map(({ id }) => id)

  return orgUnits
    .filter(({ id, parentId }) => id === actor.orgUnitId || parentId === actor.orgUnitId)
    .map(({ id }) => id)
}
