'use client'

import { useState } from 'react'

function decodeVapidKey(key: string) {
  const normalized = (key + '='.repeat((4 - key.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(normalized), char => char.charCodeAt(0))
}

export default function PushPermissionButton() {
  const [status, setStatus] = useState('')
  async function subscribe() {
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!key || !('Notification' in window) || !('serviceWorker' in navigator) || !window.isSecureContext) {
      setStatus('Push belum tersedia pada browser atau server ini.')
      return
    }
    try {
      if (await Notification.requestPermission() !== 'granted') {
        setStatus('Izin notifikasi belum diberikan.')
        return
      }
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(key),
      })
      const response = await fetch('/api/push/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      })
      if (!response.ok) throw new Error('Subscription gagal disimpan')
      setStatus('Notifikasi perangkat aktif.')
    } catch {
      setStatus('Gagal mengaktifkan notifikasi. Coba lagi setelah masuk ke akun.')
    }
  }
  async function unsubscribe() {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      if (subscription) {
        const response = await fetch('/api/push/subscription', {
          method: 'DELETE', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
        if (!response.ok) throw new Error('Subscription gagal dihapus')
        await subscription.unsubscribe()
      }
      setStatus('Notifikasi perangkat dinonaktifkan.')
    } catch { setStatus('Gagal menonaktifkan notifikasi.') }
  }
  return <div>
    <button type="button" onClick={subscribe}>Aktifkan notifikasi perangkat</button>
    <button type="button" onClick={unsubscribe}>Nonaktifkan notifikasi perangkat</button>
    {status && <p role="status">{status}</p>}
  </div>
}
