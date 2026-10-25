import type { PerformanceReport } from './queries'
import type { TaskListItem } from '@/lib/tasks/queries'
import type { ExportParams } from './export'

/** Dependency-free, printable A4 PDF 1.4. Each object is ASCII for exact xref offsets. */
function ascii(input: string) {
  return input.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, '?')
}
function pdfEscape(text: string) {
  return ascii(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
}
const encode = (text: string) => new TextEncoder().encode(text)

function renderPage(lines: string[], page: number, total: number) {
  const commands = [
    '0.10 0.16 0.23 rg',
    'BT /F1 11 Tf 48 798 Td (ACCOUNTING TASK MANAGER - SIG) Tj ET',
    '0.84 0.14 0.18 rg',
    '48 782 499 2 re f',
    '0.10 0.16 0.23 rg',
  ]
  lines.forEach((line, i) => {
    commands.push('BT /F1 9 Tf 48 ' + (753 - i * 17) + ' Td (' + pdfEscape(line) + ') Tj ET')
  })
  commands.push('BT /F1 8 Tf 48 35 Td (Halaman ' + page + ' / ' + total + ') Tj ET')
  return commands.join('\n') + '\n'
}

export function buildReportPdf(report: PerformanceReport, params: ExportParams): Uint8Array {
  const summary = report.summary
  const text = [
    'LAPORAN TASK DEPARTMENT OF ACCOUNTING',
    'Periode: ' + params.dateFrom + ' s.d. ' + params.dateTo,
    'Cakupan: ' + params.orgUnitLabel,
    '',
    'RINGKASAN',
    'Task jatuh tempo: ' + summary.dueCount,
    'Selesai: ' + summary.completedCount,
    'Tepat waktu: ' + summary.onTimeCount + ' (' + (summary.onTimeRate === null ? 'N/A' : summary.onTimeRate + '%') + ')',
    'Terlambat: ' + summary.lateCount,
    'Progress rata-rata: ' + summary.averageProgress + '%',
    '',
    'PER UNIT / SECTION',
    ...report.rows.flatMap((row) => [
      (row.parentUnitName ? row.parentUnitName + ' / ' : '') + row.orgUnitName,
      '  Total ' + row.taskCount + ' | Done ' + row.completedCount + ' | Progress ' + row.averageProgress + '% | Telat ' + row.lateCount,
    ]),
    '',
    'TASK TERLAMBAT',
    ...(report.lateTasks.length ? report.lateTasks.flatMap((t) => [
      t.title,
      '  PIC: ' + t.ownerName + ' | Tenggat: ' + t.dueDate.slice(0, 10) + ' | ' + t.status + ' | ' + t.progressPct + '%',
    ]) : ['Tidak ada task terlambat.']),
  ]
  return renderPdfLines(text)
}

function renderPdfLines(text: string[]): Uint8Array {
  // Wrap long titles and descriptions instead of silently truncating them.
  // Split at whitespace wherever possible; preserve even one long token.
  const wrapped = text.flatMap(line => {
    if (line.length <= 88) return [line]
    const chunks: string[] = []
    let remaining = line
    while (remaining.length > 88) {
      const lastSpace = remaining.lastIndexOf(' ', 88)
      const at = lastSpace > 16 ? lastSpace : 88
      chunks.push(remaining.slice(0, at))
      remaining = remaining.slice(at).trimStart()
    }
    chunks.push(remaining)
    return chunks
  })
  // 41 content lines keep every page above the footer.
  const pages: string[][] = []
  for (let i = 0; i < wrapped.length; i += 41) pages.push(wrapped.slice(i, i + 41))
  if (!pages.length) pages.push([])
  const objects: string[] = []
  const add = (body: string) => { objects.push(body); return objects.length }
  const catalogId = add('')
  const pagesId = add('')
  const fontId = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>')
  const pageIds: number[] = []
  pages.forEach((lines, index) => {
    const stream = renderPage(lines, index + 1, pages.length)
    const streamId = add('<< /Length ' + encode(stream).length + ' >>\nstream\n' + stream + 'endstream')
    const pageId = add('<< /Type /Page /Parent ' + pagesId + ' 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ' + fontId + ' 0 R >> >> /Contents ' + streamId + ' 0 R >>')
    pageIds.push(pageId)
  })
  objects[catalogId - 1] = '<< /Type /Catalog /Pages ' + pagesId + ' 0 R >>'
  objects[pagesId - 1] = '<< /Type /Pages /Count ' + pageIds.length + ' /Kids [ ' + pageIds.map((id) => id + ' 0 R').join(' ') + ' ] >>'
  let body = '%PDF-1.4\n'
  const offsets = [0]
  objects.forEach((obj, index) => {
    offsets.push(encode(body).length)
    body += (index + 1) + ' 0 obj\n' + obj + '\nendobj\n'
  })
  const xrefAt = encode(body).length
  body += 'xref\n0 ' + (objects.length + 1) + '\n'
  body += '0000000000 65535 f \n'
  offsets.slice(1).forEach((offset) => { body += String(offset).padStart(10, '0') + ' 00000 n \n' })
  body += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root ' + catalogId + ' 0 R >>\nstartxref\n' + xrefAt + '\n%%EOF\n'
  return encode(body)
}

/** Daftar rinci semua status tugas, dengan tautan aplikasi untuk melihat berkas evidence. */
export function buildTaskListPdf(tasks: readonly TaskListItem[], params: ExportParams): Uint8Array {
  const lines: string[] = [
    'LAPORAN DETAIL TUGAS - ACCOUNTING SIG',
    'Tanggal pembuatan: '+params.dateFrom+' s.d. '+params.dateTo,
    'Cakupan: '+params.orgUnitLabel,
    'Jumlah tugas: '+tasks.length,
    '',
  ]
  for (const task of tasks) {
    lines.push(task.title)
    lines.push('  PIC: '+task.ownerName+' | Status: '+task.status+' | Kemajuan: '+task.progressPct+'%')
    lines.push('  Dibuat: '+task.createdAt.slice(0,10)+' | Tenggat: '+task.dueDate.slice(0,10))
    if(task.completedAt) lines.push('  Selesai: '+task.completedAt.slice(0,10))
    lines.push('  Progres dan lampiran: /tasks/'+task.id)
    lines.push('')
  }
  return renderPdfLines(lines)
}
