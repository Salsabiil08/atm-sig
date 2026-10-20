'use client'

export default function TaskTemplatesError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <div role="alert" className="rounded-xl border border-red-200 bg-white p-6">
        <h1 className="text-lg font-semibold text-slate-900">Kategori &amp; template task gagal dimuat</h1>
        <p className="mt-2 text-sm text-slate-600">
          Terjadi kendala saat mengambil data master. Silakan coba lagi.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
        >
          Coba lagi
        </button>
      </div>
    </section>
  )
}
