import { ROLES, type RoleName } from '@/lib/constants/rbac'

export type OrganizationalUnit = {
  id: number
  parentId: number | null
  type: 'department' | 'unit' | 'section'
}

export type AssignmentSupervisor = {
  role: RoleName
  orgUnitId: number
  status: 'aktif' | 'nonaktif'
}

export function requiredOrgUnitType(role: RoleName): OrganizationalUnit['type'] | null {
  if (role === ROLES.SPECTATOR) return null
  if (role === ROLES.SM) return 'unit'
  if (role === ROLES.GM || role === ROLES.SUPER_ADMIN) return 'department'
  return 'section'
}

function expectedSupervisorRole(role: RoleName): RoleName | null {
  if (role === ROLES.STAFF_PIC) return ROLES.MANAGER
  if (role === ROLES.MANAGER) return ROLES.SM
  if (role === ROLES.SM) return ROLES.GM
  return null
}

export function requiresSupervisor(role: RoleName): boolean {
  return expectedSupervisorRole(role) !== null
}

export function isValidUserAssignment(
  role: RoleName,
  orgUnit: OrganizationalUnit,
  supervisor: AssignmentSupervisor | null,
  orgUnits: readonly OrganizationalUnit[],
): boolean {
  const requiredType = requiredOrgUnitType(role)
  if (requiredType && orgUnit.type !== requiredType) return false
  const requiredSupervisor = expectedSupervisorRole(role)
  if (!supervisor) return requiredSupervisor === null
  if (
    !requiredSupervisor ||
    supervisor.role !== requiredSupervisor ||
    supervisor.status !== 'aktif'
  ) {
    return false
  }

  if (role === ROLES.STAFF_PIC) return supervisor.orgUnitId === orgUnit.id

  const parentUnit = orgUnits.find(({ id }) => id === orgUnit.parentId)
  if (role === ROLES.MANAGER) {
    return parentUnit?.type === 'unit' && supervisor.orgUnitId === parentUnit.id
  }

  if (role === ROLES.SM) {
    return parentUnit?.type === 'department' && supervisor.orgUnitId === parentUnit.id
  }

  return false
}
