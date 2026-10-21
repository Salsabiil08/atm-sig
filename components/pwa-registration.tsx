'use client'

import { useEffect } from 'react'

/** Registers the worker; does not request notification permission. */
export default function PwaRegistration() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !window.isSecureContext) return
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.warn('ATM service worker registration failed', error)
    })
  }, [])
  return null
}
