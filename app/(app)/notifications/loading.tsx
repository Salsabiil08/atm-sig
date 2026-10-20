export default function NotificationsLoading() {
  return (
    <section
      role="status"
      aria-label="Memuat notifikasi"
      className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6 lg:px-8"
    >
      <span className="sr-only">Memuat notifikasi...</span>
      <div className="h-8 w-48 animate-pulse rounded bg-slate-200" />
      <div className="h-11 w-full animate-pulse rounded-lg bg-slate-200 sm:w-80" />
      <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="h-16 animate-pulse rounded bg-slate-100" />
        ))}
      </div>
    </section>
  )
}
