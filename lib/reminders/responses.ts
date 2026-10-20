export const REMINDER_RESPONSES = [
  'Masih on progress',
  'Butuh support',
  'Ajukan perubahan deadline',
] as const

export type ReminderResponse = (typeof REMINDER_RESPONSES)[number]

export function isReminderResponse(value: unknown): value is ReminderResponse {
  return REMINDER_RESPONSES.some((response) => response === value)
}
