'use client'

import { useEffect, useState } from 'react'

type ThemeChoice = 'light' | 'dark' | 'system'
const STORAGE_KEY = 'atm-theme'

function isThemeChoice(value: string | null): value is ThemeChoice {
  return value === 'light' || value === 'dark' || value === 'system'
}

export default function ThemeToggle({ onBrand = false }: { onBrand?: boolean }) {
  const [choice, setChoice] = useState<ThemeChoice>('system')

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      setChoice(isThemeChoice(stored) ? stored : 'system')
    } catch {
      setChoice('system')
    }
  }, [])

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = () => {
      const dark = choice === 'dark' || (choice === 'system' && media.matches)
      document.documentElement.dataset.theme = dark ? 'dark' : 'light'
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [choice])

  function changeTheme(next: ThemeChoice) {
    setChoice(next)
    try { localStorage.setItem(STORAGE_KEY, next) } catch { /* private browsing */ }
  }

  return (
    <label className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-medium ${onBrand ? 'text-white' : 'text-[var(--color-text-secondary)]'}`}>
      <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2m0 16v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
      </svg>
      <span className="sr-only">Tema tampilan</span>
      <select
        aria-label="Tema tampilan"
        value={choice}
        onChange={(e) => changeTheme(e.target.value as ThemeChoice)}
        className={`cursor-pointer rounded-md border px-1.5 py-1.5 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 ${onBrand ? 'border-white/40 bg-black/15 text-white' : 'border-[var(--color-border)] bg-[var(--color-bg-card)] text-[var(--color-text-primary)]'}`}
      >
        <option value="light" className="text-black">Light</option>
        <option value="dark" className="text-black">Dark</option>
        <option value="system" className="text-black">Sistem</option>
      </select>
    </label>
  )
}
