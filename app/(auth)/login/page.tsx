// FR-001, FR-002 — Halaman login ATM
// Sesuai Stitch mockup 01_sign_in: layout 2 kolom (brand sidebar kiri + form kanan)

import type { Metadata } from 'next'
import { Suspense } from 'react'
import BrandLogo from '@/app/_components/BrandLogo'
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
    <main className="min-h-screen w-full flex flex-col md:flex-row bg-[#fafafa]">
      {/* Kiri: Brand section — gelap dengan dekorasi */}
      <section
        className="relative w-full md:w-[48%] min-h-[300px] md:min-h-screen flex flex-col justify-between p-8 sm:p-12 lg:p-16 overflow-hidden"
        style={{ backgroundColor: '#212325' }}
        aria-label="Brand ATM"
      >
        {/* Garis merah bawah */}
        <div
          className="absolute bottom-0 left-0 right-0 z-20"
          style={{ height: '6px', backgroundColor: '#D32F2F' }}
        />

        {/* Header brand */}
        <div className="z-20 relative">
          <BrandLogo className="h-36 w-40 rounded-xl bg-white object-contain p-1 shadow-md sm:h-40 sm:w-44" priority />
        </div>

        {/* Dekorasi bar chart latar */}
        <div aria-hidden="true" className="absolute inset-0 pointer-events-none z-0">
          {[
            { h: '14rem', l: '4rem' },
            { h: '20rem', l: '9rem' },
            { h: '12rem', l: '14rem' },
            { h: '24rem', l: '19rem' },
            { h: '16rem', l: '23.5rem' },
          ].map((bar, i) => (
            <div
              key={i}
              className="absolute bottom-0 w-16"
              style={{
                height: bar.h,
                left: bar.l,
                backgroundColor: 'rgba(255,255,255,0.08)',
              }}
            />
          ))}
        </div>

        {/* Teks brand bawah */}
        <div className="z-20 relative pt-32 pb-4">
          <h1
            className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight"
            style={{ color: '#FFFFFF' }}
          >
            Accounting Task Manager
          </h1>
          <p className="text-sm font-normal mt-2.5" style={{ color: '#9CA3AF' }}>
            Department of Accounting
          </p>
        </div>
      </section>

      {/* Kanan: Form login */}
      <section
        className="w-full md:w-[52%] min-h-screen flex items-center justify-center p-6 sm:p-10 lg:p-16"
        style={{ backgroundColor: '#fafafa' }}
      >
        <div
          className="w-full max-w-[460px] bg-white rounded-2xl p-8 sm:p-11"
          style={{
            boxShadow: '0 10px 35px -4px rgba(230,150,150,0.18)',
            border: '1px solid #fbdcdc',
          }}
        >
          {/* ATM Badge di atas form */}
          <div className="flex justify-center mb-4">
            <BrandLogo className="h-[76px] w-[86px] object-contain sm:h-[88px] sm:w-[100px]" />
          </div>

          {/* Header form */}
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-[26px] font-bold text-gray-900 tracking-tight">
              Masuk
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 mt-1.5 font-normal leading-relaxed">
              Masuk untuk mengelola task Department of Accounting
            </p>
          </div>

          <Suspense fallback={null}>
            <LoginNotice searchParams={searchParams} />
          </Suspense>
          <LoginForm />

          {/* Hint bawah */}
          <div className="text-center mt-6">
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
        </div>
      </section>
    </main>
  )
}
