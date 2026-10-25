import type { TaskStatus } from '@/lib/constants/rbac'

export const TASK_STATUS_LABELS: Record<TaskStatus,string> = {
  'To do':'Belum Dimulai',
  'In progress':'Dalam Pengerjaan',
  'Blocked':'Terhambat',
  'Review':'Menunggu Tinjauan',
  'Revisi':'Perlu Revisi',
  'Done':'Selesai',
}

export function taskStatusLabel(status:TaskStatus):string {
  return TASK_STATUS_LABELS[status]
}
