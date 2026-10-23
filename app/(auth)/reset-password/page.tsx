import type { Metadata } from 'next'
import Link from 'next/link'
import AuthPageShell from '../_components/AuthPageShell'
import ResetPasswordForm from './_components/ResetPasswordForm'

export const metadata: Metadata = {
  title: 'Atur ulang kata sandi',
  description: 'Atur kata sandi baru setelah memverifikasi tautan email.',
}

export default function ResetPasswordPage() {
  return (
    <AuthPageShell title="Atur ulang kata sandi" description="Halaman ini hanya dapat digunakan melalui tautan reset yang valid dari email.">
      <ResetPasswordForm />
      <p className="mt-5 text-center text-sm text-slate-600"><Link href="/login" className="font-medium text-slate-900 underline underline-offset-4">Kembali ke masuk</Link></p>
    </AuthPageShell>
  )
}
