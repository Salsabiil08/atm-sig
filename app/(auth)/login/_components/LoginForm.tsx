'use client'

// FR-001 — Komponen form login (Client Component karena ada interaksi browser)
// Sesuai Stitch mockup 01_sign_in: form dengan field email dan password
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginForm({ initialNotice }: { initialNotice?: string | null }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError('Email atau kata sandi tidak valid. Silakan coba lagi.')
        return
      }

      router.replace('/tasks')
      router.refresh()
    } catch {
      setError('Tidak dapat terhubung ke layanan login. Silakan coba lagi.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
      {initialNotice && (
        <div
          role="alert"
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {initialNotice}
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-lg border px-4 py-3 text-sm"
          style={{
            backgroundColor: '#FEF2F2',
            borderColor: '#FECACA',
            color: '#DC2626',
          }}
        >
          {error}
        </div>
      )}

      <div>
        <label
          htmlFor="email"
          className="block text-xs font-semibold mb-1.5"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="nama@sig.id"
          className="w-full px-3.5 py-3 sm:py-2.5 border border-gray-300 rounded-lg text-sm
                     text-gray-900 placeholder-gray-400 transition duration-150
                     disabled:bg-gray-50 disabled:text-gray-400"
          style={{
            outline: 'none',
          }}
          onFocus={(e) => {
            e.target.style.borderColor = '#1e293b'
            e.target.style.boxShadow = '0 0 0 1px #1e293b'
          }}
          onBlur={(e) => {
            e.target.style.borderColor = '#D1D5DB'
            e.target.style.boxShadow = 'none'
          }}
          disabled={loading}
        />
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-xs font-semibold mb-1.5"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Kata Sandi
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••••"
          className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm
                     text-gray-900 placeholder-gray-400 transition duration-150
                     disabled:bg-gray-50 disabled:text-gray-400"
          style={{ outline: 'none' }}
          onFocus={(e) => {
            e.target.style.borderColor = '#1e293b'
            e.target.style.boxShadow = '0 0 0 1px #1e293b'
          }}
          onBlur={(e) => {
            e.target.style.borderColor = '#D1D5DB'
            e.target.style.boxShadow = 'none'
          }}
          disabled={loading}
        />
      </div>

      <div className="pt-2">
        <button
          type="submit"
          id="btn-login"
          disabled={loading}
          aria-busy={loading}
          className="w-full py-3 px-4 text-white text-sm font-semibold rounded-lg
                     shadow transition duration-200 focus:outline-none
                     disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#18191f' }}
          onMouseEnter={(e) => {
            if (!loading) (e.target as HTMLButtonElement).style.backgroundColor = '#252730'
          }}
          onMouseLeave={(e) => {
            ;(e.target as HTMLButtonElement).style.backgroundColor = '#18191f'
          }}
        >
          {loading ? 'Memproses...' : 'Masuk'}
        </button>
      </div>
    </form>
  )
}
