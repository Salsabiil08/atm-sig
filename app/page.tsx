// FR-001 — Halaman root: redirect ke /dashboard (sudah login) atau /login (belum)
// Middleware menangani redirect ini, halaman ini hanya fallback.
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/dashboard')
}
