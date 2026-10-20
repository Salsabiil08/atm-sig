// NFR-001, PR-1 — Konstanta RBAC: role level dan nama resmi (docs/03-roles-and-permissions.md)

export const ROLES = {
  SPECTATOR: 'Spectator',
  STAFF_PIC: 'Staff/PIC',
  MANAGER: 'Manager',
  SM: 'SM',
  GM: 'GM',
  SUPER_ADMIN: 'Super Admin',
} as const

export type RoleName = (typeof ROLES)[keyof typeof ROLES]

/**
 * Level hirarki role. Semakin tinggi nilai, semakin luas akses.
 * Dipakai untuk perbandingan cepat (mis. user.level >= ROLE_LEVELS.SM).
 */
export const ROLE_LEVELS: Record<RoleName, number> = {
  Spectator: 1,
  'Staff/PIC': 2,
  Manager: 3,
  SM: 4,
  GM: 5,
  'Super Admin': 6,
}

/**
 * Status task resmi (BR-001).
 * Urutan mencerminkan alur status yang valid.
 */
export const TASK_STATUSES = [
  'To do',
  'In progress',
  'Blocked',
  'Review',
  'Revisi',
  'Done',
] as const

export type TaskStatus = (typeof TASK_STATUSES)[number]

/**
 * Checkpoint reminder berbasis persentase (BR-030..BR-032, D-004).
 */
export const REMINDER_CHECKPOINTS = [50, 80, 90] as const
export type CheckpointPct = (typeof REMINDER_CHECKPOINTS)[number]

/**
 * Role yang berwenang menyetujui perubahan deadline (BR-040, FR-061).
 * Manager tidak termasuk.
 */
export const DEADLINE_APPROVERS: RoleName[] = ['SM', 'GM', 'Super Admin']

/**
 * Role yang dapat mengubah deadline langsung tanpa approval (BR-041, FR-064).
 */
export const DIRECT_DEADLINE_EDITORS: RoleName[] = ['Manager', 'SM', 'GM', 'Super Admin']

/**
 * Role yang tidak memiliki reviewer (D-015).
 * Task milik GM dan Super Admin tidak perlu di-review oleh siapapun.
 */
export const ROLES_WITHOUT_REVIEWER: RoleName[] = ['GM', 'Super Admin']
