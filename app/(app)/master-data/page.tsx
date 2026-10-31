import type { Metadata } from 'next'
import { getSessionUser, requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import PersonalUserManagement from './PersonalUserManagement'

export const metadata: Metadata = { title: 'Master Data' }

export default async function MasterDataPage() {
  const user = await getSessionUser()
  requireRole(user, 'Staff/PIC')
  const supabase = await createClient()
  const { data: units, error } = await supabase.from('org_units').select('id,name,type,parent_id').order('id')
  if (error || !units) throw new Error('Master data organisasi tidak dapat dimuat.')
  const byId = new Map(units.map(unit => [unit.id, unit]))
  const chain: typeof units = []
  let current = byId.get(user.orgUnitId)
  const visited = new Set<number>()
  while (current && !visited.has(current.id)) {
    visited.add(current.id)
    chain.unshift(current)
    current = current.parent_id === null ? undefined : byId.get(current.parent_id)
  }

  return (
    <main className="px-4 py-6 sm:px-6 lg:px-8">
      <header>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">MASTER DATA USERS</h1>
        <p className="mt-1 text-sm text-slate-500">Kelola keamanan akun Anda. Data profil dan penempatan organisasi bersifat hanya-baca.</p>
      </header>
      <div className="mt-6"><PersonalUserManagement user={{ name: user.name, email: user.email, role: user.role, orgUnitName: byId.get(user.orgUnitId)?.name ?? 'Tidak tersedia' }} /></div>
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-semibold text-slate-900">Struktur Organisasi Saya</h2>
        <ol className="mt-4 space-y-3">
          {chain.map((unit, index) => <li key={unit.id} className="flex items-center gap-3 text-sm"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--color-brand-light)] font-bold text-[var(--color-brand)]">{index + 1}</span><span><strong>{unit.name}</strong> <span className="text-slate-500">({unit.type})</span></span></li>)}
        </ol>
      </section>
    </main>
  )
}
