import Link from 'next/link'
import NavIcon, {type NavIconName} from './NavIcon'
type Tab = { label: string; href: string; minLevel?: number; icon?: NavIconName }
type Props = { current: string; tabs: Tab[]; roleLevel?: number; label?: string }
export default function WorkspaceTabs({ current, tabs, roleLevel = 6, label = 'Tab halaman' }: Props) {
  return (
    <nav aria-label={label} className="mb-5 flex max-w-full gap-1 overflow-x-auto border-b border-[var(--color-border)] pb-2">
      {tabs.filter(tab => roleLevel >= (tab.minLevel ?? 1)).map(tab => (
        <Link key={tab.href} href={tab.href} aria-current={current === tab.href ? 'page' : undefined}
          className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${current === tab.href ? 'bg-[var(--color-brand-light)] text-[var(--color-brand)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-brand-muted)] hover:text-[var(--color-text-primary)]'}`}>
          {tab.icon && <NavIcon name={tab.icon} className="h-4 w-4 shrink-0" />}
          <span>{tab.label}</span>
        </Link>
      ))}
    </nav>
  )
}
export const WORK_TABS: Tab[] = [
  { label: 'Tugas Saya', icon: 'user', href: '/tasks?mine=1' },
  { label: 'Daftar Task', icon: 'tasks', href: '/tasks' },
  { label: 'Kanban', icon: 'kanban', href: '/kanban' },
  { label: 'Timeline', icon: 'timeline', href: '/timeline' },
]
export const DASHBOARD_TABS: Tab[] = [
  { label: 'Ringkasan', icon: 'dashboard', href: '/dashboard' },
  { label: 'Kinerja Aktif', icon: 'reports', href: '/performance' },
  { label: 'Jobload Periode', icon: 'jobload', href: '/jobload' },
]
export const APPROVAL_TABS: Tab[] = [
  { label: 'Review Task', icon: 'approval', href: '/review-inbox', minLevel: 3 },
  { label: 'Approval Deadline', icon: 'calendar', href: '/approvals', minLevel: 4 },
]
export const MASTER_TABS: Tab[] = [
  { label: 'Pengguna & Role', icon: 'user', href: '/users' },
  { label: 'Struktur Organisasi', icon: 'structure', href: '/org-structure' },
  { label: 'Kategori & Template', icon: 'master', href: '/task-templates' },
]
export const REPORT_TABS: Tab[] = [
  { label: 'Laporan Task', icon: 'reports', href: '/reports' },
  { label: 'Audit Log', icon: 'audit', href: '/audit-log' },
]
