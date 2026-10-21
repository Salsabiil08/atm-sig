// FR-001, NFR-001 — Supabase server client (Server Components, Server Actions, Route Handlers)
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { connection } from 'next/server'
import { cache } from 'react'
import type { Database } from '@/lib/supabase/database.types'

// Dimemoize per request (React cache): semua pemanggil dalam satu request memakai
// satu instance client, sehingga fungsi lain yang di-cache berdasarkan referensi
// client (mis. getTaskScopeFilter) ikut ter-memoize. Di luar render React
// (mis. Route Handler) fungsi ini tetap berjalan normal tanpa memoization.
export const createClient = cache(async function createClient() {
  // supabase-js (auth) memakai Date.now() untuk cek kedaluwarsa token. Dengan
  // Cache Components nilai itu tidak boleh dihitung saat prerender, jadi tandai
  // sebagai request-time sebelum client dibuat.
  await connection()
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component memanggil setAll — abaikan;
            // middleware bertanggung jawab menyegarkan sesi.
          }
        },
      },
    }
  )
})
