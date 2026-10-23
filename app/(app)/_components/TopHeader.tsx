'use client'

// D-030 — Top Header navigasi ATM (sesuai Stitch mockup 04_dashboard)
// Header merah SIG dengan logo, nama aplikasi, tanggal, dan info user

import { type SessionUser } from '@/lib/auth/session'
import ATMWordmark from '@/app/_components/ATMWordmark'
import ThemeToggle from '@/app/_components/ThemeToggle'
import LogoutButton from './LogoutButton'

type Props = { user: SessionUser }

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? '')
    .join('')
}

function getTodayLabel(): string {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Jakarta',
  }).format(new Date())
}

// Warna avatar berdasarkan hash nama
const AVATAR_COLORS = [
  '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316', '#06B6D4',
]

function avatarColor(name: string): string {
  let hash = 0
  for (const c of name) hash = (hash * 31 + c.charCodeAt(0)) & 0xffffffff
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export default function TopHeader({ user }: Props) {
  const initials = getInitials(user.name)
  const today = getTodayLabel()
  const bgColor = avatarColor(user.name)

  return (
    <header
      className="flex shrink-0 items-center justify-between gap-2 px-3 shadow-sm sm:px-6"
      style={{
        backgroundColor: 'var(--color-brand)',
        height: 'var(--header-height)',
      }}
    >
      {/* Wordmark saja: tanpa icon checklist, badge putih, atau teks duplikat. */}
      <div className="flex min-w-0 shrink-0 items-center">
        <ATMWordmark variant="light" className="w-[96px] sm:w-[116px]" />
      </div>

      {/* Kanan: Appearance, tanggal, dan akun */}
      <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-4">
        <ThemeToggle onBrand />
        {/* Tanggal */}
        <div
          className="hidden rounded-md px-3.5 py-1.5 text-xs font-medium text-red-50 sm:block"
          style={{ backgroundColor: 'rgba(180, 35, 24, 0.7)' }}
        >
          {today}
        </div>

        {/* Info user + avatar + logout */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden text-right leading-tight sm:block">
            <p className="text-xs font-bold text-white">{user.name}</p>
            <p className="text-[11px] text-red-200">{user.role}</p>
          </div>
          <div
            className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white shadow sm:h-8 sm:w-8"
            style={{ backgroundColor: bgColor }}
            aria-label={`Avatar ${user.name}`}
          >
            {initials}
          </div>
          <LogoutButton compact />
        </div>
      </div>
    </header>
  )
}
