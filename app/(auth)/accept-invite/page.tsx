import type { Metadata } from 'next'
import AuthPageShell from '../_components/AuthPageShell'
import AcceptInviteForm from './AcceptInviteForm'

export const metadata: Metadata = {
  title: 'Aktifkan akun',
  description: 'Atur kata sandi untuk menyelesaikan undangan akun.',
}

export default function AcceptInvitePage() {
  return (
    <AuthPageShell title="Aktifkan akun" description="Buat kata sandi untuk menyelesaikan undangan. Akun baru dimulai dengan akses Spectator.">
      <AcceptInviteForm />
      
    </AuthPageShell>
  )
}
