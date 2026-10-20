import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
let spectatorId: string
let managerId: string
let accountingManagerId: string
let staffId: string
let gmId: string
let superAdminId: string
let smAccountingId: string
let smReportingId: string
let replacementStaffId: string
let accountingTaskId: string
let reportingTaskId: string
let deleteCheckTaskId: string
let accountingDeadlineRequestId: string
let supportRequestId: string
let evidenceRequirementId: string
let evidenceStoragePath: string
let auditLogId: string

async function runMigration(fileName: string) {
  const migration = await readFile(
    resolve(process.cwd(), 'supabase', 'migrations', fileName),
    'utf8',
  )
  await db.exec(migration)
}

async function createAuthUser(
  id: string,
  email: string,
  metadata: Record<string, string | number> = { name: 'Test User' },
) {
  await db.query(
    'INSERT INTO auth.users (id, email, raw_user_meta_data) VALUES ($1, $2, $3)',
    [id, email, JSON.stringify(metadata)],
  )
}

describe('Role and organization scope (FR-002, FR-004, NFR-001, NFR-002, BR-061)', () => {
  beforeAll(async () => {
    await db.exec(`
      CREATE SCHEMA auth;
      CREATE SCHEMA storage;
      CREATE ROLE authenticated;
      CREATE ROLE service_role BYPASSRLS;
      CREATE FUNCTION auth.uid() RETURNS uuid
        LANGUAGE sql STABLE
        AS $function$
          SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid
        $function$;
      CREATE FUNCTION auth.role() RETURNS text
        LANGUAGE sql STABLE
        AS $function$
          SELECT COALESCE(current_setting('request.jwt.claim.role', true), current_user::text)
        $function$;
      CREATE TABLE auth.users (
        id uuid PRIMARY KEY,
        email text,
        raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb
      );
      CREATE TABLE storage.buckets (
        id text PRIMARY KEY,
        name text NOT NULL,
        public boolean NOT NULL DEFAULT false,
        file_size_limit bigint,
        allowed_mime_types text[]
      );
      CREATE TABLE storage.objects (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        bucket_id text NOT NULL REFERENCES storage.buckets(id),
        name text NOT NULL,
        owner_id uuid
      );
      ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    `)

    await runMigration('001_init_schema.sql')
    await runMigration('002_rls_policies.sql')
    await runMigration('003_user_trigger.sql')
    await runMigration('004_spectator_read_only.sql')
    await runMigration('005_wbs_items.sql')
    await runMigration('006_rls_write_policies.sql')
    await runMigration('007_user_management_access.sql')
    await runMigration('008_user_role_change_requests.sql')
    await runMigration('009_organization_scope_rls.sql')
    await runMigration('010_audited_role_changes.sql')
    await runMigration('011_spectator_scope_tree.sql')
    await runMigration('012_scoped_task_delete.sql')
    await runMigration('013_task_support_transitions.sql')
    await runMigration('014_private_task_evidence_storage.sql')
    await runMigration('015_validate_task_evidence_locations.sql')
    await runMigration('016_task_progress_history.sql')
    await runMigration('017_task_status_transitions.sql')
    await runMigration('018_task_status_gates.sql')
    await runMigration('019_scoped_task_reassignment.sql')
    await runMigration('020_notify_new_task_owner.sql')
    await runMigration('021_task_reviewer_chain.sql')
    await runMigration('022_atomic_task_review.sql')
    await runMigration('023_validate_pic_deadline_requests.sql')
    await runMigration('024_atomic_deadline_decisions.sql')
    await runMigration('025_audit_direct_deadline_updates.sql')
    await runMigration('026_privileged_owner_self_review.sql')
    await runMigration('027_task_reminder_scheduler.sql')
    await runMigration('028_reminder_recipient_guard.sql')
    await runMigration('029_pic_reminder_responses.sql')
    await runMigration('030_reminder_supervisor_notifications.sql')
    await runMigration('031_reminder_email_delivery.sql')
    await runMigration('032_notification_reminder_reference.sql')
    await db.exec(`
      GRANT USAGE ON SCHEMA auth TO authenticated;
      GRANT USAGE ON SCHEMA auth TO service_role;
      GRANT USAGE ON SCHEMA storage TO authenticated;
      GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
      GRANT EXECUTE ON FUNCTION auth.uid() TO service_role;
      GRANT EXECUTE ON FUNCTION auth.role() TO service_role;
      GRANT USAGE ON SCHEMA public TO authenticated;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
      GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
      GRANT SELECT, INSERT ON storage.objects TO authenticated;
    `)
    await runMigration('033_task_categories_templates.sql')
    await runMigration('034_task_category_scope_and_missed_runs.sql')
    await runMigration('035_scoped_manager_kanban_transitions.sql')
    await runMigration('036_guard_pic_timeline_dates.sql')
  }, 60_000)

  beforeEach(async () => {
    spectatorId = crypto.randomUUID()
    managerId = crypto.randomUUID()
    accountingManagerId = crypto.randomUUID()
    staffId = crypto.randomUUID()
    gmId = crypto.randomUUID()
    superAdminId = crypto.randomUUID()
    smAccountingId = crypto.randomUUID()
    smReportingId = crypto.randomUUID()
    replacementStaffId = crypto.randomUUID()
    accountingTaskId = crypto.randomUUID()
    reportingTaskId = crypto.randomUUID()
    deleteCheckTaskId = crypto.randomUUID()
    accountingDeadlineRequestId = crypto.randomUUID()
    supportRequestId = crypto.randomUUID()
    evidenceRequirementId = crypto.randomUUID()
    evidenceStoragePath = `${accountingTaskId}/${evidenceRequirementId}/${crypto.randomUUID()}.pdf`
    auditLogId = crypto.randomUUID()
    await createAuthUser(spectatorId, `${spectatorId}@example.test`, {
      name: 'Test User',
      role: 'Super Admin',
      role_id: 6,
    })
    await createAuthUser(managerId, `${managerId}@example.test`)
    await createAuthUser(accountingManagerId, `${accountingManagerId}@example.test`)
    await createAuthUser(staffId, `${staffId}@example.test`)
    await createAuthUser(gmId, `${gmId}@example.test`)
    await createAuthUser(superAdminId, `${superAdminId}@example.test`)
    await createAuthUser(smAccountingId, `${smAccountingId}@example.test`)
    await createAuthUser(smReportingId, `${smReportingId}@example.test`)
    await createAuthUser(replacementStaffId, `${replacementStaffId}@example.test`)
    await db.query(
      "UPDATE public.users SET role_id = (SELECT id FROM public.roles WHERE name = 'Manager'), org_unit_id = 5 WHERE id = $1",
      [managerId],
    )
    await db.query(
      "UPDATE public.users SET role_id = (SELECT id FROM public.roles WHERE name = 'Manager'), org_unit_id = 4, supervisor_id = $2 WHERE id = $1",
      [accountingManagerId, smAccountingId],
    )
    await db.query(
      "UPDATE public.users SET role_id = (SELECT id FROM public.roles WHERE name = 'Staff/PIC'), org_unit_id = 4 WHERE id = $1",
      [staffId],
    )
    await db.query(
      'UPDATE public.users SET supervisor_id = $1 WHERE id = $2',
      [accountingManagerId, staffId],
    )
    await db.query(
      "UPDATE public.users SET role_id = (SELECT id FROM public.roles WHERE name = 'Super Admin') WHERE id = $1",
      [superAdminId],
    )
    await db.query(
      "UPDATE public.users SET role_id = (SELECT id FROM public.roles WHERE name = 'GM') WHERE id = $1",
      [gmId],
    )
    await db.query(
      "UPDATE public.users SET role_id = (SELECT id FROM public.roles WHERE name = 'SM'), org_unit_id = 2 WHERE id = $1",
      [smAccountingId],
    )
    await db.query(
      "UPDATE public.users SET role_id = (SELECT id FROM public.roles WHERE name = 'SM'), org_unit_id = 3 WHERE id = $1",
      [smReportingId],
    )
    await db.query(
      "UPDATE public.users SET role_id = (SELECT id FROM public.roles WHERE name = 'Staff/PIC'), org_unit_id = 4, supervisor_id = $1 WHERE id = $2",
      [accountingManagerId, replacementStaffId],
    )
    await db.query(
      `INSERT INTO public.tasks (id, owner_id, assigner_id, reviewer_id, org_unit_id, title, start_date, due_date)
       VALUES
       ($1, $4, $5, $6, 4, 'Accounting task', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z'),
       ($2, $4, $5, $6, 9, 'Reporting task', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z'),
       ($3, $4, $5, $6, 4, 'Delete check task', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z')`,
      [accountingTaskId, reportingTaskId, deleteCheckTaskId, staffId, gmId, accountingManagerId],
    )
    await db.query(
      `INSERT INTO public.deadline_change_requests
        (id, task_id, requested_by, old_due_date, new_due_date, reason)
       VALUES ($1, $2, $3, '2026-01-02T00:00:00Z', $4, 'Test reason')`,
      [
        accountingDeadlineRequestId,
        accountingTaskId,
        staffId,
        new Date(Date.now() + 86_400_000).toISOString(),
      ],
    )
    await db.query(
      `INSERT INTO public.task_supports (id, task_id, needed_from_id, description)
       VALUES ($1, $2, $3, 'Review the reconciliation')`,
      [supportRequestId, accountingTaskId, accountingManagerId],
    )
    await db.query(
      `INSERT INTO public.evidence_requirements (id, task_id, description, mandatory)
       VALUES ($1, $2, 'Reconciliation report', true)`,
      [evidenceRequirementId, accountingTaskId],
    )
    await db.query(
      `INSERT INTO storage.objects (bucket_id, name, owner_id)
       VALUES ('task-evidence', $1, $2)`,
      [evidenceStoragePath, staffId],
    )
    await db.query(
      "INSERT INTO public.notifications (user_id, type, title, body) VALUES ($1, 'test', 'Test', 'Test')",
      [spectatorId],
    )
    await db.query(
      "INSERT INTO public.notifications (user_id, type, title, body) VALUES ($1, 'test', 'Test', 'Test')",
      [managerId],
    )
    await db.query(
      "INSERT INTO public.audit_logs (id, user_id, action, object) VALUES ($1, $2, 'test', 'users:test')",
      [auditLogId, superAdminId],
    )
  })

  afterAll(async () => {
    await db.close()
  })

  it('creates a new auth user with the Spectator role and department placement', async () => {
    const { rows } = await db.query(
      `SELECT u.name, r.name AS role, ou.type AS org_type, u.status
       FROM public.users u
       JOIN public.roles r ON r.id = u.role_id
       JOIN public.org_units ou ON ou.id = u.org_unit_id
       WHERE u.id = $1`,
      [spectatorId],
    )

    expect(rows).toEqual([
      {
        name: 'Test User',
        role: 'Spectator',
        org_type: 'department',
        status: 'aktif',
      },
    ])
  })

  it('allows a Spectator to read their profile but denies profile, task, and notification writes', async () => {
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [spectatorId])
    await db.exec('SET LOCAL ROLE authenticated')

    const { rows: profiles } = await db.query(
      'SELECT id FROM public.users WHERE id = $1',
      [spectatorId],
    )
    const { rows: profileUpdates } = await db.query(
      "UPDATE public.users SET role_id = (SELECT id FROM public.roles WHERE name = 'Super Admin') WHERE id = $1 RETURNING role_id",
      [spectatorId],
    )
    const { rows: notificationUpdates } = await db.query(
      "UPDATE public.notifications SET read_at = now() WHERE user_id = $1 RETURNING id",
      [spectatorId],
    )

    expect(profiles).toHaveLength(1)
    expect(profileUpdates).toEqual([])
    expect(notificationUpdates).toEqual([])
    const { rows: scopedTasks } = await db.query(
      'SELECT id FROM public.tasks WHERE id = $1',
      [accountingTaskId],
    )
    expect(scopedTasks).toHaveLength(1)

    await expect(
      db.query(
        `INSERT INTO public.tasks
          (id, owner_id, assigner_id, reviewer_id, org_unit_id, title, start_date, due_date)
         VALUES
          ('cccccccc-cccc-4ccc-8ccc-cccccccccccc', $2, $1, $3, 1, 'Test task',
           now(), now() + interval '1 day')`,
        [spectatorId, staffId, accountingManagerId],
      ),
    ).rejects.toThrow(/row-level security policy/i)

    await db.exec('ROLLBACK')
  })

  it('preserves notification updates for non-Spectator users', async () => {
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [managerId])
    await db.exec('SET LOCAL ROLE authenticated')

    const { rows } = await db.query(
      "UPDATE public.notifications SET read_at = now() WHERE user_id = $1 RETURNING id",
      [managerId],
    )

    expect(rows).toHaveLength(1)
    await db.exec('ROLLBACK')
  })

  it('notifies the PIC exactly once when an authorized manager creates a task', async () => {
    const newTaskId = crypto.randomUUID()
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [accountingManagerId])
    await db.exec('SET LOCAL ROLE authenticated')

    await db.query(
      `INSERT INTO public.tasks
        (id, owner_id, assigner_id, reviewer_id, org_unit_id, title, start_date, due_date)
       VALUES ($1, $2, $3, $4, 4, 'New reconciliation task', '2026-02-01', '2026-02-02')`,
      [newTaskId, staffId, accountingManagerId, accountingManagerId],
    )

    const { rows: managerNotifications } = await db.query(
      'SELECT id FROM public.notifications WHERE task_id = $1',
      [newTaskId],
    )
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [staffId])
    const { rows: picNotifications } = await db.query(
      `SELECT user_id, type, title, body
       FROM public.notifications
       WHERE task_id = $1`,
      [newTaskId],
    )

    expect(managerNotifications).toEqual([])
    expect(picNotifications).toEqual([{
      user_id: staffId,
      type: 'task_assigned',
      title: 'Task baru ditugaskan kepada Anda',
      body: 'Anda ditetapkan sebagai PIC task "New reconciliation task".',
    }])
    await db.exec('ROLLBACK')
  })

  it('enforces the active direct reviewer and role chain through the Supabase API', async () => {
    const validTaskId = crypto.randomUUID()
    const invalidTaskId = crypto.randomUUID()
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [accountingManagerId])
    await db.exec('SET LOCAL ROLE authenticated')

    await db.query(
      `INSERT INTO public.tasks
        (id, owner_id, assigner_id, reviewer_id, org_unit_id, title, start_date, due_date)
       VALUES ($1, $2, $3, $4, 4, 'Valid reviewer task', '2026-02-01', '2026-02-02')`,
      [validTaskId, staffId, accountingManagerId, accountingManagerId],
    )
    await expect(
      db.query(
        `INSERT INTO public.tasks
          (id, owner_id, assigner_id, reviewer_id, org_unit_id, title, start_date, due_date)
         VALUES ($1, $2, $3, $4, 4, 'Invalid reviewer task', '2026-02-01', '2026-02-02')`,
        [invalidTaskId, staffId, accountingManagerId, smAccountingId],
      ),
    ).rejects.toThrow(/Reviewer harus atasan langsung PIC/)

    await db.exec('ROLLBACK')
  })

  it('denies profile updates through the Supabase API for a Manager', async () => {
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [managerId])
    await db.exec('SET LOCAL ROLE authenticated')

    const { rows } = await db.query(
      "UPDATE public.users SET name = 'Changed' WHERE id = $1 RETURNING id",
      [spectatorId],
    )

    expect(rows).toEqual([])
    await db.exec('ROLLBACK')
  })

  it('denies a Manager from changing another user role through the Supabase API', async () => {
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [managerId])
    await db.exec('SET LOCAL ROLE authenticated')

    const { rows } = await db.query(
      "UPDATE public.users SET role_id = (SELECT id FROM public.roles WHERE name = 'GM') WHERE id = $1 RETURNING id",
      [spectatorId],
    )

    expect(rows).toEqual([])
    await db.exec('ROLLBACK')
  })

  it('denies direct profile and role updates even to a Super Admin', async () => {
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [superAdminId])
    await db.exec('SET LOCAL ROLE authenticated')

    const { rows } = await db.query(
      "UPDATE public.users SET role_id = (SELECT id FROM public.roles WHERE name = 'Staff/PIC') WHERE id = $1 RETURNING id",
      [spectatorId],
    )

    expect(rows).toEqual([])
    await db.exec('ROLLBACK')
  })

  it('denies authenticated users from inserting their own audit rows', async () => {
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [superAdminId])
    await db.exec('SET LOCAL ROLE authenticated')

    await expect(
      db.query(
        `INSERT INTO public.audit_logs (user_id, action, object, old_value, new_value)
         VALUES ($1, 'assign-role', 'users:test', 'old', 'new')`,
        [superAdminId],
      ),
    ).rejects.toThrow(/row-level security policy/i)
    await db.exec('ROLLBACK')
  })

  it('keeps audit rows immutable through the Supabase API', async () => {
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [superAdminId])
    await db.exec('SET LOCAL ROLE authenticated')

    const { rows: updates } = await db.query(
      "UPDATE public.audit_logs SET action = 'tampered' WHERE id = $1 RETURNING id",
      [auditLogId],
    )
    const { rows: deletes } = await db.query(
      'DELETE FROM public.audit_logs WHERE id = $1 RETURNING id',
      [auditLogId],
    )

    expect(updates).toEqual([])
    expect(deletes).toEqual([])
    await db.exec('ROLLBACK')
  })

  it('allows GM to submit a role-change request but not apply or decide it', async () => {
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [gmId])
    await db.exec('SET LOCAL ROLE authenticated')

    const { rows: inserted } = await db.query(
      `INSERT INTO public.role_change_requests
        (target_user_id, requested_by, requested_role_id, requested_org_unit_id)
       VALUES ($1, $2, (SELECT id FROM public.roles WHERE name = 'Staff/PIC'), 1)
        RETURNING status`,
      [spectatorId, gmId],
    )
    const { rows: profileUpdates } = await db.query(
      "UPDATE public.users SET role_id = (SELECT id FROM public.roles WHERE name = 'GM') WHERE id = $1 RETURNING id",
      [spectatorId],
    )
    const { rows: requestUpdates } = await db.query(
      "UPDATE public.role_change_requests SET status = 'approved', decided_by = $1, decided_at = now() WHERE target_user_id = $2 RETURNING id",
      [gmId, spectatorId],
    )

    expect(inserted).toHaveLength(1)
    expect(inserted).toEqual([{ status: 'pending' }])
    expect(profileUpdates).toEqual([])
    expect(requestUpdates).toEqual([])
    await db.exec('ROLLBACK')
  })

  it('denies a Manager from submitting role-change requests', async () => {
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [managerId])
    await db.exec('SET LOCAL ROLE authenticated')

    await expect(
      db.query(
        `INSERT INTO public.role_change_requests
          (target_user_id, requested_by, requested_role_id, requested_org_unit_id)
         VALUES ($1, $2, (SELECT id FROM public.roles WHERE name = 'Staff/PIC'), 1)`,
        [spectatorId, managerId],
      ),
    ).rejects.toThrow(/row-level security policy/i)
    await db.exec('ROLLBACK')
  })

  it('allows only Super Admin to decide a pending role-change request', async () => {
    const requestId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
    await db.query(
      `INSERT INTO public.role_change_requests
        (id, target_user_id, requested_by, requested_role_id, requested_org_unit_id)
       VALUES ($1, $2, $3, (SELECT id FROM public.roles WHERE name = 'Staff/PIC'), 1)`,
      [requestId, spectatorId, gmId],
    )

    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [gmId])
    await db.exec('SET LOCAL ROLE authenticated')
    const { rows: gmUpdates } = await db.query(
      "UPDATE public.role_change_requests SET status = 'rejected', decided_by = $1, decided_at = now() WHERE id = $2 RETURNING id",
      [gmId, requestId],
    )
    expect(gmUpdates).toEqual([])
    await db.exec('ROLLBACK')

    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [superAdminId])
    await db.exec('SET LOCAL ROLE authenticated')
    const { rows: adminUpdates } = await db.query(
      "UPDATE public.role_change_requests SET status = 'approved', decided_by = $1, decided_at = now() WHERE id = $2 RETURNING id",
      [superAdminId, requestId],
    )
    expect(adminUpdates).toHaveLength(1)
    await db.exec('ROLLBACK')
  })

  it('allows an SM to read and update tasks in its unit sections but blocks the other unit', async () => {
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [smAccountingId])
    await db.exec('SET LOCAL ROLE authenticated')

    const { rows: accessible } = await db.query(
      'SELECT id FROM public.tasks WHERE id = $1',
      [accountingTaskId],
    )
    const { rows: outsideScope } = await db.query(
      'SELECT id FROM public.tasks WHERE id = $1',
      [reportingTaskId],
    )
    const { rows: allowedUpdate } = await db.query(
      "UPDATE public.tasks SET title = 'Allowed change' WHERE id = $1 RETURNING id",
      [accountingTaskId],
    )

    expect(accessible).toHaveLength(1)
    expect(outsideScope).toEqual([])
    expect(allowedUpdate).toHaveLength(1)
    await db.exec('ROLLBACK')
  })

  it('enforces read, update, and create permissions for every role through the API', async () => {
    const roleMatrix = [
      { name: 'Spectator', id: spectatorId, canRead: true, canUpdate: false, canCreate: false, canDelete: false },
      { name: 'Staff/PIC', id: staffId, canRead: true, canUpdate: true, canCreate: false, canDelete: false },
      { name: 'Manager outside section', id: managerId, canRead: false, canUpdate: false, canCreate: false, canDelete: false },
      { name: 'Manager in section', id: accountingManagerId, canRead: true, canUpdate: true, canCreate: true, canDelete: true },
      { name: 'SM Accounting', id: smAccountingId, canRead: true, canUpdate: true, canCreate: true, canDelete: true },
      { name: 'SM Reporting', id: smReportingId, canRead: false, canUpdate: false, canCreate: false, canDelete: false },
      { name: 'GM', id: gmId, canRead: true, canUpdate: true, canCreate: true, canDelete: true },
      { name: 'Super Admin', id: superAdminId, canRead: true, canUpdate: true, canCreate: true, canDelete: true },
    ]

    await db.exec('BEGIN')
    await db.exec('SET LOCAL ROLE authenticated')

    for (const role of roleMatrix) {
      await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [role.id])
      const { rows: readableTasks } = await db.query(
        'SELECT id FROM public.tasks WHERE id = $1',
        [accountingTaskId],
      )
      const { rows: updatedTasks } = await db.query(
        "UPDATE public.tasks SET title = $1 WHERE id = $2 RETURNING id",
        [`${role.name} update`, accountingTaskId],
      )

      expect(readableTasks, `${role.name} read access`).toHaveLength(role.canRead ? 1 : 0)
      expect(updatedTasks, `${role.name} update access`).toHaveLength(role.canUpdate ? 1 : 0)

      await db.exec('SAVEPOINT role_delete')
      const { rows: deletedTasks } = await db.query(
        'DELETE FROM public.tasks WHERE id = $1 RETURNING id',
        [deleteCheckTaskId],
      )
      expect(deletedTasks, `${role.name} delete access`).toHaveLength(role.canDelete ? 1 : 0)
      await db.exec('ROLLBACK TO SAVEPOINT role_delete')
      await db.exec('RELEASE SAVEPOINT role_delete')

      await db.exec('SAVEPOINT role_insert')
      if (role.canCreate) {
        const { rows: insertedTasks } = await db.query(
          `INSERT INTO public.tasks
            (id, owner_id, assigner_id, reviewer_id, org_unit_id, title, start_date, due_date)
           VALUES ($1, $2, $3, $4, 4, 'Role matrix task', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z')
           RETURNING id`,
          [crypto.randomUUID(), staffId, role.id, accountingManagerId],
        )
        expect(insertedTasks, `${role.name} create access`).toHaveLength(1)
      } else {
        await expect(
          db.query(
            `INSERT INTO public.tasks
              (id, owner_id, assigner_id, reviewer_id, org_unit_id, title, start_date, due_date)
             VALUES ($1, $2, $3, $4, 4, 'Role matrix task', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z')
             RETURNING id`,
            [crypto.randomUUID(), staffId, role.id, accountingManagerId],
          ),
        ).rejects.toThrow(/row-level security policy/i)
        await db.exec('ROLLBACK TO SAVEPOINT role_insert')
      }
      await db.exec('RELEASE SAVEPOINT role_insert')
    }

    await db.exec('ROLLBACK')
  })

  it('allows only the requested support recipient to complete the request once', async () => {
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [staffId])
    await db.exec('SET LOCAL ROLE authenticated')

    const { rows: ownerUpdates } = await db.query(
      "UPDATE public.task_supports SET status = 'diberikan' WHERE id = $1 RETURNING id",
      [supportRequestId],
    )
    expect(ownerUpdates).toEqual([])
    await db.exec('ROLLBACK')

    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [accountingManagerId])
    await db.exec('SET LOCAL ROLE authenticated')

    await db.exec('SAVEPOINT invalid_support_change')
    await expect(
      db.query(
        "UPDATE public.task_supports SET status = 'diberikan', description = 'Tampered' WHERE id = $1",
        [supportRequestId],
      ),
    ).rejects.toThrow(/hanya dapat ditandai diberikan/i)
    await db.exec('ROLLBACK TO SAVEPOINT invalid_support_change')
    await db.exec('RELEASE SAVEPOINT invalid_support_change')

    const { rows: provided } = await db.query(
      "UPDATE public.task_supports SET status = 'diberikan' WHERE id = $1 RETURNING id, status",
      [supportRequestId],
    )
    const { rows: reverted } = await db.query(
      "UPDATE public.task_supports SET status = 'diminta' WHERE id = $1 RETURNING id",
      [supportRequestId],
    )

    expect(provided).toEqual([{ id: supportRequestId, status: 'diberikan' }])
    expect(reverted).toEqual([])
    await db.exec('ROLLBACK')
  })

  it('requires the task owner and an active, different recipient to create support requests', async () => {
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [staffId])
    await db.exec('SET LOCAL ROLE authenticated')

    const { rows: requests } = await db.query(
      `INSERT INTO public.task_supports (task_id, needed_from_id, description)
       VALUES ($1, $2, 'Provide reconciliation review')
       RETURNING id, status`,
      [accountingTaskId, accountingManagerId],
    )
    expect(requests).toHaveLength(1)

    await expect(
      db.query(
        `INSERT INTO public.task_supports (task_id, needed_from_id, description)
         VALUES ($1, $2, 'Self support')`,
        [accountingTaskId, staffId],
      ),
    ).rejects.toThrow(/row-level security policy/i)
    await db.exec('ROLLBACK')
  })

  it('restricts private evidence file access to users who can access the task', async () => {
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [staffId])
    await db.exec('SET LOCAL ROLE authenticated')
    const { rows: ownerFiles } = await db.query(
      'SELECT name FROM storage.objects WHERE name = $1',
      [evidenceStoragePath],
    )
    expect(ownerFiles).toEqual([{ name: evidenceStoragePath }])
    await db.exec('ROLLBACK')

    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [managerId])
    await db.exec('SET LOCAL ROLE authenticated')
    const { rows: outsideFiles } = await db.query(
      'SELECT name FROM storage.objects WHERE name = $1',
      [evidenceStoragePath],
    )
    expect(outsideFiles).toEqual([])
    await expect(
      db.query(
        `INSERT INTO storage.objects (bucket_id, name, owner_id)
         VALUES ('task-evidence', $1, $2)`,
        [evidenceStoragePath, managerId],
      ),
    ).rejects.toThrow(/row-level security policy/i)
    await db.exec('ROLLBACK')
  })

  it('rejects unsafe evidence locations through the authenticated API', async () => {
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [staffId])
    await db.exec('SET LOCAL ROLE authenticated')

    await expect(
      db.query(
        `INSERT INTO public.task_evidence (requirement_id, uploader_id, file_or_link)
         VALUES ($1, $2, 'javascript:alert(1)')`,
        [evidenceRequirementId, staffId],
      ),
    ).rejects.toThrow(/task_evidence_file_or_link_format/i)
    await db.exec('ROLLBACK')
  })

  it('records PIC progress changes and rejects progress updates by other roles', async () => {
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [staffId])
    await db.exec('SET LOCAL ROLE authenticated')
    const { rows: progressUpdate } = await db.query(
      'UPDATE public.tasks SET progress_pct = 45 WHERE id = $1 RETURNING progress_pct',
      [accountingTaskId],
    )
    const { rows: history } = await db.query(
      'SELECT changed_by, progress_pct FROM public.task_progress_history WHERE task_id = $1',
      [accountingTaskId],
    )
    expect(progressUpdate).toEqual([{ progress_pct: 45 }])
    expect(history).toEqual([{ changed_by: staffId, progress_pct: 45 }])
    await db.exec('ROLLBACK')

    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [accountingManagerId])
    await db.exec('SET LOCAL ROLE authenticated')
    await expect(
      db.query(
        'UPDATE public.tasks SET progress_pct = 60 WHERE id = $1',
        [accountingTaskId],
      ),
    ).rejects.toThrow(/hanya PIC task/i)
    await db.exec('ROLLBACK')
  })

  it('enforces valid status transitions through direct authenticated API updates', async () => {
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [staffId])
    await db.exec('SET LOCAL ROLE authenticated')

    const { rows: started } = await db.query(
      "UPDATE public.tasks SET status = 'In progress' WHERE id = $1 RETURNING status",
      [accountingTaskId],
    )
    expect(started).toEqual([{ status: 'In progress' }])
    await expect(
      db.query("UPDATE public.tasks SET status = 'Done' WHERE id = $1", [accountingTaskId]),
    ).rejects.toThrow(/transisi status task tidak diizinkan/i)
    await db.exec('ROLLBACK')
  })

  it('allows an in-scope manager to move a task through valid Kanban transitions, but not skip review (FR-110, BR-080)', async () => {
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [smAccountingId])
    await db.exec('SET LOCAL ROLE authenticated')
    const { rows } = await db.query(
      "UPDATE public.tasks SET status = 'In progress' WHERE id = $1 RETURNING status",
      [accountingTaskId],
    )
    expect(rows).toEqual([{ status: 'In progress' }])
    await db.exec('ROLLBACK')

    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [smAccountingId])
    await db.exec('SET LOCAL ROLE authenticated')
    await db.exec('SAVEPOINT invalid_kanban_transition')
    await expect(db.query(
      "UPDATE public.tasks SET status = 'Done' WHERE id = $1",
      [accountingTaskId],
    )).rejects.toThrow(/transisi status task tidak diizinkan/i)
    await db.exec('ROLLBACK TO SAVEPOINT invalid_kanban_transition')
    await db.exec('ROLLBACK')
  })

  it('blocks a PIC from changing start_date directly but permits an in-scope Manager (FR-111, BR-081)', async () => {
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [staffId])
    await db.exec('SET LOCAL ROLE authenticated')
    await expect(db.query(
      "UPDATE public.tasks SET start_date = '2026-01-01T12:00:00Z' WHERE id = $1",
      [accountingTaskId],
    )).rejects.toThrow(/pic harus mengajukan perubahan timeline/i)
    await db.exec('ROLLBACK')

    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [accountingManagerId])
    await db.exec('SET LOCAL ROLE authenticated')
    const { rows } = await db.query(
      "UPDATE public.tasks SET start_date = '2026-01-01T12:00:00Z' WHERE id = $1 RETURNING start_date",
      [accountingTaskId],
    )
    expect(rows).toEqual([{ start_date: new Date('2026-01-01T12:00:00.000Z') }])
    const { rows: auditRows } = await db.query(
      "SELECT action, old_value, new_value FROM public.audit_logs WHERE object = $1 AND action = 'update_start_date_direct'",
      [`tasks:${accountingTaskId}`],
    )
    expect(auditRows).toHaveLength(1)
    const audit = auditRows[0] as Record<string, unknown>
    expect(audit.action).toBe('update_start_date_direct')
    expect(new Date(String(audit.old_value)).toISOString()).toBe('2026-01-01T00:00:00.000Z')
    expect(new Date(String(audit.new_value)).toISOString()).toBe('2026-01-01T12:00:00.000Z')
    await db.exec('ROLLBACK')
  })

  it('allows only the assigned reviewer to approve a task in Review', async () => {
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [staffId])
    await db.exec('SET LOCAL ROLE authenticated')
    await db.query(
      'UPDATE public.tasks SET reviewer_id = $1 WHERE id = $2',
      [accountingManagerId, accountingTaskId],
    )
    await db.query(
      `INSERT INTO public.task_evidence (requirement_id, uploader_id, file_or_link)
       VALUES ($1, $2, 'https://files.example.test/reconciliation.pdf')`,
      [evidenceRequirementId, staffId],
    )
    await db.query(
      "UPDATE public.tasks SET status = 'In progress' WHERE id = $1",
      [accountingTaskId],
    )
    await db.query(
      "UPDATE public.tasks SET status = 'Review' WHERE id = $1",
      [accountingTaskId],
    )

    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [accountingManagerId])
    const { rows: approved } = await db.query(
      "UPDATE public.tasks SET status = 'Done' WHERE id = $1 RETURNING status, completed_at",
      [accountingTaskId],
    )
    expect(approved).toMatchObject([{ status: 'Done', completed_at: expect.anything() }])
    await db.exec('ROLLBACK')
  })

  it('requires a reviewer comment and atomically rejects a task to Revisi', async () => {
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [staffId])
    await db.exec('SET LOCAL ROLE authenticated')
    await db.query(
      `INSERT INTO public.task_evidence (requirement_id, uploader_id, file_or_link)
       VALUES ($1, $2, 'https://files.example.test/reconciliation.pdf')`,
      [evidenceRequirementId, staffId],
    )
    await db.query(
      "UPDATE public.tasks SET status = 'In progress' WHERE id = $1",
      [accountingTaskId],
    )
    await db.query(
      "UPDATE public.tasks SET status = 'Review' WHERE id = $1",
      [accountingTaskId],
    )
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [accountingManagerId])
    await db.exec('SAVEPOINT missing_review_comment')
    await expect(
      db.query(
        "UPDATE public.tasks SET status = 'Revisi' WHERE id = $1",
        [accountingTaskId],
      ),
    ).rejects.toThrow(/penolakan review wajib menyertakan komentar/i)
    await db.exec('ROLLBACK TO SAVEPOINT missing_review_comment')
    await db.exec('RELEASE SAVEPOINT missing_review_comment')

    await db.query(
      `SELECT public.review_task($1, 'Revisi'::public.task_status, $2)`,
      [accountingTaskId, 'Lengkapi lampiran rekonsiliasi.'],
    )
    const { rows: taskRows } = await db.query(
      'SELECT status FROM public.tasks WHERE id = $1',
      [accountingTaskId],
    )
    const { rows: comments } = await db.query(
      'SELECT user_id, body FROM public.task_comments WHERE task_id = $1',
      [accountingTaskId],
    )

    expect(taskRows).toEqual([{ status: 'Revisi' }])
    expect(comments).toEqual([{
      user_id: accountingManagerId,
      body: 'Lengkapi lampiran rekonsiliasi.',
    }])
    await db.exec('ROLLBACK')
  })

  it('allows the PIC to request a future deadline without changing the task due date', async () => {
    const requestId = crypto.randomUUID()
    const requestedDueDate = new Date(Date.now() + 10 * 86_400_000).toISOString()
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [staffId])
    await db.exec('SET LOCAL ROLE authenticated')

    const { rows: inserted } = await db.query(
      `INSERT INTO public.deadline_change_requests
        (id, task_id, requested_by, old_due_date, new_due_date, reason)
       VALUES ($1, $2, $3, '2026-01-02T00:00:00Z', $4, 'Menunggu dokumen pendukung')
       RETURNING status`,
      [requestId, accountingTaskId, staffId, requestedDueDate],
    )
    const { rows: taskRows } = await db.query(
      "SELECT due_date = '2026-01-02T00:00:00Z'::timestamptz AS unchanged FROM public.tasks WHERE id = $1",
      [accountingTaskId],
    )

    expect(inserted).toEqual([{ status: 'Menunggu approval' }])
    expect(taskRows).toEqual([{ unchanged: true }])
    await db.exec('ROLLBACK')
  })

  it('allows only in-scope SM or higher to approve a request and update the task atomically', async () => {
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [smAccountingId])
    await db.exec('SET LOCAL ROLE authenticated')

    await db.query(
      'SELECT public.decide_deadline_change($1, $2::public.deadline_request_status)',
      [accountingDeadlineRequestId, 'Disetujui'],
    )
    const { rows: deadlines } = await db.query<{
      due_date: Date
      new_due_date: Date
    }>(
      `SELECT t.due_date, d.new_due_date
       FROM public.tasks t
       JOIN public.deadline_change_requests d ON d.task_id = t.id
       WHERE t.id = $1 AND d.id = $2`,
      [accountingTaskId, accountingDeadlineRequestId],
    )
    const { rows: requestRows } = await db.query(
      'SELECT status, approver_id, decided_at FROM public.deadline_change_requests WHERE id = $1',
      [accountingDeadlineRequestId],
    )

    expect(deadlines).toHaveLength(1)
    expect(deadlines[0].due_date).toEqual(deadlines[0].new_due_date)
    expect(requestRows).toMatchObject([{
      status: 'Disetujui',
      approver_id: smAccountingId,
      decided_at: expect.anything(),
    }])
    await db.exec('ROLLBACK')
  })

  it('records a rejection without changing the task deadline', async () => {
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [smAccountingId])
    await db.exec('SET LOCAL ROLE authenticated')
    await db.query(
      'SELECT public.decide_deadline_change($1, $2::public.deadline_request_status)',
      [accountingDeadlineRequestId, 'Ditolak'],
    )
    const { rows: taskRows } = await db.query(
      "SELECT due_date = '2026-01-02T00:00:00Z'::timestamptz AS unchanged FROM public.tasks WHERE id = $1",
      [accountingTaskId],
    )
    const { rows: requestRows } = await db.query(
      'SELECT status, approver_id, decided_at FROM public.deadline_change_requests WHERE id = $1',
      [accountingDeadlineRequestId],
    )

    expect(taskRows).toMatchObject([{ unchanged: true }])
    expect(requestRows).toMatchObject([{
      status: 'Ditolak',
      approver_id: smAccountingId,
      decided_at: expect.anything(),
    }])
    await db.exec('ROLLBACK')
  })

  it('rejects managers, out-of-scope approvers, and stale deadline requests', async () => {
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [accountingManagerId])
    await db.exec('SET LOCAL ROLE authenticated')
    await expect(
      db.query(
        'SELECT public.decide_deadline_change($1, $2::public.deadline_request_status)',
        [accountingDeadlineRequestId, 'Disetujui'],
      ),
    ).rejects.toThrow(/Hanya SM, GM, atau Super Admin/i)
    await db.exec('ROLLBACK')

    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [smReportingId])
    await db.exec('SET LOCAL ROLE authenticated')
    await expect(
      db.query(
        'SELECT public.decide_deadline_change($1, $2::public.deadline_request_status)',
        [accountingDeadlineRequestId, 'Disetujui'],
      ),
    ).rejects.toThrow(/di luar cakupan/i)
    await db.exec('ROLLBACK')

    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [accountingManagerId])
    await db.exec('SET LOCAL ROLE authenticated')
    await db.query(
      "UPDATE public.tasks SET due_date = now() + interval '20 days' WHERE id = $1",
      [accountingTaskId],
    )
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [smAccountingId])
    await expect(
      db.query(
        'SELECT public.decide_deadline_change($1, $2::public.deadline_request_status)',
        [accountingDeadlineRequestId, 'Disetujui'],
      ),
    ).rejects.toThrow(/Deadline task telah berubah/i)
    await db.exec('ROLLBACK')
  })

  it('audits direct deadline edits atomically and blocks PIC approval bypass', async () => {
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [accountingManagerId])
    await db.exec('SET LOCAL ROLE authenticated')
    await db.query(
      "UPDATE public.tasks SET due_date = now() + interval '30 days' WHERE id = $1",
      [accountingTaskId],
    )
    const { rows: auditRows } = await db.query(
      `SELECT action, object, user_id,
         old_value::timestamptz = '2026-01-02T00:00:00Z'::timestamptz AS old_deadline_matches,
          new_value::timestamptz = t.due_date AS new_deadline_matches
       FROM public.audit_logs a
       JOIN public.tasks t ON a.object = 'tasks:' || t.id
       WHERE a.action = 'update_deadline_direct' AND t.id = $1`,
      [accountingTaskId],
    )

    expect(auditRows).toEqual([{
      action: 'update_deadline_direct',
      object: `tasks:${accountingTaskId}`,
      user_id: accountingManagerId,
      old_deadline_matches: true,
      new_deadline_matches: true,
    }])
    await db.exec('ROLLBACK')

    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [staffId])
    await db.exec('SET LOCAL ROLE authenticated')
    await expect(
      db.query(
        "UPDATE public.tasks SET due_date = now() + interval '30 days' WHERE id = $1",
        [accountingTaskId],
      ),
    ).rejects.toThrow(/Hanya Manager, SM, GM, atau Super Admin/i)
    await db.exec('ROLLBACK')
  })

  it('creates eligible reminder checkpoints once and atomically notifies only task owners', async () => {
    const blockedTaskId = crypto.randomUUID()
    const reviewTaskId = crypto.randomUUID()
    const doneTaskId = crypto.randomUUID()
    const overdueTaskId = crypto.randomUUID()
    const shortTaskId = crypto.randomUUID()
    const shortDoneWbsId = crypto.randomUUID()
    const shortOpenWbsId = crypto.randomUUID()
    const schedulerNow = '2026-01-02T21:36:00Z'

    await db.query(
      `INSERT INTO public.tasks
        (id, owner_id, assigner_id, reviewer_id, org_unit_id, title, status,
         progress_pct, start_date, due_date)
       VALUES
        ($1, $5, $6, $7, 4, 'Blocked reminder task', 'Blocked', 40, '2026-01-01T00:00:00Z', '2026-01-03T00:00:00Z'),
        ($2, $5, $6, $7, 4, 'Review reminder task', 'Review', 100, '2026-01-01T00:00:00Z', '2026-01-03T00:00:00Z'),
        ($3, $5, $6, $7, 4, 'Done task', 'Done', 0, '2026-01-01T00:00:00Z', '2026-01-03T00:00:00Z'),
        ($4, $5, $6, $7, 4, 'Overdue task', 'In progress', 0, '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z'),
        ($8, $5, $6, $7, 4, 'Short WBS task', 'In progress', 90, '2026-01-02T12:00:00Z', '2026-01-03T00:00:00Z')`,
      [
        blockedTaskId,
        reviewTaskId,
        doneTaskId,
        overdueTaskId,
        staffId,
        gmId,
        accountingManagerId,
        shortTaskId,
      ],
    )
    await db.query(
      `INSERT INTO public.wbs_items (id, task_id, title, weight, is_done)
       VALUES ($1, $3, 'Finished portion', 20, true),
              ($2, $3, 'Outstanding portion', 80, false)`,
      [shortDoneWbsId, shortOpenWbsId, shortTaskId],
    )

    const { rows: firstRun } = await db.query<{
      reminder_id: string
      task_id: string
      owner_id: string
      checkpoint_pct: number
    }>(
      'SELECT * FROM public.process_task_reminder_checkpoints($1::timestamptz)',
      [schedulerNow],
    )
    const { rows: secondRun } = await db.query<{
      reminder_id: string
      task_id: string
      owner_id: string
      checkpoint_pct: number
    }>(
      'SELECT * FROM public.process_task_reminder_checkpoints($1::timestamptz)',
      [schedulerNow],
    )
    const { rows: reminderRows } = await db.query<{
      task_id: string
      checkpoint_pct: number
      due_date_version: Date
    }>(
      'SELECT task_id, checkpoint_pct, due_date_version FROM public.task_reminders ORDER BY task_id, checkpoint_pct',
    )
    const { rows: notificationRows } = await db.query<{
      user_id: string
      reminder_id: string | null
      type: string
    }>(
      `SELECT user_id, reminder_id, type FROM public.notifications
       WHERE type LIKE 'reminder_%'
       ORDER BY type`,
    )

    expect(firstRun).toHaveLength(7)
    expect(secondRun).toEqual([])
    expect(reminderRows).toHaveLength(7)
    expect(reminderRows.filter((row) => row.task_id === blockedTaskId).map((row) => row.checkpoint_pct))
      .toEqual([50, 80, 90])
    expect(reminderRows.filter((row) => row.task_id === reviewTaskId).map((row) => row.checkpoint_pct))
      .toEqual([80, 90])
    expect(reminderRows.filter((row) => row.task_id === shortTaskId).map((row) => row.checkpoint_pct))
      .toEqual([50, 80])
    expect(reminderRows.every((row) => row.due_date_version instanceof Date)).toBe(true)
    expect(notificationRows).toHaveLength(7)
    expect(notificationRows.every((row) => row.user_id === staffId)).toBe(true)
    expect(notificationRows.every((row) => row.reminder_id !== null)).toBe(true)
  })

  it('rejects reminder notifications addressed to anyone other than the current task PIC', async () => {
    await expect(
      db.query(
        `INSERT INTO public.notifications (user_id, task_id, type, title, body)
         VALUES ($1, $2, 'reminder_50', 'Reminder', 'Update task')`,
        [managerId, accountingTaskId],
      ),
    ).rejects.toThrow('Reminder hanya dapat dikirim kepada PIC task')
  })

  it('allows the PIC to respond once with a valid choice and denies other users', async () => {
    const reminderId = crypto.randomUUID()
    await db.query(
      `INSERT INTO public.task_reminders
        (id, task_id, checkpoint_pct, due_date_version)
       VALUES ($1, $2, 50, '2026-01-01T00:00:00Z')`,
      [reminderId, accountingTaskId],
    )

    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [accountingManagerId])
    await db.exec('SET LOCAL ROLE authenticated')
    const { rows: reviewerUpdate } = await db.query(
      `UPDATE public.task_reminders
       SET response = 'Masih on progress'
       WHERE id = $1
       RETURNING id`,
      [reminderId],
    )
    expect(reviewerUpdate).toEqual([])
    await db.exec('ROLLBACK')

    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [staffId])
    await db.exec('SET LOCAL ROLE authenticated')
    await expect(
      db.query(
        `UPDATE public.task_reminders
         SET response = 'Invalid choice'
         WHERE id = $1`,
        [reminderId],
      ),
    ).rejects.toThrow('Pilihan tanggapan reminder tidak valid')
    await db.exec('ROLLBACK')

    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [staffId])
    await db.exec('SET LOCAL ROLE authenticated')
    const { rows: picUpdate } = await db.query<{ id: string }>(
      `UPDATE public.task_reminders
       SET response = 'Ajukan perubahan deadline'
       WHERE id = $1
       RETURNING id`,
      [reminderId],
    )
    const { rows: savedResponse } = await db.query<{
      response: string
      responded_at: Date
    }>(
      'SELECT response, responded_at FROM public.task_reminders WHERE id = $1',
      [reminderId],
    )
    const { rows: repeatedUpdate } = await db.query(
      `UPDATE public.task_reminders
       SET response = 'Butuh support'
       WHERE id = $1
       RETURNING id`,
      [reminderId],
    )
    expect(picUpdate).toHaveLength(1)
    expect(savedResponse).toHaveLength(1)
    expect(savedResponse[0].response).toBe('Ajukan perubahan deadline')
    expect(savedResponse[0].responded_at).toBeInstanceOf(Date)
    expect(repeatedUpdate).toEqual([])
    await db.exec('ROLLBACK')
  })

  it('notifies scoped supervisors for PIC responses and progress, and the PIC for deadline decisions', async () => {
    const reminderId = crypto.randomUUID()
    await db.exec('BEGIN')
    try {
      await db.query(
        `INSERT INTO public.task_reminders
          (id, task_id, checkpoint_pct, due_date_version)
         VALUES ($1, $2, 50, '2026-01-01T00:00:00Z')`,
        [reminderId, accountingTaskId],
      )
      await db.query(
        `UPDATE public.task_reminders
         SET response = 'Masih on progress'
         WHERE id = $1`,
        [reminderId],
      )

      await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [staffId])
      await db.exec('SET LOCAL ROLE authenticated')
      await db.query(
        'UPDATE public.tasks SET progress_pct = 25 WHERE id = $1',
        [accountingTaskId],
      )
      await db.exec('RESET ROLE')
      await db.query(
        `UPDATE public.deadline_change_requests
         SET status = 'Ditolak', approver_id = $2, decided_at = now()
         WHERE id = $1`,
        [accountingDeadlineRequestId, smAccountingId],
      )

      const { rows: responseRecipients } = await db.query<{ user_id: string }>(
        `SELECT user_id FROM public.notifications
         WHERE task_id = $1 AND type = 'reminder_response'
         ORDER BY user_id`,
        [accountingTaskId],
      )
      const { rows: progressRecipients } = await db.query<{ user_id: string }>(
        `SELECT user_id FROM public.notifications
         WHERE task_id = $1 AND type = 'task_progress_updated'
         ORDER BY user_id`,
        [accountingTaskId],
      )
      const { rows: deadlineRequestRecipients } = await db.query<{ user_id: string }>(
        `SELECT user_id FROM public.notifications
         WHERE task_id = $1 AND type = 'deadline_change_requested'
         ORDER BY user_id`,
        [accountingTaskId],
      )
      const { rows: decisionRecipients } = await db.query<{ user_id: string }>(
        `SELECT user_id FROM public.notifications
         WHERE task_id = $1 AND type = 'deadline_change_decision'
         ORDER BY user_id`,
        [accountingTaskId],
      )
      const { rows: expectedFullSet } = await db.query<{ user_id: string }>(
        `SELECT DISTINCT recipient_id AS user_id
         FROM (
           SELECT t.reviewer_id AS recipient_id
           FROM public.tasks t
           WHERE t.id = $1
           UNION
           SELECT u.id
           FROM public.users u
           JOIN public.roles r ON r.id = u.role_id AND r.level = 4
           WHERE u.org_unit_id = 2
           UNION
           SELECT u.id
           FROM public.users u
           JOIN public.roles r ON r.id = u.role_id AND r.level IN (5, 6)
         ) recipients
         JOIN public.users active_user ON active_user.id = recipient_id
         WHERE active_user.status = 'aktif' AND recipient_id <> $2
         ORDER BY recipient_id`,
        [accountingTaskId, staffId],
      )
      const { rows: expectedWithoutManager } = await db.query<{ user_id: string }>(
        `SELECT DISTINCT u.id AS user_id
         FROM public.users u
         JOIN public.roles r ON r.id = u.role_id
         WHERE u.status = 'aktif'
           AND u.id <> $1
           AND (
             (r.level = 4 AND u.org_unit_id = 2)
             OR r.level IN (5, 6)
           )
         ORDER BY u.id`,
        [staffId],
      )

      expect(responseRecipients.map((row) => row.user_id)).toEqual(
        expectedFullSet.map((row) => row.user_id),
      )
      expect(progressRecipients.map((row) => row.user_id)).toEqual(
        expectedFullSet.map((row) => row.user_id),
      )
      expect(deadlineRequestRecipients.map((row) => row.user_id)).toEqual(
        expectedWithoutManager.map((row) => row.user_id),
      )
      expect(decisionRecipients.map((row) => row.user_id)).toEqual([staffId])
    } finally {
      await db.exec('ROLLBACK')
    }
  })

  it('claims reminder emails only after 72 hours and protects delivery against retries', async () => {
    const emailTaskId = crypto.randomUUID()
    const overdueTaskId = crypto.randomUUID()
    const doneTaskId = crypto.randomUUID()
    const firstReminderId = crypto.randomUUID()
    const secondReminderId = crypto.randomUUID()
    const overdueReminderId = crypto.randomUUID()
    const doneReminderId = crypto.randomUUID()
    const emailNow = '2026-01-05T00:00:00Z'
    await db.query(
      `INSERT INTO public.tasks
        (id, owner_id, assigner_id, reviewer_id, org_unit_id, title, status, start_date, due_date)
       VALUES
         ($1, $4, $5, $6, 4, 'Email escalation task', 'In progress', '2026-01-01T00:00:00Z', '2026-01-10T00:00:00Z'),
         ($2, $4, $5, $6, 4, 'Overdue email task', 'In progress', '2026-01-01T00:00:00Z', '2026-01-04T00:00:00Z'),
         ($3, $4, $5, $6, 4, 'Done email task', 'Done', '2026-01-01T00:00:00Z', '2026-01-10T00:00:00Z')`,
      [emailTaskId, overdueTaskId, doneTaskId, staffId, gmId, accountingManagerId],
    )
    await db.query(
      `INSERT INTO public.task_reminders
        (id, task_id, checkpoint_pct, sent_at, due_date_version)
       VALUES
        ($1, $5, 50, '2026-01-01T00:00:00Z', '2026-01-10T00:00:00Z'),
        ($2, $5, 80, '2026-01-02T00:00:00Z', '2026-01-10T00:00:00Z'),
        ($3, $6, 90, '2026-01-01T00:00:00Z', '2026-01-04T00:00:00Z'),
        ($4, $7, 90, '2026-01-01T00:00:00Z', '2026-01-10T00:00:00Z')`,
      [
        firstReminderId,
        secondReminderId,
        overdueReminderId,
        doneReminderId,
        emailTaskId,
        overdueTaskId,
        doneTaskId,
      ],
    )

    const { rows: firstClaim } = await db.query<{
      reminder_id: string
      task_id: string
      owner_id: string
      owner_email: string
      task_title: string
      checkpoint_pct: number
    }>(
      'SELECT * FROM public.claim_due_reminder_emails($1::timestamptz, 2)',
      [emailNow],
    )
    const { rows: repeatedClaim } = await db.query(
      'SELECT * FROM public.claim_due_reminder_emails($1::timestamptz, 2)',
      [emailNow],
    )
    const { rows: markedSent } = await db.query<{ mark_reminder_email_sent: boolean }>(
      'SELECT public.mark_reminder_email_sent($1, $2::timestamptz)',
      [firstReminderId, emailNow],
    )
    const retryAt = '2026-01-05T00:16:00Z'
    const { rows: expiredLeaseRetry } = await db.query<{ reminder_id: string }>(
      'SELECT * FROM public.claim_due_reminder_emails($1::timestamptz, 2)',
      [retryAt],
    )

    expect(firstClaim.map((row) => row.reminder_id).sort())
      .toEqual([firstReminderId, secondReminderId].sort())
    expect(firstClaim.every((row) => row.owner_email === `${staffId}@example.test`)).toBe(true)
    expect(firstClaim.every((row) => row.task_id === emailTaskId)).toBe(true)
    expect(firstClaim.every((row) => row.owner_id === staffId)).toBe(true)
    expect(firstClaim.every((row) => row.task_title === 'Email escalation task')).toBe(true)
    expect(repeatedClaim).toEqual([])
    expect(markedSent[0].mark_reminder_email_sent).toBe(true)
    expect(expiredLeaseRetry.map((row) => row.reminder_id)).toEqual([secondReminderId])
  })

  it('preserves reminders from the old deadline and issues the checkpoint again for the approved version', async () => {
    const versionedTaskId = crypto.randomUUID()
    const deadlineRequestId = crypto.randomUUID()
    const now = Date.now()
    const startDate = new Date(now - 10 * 86_400_000).toISOString()
    const oldDueDate = new Date(now + 5 * 86_400_000).toISOString()
    const newDueDate = new Date(now + 15 * 86_400_000).toISOString()
    const firstCheckpointTime = new Date(now).toISOString()
    const secondCheckpointTime = new Date(now + 4 * 86_400_000).toISOString()

    await db.query(
      `INSERT INTO public.tasks
        (id, owner_id, assigner_id, reviewer_id, org_unit_id, title, status, progress_pct, start_date, due_date)
       VALUES ($1, $2, $3, $4, 4, 'Versioned reminder task', 'In progress', 0, $5, $6)`,
      [
        versionedTaskId,
        staffId,
        gmId,
        accountingManagerId,
        startDate,
        oldDueDate,
      ],
    )
    const { rows: firstRun } = await db.query<{ checkpoint_pct: number }>(
      'SELECT * FROM public.process_task_reminder_checkpoints($1::timestamptz)',
      [firstCheckpointTime],
    )
    await db.query(
      `INSERT INTO public.deadline_change_requests
        (id, task_id, requested_by, old_due_date, new_due_date, reason)
       VALUES ($1, $2, $3, $4, $5, 'Menunggu dependensi eksternal')`,
      [deadlineRequestId, versionedTaskId, staffId, oldDueDate, newDueDate],
    )

    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [smAccountingId])
    await db.exec('SET LOCAL ROLE authenticated')
    await db.query(
      `SELECT public.decide_deadline_change(
        $1,
        'Disetujui'::public.deadline_request_status
      )`,
      [deadlineRequestId],
    )
    await db.exec('RESET ROLE')
    const { rows: secondRun } = await db.query<{ checkpoint_pct: number }>(
      'SELECT * FROM public.process_task_reminder_checkpoints($1::timestamptz)',
      [secondCheckpointTime],
    )
    const { rows: reminderVersions } = await db.query<{
      checkpoint_pct: number
      due_date_version: Date
    }>(
      `SELECT checkpoint_pct, due_date_version
       FROM public.task_reminders
       WHERE task_id = $1
       ORDER BY due_date_version`,
      [versionedTaskId],
    )
    const { rows: repeatedRun } = await db.query(
      'SELECT * FROM public.process_task_reminder_checkpoints($1::timestamptz)',
      [secondCheckpointTime],
    )

    expect(firstRun.map((row) => row.checkpoint_pct)).toEqual([50])
    expect(secondRun.map((row) => row.checkpoint_pct)).toEqual([50])
    expect(reminderVersions).toHaveLength(2)
    expect(reminderVersions.map((row) => row.checkpoint_pct)).toEqual([50, 50])
    expect(reminderVersions[0].due_date_version.toISOString()).toBe(oldDueDate)
    expect(reminderVersions[1].due_date_version.toISOString()).toBe(newDueDate)
    expect(repeatedRun).toEqual([])
    await db.exec('ROLLBACK')
  })

  it('requires active support before Blocked and fulfillment before returning to In progress', async () => {
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [staffId])
    await db.exec('SET LOCAL ROLE authenticated')
    await db.query(
      "UPDATE public.tasks SET status = 'In progress' WHERE id = $1",
      [deleteCheckTaskId],
    )
    await expect(
      db.query("UPDATE public.tasks SET status = 'Blocked' WHERE id = $1", [deleteCheckTaskId]),
    ).rejects.toThrow(/wajib memiliki permintaan support/i)
    await db.exec('ROLLBACK')

    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [staffId])
    await db.exec('SET LOCAL ROLE authenticated')
    await db.query(
      "UPDATE public.tasks SET status = 'In progress' WHERE id = $1",
      [deleteCheckTaskId],
    )
    await db.query(
      `INSERT INTO public.task_supports (task_id, needed_from_id, description)
       VALUES ($1, $2, 'Resolve access issue')`,
      [deleteCheckTaskId, accountingManagerId],
    )
    await db.query(
      "UPDATE public.tasks SET status = 'Blocked' WHERE id = $1",
      [deleteCheckTaskId],
    )
    await db.exec('SAVEPOINT pending_support')
    await expect(
      db.query("UPDATE public.tasks SET status = 'In progress' WHERE id = $1", [deleteCheckTaskId]),
    ).rejects.toThrow(/support task harus diberikan/i)
    await db.exec('ROLLBACK TO SAVEPOINT pending_support')
    await db.exec('RELEASE SAVEPOINT pending_support')

    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [accountingManagerId])
    await db.query(
      "UPDATE public.task_supports SET status = 'diberikan' WHERE task_id = $1",
      [deleteCheckTaskId],
    )
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [staffId])
    const { rows: resumed } = await db.query(
      "UPDATE public.tasks SET status = 'In progress' WHERE id = $1 RETURNING status",
      [deleteCheckTaskId],
    )
    expect(resumed).toEqual([{ status: 'In progress' }])
    await db.exec('ROLLBACK')
  })

  it('requires evidence for regular owners and supports privileged owners without reviewers', async () => {
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [staffId])
    await db.exec('SET LOCAL ROLE authenticated')
    await db.query(
      "UPDATE public.tasks SET status = 'In progress' WHERE id = $1",
      [accountingTaskId],
    )
    await expect(
      db.query("UPDATE public.tasks SET status = 'Review' WHERE id = $1", [accountingTaskId]),
    ).rejects.toThrow(/evidence wajib harus diunggah/i)
    await db.exec('ROLLBACK')

    await db.exec('BEGIN')
    const gmTaskId = crypto.randomUUID()
    const gmEvidenceRequirementId = crypto.randomUUID()
    await db.query(
      `INSERT INTO public.tasks (id, owner_id, assigner_id, org_unit_id, title, start_date, due_date)
       VALUES ($1, $2, $2, 4, 'GM task', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z')`,
      [gmTaskId, gmId],
    )
    await db.query(
      `INSERT INTO public.evidence_requirements (id, task_id, description, mandatory)
       VALUES ($1, $2, 'Optional for GM owner', true)`,
      [gmEvidenceRequirementId, gmTaskId],
    )
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [gmId])
    await db.exec('SET LOCAL ROLE authenticated')
    await db.query(
      "UPDATE public.tasks SET status = 'In progress' WHERE id = $1",
      [gmTaskId],
    )
    const { rows: done } = await db.query(
      "UPDATE public.tasks SET status = 'Done' WHERE id = $1 RETURNING status",
      [gmTaskId],
    )
    expect(done).toEqual([{ status: 'Done' }])

    const superAdminTaskId = crypto.randomUUID()
    const superAdminEvidenceRequirementId = crypto.randomUUID()
    await db.query(
      `INSERT INTO public.tasks (id, owner_id, assigner_id, org_unit_id, title, start_date, due_date)
       VALUES ($1, $2, $2, 4, 'Super Admin self-review task', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z')`,
      [superAdminTaskId, superAdminId],
    )
    await db.query(
      `INSERT INTO public.evidence_requirements (id, task_id, description, mandatory)
       VALUES ($1, $2, 'Evidence waived for owner', true)`,
      [superAdminEvidenceRequirementId, superAdminTaskId],
    )
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [superAdminId])
    await db.query(
      "UPDATE public.tasks SET status = 'In progress' WHERE id = $1",
      [superAdminTaskId],
    )
    await db.query(
      "UPDATE public.tasks SET status = 'Review' WHERE id = $1",
      [superAdminTaskId],
    )
    await db.query(
      `SELECT public.review_task(
        $1,
        'Revisi'::public.task_status,
        'Lengkapi penjelasan rekonsiliasi.'
      )`,
      [superAdminTaskId],
    )
    await db.query(
      "UPDATE public.tasks SET status = 'In progress' WHERE id = $1",
      [superAdminTaskId],
    )
    await db.query(
      "UPDATE public.tasks SET status = 'Review' WHERE id = $1",
      [superAdminTaskId],
    )
    await db.query(
      `SELECT public.review_task(
        $1,
        'Done'::public.task_status,
        'Hasil revisi sudah saya verifikasi.'
      )`,
      [superAdminTaskId],
    )
    const { rows: selfReviewedTask } = await db.query(
      'SELECT status, reviewer_id, completed_at FROM public.tasks WHERE id = $1',
      [superAdminTaskId],
    )
    const { rows: selfReviewComments } = await db.query(
      'SELECT body FROM public.task_comments WHERE task_id = $1 ORDER BY created_at',
      [superAdminTaskId],
    )
    expect(selfReviewedTask).toMatchObject([{
      status: 'Done',
      reviewer_id: null,
      completed_at: expect.anything(),
    }])
    expect(selfReviewComments).toEqual([
      { body: 'Lengkapi penjelasan rekonsiliasi.' },
      { body: 'Hasil revisi sudah saya verifikasi.' },
    ])
    await db.exec('ROLLBACK')
  })

  it('moves task ownership atomically with scoped history and PIC notification', async () => {
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [accountingManagerId])
    await db.exec('SET LOCAL ROLE authenticated')

    await db.exec('SAVEPOINT bypass_reassignment')
    await expect(
      db.query(
        'UPDATE public.tasks SET owner_id = $1 WHERE id = $2',
        [replacementStaffId, accountingTaskId],
      ),
    ).rejects.toThrow(/harus dilakukan melalui alur pemindahan/i)
    await db.exec('ROLLBACK TO SAVEPOINT bypass_reassignment')
    await db.exec('RELEASE SAVEPOINT bypass_reassignment')

    await db.exec('SAVEPOINT direct_history_insert')
    await expect(
      db.query(
        `INSERT INTO public.task_reassignments (task_id, from_user_id, to_user_id, reason)
         VALUES ($1, $2, $3, 'Bypass action')`,
        [accountingTaskId, staffId, replacementStaffId],
      ),
    ).rejects.toThrow(/row-level security policy/i)
    await db.exec('ROLLBACK TO SAVEPOINT direct_history_insert')
    await db.exec('RELEASE SAVEPOINT direct_history_insert')

    const { rows: reassignment } = await db.query(
      'SELECT public.reassign_task($1, $2, $3) AS id',
      [accountingTaskId, replacementStaffId, 'Rebalance workload'],
    )
    expect(reassignment).toHaveLength(1)
    const { rows: movedTask } = await db.query(
      'SELECT owner_id, reviewer_id, org_unit_id FROM public.tasks WHERE id = $1',
      [accountingTaskId],
    )
    expect(movedTask).toEqual([{
      owner_id: replacementStaffId,
      reviewer_id: accountingManagerId,
      org_unit_id: 4,
    }])
    const { rows: history } = await db.query(
      'SELECT from_user_id, to_user_id, reason FROM public.task_reassignments WHERE task_id = $1',
      [accountingTaskId],
    )
    expect(history).toEqual([{
      from_user_id: staffId,
      to_user_id: replacementStaffId,
      reason: 'Rebalance workload',
    }])

    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [replacementStaffId])
    const { rows: assignmentNotices } = await db.query(
      "SELECT type, title FROM public.notifications WHERE user_id = $1 AND task_id = $2",
      [replacementStaffId, accountingTaskId],
    )
    expect(assignmentNotices).toEqual([{
      type: 'task_assigned',
      title: 'Task baru ditugaskan kepada Anda',
    }])
    await db.exec('ROLLBACK')
  })

  it('rejects transfers outside the manager section and rejects blank reasons', async () => {
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [managerId])
    await db.exec('SET LOCAL ROLE authenticated')
    await expect(
      db.query(
        'SELECT public.reassign_task($1, $2, $3)',
        [accountingTaskId, replacementStaffId, 'Wrong section'],
      ),
    ).rejects.toThrow(/di luar cakupan/i)
    await db.exec('ROLLBACK')

    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [accountingManagerId])
    await db.exec('SET LOCAL ROLE authenticated')
    await expect(
      db.query(
        'SELECT public.reassign_task($1, $2, $3)',
        [accountingTaskId, replacementStaffId, '   '],
      ),
    ).rejects.toThrow(/data pemindahan task tidak valid/i)
    await db.exec('ROLLBACK')
  })

  it('allows SM and GM transfers only to permitted role levels within their organization tree', async () => {
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [smAccountingId])
    await db.exec('SET LOCAL ROLE authenticated')
    const { rows: smMove } = await db.query(
      'SELECT public.reassign_task($1, $2, $3) AS id',
      [accountingTaskId, accountingManagerId, 'SM workload balancing'],
    )
    expect(smMove).toHaveLength(1)
    await db.exec('ROLLBACK')

    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [gmId])
    await db.exec('SET LOCAL ROLE authenticated')
    const { rows: gmMove } = await db.query(
      'SELECT public.reassign_task($1, $2, $3) AS id',
      [accountingTaskId, accountingManagerId, 'GM workload balancing'],
    )
    expect(gmMove).toHaveLength(1)
    await db.exec('ROLLBACK')
  })

  it('prevents a Manager from changing a task in another section', async () => {
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [managerId])
    await db.exec('SET LOCAL ROLE authenticated')

    const { rows } = await db.query(
      "UPDATE public.tasks SET title = 'Unauthorized change' WHERE id = $1 RETURNING id",
      [accountingTaskId],
    )

    expect(rows).toEqual([])
    await db.exec('ROLLBACK')
  })

  it('blocks the SM Reporting unit from changing a Unit Accounting task (PR-2)', async () => {
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [smReportingId])
    await db.exec('SET LOCAL ROLE authenticated')

    const { rows } = await db.query(
      "UPDATE public.tasks SET title = 'Unauthorized change' WHERE id = $1 RETURNING id",
      [accountingTaskId],
    )

    expect(rows).toEqual([])
    const { rows: deadlineUpdates } = await db.query(
      "UPDATE public.deadline_change_requests SET status = 'Disetujui', approver_id = $1, decided_at = now() WHERE id = $2 RETURNING id",
      [smReportingId, accountingDeadlineRequestId],
    )
    expect(deadlineUpdates).toEqual([])
    await db.exec('ROLLBACK')
  })

  it('clamps monthly task template dates to the last day of shorter months (FR-100, D-035)', async () => {
    const { rows } = await db.query<{ run_at: Date }>(
      `SELECT public.next_task_template_run('monthly'::text, 31::smallint, '2027-02-01T00:00:00Z'::timestamptz) AS run_at`,
    )

    expect(new Date(rows[0].run_at).toISOString()).toBe('2027-02-28T01:00:00.000Z')
  })

  it('scopes task category writes to SM+ and the managed organization tree (FR-100, D-032)', async () => {
    const categoryId = crypto.randomUUID()
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [smAccountingId])
    await db.exec('SET LOCAL ROLE authenticated')
    await db.query(
      'INSERT INTO public.task_categories (id, org_unit_id, name) VALUES ($1, 4, $2)',
      [categoryId, 'Monthly close'],
    )
    await db.exec('ROLLBACK')

    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [staffId])
    await db.exec('SET LOCAL ROLE authenticated')
    await expect(db.query(
      "INSERT INTO public.task_categories (org_unit_id, name) VALUES (4, 'Unauthorized')",
    )).rejects.toThrow(/row-level security policy/i)
    await db.exec('ROLLBACK')

    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [smReportingId])
    await db.exec('SET LOCAL ROLE authenticated')
    await expect(db.query(
      "INSERT INTO public.task_categories (org_unit_id, name) VALUES (4, 'Wrong unit')",
    )).rejects.toThrow(/row-level security policy/i)
    await db.exec('ROLLBACK')
  })

  it('scopes category reads and prevents direct scope changes through the API (FR-100, D-032)', async () => {
    const categoryId = crypto.randomUUID()
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [smAccountingId])
    await db.exec('SET LOCAL ROLE authenticated')
    await db.query(
      'INSERT INTO public.task_categories (id, org_unit_id, name) VALUES ($1, 4, $2)',
      [categoryId, `Scoped ${categoryId.slice(0, 6)}`],
    )
    const { rows: scopedRows } = await db.query(
      'SELECT id FROM public.task_categories WHERE id = $1', [categoryId],
    )
    expect(scopedRows).toHaveLength(1)
    await db.exec('SAVEPOINT invalid_category_section')
    await expect(db.query(
      "INSERT INTO public.task_categories (org_unit_id, name) VALUES (3, 'Not a section')",
    )).rejects.toThrow(/harus berada pada section/i)
    await db.exec('ROLLBACK TO SAVEPOINT invalid_category_section')
    await db.exec('SAVEPOINT invalid_category_scope_change')
    await expect(db.query(
      'UPDATE public.task_categories SET org_unit_id = 5 WHERE id = $1', [categoryId],
    )).rejects.toThrow(/cakupan kategori tidak dapat diubah/i)
    await db.exec('ROLLBACK TO SAVEPOINT invalid_category_scope_change')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [smReportingId])
    const { rows: outOfScopeRows } = await db.query(
      'SELECT id FROM public.task_categories WHERE id = $1', [categoryId],
    )
    expect(outOfScopeRows).toEqual([])
    await db.exec('ROLLBACK')

    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [staffId])
    await db.exec('SET LOCAL ROLE authenticated')
    const { rows: hiddenRows } = await db.query(
      'SELECT id FROM public.task_categories WHERE id = $1', [categoryId],
    )
    expect(hiddenRows).toEqual([])
    await db.exec('ROLLBACK')
  })

  it('skips a recurring template when its 08:00 WIB cron window was missed (FR-100, CR-0003)', async () => {
    const categoryId = crypto.randomUUID()
    const templateId = crypto.randomUUID()
    const scheduledAt = '2027-03-08T01:00:00.000Z'

    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [smAccountingId])
    await db.exec('SET LOCAL ROLE authenticated')
    await db.query(
      'INSERT INTO public.task_categories (id, org_unit_id, name) VALUES ($1, 4, $2)',
      [categoryId, `Missed ${categoryId.slice(0, 6)}`],
    )
    await db.query(
      `INSERT INTO public.task_templates
        (id, org_unit_id, category_id, name, title, owner_id, reviewer_id, recurrence, recurrence_day, due_offset_days, created_by)
       VALUES ($1, 4, $2, 'Weekly close', 'Review ledger', $3, $4, 'weekly', 1, 7, $5)`,
      [templateId, categoryId, staffId, accountingManagerId, smAccountingId],
    )

    await db.query("SELECT set_config('request.jwt.claim.sub', '', true)")
    await db.query("SELECT set_config('request.jwt.claim.role', 'service_role', true)")
    await db.exec('SET LOCAL ROLE service_role')
    await db.query(
      'UPDATE public.task_templates SET next_run_at = $1::timestamptz WHERE id = $2',
      [scheduledAt, templateId],
    )
    const { rows: workerPrivileges } = await db.query<{ can_execute: boolean }>(
      `SELECT has_function_privilege(
        'service_role',
        'public.process_task_template_runs_worker(timestamp with time zone)',
        'EXECUTE'
      ) AS can_execute`,
    )
    expect(workerPrivileges).toEqual([{ can_execute: false }])
    const { rows } = await db.query<{ created_count: number; skipped_count: number }>(
      'SELECT * FROM public.process_task_template_runs($1::timestamptz)',
      ['2027-03-08T01:05:00.000Z'],
    )
    expect(rows).toEqual([{ created_count: 0, skipped_count: 1 }])
    const { rows: runRows } = await db.query(
      'SELECT outcome, task_id FROM public.task_template_runs WHERE template_id = $1', [templateId],
    )
    expect(runRows).toEqual([{ outcome: 'skipped', task_id: null }])
    await db.exec('ROLLBACK')
  })

  it('creates recurring tasks once from an immutable template snapshot (FR-100, CR-0003, BR-001)', async () => {
    const categoryId = crypto.randomUUID()
    const templateId = crypto.randomUUID()
    await db.exec('BEGIN')
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [smAccountingId])
    await db.exec('SET LOCAL ROLE authenticated')
    await db.query(
      'INSERT INTO public.task_categories (id, org_unit_id, name) VALUES ($1, 4, $2)',
      [categoryId, `Routine ${categoryId.slice(0, 6)}`],
    )
    await db.query(
      `INSERT INTO public.task_templates
        (id, org_unit_id, category_id, name, title, priority, owner_id, reviewer_id, recurrence, recurrence_day, start_offset_days, due_offset_days, created_by)
       VALUES ($1, 4, $2, 'Monthly close', 'Reconcile the ledger', 'sedang', $3, $4, 'monthly', 31, 2, 9, $5)`,
      [templateId, categoryId, staffId, accountingManagerId, smAccountingId],
    )
    const { rows: scheduledRows } = await db.query<{ next_run_at: Date }>(
      'SELECT next_run_at FROM public.task_templates WHERE id = $1', [templateId],
    )
    const scheduledAt = new Date(scheduledRows[0].next_run_at)
    const { rows: updatedSchedule } = await db.query<{ next_run_at: Date }>(
      `UPDATE public.task_templates SET title = 'Reconcile the ledger — revised' WHERE id = $1 RETURNING next_run_at`,
      [templateId],
    )
    expect(new Date(updatedSchedule[0].next_run_at).toISOString()).toBe(scheduledAt.toISOString())

    await db.query("SELECT set_config('request.jwt.claim.sub', '', true)")
    await db.query("SELECT set_config('request.jwt.claim.role', 'service_role', true)")
    await db.exec('SET LOCAL ROLE service_role')
    const processAt = new Date(scheduledAt.getTime() + 60_000).toISOString()
    const { rows: runResult } = await db.query<{ created_count: number; skipped_count: number }>(
      'SELECT * FROM public.process_task_template_runs($1::timestamptz)', [processAt],
    )
    expect(runResult).toEqual([{ created_count: 1, skipped_count: 0 }])

    await db.query(
      `UPDATE public.task_templates
       SET title = 'Changed after creation', priority = 'tinggi', start_offset_days = 3, due_offset_days = 10
       WHERE id = $1`,
      [templateId],
    )

    const { rows: createdTasks } = await db.query<{
      title: string
      status: string
      category_id: string
      owner_id: string
      reviewer_id: string
      priority: string
      start_date: Date
      due_date: Date
    }>(
      'SELECT title, status, category_id, owner_id, reviewer_id, priority, start_date, due_date FROM public.tasks WHERE category_id = $1', [categoryId],
    )
    expect(createdTasks).toEqual([{
      title: 'Reconcile the ledger — revised', status: 'To do', category_id: categoryId, owner_id: staffId,
      reviewer_id: accountingManagerId, priority: 'sedang',
      start_date: new Date(scheduledAt.getTime() + 2 * 24 * 60 * 60 * 1000),
      due_date: new Date(scheduledAt.getTime() + 9 * 24 * 60 * 60 * 1000),
    }])
    const { rows: repeatResult } = await db.query<{ created_count: number; skipped_count: number }>(
      'SELECT * FROM public.process_task_template_runs($1::timestamptz)', [processAt],
    )
    expect(repeatResult).toEqual([{ created_count: 0, skipped_count: 0 }])
    const { rows: runRows } = await db.query<{ outcome: string; task_id: string | null }>(
      'SELECT outcome, task_id FROM public.task_template_runs WHERE template_id = $1', [templateId],
    )
    expect(runRows).toEqual([{ outcome: 'created', task_id: expect.any(String) }])
    await db.exec('ROLLBACK')
  })
})
