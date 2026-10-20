import { describe, expect, it } from 'vitest'
import { ROLES } from '@/lib/constants/rbac'
import {
  isValidUserAssignment,
  requiredOrgUnitType,
  requiresSupervisor,
  type OrganizationalUnit,
} from './assignment'

const units: OrganizationalUnit[] = [
  { id: 1, parentId: null, type: 'department' },
  { id: 2, parentId: 1, type: 'unit' },
  { id: 3, parentId: 1, type: 'unit' },
  { id: 4, parentId: 2, type: 'section' },
  { id: 5, parentId: 3, type: 'section' },
]

describe('role assignment structure (FR-003, BR-060)', () => {
  it('maps each operational role to the correct organization level', () => {
    expect(requiredOrgUnitType(ROLES.SPECTATOR)).toBeNull()
    expect(requiredOrgUnitType(ROLES.STAFF_PIC)).toBe('section')
    expect(requiredOrgUnitType(ROLES.MANAGER)).toBe('section')
    expect(requiredOrgUnitType(ROLES.SM)).toBe('unit')
    expect(requiredOrgUnitType(ROLES.GM)).toBe('department')
    expect(requiredOrgUnitType(ROLES.SUPER_ADMIN)).toBe('department')
  })

  it('requires direct supervisors for Staff/PIC, Manager, and SM only', () => {
    expect(requiresSupervisor(ROLES.STAFF_PIC)).toBe(true)
    expect(requiresSupervisor(ROLES.MANAGER)).toBe(true)
    expect(requiresSupervisor(ROLES.SM)).toBe(true)
    expect(requiresSupervisor(ROLES.SPECTATOR)).toBe(false)
    expect(requiresSupervisor(ROLES.GM)).toBe(false)
    expect(requiresSupervisor(ROLES.SUPER_ADMIN)).toBe(false)
    expect(isValidUserAssignment(ROLES.STAFF_PIC, units[3], null, units)).toBe(false)
    expect(isValidUserAssignment(ROLES.MANAGER, units[3], null, units)).toBe(false)
    expect(isValidUserAssignment(ROLES.SM, units[1], null, units)).toBe(false)
    expect(isValidUserAssignment(ROLES.GM, units[0], null, units)).toBe(true)
  })

  it('validates Staff/PIC, Manager, and SM supervisor chains and placement', () => {
    expect(isValidUserAssignment(
      ROLES.STAFF_PIC,
      units[3],
      { role: ROLES.MANAGER, orgUnitId: 4, status: 'aktif' },
      units,
    )).toBe(true)
    expect(isValidUserAssignment(
      ROLES.MANAGER,
      units[3],
      { role: ROLES.SM, orgUnitId: 2, status: 'aktif' },
      units,
    )).toBe(true)
    expect(isValidUserAssignment(
      ROLES.SM,
      units[1],
      { role: ROLES.GM, orgUnitId: 1, status: 'aktif' },
      units,
    )).toBe(true)
  })

  it('rejects mismatched unit levels, out-of-scope supervisors, and inactive supervisors', () => {
    expect(isValidUserAssignment(ROLES.STAFF_PIC, units[1], null, units)).toBe(false)
    expect(isValidUserAssignment(
      ROLES.STAFF_PIC,
      units[3],
      { role: ROLES.MANAGER, orgUnitId: 5, status: 'aktif' },
      units,
    )).toBe(false)
    expect(isValidUserAssignment(
      ROLES.SM,
      units[1],
      { role: ROLES.GM, orgUnitId: 1, status: 'nonaktif' },
      units,
    )).toBe(false)
  })

  it('allows Spectator placement at any existing organization level without a supervisor', () => {
    expect(isValidUserAssignment(ROLES.SPECTATOR, units[3], null, units)).toBe(true)
  })
})
