import { describe, expect, it } from 'vitest'
import { getActiveTaskWorkloads, getMonthDayCount, getTimelineBarPosition } from './timeline'

describe('Gantt timeline helpers (FR-111, D-031)', () => {
  it('uses the right day count for leap and non-leap months', () => {
    expect(getMonthDayCount('2028-02')).toBe(29)
    expect(getMonthDayCount('2027-02')).toBe(28)
    expect(getMonthDayCount('2027-04')).toBe(30)
  })

  it('clips task bars to the selected month and hides tasks outside it', () => {
    expect(getTimelineBarPosition('2027-01-28T17:00:00.000Z', '2027-02-02T17:00:00.000Z', '2027-02')).toEqual({
      visible: true,
      leftPct: 0,
      widthPct: (3 / 28) * 100,
    })
    expect(getTimelineBarPosition('2027-03-01T00:00:00.000Z', '2027-03-02T00:00:00.000Z', '2027-02').visible).toBe(false)
  })

  it('counts active tasks per PIC and excludes Done', () => {
    expect(getActiveTaskWorkloads([
      { ownerId: 'a', ownerName: 'Ayu', status: 'To do' },
      { ownerId: 'a', ownerName: 'Ayu', status: 'Blocked' },
      { ownerId: 'b', ownerName: 'Budi', status: 'In progress' },
      { ownerId: 'a', ownerName: 'Ayu', status: 'Done' },
    ])).toEqual([
      { id: 'a', name: 'Ayu', count: 2 },
      { id: 'b', name: 'Budi', count: 1 },
    ])
  })
})
