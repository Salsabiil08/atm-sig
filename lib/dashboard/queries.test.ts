import { describe, expect, it } from 'vitest'
import { buildDashboardPerformance, calcTimePct } from './queries'

describe('dashboard metrics (FR-070, FR-072)', () => {
  it('aggregates active progress and overdue load by owner and organization unit', () => {
    const now = new Date('2026-10-20T12:00:00.000Z')
    const performance = buildDashboardPerformance([
      {
        ownerId: 'user-a',
        ownerName: 'Rina',
        orgUnitId: 4,
        orgUnitName: 'Section Accounting',
        progressPct: 20,
        status: 'In progress',
        dueDate: '2026-10-20T11:00:00.000Z',
      },
      {
        ownerId: 'user-a',
        ownerName: 'Rina',
        orgUnitId: 4,
        orgUnitName: 'Section Accounting',
        progressPct: 60,
        status: 'Review',
        dueDate: '2026-10-21T11:00:00.000Z',
      },
      {
        ownerId: 'user-b',
        ownerName: 'Agus',
        orgUnitId: 5,
        orgUnitName: 'Section Reporting',
        progressPct: 100,
        status: 'Done',
        dueDate: '2026-10-19T11:00:00.000Z',
      },
    ], now)

    expect(performance).toEqual({
      owners: [{
        id: 'user-a',
        name: 'Rina',
        activeTasks: 2,
        overdueTasks: 1,
        averageProgress: 40,
      }],
      orgUnits: [{
        id: 4,
        name: 'Section Accounting',
        activeTasks: 2,
        overdueTasks: 1,
        averageProgress: 40,
      }],
    })
  })

  it('allows the time clock to be injected for boundary tests', () => {
    expect(calcTimePct(
      '2026-10-20T10:00:00.000Z',
      '2026-10-20T12:00:00.000Z',
      new Date('2026-10-20T11:00:00.000Z').getTime(),
    )).toBe(50)
  })
})
