'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function AcceptInviteForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Kata sandi harus memiliki minimal 8 karakter.')
      return
    }
    if (password !== confirmation) {
      setError('Konfirmasi kata sandi tidak sama.')
      return
    }

    setBusy(true)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) {
        setError('Undangan tidak valid atau sudah kedaluwarsa. Minta administrator mengirim ulang.')
        return
      }
      router.replace('/tasks')
      router.refresh()
    } catch {
      setError('Kata sandi tidak dapat disimpan. Silakan coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      <div>
        <label htmlFor="invite-password" className="mb-1.5 block text-sm font-medium text-slate-700">
          Kata sandi baru
        </label>
        <input
          id="invite-password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
        />
      </div>
      <div>
        <label htmlFor="invite-password-confirm" className="mb-1.5 block text-sm font-medium text-slate-700">
          Ulangi kata sandi
        </label>
        <input
          id="invite-password-confirm"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          className="min-h-11 w-full rounded-md border border-slate-300 px-3 text-sm text-slate-900 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
        />
      </div>
      <button
        type="submit"
        disabled={busy}
        className="min-h-11 w-full rounded-md bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? 'Menyimpan...' : 'Atur kata sandi'}
      </button>
    </form>
  )
}
