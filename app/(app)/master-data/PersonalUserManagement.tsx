'use client'

import { FormEvent, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type Props = {
  user: { name: string; email: string; role: string; orgUnitName: string }
}

export default function PersonalUserManagement({ user }: Props) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  function closeDialog() {
    if (busy) return
    setOpen(false)
    setError(null)
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setMessage(null)
    const form = event.currentTarget
    const data = new FormData(form)
    const oldPassword = String(data.get('oldPassword') ?? '')
    const newPassword = String(data.get('newPassword') ?? '')
    const confirmation = String(data.get('confirmation') ?? '')

    if (newPassword !== confirmation) {
      setError('Password baru tidak sama.')
      return
    }
    if (newPassword.length < 8) {
      setError('Password baru minimal 8 karakter.')
      return
    }

    setBusy(true)
    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: oldPassword,
      })
      if (signInError) {
        setError('Password lama salah.')
        return
      }
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) {
        setError('Password tidak berhasil diubah. Silakan coba lagi.')
        return
      }
      form.reset()
      setOpen(false)
      setMessage('Password Berhasil Diubah')
    } catch {
      setError('Password tidak berhasil diubah. Silakan coba lagi.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {message && <p className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800" role="status">{message}</p>}
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[820px] border-collapse text-left text-sm">
          <caption className="sr-only">Data akun pengguna aktif</caption>
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">No</th>
              <th className="px-4 py-3 font-semibold">Nama</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">Unit / section</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-slate-100 hover:bg-slate-50/70">
              <td className="px-4 py-3 text-slate-500">1</td>
              <td className="px-4 py-3 font-semibold text-slate-900">{user.name}</td>
              <td className="px-4 py-3 text-slate-600">{user.email}</td>
              <td className="px-4 py-3 text-slate-700">{user.role}</td>
              <td className="px-4 py-3 text-slate-700">{user.orgUnitName}</td>
              <td className="px-4 py-3"><span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-800">Aktif</span></td>
              <td className="px-4 py-3 text-right">
                <button type="button" onClick={() => { setOpen(true); setError(null); setMessage(null) }} className="rounded border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400">Ubah Password</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {open && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDialog() }}>
        <section role="dialog" aria-modal="true" aria-labelledby="change-password-title" className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div><h2 id="change-password-title" className="text-lg font-bold text-slate-900">Ubah Password</h2><p className="mt-1 text-sm text-slate-500">Masukkan password lama untuk memverifikasi akun Anda.</p></div>
            <button type="button" aria-label="Tutup dialog ubah password" onClick={closeDialog} disabled={busy} className="rounded px-2 py-1 text-xl text-slate-500 hover:bg-slate-100">×</button>
          </div>
          <form onSubmit={changePassword} className="mt-5 space-y-4">
            {error && <p className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">{error}</p>}
            <label className="block text-sm font-medium text-slate-700">Password lama<input name="oldPassword" type="password" autoComplete="current-password" required disabled={busy} className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 px-3" /></label>
            <label className="block text-sm font-medium text-slate-700">Password baru<input name="newPassword" type="password" autoComplete="new-password" minLength={8} required disabled={busy} className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 px-3" /></label>
            <label className="block text-sm font-medium text-slate-700">Ketik lagi password baru<input name="confirmation" type="password" autoComplete="new-password" minLength={8} required disabled={busy} className="mt-1 block min-h-11 w-full rounded-md border border-slate-300 px-3" /></label>
            <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={closeDialog} disabled={busy} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Batal</button><button type="submit" disabled={busy} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">{busy ? 'Menyimpan...' : 'Simpan Password'}</button></div>
          </form>
        </section>
      </div>}
    </>
  )
}
