import type { Metadata } from 'next'
import { getSessionUser, requireRole } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'
import WorkspaceTabs, { MASTER_TABS } from '../_components/WorkspaceTabs'

export const metadata: Metadata = { title: 'Struktur Organisasi' }
type Unit = { id:number; name:string; type:'department'|'unit'|'section';parent_id:number|null }
export default async function OrganizationStructurePage() {
  const user = await getSessionUser()
  requireRole(user,'SM')
  const supabase = await createClient()
  const {data,error}=await supabase.from('org_units').select('id,name,type,parent_id').order('name')
  if(error) throw new Error('Gagal memuat master struktur organisasi.')
  const units = (data ?? []) as Unit[]
  const levels = {department:0,unit:1,section:2}
  const nodes = units.map(unit=>({ ...unit, parent:units.find(parent=>parent.id===unit.parent_id) }))
    .sort((a,b)=>levels[a.type]-levels[b.type] || a.name.localeCompare(b.name,'id'))
  return <main className="mx-auto max-w-5xl space-y-5 px-4 py-5 sm:px-6 lg:px-8">
    <WorkspaceTabs current="/org-structure" tabs={MASTER_TABS} roleLevel={user.roleLevel} />
    <header><h1 className="text-xl font-bold text-[var(--color-text-primary)]">Struktur Organisasi</h1>
      <p className="mt-1 text-sm text-[var(--color-text-secondary)]">Hirarki Department → Unit → Section sesuai data yang tersimpan.</p>
    </header>
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
      <table className="w-full min-w-[480px] text-left text-sm">
        <thead className="bg-[var(--color-bg-app)] text-[var(--color-text-secondary)]"><tr><th className="px-4 py-3">Nama</th><th className="px-4 py-3">Level</th><th className="px-4 py-3">Induk</th></tr></thead>
        <tbody>{nodes.map(unit=><tr key={unit.id} className="border-t border-[var(--color-border)] text-[var(--color-text-primary)]">
          <td className="px-4 py-3 font-semibold">{unit.name}</td><td className="px-4 py-3 capitalize">{unit.type}</td><td className="px-4 py-3">{unit.parent?.name??'—'}</td>
        </tr>)}
        {!nodes.length&&<tr><td colSpan={3} className="p-8 text-center">Struktur organisasi belum tersedia.</td></tr>}</tbody>
      </table>
    </div>
    <p className="text-xs text-[var(--color-text-muted)]">Tampilan read-only. Perubahan hirarki memerlukan validasi referensi user/task dan audit atomik.</p>
  </main>
}
