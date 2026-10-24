import { describe,expect,it } from 'vitest'
import { buildPeriodWorkloads, type WorkloadTask } from './period-workload'
const task = (id:string,extra:Partial<WorkloadTask>={}):WorkloadTask=>({id,ownerId:'A',ownerName:'Alice',createdAt:'2026-09-01T00:00:00Z',startAt:'2026-09-01T00:00:00Z',dueAt:'2026-10-15T00:00:00Z',completedAt:null,status:'In progress',...extra})
const from='2026-10-01T00:00:00+07:00',to='2026-11-01T00:00:00+07:00'
describe('historical period jobload',()=>{
 it('includes Done and active, each task once for owner',()=>{
  const result=buildPeriodWorkloads([task('1',{completedAt:'2026-10-08T00:00:00Z',status:'Done'}),task('2')],[],from,to)
  expect(result[0]).toMatchObject({ownerId:'A',total:2,carryOver:2,completed:1,outstanding:1,completionRate:50})
 })
 it('counts reassigned task under both historical owners at most once each',()=>{
  const result=buildPeriodWorkloads([task('1',{ownerId:'B',ownerName:'Bob',completedAt:'2026-10-20T00:00:00Z',status:'Done'})],
   [{taskId:'1',fromId:'A',toId:'B',at:'2026-10-10T00:00:00Z'}],from,to)
  expect(result.map(x=>[x.ownerId,x.total,x.completed])).toEqual([['A',1,0],['B',1,1]])
 })
 it('does not count tasks completed before period',()=>{
  expect(buildPeriodWorkloads([task('1',{completedAt:'2026-09-15T00:00:00Z',status:'Done'})],[],from,to)).toEqual([])
 })
 it('rejects reversed dates',()=>{
  expect(()=>buildPeriodWorkloads([],[],to,from)).toThrow('Periode')
 })
})
