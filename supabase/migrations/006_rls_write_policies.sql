-- Migration 006: Tambah notifications.title dan notifications.body
-- OQ-07: Notifikasi in-app memerlukan judul dan isi pesan yang informatif

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS body  TEXT NOT NULL DEFAULT '';

-- Hapus default setelah migrasi (supaya Insert wajib mengisi)
ALTER TABLE notifications
  ALTER COLUMN title DROP DEFAULT,
  ALTER COLUMN body  DROP DEFAULT;

-- Tambah write policies untuk tasks (tidak ada di 002_rls_policies.sql)
-- NFR-001: setiap write wajib dicek di server; RLS sebagai lapisan tambahan

-- INSERT tasks: Manager/SM/GM/Super Admin bisa membuat task di unit sendiri atau bawahnya
CREATE POLICY "tasks_insert" ON tasks
  FOR INSERT WITH CHECK (
    get_my_role_level() >= 3
    AND org_unit_id IN (
      SELECT id FROM org_units
      WHERE id = get_my_org_unit_id()
         OR parent_id = get_my_org_unit_id()
    )
    OR get_my_role_level() >= 5
  );

-- UPDATE tasks: PIC, Reviewer, atau Manager/SM/GM/Super Admin dari unit yang sama
CREATE POLICY "tasks_update" ON tasks
  FOR UPDATE USING (
    (owner_id = auth.uid() AND get_my_role_level() >= 2)
    OR (reviewer_id = auth.uid() AND get_my_role_level() >= 2)
    OR (org_unit_id = get_my_org_unit_id() AND get_my_role_level() >= 3)
    OR get_my_role_level() >= 5
  );

-- INSERT task_comments: semua user yang bisa baca task dapat berkomentar
CREATE POLICY "task_comments_insert" ON task_comments
  FOR INSERT WITH CHECK (
    get_my_role_level() >= 2
    AND EXISTS (
      SELECT 1 FROM tasks t WHERE t.id = task_comments.task_id
        AND (
          get_my_role_level() >= 5
          OR t.org_unit_id = get_my_org_unit_id()
          OR t.owner_id = auth.uid()
          OR t.reviewer_id = auth.uid()
        )
    )
  );

-- SELECT task_comments: sama dengan akses baca task
CREATE POLICY "task_comments_read" ON task_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks t WHERE t.id = task_comments.task_id
        AND (
          get_my_role_level() >= 5
          OR t.org_unit_id = get_my_org_unit_id()
          OR t.owner_id = auth.uid()
          OR t.reviewer_id = auth.uid()
        )
    )
  );

-- SELECT evidence_requirements: sama dengan akses baca task
CREATE POLICY "evidence_requirements_read" ON evidence_requirements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks t WHERE t.id = evidence_requirements.task_id
        AND (
          get_my_role_level() >= 5
          OR t.org_unit_id = get_my_org_unit_id()
          OR t.owner_id = auth.uid()
          OR t.reviewer_id = auth.uid()
        )
    )
  );

-- INSERT/UPDATE evidence_requirements: Manager ke atas
CREATE POLICY "evidence_requirements_write" ON evidence_requirements
  FOR ALL USING (
    get_my_role_level() >= 3
    AND EXISTS (
      SELECT 1 FROM tasks t WHERE t.id = evidence_requirements.task_id
        AND (
          t.org_unit_id = get_my_org_unit_id()
          OR get_my_role_level() >= 5
        )
    )
  );

-- SELECT task_evidence: sama dengan akses baca task
CREATE POLICY "task_evidence_read" ON task_evidence
  FOR SELECT USING (
    EXISTS (
      SELECT 1
        FROM evidence_requirements er
        JOIN tasks t ON t.id = er.task_id
       WHERE er.id = task_evidence.requirement_id
         AND (
           get_my_role_level() >= 5
           OR t.org_unit_id = get_my_org_unit_id()
           OR t.owner_id = auth.uid()
           OR t.reviewer_id = auth.uid()
         )
    )
  );

-- INSERT task_evidence: PIC task atau reviewer
CREATE POLICY "task_evidence_insert" ON task_evidence
  FOR INSERT WITH CHECK (
    get_my_role_level() >= 2
    AND uploader_id = auth.uid()
    AND EXISTS (
      SELECT 1
        FROM evidence_requirements er
        JOIN tasks t ON t.id = er.task_id
       WHERE er.id = task_evidence.requirement_id
         AND (
           t.owner_id = auth.uid()
           OR t.reviewer_id = auth.uid()
           OR get_my_role_level() >= 3
         )
    )
  );

-- SELECT deadline_change_requests
CREATE POLICY "deadline_change_requests_read" ON deadline_change_requests
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      requested_by = auth.uid()
      OR approver_id = auth.uid()
      OR get_my_role_level() >= 4
    )
  );

-- INSERT deadline_change_requests: PIC task (Staff/PIC level 2)
CREATE POLICY "deadline_change_requests_insert" ON deadline_change_requests
  FOR INSERT WITH CHECK (
    get_my_role_level() >= 2
    AND requested_by = auth.uid()
    AND status = 'Menunggu approval'
  );

-- UPDATE deadline_change_requests: approver (SM/GM/Super Admin)
CREATE POLICY "deadline_change_requests_update" ON deadline_change_requests
  FOR UPDATE USING (
    get_my_role_level() >= 4
    AND status = 'Menunggu approval'
  );

-- SELECT task_reminders: PIC, reviewer, manager ke atas
CREATE POLICY "task_reminders_read" ON task_reminders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks t WHERE t.id = task_reminders.task_id
        AND (
          get_my_role_level() >= 5
          OR t.org_unit_id = get_my_org_unit_id()
          OR t.owner_id = auth.uid()
          OR t.reviewer_id = auth.uid()
        )
    )
  );

-- UPDATE task_reminders: PIC (untuk respond) + server
CREATE POLICY "task_reminders_update" ON task_reminders
  FOR UPDATE USING (
    get_my_role_level() >= 2
    AND EXISTS (
      SELECT 1 FROM tasks t WHERE t.id = task_reminders.task_id
        AND (t.owner_id = auth.uid() OR t.reviewer_id = auth.uid())
    )
  );

-- SELECT task_supports: terkait pihak
CREATE POLICY "task_supports_read" ON task_supports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks t WHERE t.id = task_supports.task_id
        AND (
          get_my_role_level() >= 5
          OR t.org_unit_id = get_my_org_unit_id()
          OR t.owner_id = auth.uid()
          OR needed_from_id = auth.uid()
        )
    )
  );

-- INSERT task_supports: PIC task
CREATE POLICY "task_supports_insert" ON task_supports
  FOR INSERT WITH CHECK (
    get_my_role_level() >= 2
    AND EXISTS (
      SELECT 1 FROM tasks t WHERE t.id = task_supports.task_id
        AND t.owner_id = auth.uid()
    )
  );

-- UPDATE task_supports: pihak yang dimintai bantuan atau PIC
CREATE POLICY "task_supports_update" ON task_supports
  FOR UPDATE USING (
    get_my_role_level() >= 2
    AND (
      needed_from_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM tasks t WHERE t.id = task_supports.task_id
          AND t.owner_id = auth.uid()
      )
    )
  );

-- SELECT task_reassignments
CREATE POLICY "task_reassignments_read" ON task_reassignments
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      from_user_id = auth.uid()
      OR to_user_id = auth.uid()
      OR get_my_role_level() >= 3
    )
  );

-- INSERT notifications: server saja yang insert (via service_role)
-- Tidak ada policy INSERT agar hanya server yang bisa membuat notifikasi
-- Baca notifikasi sendiri sudah ada di migration 002

-- INSERT audit_logs: server saja (via service_role)
-- Policy SELECT sudah ada di migration 002

-- Super Admin can manage users
CREATE POLICY "users_insert_superadmin" ON users
  FOR INSERT WITH CHECK (get_my_role_level() = 6);

CREATE POLICY "users_update_superadmin" ON users
  FOR UPDATE USING (get_my_role_level() = 6 OR id = auth.uid());
