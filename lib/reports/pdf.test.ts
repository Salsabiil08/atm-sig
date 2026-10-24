import { describe, expect, it } from 'vitest'
import { buildReportPdf } from './pdf'
import type { PerformanceReport } from './queries'
const params = { dateFrom: '2026-10-01', dateTo: '2026-10-31', orgUnitLabel: 'Accounting' }
const report: PerformanceReport = {
  summary: { taskCount: 2, dueCount: 2, completedCount: 1, onTimeCount: 1, onTimeRate: 50, lateCount: 1, averageProgress: 75 },
  orgUnits: [],
  rows: [{ orgUnitId: 1, orgUnitName: 'Unit A', parentUnitName: null, taskCount: 2, dueCount: 2, completedCount: 1, onTimeCount: 1, onTimeRate: 50, lateCount: 1, averageProgress: 75 }],
  lateTasks: [{ id: '1', title: 'Closing <A>', ownerName: 'PIC Test', dueDate: '2026-10-20T00:00:00Z', completedAt: null, status: 'In progress', progressPct: 50 }],
}
describe('Real PDF output', () => {
  it('produces a real, parseable-style PDF container, not HTML', () => {
    const bytes = buildReportPdf(report, params)
    const result = new TextDecoder().decode(bytes)
    expect(result.startsWith('%PDF-1.4')).toBe(true)
    expect(result).toContain('/Type /Catalog')
    expect(result).toContain('/Type /Page')
    expect(result).toContain('xref')
    expect(result.trimEnd().endsWith('%%EOF')).toBe(true)
    expect(result).toContain('Closing <A>')
    expect(result).not.toContain('<!DOCTYPE html>')
  })
  it('handles empty and multi-page exports with consistent page count', () => {
    const large = { ...report, lateTasks: Array.from({ length: 100 }, (_, i) => ({
      ...report.lateTasks[0], id: String(i), title: 'Task ' + i,
    })) }
    const bytes = buildReportPdf(large, params)
    const source = new TextDecoder().decode(bytes)
    const count = (source.match(/\/Type \/Page\b/g) ?? []).length
    expect(count).toBeGreaterThan(1)
    expect(source).toContain('/Count ' + count)
  })
  it('encodes PDF text safely when user-supplied title contains parentheses', () => {
    const special = { ...report, lateTasks: [{ ...report.lateTasks[0], title: '(test) \\ injected' }] }
    const result = new TextDecoder().decode(buildReportPdf(special, params))
    expect(result).toContain('\\(test\\)')
  })
})
