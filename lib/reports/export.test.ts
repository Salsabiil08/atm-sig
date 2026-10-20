// T-503 — Tests: export Excel (.xlsx) dan PDF (printable HTML) — FR-091
import { describe, expect, it } from 'vitest'
import { buildXlsx, buildPdfHtml, type ExportParams } from './export'
import type { PerformanceReport } from './queries'

const params: ExportParams = {
  dateFrom: '2026-10-01',
  dateTo:   '2026-10-31',
  orgUnitLabel: 'Semua dalam cakupan',
}

const emptyReport: PerformanceReport = {
  summary: { taskCount: 0, completedCount: 0, dueCount: 0, onTimeCount: 0, onTimeRate: null, lateCount: 0, averageProgress: 0 },
  rows: [],
  lateTasks: [],
  orgUnits: [],
}

const report: PerformanceReport = {
  summary: {
    taskCount: 3, completedCount: 2, dueCount: 3,
    onTimeCount: 1, onTimeRate: 33, lateCount: 2, averageProgress: 83,
  },
  rows: [
    {
      orgUnitId: 4, orgUnitName: 'Section Accounting', parentUnitName: 'Unit Accounting',
      taskCount: 2, completedCount: 1, dueCount: 2, onTimeCount: 1, onTimeRate: 50, lateCount: 1, averageProgress: 75,
    },
    {
      orgUnitId: 5, orgUnitName: 'Section Reporting', parentUnitName: 'Unit Reporting',
      taskCount: 1, completedCount: 0, dueCount: 1, onTimeCount: 0, onTimeRate: 0, lateCount: 1, averageProgress: 50,
    },
  ],
  lateTasks: [
    { id: 'a', title: 'Jurnal <Test>', ownerName: 'Rina', dueDate: '2026-10-15T17:00:00.000Z', completedAt: '2026-10-16T10:00:00.000Z', status: 'Done', progressPct: 100 },
    { id: 'b', title: 'Laporan vendor', ownerName: 'Dimas', dueDate: '2026-10-18T17:00:00.000Z', completedAt: null, status: 'In progress', progressPct: 50 },
  ],
  orgUnits: [
    { id: 4, name: 'Section Accounting', parentUnitName: 'Unit Accounting' },
    { id: 5, name: 'Section Reporting', parentUnitName: 'Unit Reporting' },
  ],
}

describe('buildXlsx (FR-091)', () => {
  it('returns a non-empty Uint8Array that starts with the ZIP local-file-header signature', () => {
    const bytes = buildXlsx(report, params)
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBeGreaterThan(200)
    // ZIP magic bytes: 50 4B 03 04
    expect(bytes[0]).toBe(0x50)
    expect(bytes[1]).toBe(0x4b)
    expect(bytes[2]).toBe(0x03)
    expect(bytes[3]).toBe(0x04)
  })

  it('embeds [Content_Types].xml and sheet1.xml entries in the ZIP', () => {
    const bytes = buildXlsx(report, params)
    const text = new TextDecoder().decode(bytes)
    expect(text).toContain('[Content_Types].xml')
    expect(text).toContain('sheet1.xml')
  })

  it('includes the filter period and report data in the sheet XML', () => {
    const bytes = buildXlsx(report, params)
    const text = new TextDecoder().decode(bytes)
    expect(text).toContain('2026-10-01')
    expect(text).toContain('2026-10-31')
    expect(text).toContain('Section Accounting')
    expect(text).toContain('Jurnal')
  })

  it('handles an empty report without throwing', () => {
    const bytes = buildXlsx(emptyReport, params)
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBeGreaterThan(100)
  })
})

describe('buildPdfHtml (FR-091)', () => {
  it('returns a complete HTML document with correct headers', () => {
    const html = buildPdfHtml(report, params)
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('<html lang="id">')
    expect(html).toContain('LAPORAN TASK')
    expect(html).toContain('2026-10-01')
    expect(html).toContain('2026-10-31')
  })

  it('escapes HTML special chars in task titles', () => {
    const html = buildPdfHtml(report, params)
    // Task title has '<Test>' which must be escaped
    expect(html).toContain('&lt;Test&gt;')
    expect(html).not.toContain('<Test>')
  })

  it('shows N/A for null onTimeRate in the summary', () => {
    const html = buildPdfHtml(emptyReport, params)
    expect(html).toContain('N/A')
  })

  it('shows the empty-state message when there are no rows or late tasks', () => {
    const html = buildPdfHtml(emptyReport, params)
    expect(html).toContain('Tidak ada task dengan tenggat pada periode ini.')
    expect(html).toContain('Tidak ada task terlambat pada periode ini.')
  })

  it('renders per-unit rows and late task rows for a non-empty report', () => {
    const html = buildPdfHtml(report, params)
    expect(html).toContain('Unit Accounting / Section Accounting')
    expect(html).toContain('Laporan vendor')
    expect(html).toContain('Dimas')
  })
})
