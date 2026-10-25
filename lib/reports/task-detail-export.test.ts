import { describe, expect, it } from 'vitest'
import { buildTaskListXlsx } from './export'
import { buildTaskListPdf } from './pdf'
import type { TaskListItem } from '@/lib/tasks/queries'

const task:TaskListItem={
  id:'11111111-1111-4111-8111-111111111111',
  title:'Rekonsiliasi Bank',
  status:'Done',
  priority:'tinggi',
  progressPct:100,
  startDate:'2026-10-01T01:00:00+07:00',
  dueDate:'2026-10-25T17:00:00+07:00',
  completedAt:'2026-10-24T09:00:00+07:00',
  timePct:100,
  isOverdue:false,
  ownerName:'Staf Akuntansi',
  ownerId:'22222222-2222-4222-8222-222222222222',
  reviewerId:null,
  assignerName:'Manajer',
  reviewerName:null,
  orgUnitName:'Akuntansi',
  createdAt:'2026-10-01T00:00:00+07:00',
}
const params={dateFrom:'2026-10-01',dateTo:'2026-10-31',orgUnitLabel:'Akuntansi'}
describe('ekspor rincian tugas',()=>{
  it('creates detail PDF with task title, translated status, and detail path',()=>{
    const result=new TextDecoder().decode(buildTaskListPdf([task],params))
    expect(result.startsWith('%PDF-1.4')).toBe(true)
    expect(result).toContain('Rekonsiliasi Bank')
    expect(result).toContain('Selesai')
    expect(result).toContain('/tasks/'+task.id)
    expect(result.trimEnd().endsWith('%%EOF')).toBe(true)
  })
  it('creates OOXML spreadsheet archive with task metadata',()=>{
    const result=buildTaskListXlsx([task],params)
    expect(Array.from(result.slice(0,4))).toEqual([0x50,0x4b,0x03,0x04])
    const raw=new TextDecoder().decode(result)
    expect(raw).toContain('Rekonsiliasi Bank')
    expect(raw).toContain('Selesai')
    expect(raw).toContain('/tasks/'+task.id)
  })
  it('exports an empty task list without failing',()=>{
    expect(buildTaskListPdf([],params).length).toBeGreaterThan(100)
    expect(buildTaskListXlsx([],params).length).toBeGreaterThan(100)
  })
})
