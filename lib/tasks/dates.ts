/**
 * Blueprint R.02 D-02: user-selected calendar dates are Asia/Jakarta dates.
 * Due dates expire at the end of the selected day, not at 00:00 WIB.
 */
export function toJakartaTimestamp(date: string, endOfDay = false): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Tanggal tidak valid.')
  const time = endOfDay ? '23:59:59.999' : '00:00:00.000'
  const instant = new Date(`${date}T${time}+07:00`)
  if (!Number.isFinite(instant.getTime())) throw new Error('Tanggal tidak valid.')
  const actual = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(instant)
  if (actual !== date) throw new Error('Tanggal tidak valid.')
  return instant.toISOString()
}
