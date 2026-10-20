import type { Metadata } from 'next'
import Link from 'next/link'
import BrandLogo from '@/app/_components/BrandLogo'
import ForgotPasswordForm from './_components/ForgotPasswordForm'

export const metadata: Metadata = {
  title: 'Lupa kata sandi',
  description: 'Minta tautan untuk mengatur ulang kata sandi.',
}

export default function ForgotPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <BrandLogo className="h-20 w-[92px] object-contain" />
        <h1 className="mt-3 text-2xl font-bold text-slate-900">Lupa kata sandi?</h1>
        <p className="mt-2 text-sm text-slate-600">Masukkan email akun. Jika terdaftar, kami akan mengirim tautan reset.</p>
        <ForgotPasswordForm />
        <p className="mt-5 text-center text-sm text-slate-600">
          <Link href="/login" className="font-medium text-slate-900 underline underline-offset-4">Kembali ke masuk</Link>
        </p>
      </section>
    </main>
  )
}
