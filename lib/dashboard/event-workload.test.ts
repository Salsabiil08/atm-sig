import {describe,it,expect} from 'vitest'
import {buildEventWorkloads,type TaskStateEvent} from './event-workload'
import type {WorkloadTask} from './period-workload'

const from='2026-10-01T00:00:00+07:00',to='2026-11-01T00:00:00+07:00'
const task=(id:string,createdAt='2026-09-01T00:00:00Z'):WorkloadTask=>({
 id,ownerId:'A',ownerName:'Alice',createdAt,startAt:createdAt,
 dueAt:'2026-10-15T00:00:00Z',completedAt:null,status:'In progress',
})
const event=(taskId:string,at:string,ownerId='A',newStatus='In progress',
 oldStatus:string|null=null,isBaseline=false):TaskStateEvent=>({
 taskId,at,ownerId,newStatus,oldStatus,isBaseline,
 startAt:'2026-09-01T00:00:00Z',dueAt:'2026-10-15T00:00:00Z',
})
describe('reconstruction from complete task lifecycle events',()=>{
 it('counts carry-over and Done by event, not current snapshot',()=>{
  const tasks=[task('1')]
  const events=[event('1','2026-09-30T00:00:00Z','A','In progress',null,true),
    event('1','2026-10-20T00:00:00Z','A','Done','In progress')]
  const result=buildEventWorkloads(tasks,events,from,to,new Date('2026-11-02T00:00:00Z'))
  expect(result.uncertainTaskIds).toEqual([])
  expect(result.rows[0]).toMatchObject({total:1,carryOver:1,newTasks:0,completed:1,outstanding:0})
 })
 it('counts reassignment once per PIC and attributes completion to final owner',()=>{
  const events=[event('1','2026-09-30T00:00:00Z','A','In progress',null,true),
    event('1','2026-10-10T00:00:00Z','B','In progress','In progress'),
    event('1','2026-10-20T00:00:00Z','B','Done','In progress')]
  const report=buildEventWorkloads([task('1')],events,from,to,new Date('2026-11-02T00:00:00Z'))
  expect(report.rows.map(r=>[r.ownerId,r.total,r.completed])).toEqual([['A',1,0],['B',1,1]])
 })
 it('refuses to fabricate history before first known baseline',()=>{
  const report=buildEventWorkloads([task('old')],[event('old','2026-10-24T00:00:00Z','A','Done',null,true)],from,to)
  expect(report.rows).toEqual([])
  expect(report.uncertainTaskIds).toEqual(['old'])
 })
 it('treats reopen as outstanding at the period cutoff',()=>{
  const events=[event('1','2026-09-30T00:00:00Z','A','In progress',null,true),
    event('1','2026-10-08T00:00:00Z','A','Done','In progress'),
    event('1','2026-10-15T00:00:00Z','A','In progress','Done')]
  const report=buildEventWorkloads([task('1')],events,from,to,new Date('2026-11-02T00:00:00Z'))
  expect(report.rows[0]).toMatchObject({completed:0,outstanding:1,total:1})
 })
 it('does not count a task already Done before requested period',()=>{
  const events=[event('1','2026-09-20T00:00:00Z','A','Done',null,true)]
  const report=buildEventWorkloads([task('1')],events,from,to)
  expect(report.rows).toEqual([])
 })
})
