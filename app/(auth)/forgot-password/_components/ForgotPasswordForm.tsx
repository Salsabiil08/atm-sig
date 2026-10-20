'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)

    try {
      const callbackUrl = new URL('/auth/confirm', window.location.origin)
      callbackUrl.searchParams.set('next', 'reset-password')
      const { error: resetError } = await createClient().auth.resetPasswordForEmail(
        email.trim(),
        { redirectTo: callbackUrl.toString() },
      )

      if (resetError) {
        setError('Permintaan reset belum dapat diproses. Silakan coba lagi.')
        return
      }

      setNotice('Jika email tersebut terdaftar, tautan reset akan dikirim. Periksa kotak masuk dan folder spam.')
    } catch {
      setError('Tidak dapat terhubung ke layanan reset password. Silakan coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {notice && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
      <div>
        <label htmlFor="reset-email" className="mb-1.5 block text-sm font-medium text-slate-700">Email</label>
        <input id="reset-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900" disabled={busy} />
      </div>
      <button type="submit" disabled={busy} className="min-h-11 w-full rounded-md bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
        {busy ? 'Mengirim...' : 'Kirim tautan reset'}
      </button>
    </form>
  )
}
