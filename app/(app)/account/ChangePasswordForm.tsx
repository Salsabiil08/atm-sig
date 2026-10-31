'use client'

import { FormEvent, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function ChangePasswordForm() {
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage('')
    setError('')
    const data = new FormData(event.currentTarget)
    const password = String(data.get('password') ?? '')
    const confirmation = String(data.get('confirmation') ?? '')
    if (password.length < 8) return setError('Password baru minimal 8 karakter.')
    if (password !== confirmation) return setError('Konfirmasi password tidak sama.')
    setSaving(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setSaving(false)
    if (updateError) return setError('Password tidak berhasil diperbarui. Silakan coba lagi.')
    event.currentTarget.reset()
    setMessage('Password berhasil diperbarui.')
  }

  return (
    <form onSubmit={submit} className="max-w-xl space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <label className="block text-sm font-medium text-slate-700">Password baru
        <input name="password" type="password" minLength={8} required autoComplete="new-password" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
      </label>
      <label className="block text-sm font-medium text-slate-700">Konfirmasi password baru
        <input name="confirmation" type="password" minLength={8} required autoComplete="new-password" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
      </label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {message && <p role="status" className="text-sm text-green-700">{message}</p>}
      <button disabled={saving} className="rounded-lg bg-[var(--color-brand)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
        {saving ? 'Menyimpan…' : 'Perbarui password'}
      </button>
    </form>
  )
}
