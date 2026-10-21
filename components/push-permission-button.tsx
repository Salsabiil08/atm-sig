'use client'

import { useEffect, useState } from 'react'

function decodeVapidKey(key: string) {
  const normalized = (key + '='.repeat((4 - key.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(normalized), char => char.charCodeAt(0))
}

type State = 'checking' | 'unsupported' | 'blocked' | 'not-subscribed' | 'subscribed' | 'error'

export default function PushPermissionButton() {
  const [state, setState] = useState<State>('checking')
  const [message, setMessage] = useState('Memeriksa notifikasi perangkat…')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function check() {
      if (!window.isSecureContext || !('Notification' in window) ||
          !('serviceWorker' in navigator) || !('PushManager' in window)) {
        if (!cancelled) { setState('unsupported'); setMessage('Browser ini tidak mendukung Web Push. Gunakan Chrome Android melalui HTTPS.') }
        return
      }
      if (Notification.permission === 'denied') {
        if (!cancelled) { setState('blocked'); setMessage('Notifikasi diblokir. Ubah izin notifikasi aplikasi di pengaturan Android/Chrome.') }
        return
      }
      try {
        const registration = await navigator.serviceWorker.register('/sw.js')
        const subscription = await registration.pushManager.getSubscription()
        if (cancelled) return
        setState(subscription ? 'subscribed' : 'not-subscribed')
        setMessage(subscription
          ? 'Perangkat pernah berlangganan. Tekan Aktifkan untuk memastikan akun ini terhubung ke server.'
          : 'Perangkat belum terdaftar. Tekan Aktifkan untuk mulai menerima push.')
      } catch {
        if (!cancelled) { setState('error'); setMessage('Service worker gagal dipasang. Periksa koneksi HTTPS dan instal ulang aplikasi jika perlu.') }
      }
    }
    void check()
    return () => { cancelled = true }
  }, [])

  async function subscribe() {
    if (busy) return
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!key || key.length < 60) {
      setState('error')
      setMessage('Public key VAPID belum tersedia pada deployment ini. Administrator perlu menambahkan konfigurasi lalu deploy ulang.')
      return
    }
    if (!('Notification' in window) || !('serviceWorker' in navigator) ||
        !('PushManager' in window) || !window.isSecureContext) {
      setState('unsupported')
      setMessage('Web Push tidak didukung pada browser/perangkat ini.')
      return
    }
    setBusy(true)
    try {
      if (await Notification.requestPermission() !== 'granted') {
        setState('blocked')
        setMessage('Izin notifikasi ditolak. Aktifkan izin notifikasi ATM di pengaturan Android.')
        return
      }
      const registration = await navigator.serviceWorker.register('/sw.js')
      let subscription = await registration.pushManager.getSubscription()
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidKey(key),
        })
      }
      const response = await fetch('/api/push/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      })
      if (!response.ok) {
        const details = await response.json().catch(() => null)
        throw new Error(typeof details?.error === 'string'
          ? details.error : 'Server menolak pendaftaran (' + response.status + ')')
      }
      setState('subscribed')
      setMessage('Perangkat berhasil terdaftar pada server. Notifikasi baru akan dikirim saat pemicu push berjalan.')
    } catch (error) {
      setState('error')
      setMessage('Pendaftaran gagal: ' + (error instanceof Error ? error.message : 'kesalahan tidak diketahui'))
    } finally {
      setBusy(false)
    }
  }

  async function unsubscribe() {
    if (busy || !('serviceWorker' in navigator)) return
    setBusy(true)
    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        const response = await fetch('/api/push/subscription', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
        if (!response.ok) throw new Error('Server gagal menghapus perangkat (' + response.status + ')')
        await subscription.unsubscribe()
      }
      setState('not-subscribed')
      setMessage('Notifikasi perangkat sudah dinonaktifkan.')
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Gagal menonaktifkan perangkat.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div role="status" aria-live="polite" className="text-sm text-slate-700">
        <span className="font-semibold">Status Android: </span>{message}
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={busy || state === 'unsupported'}
          onClick={subscribe}
          className="rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50">
          {busy ? 'Memproses…' : 'Aktifkan notifikasi perangkat'}
        </button>
        <button type="button" disabled={busy || state === 'unsupported'}
          onClick={unsubscribe}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-100 disabled:opacity-50">
          Nonaktifkan
        </button>
      </div>
      {state === 'subscribed' && <p className="text-xs text-slate-500">
        Push hanya berlaku untuk notifikasi baru setelah perangkat terdaftar; notifikasi lama tetap ada di inbox web.
      </p>}
    </div>
  )
}
