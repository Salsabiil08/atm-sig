import type { Metadata } from 'next'
import { getSessionUser, requireRole } from '@/lib/auth/session'
import ChangePasswordForm from './ChangePasswordForm'

export const metadata: Metadata = { title: 'Akun' }

export default async function AccountPage() {
  const user = await getSessionUser()
  requireRole(user, 'Staff/PIC')
  return (
    <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-xl font-bold text-slate-900">AKUN</h1>
        <p className="mt-1 text-sm text-slate-500">Kelola keamanan akun {user.email}.</p>
      </header>
      <ChangePasswordForm />
    </main>
  )
}
