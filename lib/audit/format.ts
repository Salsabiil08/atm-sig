/** Presentation-only audit formatting. Original audit evidence stays unchanged in DB. */
const labels:Record<string,string>={title:'Judul',status:'Status',priority:'Prioritas',progress_pct:'Kemajuan',due_date:'Tenggat',start_date:'Tanggal mulai',completed_at:'Diselesaikan',name:'Nama',roleId:'Peran',orgUnitId:'Unit organisasi',supervisorId:'Atasan',role_id:'Peran',org_unit_id:'Unit organisasi',supervisor_id:'Atasan',owner_id:'Penanggung jawab',reviewer_id:'Peninjau',recurrence:'Pengulangan',recurrence_day:'Hari pengulangan',is_active:'Aktif',next_run_at:'Jadwal berikutnya'};
const technicalKeys=new Set(['id','created_at','updated_at','created_by','assigner_id','parent_task_id','category_id','org_unit_id','owner_id','reviewer_id' ,'next_run_at']);
function parse(value:string|null):unknown {if(value===null)return null;try{return JSON.parse(value)}catch{return value}}
function comparable(value:unknown):string {return JSON.stringify(value)}
function fmt(value:unknown,key?:string):string{
 if(value===null||value===undefined||value==='')return '—'
 if(typeof value==='boolean')return value?'Ya':'Tidak'
 if(typeof value==='object')return 'Detail tercatat'
 const str=String(value)
 if(/^(\d{4}-\d\d-\d\d)(T| )/.test(str)){
  const date=new Date(str);if(Number.isFinite(date.getTime()))return new Intl.DateTimeFormat('id-ID',{timeZone:'Asia/Jakarta',dateStyle:'medium',timeStyle:'short'}).format(date)
 }
 if(key==='roleId'||key==='role_id')return 'Tingkat '+str
 if(key==='recurrence')return str==='weekly'?'Mingguan':str==='monthly'?'Bulanan':str
 if(/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(str))return 'Akun '+str.slice(0,8)+'…'
 return str
}
export function auditValueSummary(value:string|null,other:string|null):string[]{
 const current=parse(value),previous=parse(other)
 if(current===null)return ['—']
 if(typeof current!=='object'||Array.isArray(current))return [fmt(current)]
 const data=current as Record<string,unknown>
 const before=previous&&typeof previous==='object'&&!Array.isArray(previous)?previous as Record<string,unknown>:{}
 const changes=Object.entries(data).filter(([key,v])=>!technicalKeys.has(key)&&comparable(v)!==comparable(before[key]))
 if(!changes.length)return ['Perubahan data tersimpan']
 return changes.slice(0,6).map(([key,v])=>labels[key] ? labels[key]+': '+fmt(v,key) : key.replace(/_/g,' ')+': '+fmt(v,key))
}
