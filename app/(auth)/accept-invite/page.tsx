import type { Metadata } from 'next'
import BrandLogo from '@/app/_components/BrandLogo'
import AcceptInviteForm from './AcceptInviteForm'

export const metadata: Metadata = {
  title: 'Aktifkan akun',
  description: 'Atur kata sandi untuk menyelesaikan undangan akun.',
}

export default function AcceptInvitePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-5">
      <section className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <BrandLogo className="h-20 w-[92px] object-contain" />
        <h1 className="mt-3 text-2xl font-bold text-slate-900">Aktifkan akun</h1>
        <p className="mt-2 text-sm text-slate-600">
          Buat kata sandi untuk menyelesaikan undangan. Akun baru dimulai dengan akses Spectator.
        </p>
        <AcceptInviteForm />
      </section>
    </main>
  )
}
