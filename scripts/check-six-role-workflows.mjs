import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const source = name => readFileSync(new URL('../supabase/migrations/'+name,import.meta.url),'utf8')
const extract = (sql,name) => {
  const a=sql.indexOf('CREATE OR REPLACE FUNCTION public.'+name+'(')
  assert.ok(a>=0,'missing '+name)
  const b=sql.indexOf('$$;',a)
  assert.ok(b>a)
  return sql.slice(a,b+3)
}
const names=['spectator','pic','manager','sm','gm','admin']
const ids=Object.fromEntries(names.map((n,i)=>[n,String(i+1).repeat(8)+'-'+String(i+1).repeat(4)+'-4'+String(i+1).repeat(3)+'-8'+String(i+1).repeat(3)+'-'+String(i+1).repeat(12)]))
const tasks={
 pic:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
 manager:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
 sm:'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
 gm:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 admin:'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
}
const requests={
 pic:'abcabcab-abca-4bca-8bca-abcabcabcabc',
 manager:'bcdabcda-bcda-4cda-8cda-bcdabcdabcda',
 sm:'cdeabcde-abcd-4cde-8cde-cdeabcdeabcd',
}
const query=async sql=>(await db.query(sql)).rows
const rejected=async (sql,description)=>assert.rejects(db.query(sql),undefined,description)
const login=async(name,level)=>db.exec("SET app.user_id='"+ids[name]+"';SET app.role_level='"+level+"';SET app.org_unit_id='4';SET ROLE authenticated;")
const logout=async()=>db.exec('RESET ROLE')
const review=async(name,decision,comment)=>query(
 "SELECT public.review_task('"+tasks[name]+"','"+decision+"'::public.task_status,"+
 (comment===null?'NULL':"'"+comment+"'")+")")
const decide=async(name,decision)=>query(
 "SELECT public.decide_deadline_change('"+requests[name]+"','"+decision+"'::public.deadline_request_status)")
try {
  await db.exec([
    'CREATE ROLE authenticated;',
    'CREATE SCHEMA auth;',
    "CREATE TYPE public.task_status AS ENUM('To do','In progress','Blocked','Review','Revisi','Done');",
    "CREATE TYPE public.deadline_request_status AS ENUM('Menunggu approval','Disetujui','Ditolak');",
    "CREATE TYPE public.user_status AS ENUM('aktif','nonaktif');",
    'CREATE TABLE public.roles(id int PRIMARY KEY,level int NOT NULL);',
    "CREATE TABLE public.users(id uuid PRIMARY KEY,role_id int NOT NULL,status public.user_status DEFAULT 'aktif',org_unit_id int);",
    'CREATE TABLE public.tasks(id uuid PRIMARY KEY,owner_id uuid,reviewer_id uuid,status public.task_status NOT NULL,org_unit_id int,due_date timestamptz);',
    'CREATE TABLE public.task_comments(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),task_id uuid,user_id uuid,body text,created_at timestamptz DEFAULT now());',
    "CREATE TABLE public.deadline_change_requests(id uuid PRIMARY KEY,task_id uuid,status public.deadline_request_status NOT NULL,old_due_date timestamptz,new_due_date timestamptz,approver_id uuid,decided_at timestamptz);",
    "CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS 'select nullif(current_setting(''app.user_id'',true),'''')::uuid';",
    "CREATE FUNCTION public.can_manage_org_unit(int) RETURNS boolean LANGUAGE sql STABLE AS 'select nullif(current_setting(''app.role_level'',true),'''')::int >= 4 AND $1 = 4';",
    'INSERT INTO public.roles VALUES(1,1),(2,2),(3,3),(4,4),(5,5),(6,6);',
  ].join('\n'))
  for(let i=0;i<names.length;i++) {
    await db.exec("INSERT INTO public.users(id,role_id,org_unit_id) VALUES('"+ids[names[i]]+"',"+(i+1)+",4)")
  }
  for(const [name,reviewer] of [['pic','manager'],['manager','sm'],['sm','gm'],['gm',null],['admin',null]]) {
    await db.exec("INSERT INTO public.tasks VALUES('"+tasks[name]+"','"+ids[name]+"',"+
      (reviewer?"'"+ids[reviewer]+"'":"NULL")+",'Review',4,'2035-10-21T16:59:59Z')")
  }
  for(const name of ['pic','manager','sm']) {
    await db.exec("INSERT INTO public.deadline_change_requests(id,task_id,status,old_due_date,new_due_date) VALUES("+
      "'"+requests[name]+"','"+tasks[name]+"','Menunggu approval','2035-10-21T16:59:59Z','2035-10-25T16:59:59Z')")
  }
  await db.exec(extract(source('026_privileged_owner_self_review.sql'),'review_task'))
  await db.exec(extract(source('024_atomic_deadline_decisions.sql'),'decide_deadline_change'))
  await db.exec('GRANT USAGE ON SCHEMA auth,public TO authenticated')
  await db.exec('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth,public TO authenticated')
  await db.exec('GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA public TO authenticated')
  await login('spectator',1)
  await rejected("SELECT public.review_task('"+tasks.pic+"','Done',NULL)",'Spectator cannot review')
  await rejected("SELECT public.decide_deadline_change('"+requests.pic+"','Disetujui')",'Spectator cannot approve')
  await logout()
  await login('pic',2)
  await rejected("SELECT public.review_task('"+tasks.pic+"','Done',NULL)",'PIC cannot self-review')
  await rejected("SELECT public.decide_deadline_change('"+requests.pic+"','Disetujui')",'PIC cannot approve deadline')
  await logout()
  await login('manager',3)
  await review('pic','Done','Verified')
  await rejected("SELECT public.decide_deadline_change('"+requests.pic+"','Disetujui')",'Manager cannot approve deadline')
  await logout()
  await login('sm',4)
  await rejected("SELECT public.review_task('"+tasks.manager+"','Revisi',NULL)",'SM must comment on rejection')
  await review('manager','Revisi','Needs correction')
  await decide('pic','Disetujui')
  await logout()
  await login('gm',5)
  await review('sm','Done','Approved')
  await review('gm','Done',null)
  await decide('manager','Ditolak')
  await logout()
  await login('admin',6)
  await review('admin','Done',null)
  await decide('sm','Disetujui')
  await logout()
  assert.equal((await query("SELECT count(*)::int n FROM public.tasks WHERE status='Done'"))[0].n,4)
  assert.equal((await query('SELECT count(*)::int n FROM public.task_comments'))[0].n,3)
  assert.equal((await query("SELECT count(*)::int n FROM public.deadline_change_requests WHERE status='Disetujui'"))[0].n,2)
  console.log('PASS six-role simulated review and approval workflows using actual SQL RPCs')
} finally { await db.close() }
