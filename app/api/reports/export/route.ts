// T-503 — Route Handler export laporan Excel (.xlsx) dan PDF — FR-091
// GET /api/reports/export?format=xlsx|pdf&from=YYYY-MM-DD&to=YYYY-MM-DD&orgUnit=<id>
// Proteksi: minimum role Manager (level 3).

import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, requireRole } from '@/lib/auth/session'
import { getPerformanceReport, parseReportFilters } from '@/lib/reports/queries'
import { buildXlsx, type ExportParams } from '@/lib/reports/export'
import { buildReportPdf } from '@/lib/reports/pdf'

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getSessionUser()
    requireRole(user, 'Manager')

    const sp = request.nextUrl.searchParams
    const format = sp.get('format')
    if (format !== 'xlsx' && format !== 'pdf') {
      return NextResponse.json({ error: 'Format tidak valid. Gunakan xlsx atau pdf.' }, { status: 400 })
    }

    const rawFrom    = sp.get('from')   ?? undefined
    const rawTo      = sp.get('to')     ?? undefined
    const rawOrgUnit = sp.get('orgUnit') ?? undefined

    const filters = parseReportFilters({ dateFrom: rawFrom, dateTo: rawTo, orgUnitId: rawOrgUnit })
    const report  = await getPerformanceReport(user, filters)

    const orgUnitLabel =
      filters.orgUnitId === null
        ? 'Semua dalam cakupan'
        : (report.orgUnits.find((u) => u.id === filters.orgUnitId)?.name ?? String(filters.orgUnitId))

    const params: ExportParams = {
      dateFrom: filters.dateFrom,
      dateTo:   filters.dateTo,
      orgUnitLabel,
    }

    if (format === 'xlsx') {
      const bytes    = buildXlsx(report, params)
      const filename = `laporan-task-${filters.dateFrom}-${filters.dateTo}.xlsx`
      const responseBody = new Uint8Array(bytes.byteLength)
      responseBody.set(bytes)
      return new NextResponse(responseBody.buffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
          'Cache-Control': 'no-store',
        },
      })
    }

    // True PDF binary; same role and scope controls as XLSX.
    const pdf = buildReportPdf(report, params)
    const bytes = new Uint8Array(pdf.byteLength)
    bytes.set(pdf)
    const filename = `laporan-task-${filters.dateFrom}-${filters.dateTo}.pdf`
    return new NextResponse(bytes.buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Terjadi kesalahan saat mengekspor laporan.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
