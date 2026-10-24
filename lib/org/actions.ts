'use server'

import { revalidatePath } from 'next/cache'
import { getSessionUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

type UnitType = 'department'|'unit'|'section'
type OrgInput = {id?:number;name:string;type:UnitType;parentId:number|null}

async function requireSuperAdmin() {
  const user=await getSessionUser()
  if(user.roleLevel!==6) throw new Error('Hanya Super Admin dapat mengubah organisasi.')
  return createClient()
}

export async function saveOrgUnit(input:OrgInput):Promise<{data?:{id:number};error?:string}> {
  try {
    const supabase=await requireSuperAdmin()
    const name=input.name.trim()
    if(!name||name.length<2||name.length>100||!['department','unit','section'].includes(input.type))return {error:'Nama atau tipe unit tidak valid.'}
    if(input.type==='department'&&input.parentId!==null)return {error:'Department tidak boleh memiliki induk.'}
    if(input.type!=='department'&&(!Number.isInteger(input.parentId)||Number(input.parentId)<=0))return {error:'Induk wajib dipilih.'}
    if(input.id!==undefined&&(!Number.isInteger(input.id)||input.id<=0))return {error:'ID organisasi tidak valid.'}
    const q=input.id===undefined
      ? supabase.from('org_units').insert({name,type:input.type,parent_id:input.parentId}).select('id').single()
      : supabase.from('org_units').update({name,type:input.type,parent_id:input.parentId}).eq('id',input.id).select('id').single()
    const {data,error}=await q
    if(error||!data)return {error:'Gagal menyimpan. Periksa hak akses, hirarki, dan referensi aktif.'}
    revalidatePath('/org-structure');revalidatePath('/users')
    return {data:{id:data.id}}
  }catch {return {error:'Penyimpanan organisasi tidak berhasil.'}}
}

export async function deleteOrgUnit(id:number):Promise<{data?:{success:true};error?:string}> {
  try {
    const supabase=await requireSuperAdmin()
    if(!Number.isInteger(id)||id<=0)return {error:'ID organisasi tidak valid.'}
    const {data,error}=await supabase.from('org_units').delete().eq('id',id).select('id').maybeSingle()
    if(error||!data)return {error:'Tidak dapat menghapus organisasi yang dipakai atau di luar cakupan.'}
    revalidatePath('/org-structure')
    return {data:{success:true}}
  }catch {return {error:'Penghapusan organisasi ditolak.'}}
}
