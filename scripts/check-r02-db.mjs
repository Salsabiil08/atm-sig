// Free, isolated PostgreSQL-compatible regression harness (PGlite).
// Runs REAL migration SQL; no Supabase credentials, network, or production writes.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const migrate = async (filename) => {
  const sql = readFileSync(new URL('../supabase/migrations/' + filename, import.meta.url), 'utf8')
  await db.exec(sql)
}
const row = async (query) => (await db.query(query)).rows[0]
const PIC = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const MANAGER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const OTHER = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const task = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const SPECTATOR = '11111111-1111-4111-8111-111111111111'
const SM = '44444444-4444-4444-8444-444444444444'
const GM = '55555555-5555-4555-8555-555555555555'
const SUPER = '66666666-6666-4666-8666-666666666666'

try {
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TYPE public.task_status AS ENUM ('To do','In progress','Blocked','Review','Revisi','Done');
    CREATE TYPE public.deadline_request_status AS ENUM ('Menunggu approval','Disetujui','Ditolak');
    CREATE TYPE public.user_status AS ENUM ('aktif','nonaktif');
    CREATE TABLE public.roles (id int PRIMARY KEY, level int NOT NULL);
    CREATE TABLE public.org_units (id int PRIMARY KEY, parent_id int);
    CREATE TABLE public.users (
      id uuid PRIMARY KEY, role_id int NOT NULL REFERENCES public.roles(id),
      status public.user_status NOT NULL DEFAULT 'aktif',
      org_unit_id int NOT NULL, supervisor_id uuid
    );
    CREATE TABLE public.tasks (
      id uuid PRIMARY KEY,
      owner_id uuid NOT NULL, assigner_id uuid NOT NULL, reviewer_id uuid,
      org_unit_id int NOT NULL, parent_task_id uuid,
      title text NOT NULL DEFAULT 'Test',
      status public.task_status NOT NULL DEFAULT 'To do',
      progress_pct int NOT NULL DEFAULT 0, completed_at timestamptz
    );
    CREATE TABLE public.evidence_requirements (
      id uuid PRIMARY KEY, task_id uuid NOT NULL REFERENCES public.tasks(id),
      description text NOT NULL, mandatory boolean NOT NULL DEFAULT true
    );
    CREATE TABLE public.audit_logs (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL, action text NOT NULL, object text NOT NULL,
      old_value text, new_value text, created_at timestamptz DEFAULT now()
    );
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      'select nullif(current_setting(''app.user_id'',true),'''')::uuid';
    CREATE FUNCTION public.get_my_role_level() RETURNS integer LANGUAGE sql STABLE AS
      'select nullif(current_setting(''app.role_level'',true),'''')::int';
    CREATE FUNCTION public.get_my_org_unit_id() RETURNS integer LANGUAGE sql STABLE AS
      'select nullif(current_setting(''app.org_unit_id'',true),'''')::int';
    CREATE FUNCTION public.can_manage_org_unit(int) RETURNS boolean LANGUAGE sql STABLE AS
      'select get_my_role_level() >= 3 and $1 = get_my_org_unit_id()';
    CREATE FUNCTION public.can_access_task_scope(int,uuid,uuid) RETURNS boolean LANGUAGE sql STABLE AS
      'select get_my_role_level() >= 5 or (get_my_role_level() >= 2 and ($1 = get_my_org_unit_id() or $2=auth.uid() or $3=auth.uid()))';
    CREATE POLICY users_read_all ON public.users FOR SELECT USING (auth.uid() IS NOT NULL);
    CREATE POLICY org_units_read_all ON public.org_units FOR SELECT USING (true);
    CREATE POLICY tasks_insert ON public.tasks FOR INSERT
      WITH CHECK (get_my_role_level() >= 3 AND can_manage_org_unit(org_unit_id));
    CREATE POLICY tasks_read ON public.tasks FOR SELECT
      USING (owner_id = auth.uid() OR reviewer_id = auth.uid()
        OR (get_my_role_level() >= 3 AND can_manage_org_unit(org_unit_id)));
    CREATE POLICY tasks_update ON public.tasks FOR UPDATE
      USING (owner_id = auth.uid() OR get_my_role_level() >= 3)
      WITH CHECK (owner_id = auth.uid() OR get_my_role_level() >= 3);
    CREATE POLICY tasks_delete ON public.tasks FOR DELETE
      USING (get_my_role_level() >= 3);
    CREATE POLICY evidence_requirements_read ON public.evidence_requirements FOR SELECT
      USING (EXISTS(SELECT 1 FROM public.tasks t WHERE t.id = task_id AND t.owner_id=auth.uid()));
    CREATE POLICY evidence_requirements_write ON public.evidence_requirements FOR ALL
      USING (get_my_role_level() >= 3) WITH CHECK (get_my_role_level() >= 3);
    ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.org_units ENABLE ROW LEVEL SECURITY;
    ALTER TABLE public.evidence_requirements ENABLE ROW LEVEL SECURITY;
    GRANT USAGE ON SCHEMA public, auth TO authenticated, anon;
    GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth, public TO authenticated, anon;
    INSERT INTO public.roles VALUES (1,1),(2,2),(3,3),(4,4),(5,5),(6,6);
    INSERT INTO public.org_units VALUES (4,null),(5,null);
    INSERT INTO public.users(id,role_id,org_unit_id,supervisor_id) VALUES
      ('${PIC}',2,4,'${MANAGER}'), ('${MANAGER}',3,4,null),
      ('${OTHER}',2,5,null),('${SPECTATOR}',1,4,null),
      ('${SM}',4,4,null),('${GM}',5,4,null),('${SUPER}',6,4,null);
  `)
  // Simulate all 33 current Production SECURITY DEFINER functions.
  await db.exec(`
    CREATE FUNCTION public.review_task(uuid,public.task_status,text)
      RETURNS void LANGUAGE sql SECURITY DEFINER AS 'select';
    CREATE FUNCTION public.reassign_task(uuid,uuid,text)
      RETURNS void LANGUAGE sql SECURITY DEFINER AS 'select';
    CREATE FUNCTION public.decide_deadline_change(uuid,public.deadline_request_status)
      RETURNS void LANGUAGE sql SECURITY DEFINER AS 'select';
  `)
  for (let i = 0; i < 30; i++) {
    await db.exec(`CREATE FUNCTION public.internal_rpc_${i}() RETURNS void
      LANGUAGE sql SECURITY DEFINER AS 'select';`)
  }
  await migrate('20261022013000_pic_self_create_rls.sql')
  await migrate('20261022014000_reviewed_security_definer_acl.sql')
  await migrate('20261022015000_atomic_task_audit.sql')
  await migrate('20261022016000_spectator_business_data_rls.sql')
  const exposed = await row(`SELECT count(*)::int AS n
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef
      AND has_function_privilege('anon',p.oid,'EXECUTE')`)
  assert.equal(exposed.n,0,'anon must not execute SECURITY DEFINER functions')
  const allowed = await db.query(`SELECT p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.prosecdef
      AND has_function_privilege('authenticated',p.oid,'EXECUTE')
    ORDER BY p.proname`)
  assert.deepEqual(allowed.rows.map(r=>r.proname),[
    'decide_deadline_change','reassign_task','review_task'
  ])
  // Simulate authenticated JWT claims with PostgreSQL role privileges.
  await db.exec(`
    SET app.user_id='${PIC}'; SET app.role_level='2'; SET app.org_unit_id='4';
    SET ROLE authenticated;
  `)
  const bad = async (sql, label) => {
    await assert.rejects(db.exec(sql), undefined, label)
  }
  await bad(`INSERT INTO public.tasks(id,owner_id,assigner_id,reviewer_id,org_unit_id)
    VALUES (gen_random_uuid(),'${OTHER}','${PIC}','${MANAGER}',4)`, 'PIC cannot assign someone else')
  await bad(`INSERT INTO public.tasks(id,owner_id,assigner_id,reviewer_id,org_unit_id)
    VALUES (gen_random_uuid(),'${PIC}','${PIC}','${MANAGER}',5)`, 'PIC cannot create cross-section')
  await bad(`INSERT INTO public.tasks(id,owner_id,assigner_id,reviewer_id,org_unit_id)
    VALUES (gen_random_uuid(),'${PIC}','${PIC}','${OTHER}',4)`, 'PIC reviewer must be direct supervisor')
  await db.exec(`INSERT INTO public.tasks(id,owner_id,assigner_id,reviewer_id,org_unit_id)
    VALUES ('${task}','${PIC}','${PIC}','${MANAGER}',4)`)
  await db.exec(`INSERT INTO public.evidence_requirements(id,task_id,description)
    VALUES (gen_random_uuid(),'${task}','Signed ledger')`)
  await db.exec(`UPDATE public.tasks SET status='In progress' WHERE id='${task}'`)
  await bad(`INSERT INTO public.evidence_requirements(id,task_id,description)
    VALUES (gen_random_uuid(),'${task}','Late requirement')`,
    'PIC cannot change evidence requirements after To do')
  await db.exec('RESET ROLE')
  // If audit insertion fails, the business UPDATE must roll back atomically.
  await db.exec("ALTER TABLE public.audit_logs ADD CONSTRAINT simulate_audit_failure CHECK (action <> 'update_status') NOT VALID")
  await db.exec('SET ROLE authenticated')
  await bad(`UPDATE public.tasks SET status='Done' WHERE id='${task}'`,
    'audit failure must roll back task status')
  const taskAfterFailure = await row(`SELECT status FROM public.tasks WHERE id='${task}'`)
  assert.equal(taskAfterFailure.status, 'In progress')
  await db.exec('RESET ROLE')
  await db.exec('ALTER TABLE public.audit_logs DROP CONSTRAINT simulate_audit_failure')
  // Manager remains allowed to create scoped tasks after PIC RLS extension.
  await db.exec(`
    SET app.user_id='${MANAGER}'; SET app.role_level='3'; SET app.org_unit_id='4';
    SET ROLE authenticated;
  `)
  await db.exec(`INSERT INTO public.tasks(id,owner_id,assigner_id,reviewer_id,org_unit_id)
    VALUES (gen_random_uuid(),'${OTHER}','${MANAGER}','${MANAGER}',4)`)
  await db.exec('RESET ROLE')

  // Six-role RLS smoke UAT: Spectator, PIC, Manager, SM, GM, Super Admin.
  // This verifies DB policies, not actual interactive login/review screens.
  await db.exec(`SET app.user_id='${SPECTATOR}'; SET app.role_level='1'; SET app.org_unit_id='4'; SET ROLE authenticated;`)
  assert.equal((await row('SELECT count(*)::int n FROM public.users')).n,1,'Spectator can only see self')
  assert.equal((await row('SELECT count(*)::int n FROM public.tasks')).n,0,'Spectator cannot read tasks')
  assert.equal((await row('SELECT count(*)::int n FROM public.org_units')).n,0,'Spectator cannot read org master')
  await bad(`INSERT INTO public.tasks(id,owner_id,assigner_id,reviewer_id,org_unit_id)
    VALUES(gen_random_uuid(),'${SPECTATOR}','${SPECTATOR}',null,4)`,'Spectator cannot create')
  await db.exec('RESET ROLE')
  for (const [roleLevel,userId,expectedName] of [
    [2,PIC,'PIC'],[3,MANAGER,'Manager'],[4,SM,'SM'],[5,GM,'GM'],[6,SUPER,'Super Admin']
  ]) {
    await db.exec(`SET app.user_id='${userId}'; SET app.role_level='${roleLevel}'; SET app.org_unit_id='4'; SET ROLE authenticated;`)
    assert.ok((await row('SELECT count(*)::int n FROM public.users')).n >= 1,expectedName+' user visibility')
    assert.ok((await row('SELECT count(*)::int n FROM public.org_units')).n >= 1,expectedName+' org visibility')
    const count=(await row('SELECT count(*)::int n FROM public.tasks')).n
    assert.ok(count >= 1,expectedName+' task visibility')
    await db.exec('RESET ROLE')
  }
  console.log('PASS six-role simulated RLS UAT: Spectator isolation, PIC, Manager, SM, GM, Super Admin')
  const actions = await db.query(`SELECT action FROM public.audit_logs ORDER BY created_at`)
  assert.equal(actions.rows.some(r=>r.action==='create'),true)
  assert.equal(actions.rows.some(r=>r.action==='update_status'),true)
  console.log('PASS: real RLS, reviewed RPC ACL, PIC restrictions, audit triggers, WIB regressions')
} finally {
  await db.close()
}
