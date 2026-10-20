'use client'

export default function TaskDetailError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-lg font-semibold text-slate-900">Detail task tidak dapat dimuat</h1>
      <p className="mt-2 text-sm text-slate-600">
        Terjadi kendala saat mengambil data task. Silakan coba lagi.
      </p>
      <button
        className="mt-5 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        onClick={() => reset()}
        type="button"
      >
        Coba lagi
      </button>
    </main>
  )
}
