'use client'

// D-030 — Top Header navigasi ATM (sesuai Stitch mockup 04_dashboard)
// Header merah SIG dengan logo, nama aplikasi, tanggal, dan info user

import { type SessionUser } from '@/lib/auth/session'
import ATMWordmark from '@/app/_components/ATMWordmark'
import ThemeToggle from '@/app/_components/ThemeToggle'
import JakartaClock from './JakartaClock'
import Link from 'next/link'
import LogoutButton from './LogoutButton'

type Props = { user: SessionUser; unreadCount?: number }

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

export default function TopHeader({ user, unreadCount = 0 }: Props) {
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
        <Link
          href="/notifications"
          aria-label={unreadCount > 0 ? `Notifikasi: ${unreadCount} belum dibaca` : 'Buka notifikasi'}
          className="relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white transition-colors hover:bg-black/15 focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>
          </svg>
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full bg-white px-1 text-[10px] font-bold text-[#a81c29]">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>
        <JakartaClock />
        <ThemeToggle onBrand />
        {/* Tanggal */}
        <div className="hidden rounded-md px-3.5 py-1.5 text-xs font-medium text-red-50 sm:block">
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
