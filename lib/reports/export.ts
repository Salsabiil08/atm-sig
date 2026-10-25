// T-503 — Export Excel (.xlsx) dan PDF (printable HTML) — FR-091
// Tidak ada dependensi luar; XLSX dibuat dari OOXML (ZIP + XML) secara manual.

import type { PerformanceReport } from './queries'
import type { TaskListItem } from '@/lib/tasks/queries'
import { taskStatusLabel } from '@/lib/tasks/status-labels'

// ──────────────────────────────────────────────────────────────────────────────
// Helpers format tanggal
// ──────────────────────────────────────────────────────────────────────────────

function formatDateId(value: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date(value))
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ──────────────────────────────────────────────────────────────────────────────
// XLSX minimal builder (Open XML / OOXML)
// Spesifikasi: ECMA-376 Part 1 — SpreadsheetML
// ──────────────────────────────────────────────────────────────────────────────

type Cell = string | number | null

function xlsxCell(value: Cell, colIndex: number, rowIndex: number): string {
  const col = String.fromCharCode(65 + colIndex)
  const ref = `${col}${rowIndex}`
  if (value === null || value === undefined || value === '') {
    return `<c r="${ref}"/>`
  }
  if (typeof value === 'number') {
    return `<c r="${ref}" t="n"><v>${value}</v></c>`
  }
  // inline string
  return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(String(value))}</t></is></c>`
}

function xlsxRow(cells: Cell[], rowIndex: number): string {
  return `<row r="${rowIndex}">${cells.map((c, i) => xlsxCell(c, i, rowIndex)).join('')}</row>`
}

function buildSheetXml(rows: Cell[][]): string {
  const rowsXml = rows.map((r, i) => xlsxRow(r, i + 1)).join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${rowsXml}</sheetData>
</worksheet>`
}

function buildWorkbookXml(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Laporan" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`
}

function buildWorkbookRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"
    Target="worksheets/sheet1.xml"/>
</Relationships>`
}

function buildContentTypes(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml"  ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml"
    ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml"
    ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`
}

function buildRootRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1"
    Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
    Target="xl/workbook.xml"/>
</Relationships>`
}

// ──────────────────────────────────────────────────────────────────────────────
// Minimal ZIP builder (no compression — stored only, per DEFLATE=0 in OOXML)
// ZIP format: PKWARE spec 4.3 "Local file header" + "End of central directory"
// ──────────────────────────────────────────────────────────────────────────────

function toUint16LE(n: number): Uint8Array {
  const buf = new Uint8Array(2)
  buf[0] = n & 0xff
  buf[1] = (n >> 8) & 0xff
  return buf
}

function toUint32LE(n: number): Uint8Array {
  const buf = new Uint8Array(4)
  buf[0] = n & 0xff
  buf[1] = (n >> 8) & 0xff
  buf[2] = (n >> 16) & 0xff
  buf[3] = (n >> 24) & 0xff
  return buf
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const a of arrays) {
    out.set(a, offset)
    offset += a.length
  }
  return out
}

function crc32(data: Uint8Array): number {
  // CRC-32 table
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i++) {
    let c = i
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[i] = c
  }
  let crc = 0xffffffff
  for (const byte of data) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

type ZipEntry = { name: string; data: Uint8Array }

function buildZip(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder()
  const localHeaders: Uint8Array[] = []
  const centralHeaders: Uint8Array[] = []
  const offsets: number[] = []
  let offset = 0

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name)
    const crc = crc32(entry.data)
    const size = entry.data.length

    // Local file header (signature 0x04034b50)
    const local = concat(
      new Uint8Array([0x50, 0x4b, 0x03, 0x04]), // signature
      toUint16LE(20),                             // version needed
      toUint16LE(0),                              // flags
      toUint16LE(0),                              // compression: stored
      toUint16LE(0),                              // mod time
      toUint16LE(0),                              // mod date
      toUint32LE(crc),
      toUint32LE(size),
      toUint32LE(size),
      toUint16LE(nameBytes.length),
      toUint16LE(0),                              // extra field length
      nameBytes,
      entry.data,
    )
    offsets.push(offset)
    offset += local.length
    localHeaders.push(local)

    // Central directory header (signature 0x02014b50)
    const central = concat(
      new Uint8Array([0x50, 0x4b, 0x01, 0x02]), // signature
      toUint16LE(20),                             // version made by
      toUint16LE(20),                             // version needed
      toUint16LE(0),                              // flags
      toUint16LE(0),                              // compression: stored
      toUint16LE(0),                              // mod time
      toUint16LE(0),                              // mod date
      toUint32LE(crc),
      toUint32LE(size),
      toUint32LE(size),
      toUint16LE(nameBytes.length),
      toUint16LE(0),                              // extra
      toUint16LE(0),                              // comment
      toUint16LE(0),                              // disk start
      toUint16LE(0),                              // internal attrs
      toUint32LE(0),                              // external attrs
      toUint32LE(offsets[offsets.length - 1]),
      nameBytes,
    )
    centralHeaders.push(central)
  }

  const centralDir = concat(...centralHeaders)
  const centralDirSize = centralDir.length
  const centralDirOffset = offset

  // End of central directory record (signature 0x06054b50)
  const eocd = concat(
    new Uint8Array([0x50, 0x4b, 0x05, 0x06]), // signature
    toUint16LE(0),                              // disk number
    toUint16LE(0),                              // disk with cd start
    toUint16LE(entries.length),
    toUint16LE(entries.length),
    toUint32LE(centralDirSize),
    toUint32LE(centralDirOffset),
    toUint16LE(0),                              // comment length
  )

  return concat(...localHeaders, centralDir, eocd)
}

// ──────────────────────────────────────────────────────────────────────────────
// Public: buildXlsx
// ──────────────────────────────────────────────────────────────────────────────

export type ExportParams = {
  dateFrom: string
  dateTo: string
  orgUnitLabel: string
}

export function buildXlsx(report: PerformanceReport, params: ExportParams): Uint8Array {
  const encoder = new TextEncoder()

  const headerRow: Cell[] = [
    'Unit/Section',
    'Task Jatuh Tempo',
    'Selesai',
    'Progress Rata-rata (%)',
    'Tepat Waktu',
    'Rate Tepat Waktu (%)',
    'Terlambat',
  ]
  const summarySection: Cell[][] = [
    [`Laporan Task — ${params.dateFrom} s.d. ${params.dateTo} — ${params.orgUnitLabel}`],
    [],
    ['Ringkasan', '', '', '', '', '', ''],
    ['Task Jatuh Tempo', report.summary.dueCount],
    ['Selesai', report.summary.completedCount],
    ['Selesai Tepat Waktu', report.summary.onTimeCount],
    ['Rate Ketepatan Waktu (%)', report.summary.onTimeRate ?? 'N/A'],
    ['Terlambat', report.summary.lateCount],
    ['Progress Rata-rata (%)', report.summary.averageProgress],
    [],
    ['Per Unit/Section', '', '', '', '', '', ''],
    headerRow,
  ]
  const rowsData: Cell[][] = report.rows.map((row) => [
    row.parentUnitName ? `${row.parentUnitName} / ${row.orgUnitName}` : row.orgUnitName,
    row.dueCount,
    row.completedCount,
    row.averageProgress,
    row.onTimeCount,
    row.onTimeRate ?? 'N/A',
    row.lateCount,
  ])

  const lateSection: Cell[][] = [
    [],
    ['Task Terlambat', '', '', '', ''],
    ['Judul', 'PIC', 'Tenggat', 'Status', 'Progress (%)'],
    ...report.lateTasks.map((t) => [
      t.title,
      t.ownerName,
      formatDateId(t.dueDate),
      t.status,
      t.progressPct,
    ]),
  ]

  const allRows = [...summarySection, ...rowsData, ...lateSection]
  const sheetXml = buildSheetXml(allRows)

  const files: ZipEntry[] = [
    { name: '[Content_Types].xml',         data: encoder.encode(buildContentTypes()) },
    { name: '_rels/.rels',                  data: encoder.encode(buildRootRels()) },
    { name: 'xl/workbook.xml',              data: encoder.encode(buildWorkbookXml()) },
    { name: 'xl/_rels/workbook.xml.rels',   data: encoder.encode(buildWorkbookRels()) },
    { name: 'xl/worksheets/sheet1.xml',     data: encoder.encode(sheetXml) },
  ]

  return buildZip(files)
}

// ──────────────────────────────────────────────────────────────────────────────
// Public: buildPdfHtml — printable HTML yang browser akan cetak sebagai PDF
// ──────────────────────────────────────────────────────────────────────────────

export function buildPdfHtml(report: PerformanceReport, params: ExportParams): string {
  const rateStr = (rate: number | null) => (rate === null ? 'N/A' : `${rate}%`)

  const summaryRows = [
    ['Task Jatuh Tempo', report.summary.dueCount],
    ['Selesai', report.summary.completedCount],
    ['Selesai Tepat Waktu', `${report.summary.onTimeCount} (${rateStr(report.summary.onTimeRate)})`],
    ['Terlambat', report.summary.lateCount],
    ['Progress Rata-rata', `${report.summary.averageProgress}%`],
  ]
    .map(([k, v]) => `<tr><td>${escapeHtml(String(k))}</td><td>${escapeHtml(String(v))}</td></tr>`)
    .join('')

  const perUnitRows = report.rows
    .map((row) => {
      const name = row.parentUnitName
        ? `${escapeHtml(row.parentUnitName)} / ${escapeHtml(row.orgUnitName)}`
        : escapeHtml(row.orgUnitName)
      return `<tr>
        <td>${name}</td>
        <td class="num">${row.dueCount}</td>
        <td class="num">${row.completedCount}</td>
        <td class="num">${row.averageProgress}%</td>
        <td class="num">${row.onTimeCount} (${rateStr(row.onTimeRate)})</td>
        <td class="num">${row.lateCount}</td>
      </tr>`
    })
    .join('')

  const lateRows = report.lateTasks
    .map((t) => `<tr>
      <td>${escapeHtml(t.title)}</td>
      <td>${escapeHtml(t.ownerName)}</td>
      <td class="num">${escapeHtml(formatDateId(t.dueDate))}</td>
      <td>${escapeHtml(t.status)}</td>
      <td class="num">${t.progressPct}%</td>
    </tr>`)
    .join('')

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8"/>
  <title>Laporan Task — ${escapeHtml(params.dateFrom)} s.d. ${escapeHtml(params.dateTo)}</title>
  <style>
    @page { size: A4 landscape; margin: 1.5cm; }
    body { font-family: Arial, sans-serif; font-size: 10pt; color: #1e293b; }
    h1 { font-size: 14pt; margin: 0 0 2px; }
    p.sub { font-size: 9pt; color: #64748b; margin: 0 0 14px; }
    h2 { font-size: 11pt; margin: 18px 0 6px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    table { border-collapse: collapse; width: 100%; margin-bottom: 12px; }
    th, td { border: 1px solid #cbd5e1; padding: 4px 8px; text-align: left; }
    th { background: #f1f5f9; font-weight: 600; }
    td.num { text-align: right; }
    .summary-table { width: auto; min-width: 280px; }
    .footer { margin-top: 20px; font-size: 8pt; color: #94a3b8; }
  </style>
</head>
<body>
  <h1>LAPORAN TASK — DEPARTMENT OF ACCOUNTING</h1>
  <p class="sub">Periode: ${escapeHtml(params.dateFrom)} s.d. ${escapeHtml(params.dateTo)} &nbsp;|&nbsp; Cakupan: ${escapeHtml(params.orgUnitLabel)}</p>

  <h2>Ringkasan</h2>
  <table class="summary-table">
    <tbody>${summaryRows}</tbody>
  </table>

  <h2>Progress dan Ketepatan Waktu per Unit/Section</h2>
  ${report.rows.length === 0
    ? '<p>Tidak ada task dengan tenggat pada periode ini.</p>'
    : `<table>
    <thead><tr>
      <th>Unit/Section</th>
      <th>Jatuh Tempo</th>
      <th>Selesai</th>
      <th>Avg Progress</th>
      <th>Tepat Waktu</th>
      <th>Terlambat</th>
    </tr></thead>
    <tbody>${perUnitRows}</tbody>
  </table>`}

  <h2>Task Terlambat</h2>
  ${report.lateTasks.length === 0
    ? '<p>Tidak ada task terlambat pada periode ini.</p>'
    : `<table>
    <thead><tr>
      <th>Judul Task</th><th>PIC</th><th>Tenggat</th><th>Status</th><th>Progress</th>
    </tr></thead>
    <tbody>${lateRows}</tbody>
  </table>`}

  <p class="footer">
    Ketepatan waktu = task Done sebelum/saat tenggat ÷ seluruh task dengan tenggat dalam periode.
    Dicetak: ${escapeHtml(new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeZone: 'Asia/Jakarta' }).format(new Date()))}
  </p>
</body>
</html>`
}

/** Ekspor detail pekerjaan dalam cakupan izin pengguna, bukan ringkasan dashboard. */
export function buildTaskListXlsx(tasks: readonly TaskListItem[], params: ExportParams): Uint8Array {
  const rows: Cell[][] = [
    ['LAPORAN DETAIL TUGAS - ACCOUNTING SIG'],
    ['Periode pembuatan', params.dateFrom, 'sampai', params.dateTo],
    ['Cakupan', params.orgUnitLabel],
    [],
    ['Judul Tugas','Penanggung Jawab','Dibuat','Mulai','Tenggat','Status','Kemajuan (%)','Diselesaikan','Prioritas','Unit','Detail & Lampiran'],
    ...tasks.map(task=>[
      task.title,task.ownerName,formatDateId(task.createdAt),formatDateId(task.startDate),
      formatDateId(task.dueDate),taskStatusLabel(task.status),task.progressPct,
      task.completedAt?formatDateId(task.completedAt):'—',
      task.priority,task.orgUnitName,'/tasks/'+task.id,
    ] as Cell[]),
  ]
  const encoder = new TextEncoder()
  const sheetXml = buildSheetXml(rows)
  return buildZip([
    {name:'[Content_Types].xml',data:encoder.encode(buildContentTypes())},
    {name:'_rels/.rels',data:encoder.encode(buildRootRels())},
    {name:'xl/workbook.xml',data:encoder.encode(buildWorkbookXml())},
    {name:'xl/_rels/workbook.xml.rels',data:encoder.encode(buildWorkbookRels())},
    {name:'xl/worksheets/sheet1.xml',data:encoder.encode(sheetXml)},
  ])
}
