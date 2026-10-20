import type { Metadata } from 'next'
import Link from 'next/link'
import BrandLogo from '@/app/_components/BrandLogo'
import SignupForm from './_components/SignupForm'

export const metadata: Metadata = {
  title: 'Daftar akun',
  description: 'Buat akun Accounting Task Manager.',
}

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <BrandLogo className="h-20 w-[92px] object-contain" />
        <h1 className="mt-3 text-2xl font-bold text-slate-900">Daftar akun</h1>
        <p className="mt-2 text-sm text-slate-600">
          Konfirmasi email diperlukan sebelum masuk. Akun baru otomatis mendapat akses Spectator.
        </p>
        <SignupForm />
        <p className="mt-5 text-center text-sm text-slate-600">
          Sudah punya akun? <Link href="/login" className="font-medium text-slate-900 underline underline-offset-4">Masuk</Link>
        </p>
      </section>
    </main>
  )
}
