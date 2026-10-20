import { describe, expect, it } from 'vitest'
import {
  buildPerformanceReport,
  getReportDateRange,
  parseReportFilters,
  type ReportTaskSource,
} from './queries'

const tasks: ReportTaskSource[] = [
  {
    id: 'on-time',
    title: 'Rekonsiliasi',
    status: 'Done',
    progressPct: 100,
    dueDate: '2026-10-10T17:00:00.000Z',
    completedAt: '2026-10-10T16:59:00.000Z',
    ownerName: 'Rina',
    orgUnitId: 4,
    orgUnitName: 'Section Accounting',
    parentUnitName: 'Unit Accounting',
  },
  {
    id: 'late-complete',
    title: 'Jurnal',
    status: 'Done',
    progressPct: 100,
    dueDate: '2026-10-15T17:00:00.000Z',
    completedAt: '2026-10-16T17:00:00.000Z',
    ownerName: 'Agus',
    orgUnitId: 4,
    orgUnitName: 'Section Accounting',
    parentUnitName: 'Unit Accounting',
  },
  {
    id: 'overdue',
    title: 'Laporan vendor',
    status: 'In progress',
    progressPct: 50,
    dueDate: '2026-10-18T17:00:00.000Z',
    completedAt: null,
    ownerName: 'Dimas',
    orgUnitId: 5,
    orgUnitName: 'Section Reporting',
    parentUnitName: 'Unit Reporting',
  },
]

describe('performance report (FR-090, OQ-12)', () => {
  it('defaults to the current Jakarta month and validates date and unit filters', () => {
    expect(parseReportFilters({}, new Date('2026-10-19T18:00:00.000Z'))).toEqual({
      dateFrom: '2026-10-01',
      dateTo: '2026-10-31',
      orgUnitId: null,
    })
    expect(parseReportFilters({
      dateFrom: '2026-10-01',
      dateTo: '2026-10-20',
      orgUnitId: '4',
    })).toEqual({
      dateFrom: '2026-10-01',
      dateTo: '2026-10-20',
      orgUnitId: 4,
    })
    expect(() => parseReportFilters({ dateFrom: '2026-02-30' })).toThrow('Periode laporan tidak valid.')
    expect(() => parseReportFilters({ dateFrom: '2026-10-21', dateTo: '2026-10-20' }))
      .toThrow('Periode laporan tidak valid.')
    expect(() => parseReportFilters({ orgUnitId: '4.5' })).toThrow('Filter unit/section tidak valid.')
  })

  it('uses inclusive Jakarta dates as an exclusive UTC query range', () => {
    expect(getReportDateRange({ dateFrom: '2026-10-01', dateTo: '2026-10-31', orgUnitId: null }))
      .toEqual({
        startsAt: '2026-09-30T17:00:00.000Z',
        endsAtExclusive: '2026-10-31T17:00:00.000Z',
      })
  })

  it('counts on-time Done tasks over all due tasks and flags both overdue and late completions', () => {
    const report = buildPerformanceReport(tasks, new Date('2026-10-20T00:00:00.000Z'))

    expect(report.summary).toEqual({
      taskCount: 3,
      completedCount: 2,
      dueCount: 3,
      onTimeCount: 1,
      onTimeRate: 33,
      lateCount: 2,
      averageProgress: 83,
    })
    expect(report.rows.map((row) => ({
      name: row.orgUnitName,
      onTimeCount: row.onTimeCount,
      dueCount: row.dueCount,
      lateCount: row.lateCount,
    }))).toEqual([
      { name: 'Section Accounting', onTimeCount: 1, dueCount: 2, lateCount: 1 },
      { name: 'Section Reporting', onTimeCount: 0, dueCount: 1, lateCount: 1 },
    ])
    expect(report.lateTasks.map(({ id }) => id)).toEqual(['late-complete', 'overdue'])
  })

  it('returns N/A when no task is due and applies the section filter', () => {
    const report = buildPerformanceReport(tasks, new Date('2026-10-20T00:00:00.000Z'), {
      dateFrom: '2026-10-01',
      dateTo: '2026-10-31',
      orgUnitId: 5,
    })
    const empty = buildPerformanceReport([], new Date('2026-10-20T00:00:00.000Z'))

    expect(report.summary.taskCount).toBe(1)
    expect(report.rows.map(({ orgUnitId }) => orgUnitId)).toEqual([5])
    expect(empty.summary.onTimeRate).toBeNull()
    expect(empty.summary.averageProgress).toBe(0)
  })

  it('marks a non-Done task overdue when the report clock reaches its deadline', () => {
    const dueAtNow: ReportTaskSource = {
      ...tasks[2],
      id: 'due-now',
      dueDate: '2026-10-20T00:00:00.000Z',
    }
    const report = buildPerformanceReport(
      [dueAtNow],
      new Date('2026-10-20T00:00:00.000Z'),
    )

    expect(report.summary.lateCount).toBe(1)
  })

  it('uses the deadline effective when the task was completed, not a later revision', () => {
    const revisedAfterCompletion: ReportTaskSource = {
      ...tasks[0],
      id: 'revision-after-done',
      dueDate: '2026-10-25T17:00:00.000Z',
      completedAt: '2026-10-15T18:00:00.000Z',
      deadlineRevisions: [{
        oldDate: '2026-10-15T17:00:00.000Z',
        newDate: '2026-10-25T17:00:00.000Z',
        changedAt: '2026-10-16T12:00:00.000Z',
      }],
    }
    const report = buildPerformanceReport(
      [revisedAfterCompletion],
      new Date('2026-10-20T00:00:00.000Z'),
      { dateFrom: '2026-10-01', dateTo: '2026-10-20', orgUnitId: null },
    )

    expect(report.summary.dueCount).toBe(1)
    expect(report.summary.onTimeCount).toBe(0)
    expect(report.lateTasks[0].dueDate).toBe('2026-10-15T17:00:00.000Z')
  })
})
