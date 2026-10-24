import Link from 'next/link'
type Tab = { label: string; href: string; minLevel?: number }
type Props = { current: string; tabs: Tab[]; roleLevel?: number; label?: string }
export default function WorkspaceTabs({ current, tabs, roleLevel = 6, label = 'Tab halaman' }: Props) {
  return (
    <nav aria-label={label} className="mb-5 flex max-w-full gap-1 overflow-x-auto border-b border-[var(--color-border)] pb-2">
      {tabs.filter(tab => roleLevel >= (tab.minLevel ?? 1)).map(tab => (
        <Link key={tab.href} href={tab.href} aria-current={current === tab.href ? 'page' : undefined}
          className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${current === tab.href ? 'bg-[var(--color-brand-light)] text-[var(--color-brand)]' : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-brand-muted)] hover:text-[var(--color-text-primary)]'}`}>
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}
export const WORK_TABS: Tab[] = [
  { label: 'Tugas Saya', href: '/tasks?mine=1' },
  { label: 'Daftar Task', href: '/tasks' },
  { label: 'Kanban', href: '/kanban' },
  { label: 'Timeline', href: '/timeline' },
]
export const DASHBOARD_TABS: Tab[] = [
  { label: 'Ringkasan', href: '/dashboard' },
  { label: 'Kinerja & Job Load', href: '/performance' },
]
export const APPROVAL_TABS: Tab[] = [
  { label: 'Review Task', href: '/review-inbox', minLevel: 3 },
  { label: 'Approval Deadline', href: '/approvals', minLevel: 4 },
]
export const MASTER_TABS: Tab[] = [
  { label: 'Pengguna & Role', href: '/users' },
  { label: 'Kategori & Template', href: '/task-templates' },
]
export const REPORT_TABS: Tab[] = [
  { label: 'Laporan Task', href: '/reports' },
  { label: 'Audit Log', href: '/audit-log' },
]
