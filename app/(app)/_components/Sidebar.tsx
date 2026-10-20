'use client'

// D-030 — Sidebar navigasi ATM (sesuai Stitch mockup 04_dashboard)
// Sidebar putih dengan border kanan, item dengan ikon, item aktif merah

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { SessionUser } from '@/lib/auth/session'

// =================== IKON SVG ===================

function IconDashboard({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

function IconKinerja({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
  )
}

function IconTask({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
    </svg>
  )
}

function IconApproval({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
    </svg>
  )
}

function IconBell({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  )
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
      />
    </svg>
  )
}

function IconReport({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  )
}

function IconAuditLog({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 12h6m-6 4h6M5 7h14M5 7a2 2 0 00-2 2v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2M5 7V5a2 2 0 012-2h10a2 2 0 012 2v2"
      />
    </svg>
  )
}

function IconTemplate({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
    </svg>
  )
}

// =================== NAV ITEMS ===================

type NavItem = {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  /** Minimum role level untuk menampilkan item ini */
  minLevel?: number
}

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',     label: 'Dashboard',            icon: IconDashboard, minLevel: 3 },
  { href: '/performance',   label: 'Kinerja & Job Load',   icon: IconKinerja,   minLevel: 3 },
  { href: '/tasks',         label: 'Task',                 icon: IconTask,      minLevel: 1 },
  { href: '/kanban',        label: 'Kanban',                icon: IconTask,      minLevel: 1 },
  { href: '/timeline',      label: 'Timeline',              icon: IconTask,      minLevel: 1 },
  { href: '/approvals',     label: 'Approval',             icon: IconApproval,  minLevel: 4 },
  { href: '/notifications', label: 'Notifikasi',           icon: IconBell,      minLevel: 1 },
  { href: '/users',         label: 'Master Data',          icon: IconUsers,     minLevel: 4 },
  { href: '/reports',       label: 'Laporan',              icon: IconReport,    minLevel: 3 },
  { href: '/audit-log',     label: 'Audit Log',            icon: IconAuditLog,  minLevel: 3 },
  { href: '/task-templates', label: 'Kategori & Template', icon: IconTemplate, minLevel: 4 },
]

type Props = { user: SessionUser }

export default function Sidebar({ user }: Props) {
  const pathname = usePathname()

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.minLevel || user.roleLevel >= item.minLevel
  )

  return (
    <aside
      className="flex w-full shrink-0 select-none border-b md:w-[var(--sidebar-width)] md:flex-col md:border-b-0 md:border-r"
      style={{
        backgroundColor: 'var(--color-bg-sidebar)',
        borderColor: 'var(--color-border)',
      }}
    >
      <nav
        className="overflow-x-auto py-2 md:flex-1 md:overflow-x-hidden md:overflow-y-auto"
        aria-label="Navigasi utama"
      >
        <ul className="flex w-max gap-0.5 md:w-full md:flex-col">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const Icon = item.icon
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  className={[
                    'flex min-h-10 items-center gap-2 whitespace-nowrap border-b-4 px-3 py-2 text-sm transition-colors md:gap-3 md:border-b-0 md:border-l-4 md:px-5 md:py-2.5',
                    isActive
                      ? 'border-[var(--color-brand)] bg-red-50 font-semibold text-[var(--color-brand)]'
                      : 'border-transparent font-normal text-slate-600 hover:bg-slate-50 hover:text-slate-900',
                  ].join(' ')}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon
                    className={[
                      'w-4 h-4 shrink-0',
                      isActive ? 'text-[var(--color-brand)]' : 'text-slate-400',
                    ].join(' ')}
                  />
                  <span>{item.label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
