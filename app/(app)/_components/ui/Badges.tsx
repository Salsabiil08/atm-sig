// Komponen UI reusable: Badge status task, prioritas, dll.
// Dipakai di seluruh aplikasi untuk konsistensi visual

import type { TaskStatus } from '@/lib/constants/rbac'

// =================== STATUS BADGE ===================

const STATUS_STYLES: Record<TaskStatus, { bg: string; text: string; label: string }> = {
  'To do':      { bg: '#F3F4F6', text: '#6B7280', label: 'Belum Dimulai'      },
  'In progress':{ bg: '#EFF6FF', text: '#2563EB', label: 'Dalam Pengerjaan' },
  'Blocked':    { bg: '#FEF2F2', text: '#DC2626', label: 'Terhambat'     },
  'Review':     { bg: '#F5F3FF', text: '#7C3AED', label: 'Menunggu Tinjauan'      },
  'Revisi':     { bg: '#FFFBEB', text: '#D97706', label: 'Perlu Revisi'      },
  'Done':       { bg: '#F0FDF4', text: '#16A34A', label: 'Selesai'        },
}

type StatusBadgeProps = {
  status: TaskStatus
  className?: string
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const { bg, text, label } = STATUS_STYLES[status]
  const statusClass = { 'To do': 'todo', 'In progress': 'progress', Blocked: 'blocked', Review: 'review', Revisi: 'revisi', Done: 'done' }[status]
  return (
    <span
      className={`atm-status-${statusClass} inline-block text-[11px] font-medium px-3 py-1 rounded-full ${className}`}
      style={{ backgroundColor: bg, color: text }}
    >
      {label}
    </span>
  )
}

// =================== PRIORITAS BADGE ===================

type Priority = 'rendah' | 'sedang' | 'tinggi'

const PRIORITY_STYLES: Record<Priority, { bg: string; text: string; label: string }> = {
  rendah: { bg: '#F0FDF4', text: '#16A34A', label: 'Rendah' },
  sedang: { bg: '#FFFBEB', text: '#D97706', label: 'Sedang' },
  tinggi: { bg: '#FEF2F2', text: '#DC2626', label: 'Tinggi' },
}

type PriorityBadgeProps = {
  priority: Priority
  className?: string
}

export function PriorityBadge({ priority, className = '' }: PriorityBadgeProps) {
  const { bg, text, label } = PRIORITY_STYLES[priority]
  return (
    <span
      className={`atm-priority-${priority} inline-block text-[11px] font-medium px-2.5 py-0.5 rounded-full ${className}`}
      style={{ backgroundColor: bg, color: text }}
    >
      {label}
    </span>
  )
}

// =================== PROGRESS BAR ===================

type ProgressBarProps = {
  value: number  // 0–100
  className?: string
  showLabel?: boolean
}

function progressColor(value: number, isOverdue?: boolean): string {
  if (isOverdue) return '#DC2626'
  if (value >= 100) return '#16A34A'
  if (value >= 80) return '#F59E0B'
  return '#3B82F6'
}

export function ProgressBar({ value, className = '', showLabel = true }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value))
  const color = progressColor(clamped)

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="w-24 bg-slate-100 rounded-full overflow-hidden" style={{ height: '6px' }}>
        <div
          className="atm-progress-fill h-full rounded-full"
          style={{ width: `${clamped}%`, backgroundColor: color }}
        />
      </div>
      {showLabel && (
        <span className="text-xs text-slate-700 font-medium min-w-[2.5rem]">
          {clamped}%
        </span>
      )}
    </div>
  )
}

// =================== TIME PROGRESS (waktu berjalan) ===================

type TimeProgressProps = {
  /** Persentase waktu berjalan (0–100+) */
  timePct: number
  isOverdue: boolean
  className?: string
}

export function TimeProgress({ timePct, isOverdue, className = '' }: TimeProgressProps) {
  if (isOverdue) {
    return (
      <span
        className={`atm-overdue inline-block text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${className}`}
        style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}
      >
        Lewat
      </span>
    )
  }
  return (
    <span className={`text-xs text-slate-600 font-medium ${className}`}>
      {Math.round(timePct)}%
    </span>
  )
}
