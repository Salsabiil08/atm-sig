'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveOrgUnit, deleteOrgUnit } from '@/lib/org/actions'

type Unit={id:number;name:string;type:'department'|'unit'|'section';parent_id:number|null}
const field='mt-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-bg-card)] px-3 py-2 text-sm text-[var(--color-text-primary)]'

export default function OrgManagement({units}:{units:Unit[]}) {
  const router=useRouter()
  const [editing,setEditing]=useState<number|null>(null)
  const [name,setName]=useState('')
  const [type,setType]=useState<Unit['type']>('section')
  const [parentId,setParentId]=useState('')
  const [feedback,setFeedback]=useState('')
  const [pending,startTransition]=useTransition()
  const [confirmation,setConfirmation]=useState<number|null>(null)
  const eligibleParents=units.filter(u=>type==='unit'?u.type==='department':type==='section'?u.type==='unit':false)

  function edit(unit?:Unit) {
    setEditing(unit?.id??null);setName(unit?.name??'');setType(unit?.type??'section');setParentId(unit?.parent_id?.toString()??'');setFeedback('')
  }
  function save(){
    startTransition(async()=>{
      const result=await saveOrgUnit({id:editing??undefined,name,type,parentId:type==='department'?null:Number(parentId)})
      if(result.error){setFeedback(result.error);return}
      setFeedback('Perubahan organisasi berhasil disimpan dan dicatat audit.')
      edit();router.refresh()
    })
  }
  function remove(unit:Unit){
    if(confirmation!==unit.id){setConfirmation(unit.id);return}
    startTransition(async()=>{
      const result=await deleteOrgUnit(unit.id)
      setFeedback(result.error??'Unit telah dihapus, tindakan tercatat dalam audit.')
      setConfirmation(null);router.refresh()
    })
  }

  return <section aria-label="Kelola struktur organisasi" className="space-y-5">
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)] p-4">
      <h2 className="text-base font-semibold text-[var(--color-text-primary)]">{editing?'Edit unit':'Tambah unit organisasi'}</h2>
      <form className="mt-3 grid gap-3 sm:grid-cols-[1fr_160px_170px_auto]" onSubmit={e=>{e.preventDefault();save()}}>
        <label className="text-xs text-[var(--color-text-secondary)]">Nama<input className={field} value={name} required minLength={2} maxLength={100} onChange={e=>setName(e.target.value)}/></label>
        <label className="text-xs text-[var(--color-text-secondary)]">Tipe<select className={field} value={type} onChange={e=>{setType(e.target.value as Unit['type']);setParentId('')}}>
          <option value="department">Department</option><option value="unit">Unit</option><option value="section">Section</option>
        </select></label>
        <label className="text-xs text-[var(--color-text-secondary)]">Induk<select className={field} value={parentId} disabled={type==='department'} required={type!=='department'} onChange={e=>setParentId(e.target.value)}>
          <option value="">Pilih induk</option>{eligibleParents.filter(u=>u.id!==editing).map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
        </select></label>
        <div className="flex items-end gap-2"><button type="submit" disabled={pending} className="rounded-lg bg-[var(--color-brand)] px-3 py-2 text-sm font-semibold text-white disabled:opacity-50">Simpan</button>
          {editing&&<button type="button" onClick={()=>edit()} className="rounded-lg border border-[var(--color-border)] px-3 py-2 text-sm">Batal</button>}</div>
      </form>
    </div>
    {feedback&&<p role="status" className="rounded-lg bg-[var(--color-brand-light)] px-3 py-2 text-sm text-[var(--color-text-primary)]">{feedback}</p>}
    <div className="overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-bg-card)]">
      <table className="w-full min-w-[550px] text-left text-sm"><thead><tr className="bg-[var(--color-bg-app)] text-[var(--color-text-secondary)]"><th className="p-3">Nama</th><th className="p-3">Jenis</th><th className="p-3">Induk</th><th className="p-3">Tindakan</th></tr></thead>
        <tbody>{units.map(u=><tr key={u.id} className="border-t border-[var(--color-border)]"><td className="p-3">{u.name}</td><td className="p-3">{u.type}</td><td className="p-3">{units.find(p=>p.id===u.parent_id)?.name??'—'}</td>
          <td className="flex gap-2 p-3"><button onClick={()=>edit(u)} disabled={pending} className="text-sm font-semibold text-[var(--color-brand)]">Edit</button>
            <button onClick={()=>remove(u)} disabled={pending} className="text-sm font-semibold text-red-600">{confirmation===u.id?'Konfirmasi hapus':'Hapus'}</button></td>
        </tr>)}</tbody>
      </table>
    </div>
    <p className="text-xs text-[var(--color-text-muted)]">Perubahan parent/jenis untuk unit yang mempunyai anak, task atau user ditolak database. Penghapusan unit yang dirujuk juga ditolak.</p>
  </section>
}
