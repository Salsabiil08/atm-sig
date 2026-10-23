// FR-001, FR-002 — Halaman login ATM
// Responsive single-column sign-in: mobile full-width, desktop centered card

import type { Metadata } from 'next'
import { Suspense } from 'react'
import ATMWordmark from '@/app/_components/ATMWordmark'
import ThemeToggle from '@/app/_components/ThemeToggle'
import LoginForm from './_components/LoginForm'

export const metadata: Metadata = {
  title: 'Masuk',
  description: 'Masuk ke Accounting Task Manager PT Semen Indonesia Group',
}

type LoginPageProps = {
  searchParams: Promise<{ error?: string | string[]; notice?: string | string[] }>
}

async function LoginNotice({ searchParams }: LoginPageProps) {
  const params = await searchParams
  const errorCode = Array.isArray(params.error) ? params.error[0] : params.error
  const noticeCode = Array.isArray(params.notice) ? params.notice[0] : params.notice
  const notice = errorCode === 'account_inactive'
    ? 'Akun Anda nonaktif. Hubungi administrator untuk meminta akses kembali.'
    : errorCode === 'account_unavailable'
      ? 'Login berhasil, tetapi profil atau role akun tidak dapat diverifikasi. Hubungi administrator untuk memeriksa profil akun di sistem.'
      : errorCode === 'invite_invalid'
        ? 'Tautan undangan tidak valid atau sudah kedaluwarsa. Minta administrator mengirim ulang.'
        : errorCode === 'auth_link_invalid'
          ? 'Tautan autentikasi tidak valid atau kedaluwarsa. Silakan minta tautan baru.'
          : noticeCode === 'email_confirmed'
            ? 'Email berhasil dikonfirmasi. Silakan masuk.'
            : noticeCode === 'password_updated'
              ? 'Kata sandi berhasil diperbarui. Silakan masuk dengan kata sandi baru.'
              : null

  if (!notice) return null
  return (
    <div
        role="alert"
        className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
        {notice}
    </div>
  )
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <main className="atm-login-page relative flex min-h-dvh w-full items-start justify-center bg-white px-4 pb-8 pt-14 sm:items-center sm:px-8 sm:py-10">
      <div className="absolute right-4 top-3 sm:right-8 sm:top-6"><ThemeToggle /></div>
      <section
        aria-labelledby="login-heading"
        className="atm-login-card w-full max-w-[460px] bg-white px-2 py-7 sm:rounded-2xl sm:border sm:border-red-100 sm:px-10 sm:py-11 sm:shadow-[0_10px_35px_-4px_rgba(230,150,150,0.15)]"
      >
        <div className="mb-12 flex justify-center sm:mb-7">
          <ATMWordmark
            variant="dark"
            showSubtitle
            className="w-[min(76vw,310px)] sm:w-[210px]"
          />
        </div>

        <div className="mb-8 hidden text-center sm:block">
          <h1 id="login-heading" className="text-[26px] font-bold tracking-tight text-gray-900">
            Masuk
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-gray-500">
            Masuk untuk mengelola task Department of Accounting
          </p>
        </div>
        <h1 className="sr-only sm:hidden">Masuk ke Accounting Task Manager</h1>

        <Suspense fallback={null}>
          <LoginNotice searchParams={searchParams} />
        </Suspense>
        <LoginForm />

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Login pertama otomatis berstatus Spectator
          </p>
          <div className="mt-4 flex justify-center gap-4 text-sm">
            <a href="/signup" className="font-medium text-slate-700 underline underline-offset-4">
              Daftar akun
            </a>
            <a href="/forgot-password" className="font-medium text-slate-700 underline underline-offset-4">
              Lupa kata sandi?
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}
