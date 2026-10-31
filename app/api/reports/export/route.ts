import { NextRequest, NextResponse } from 'next/server'
import { getSessionUser, requireRole } from '@/lib/auth/session'
import { parseReportFilters } from '@/lib/reports/queries'
import { getTaskFilterOptions, getTaskList, type TaskListItem } from '@/lib/tasks/queries'
import { buildTaskListXlsx, type ExportParams } from '@/lib/reports/export'
import { buildTaskListPdf } from '@/lib/reports/pdf'

const PAGE_SIZE = 100
const MAX_EXPORT = 10000

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await getSessionUser()
    requireRole(user, 'Staff/PIC')
    const sp = request.nextUrl.searchParams
    const format = sp.get('format')
    if (format !== 'xlsx' && format !== 'pdf') {
      return NextResponse.json({error:'Format ekspor tidak valid.'},{status:400})
    }
    const rawFrom=sp.get('from')||undefined
    const rawTo=sp.get('to')||undefined
    if(Boolean(rawFrom)!==Boolean(rawTo)) {
      return NextResponse.json({error:'Tanggal awal dan akhir harus diisi bersama.'},{status:400})
    }
    const filters=parseReportFilters({
      dateFrom:rawFrom,dateTo:rawTo,orgUnitId:sp.get('orgUnit')||undefined,
    })
    const options=await getTaskFilterOptions(user)
    const orgLabel=filters.orgUnitId===null ? 'Semua seksi yang dapat diakses'
      : options.sections.find(section=>section.id===filters.orgUnitId)?.name??String(filters.orgUnitId)
    const tasks:TaskListItem[]=[]
    const base={createdFrom:rawFrom||null,createdTo:rawTo||null,orgUnitId:filters.orgUnitId,ownerId:user.roleLevel === 2 ? user.id : undefined}
    const first=await getTaskList(user,{...base,page:1,pageSize:PAGE_SIZE})
    if(first.total>MAX_EXPORT) {
      return NextResponse.json({error:'Data lebih dari 10.000 tugas. Gunakan filter tanggal agar ekspor tetap aman.'},{status:422})
    }
    tasks.push(...first.items)
    const pages=Math.ceil(first.total/PAGE_SIZE)
    for(let page=2;page<=pages;page++) {
      const batch=await getTaskList(user,{...base,page,pageSize:PAGE_SIZE})
      tasks.push(...batch.items)
    }
    const params:ExportParams={
      dateFrom:rawFrom??'Semua periode',
      dateTo:rawTo??'Semua periode',
      orgUnitLabel:orgLabel,
    }
    const bytes=format==='xlsx'?buildTaskListXlsx(tasks,params):buildTaskListPdf(tasks,params)
    const responseBody=new Uint8Array(bytes.byteLength)
    responseBody.set(bytes)
    const dateTag=rawFrom&&rawTo ? rawFrom+'-'+rawTo : 'semua'
    const filename='laporan-detail-tugas-'+dateTag+'.'+format
    return new NextResponse(responseBody.buffer,{
      status:200,
      headers:{
        'Content-Type':format==='xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'application/pdf',
        'Content-Disposition':'attachment; filename="'+filename+'"',
        'Cache-Control':'no-store',
        'X-Content-Type-Options':'nosniff',
      },
    })
  } catch(error) {
    const message=error instanceof Error?error.message:'Ekspor laporan tidak berhasil.'
    return NextResponse.json({error:message},{status:500})
  }
}
