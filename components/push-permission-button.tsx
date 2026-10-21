'use client'

import { useState } from 'react'

/** UI opt-in only. Server-side subscription storage and push delivery must be implemented separately. */
export default function PushPermissionButton() {
  const [status, setStatus] = useState<string>('')

  async function requestPermission() {
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !window.isSecureContext) {
      setStatus('Browser ini tidak mendukung push notification.')
      return
    }
    try {
      const permission = await Notification.requestPermission()
      setStatus(permission === 'granted'
        ? 'Izin diberikan. Pengiriman push belum aktif sampai langganan perangkat tersimpan.'
        : permission === 'denied' ? 'Izin ditolak di pengaturan browser.' : 'Izin belum diberikan.')
    } catch {
      setStatus('Tidak dapat meminta izin notifikasi.')
    }
  }

  return <div>
    <button type="button" onClick={requestPermission}>Aktifkan notifikasi perangkat</button>
    {status && <p role="status">{status}</p>}
  </div>
}
