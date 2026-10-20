export type CreateUserInviteInput = {
  name: string
  email: string
}

export type UpdateUserNameInput = {
  userId: string
  name: string
  email?: string
}

export type UpdateUserStatusInput = {
  userId: string
  status: 'aktif' | 'nonaktif'
  email?: string
}

export type AssignUserRoleInput = {
  userId: string
  roleId: number
  orgUnitId: number
  supervisorId: string | null
  email?: string
}

export type DecideUserRoleChangeInput = {
  requestId: string
  decision: 'approved' | 'rejected'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function validateCreateUserInviteInput(input: unknown): CreateUserInviteInput | null {
  if (!isRecord(input)) return null
  const value = input

  if (typeof value.name !== 'string' || typeof value.email !== 'string') return null

  const name = value.name.trim()
  const email = value.email.trim().toLowerCase()
  if (name.length < 2 || name.length > 100) return null
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null

  return { name, email }
}

export function validateUpdateUserNameInput(input: unknown): UpdateUserNameInput | null {
  if (!isRecord(input)) return null
  const value = input

  if (typeof value.userId !== 'string' || typeof value.name !== 'string') return null
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.userId)) {
    return null
  }

  const name = value.name.trim()
  if (name.length < 2 || name.length > 100) return null

  if (value.email !== undefined && (typeof value.email !== 'string' || value.email.length > 254)) {
    return null
  }
  return {
    userId: value.userId,
    name,
    ...(typeof value.email === 'string' ? { email: value.email.trim().toLowerCase() } : {}),
  }
}

export function validateUpdateUserStatusInput(input: unknown): UpdateUserStatusInput | null {
  if (!isRecord(input)) return null
  const value = input

  if (typeof value.userId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.userId)) {
    return null
  }
  if (value.status !== 'aktif' && value.status !== 'nonaktif') return null
  if (value.email !== undefined && (typeof value.email !== 'string' || value.email.length > 254)) {
    return null
  }

  return {
    userId: value.userId,
    status: value.status,
    ...(typeof value.email === 'string' ? { email: value.email.trim().toLowerCase() } : {}),
  }
}

export function validateAssignUserRoleInput(input: unknown): AssignUserRoleInput | null {
  if (!isRecord(input)) return null
  const value = input

  if (
    typeof value.userId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.userId) ||
    typeof value.roleId !== 'number' ||
    !Number.isInteger(value.roleId) ||
    value.roleId < 1 ||
    typeof value.orgUnitId !== 'number' ||
    !Number.isInteger(value.orgUnitId) ||
    value.orgUnitId < 1 ||
    (value.supervisorId !== null &&
      (typeof value.supervisorId !== 'string' ||
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.supervisorId)))
  ) {
    return null
  }

  if (value.email !== undefined && (typeof value.email !== 'string' || value.email.length > 254)) {
    return null
  }

  return {
    userId: value.userId,
    roleId: value.roleId,
    orgUnitId: value.orgUnitId,
    supervisorId: value.supervisorId,
    ...(typeof value.email === 'string' ? { email: value.email.trim().toLowerCase() } : {}),
  }
}

export function validateDecideUserRoleChangeInput(
  input: unknown,
): DecideUserRoleChangeInput | null {
  if (!isRecord(input)) return null
  const { requestId, decision } = input
  if (
    typeof requestId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId) ||
    (decision !== 'approved' && decision !== 'rejected')
  ) {
    return null
  }
  return { requestId, decision }
}
