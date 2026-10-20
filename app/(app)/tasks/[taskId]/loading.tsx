export default function TaskDetailLoading() {
  return (
    <main
      aria-label="Memuat detail task"
      aria-busy="true"
      className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8"
    >
      <div className="h-8 w-2/3 animate-pulse rounded bg-slate-200" />
      <div className="h-24 animate-pulse rounded-lg bg-white shadow-sm" />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-lg bg-white shadow-sm" />
        <div className="h-64 animate-pulse rounded-lg bg-white shadow-sm" />
      </div>
    </main>
  )
}
