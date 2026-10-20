// Batas Suspense untuk semua halaman di grup (app).
// Dengan Cache Components, halaman yang membaca sesi/data Supabase harus berada
// di dalam <Suspense> agar route tidak dianggap "blocking".
export default function AppLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex h-full min-h-[240px] items-center justify-center text-sm text-gray-500"
    >
      Memuat halaman...
    </div>
  )
}
