-- T-106 / NFR-001 / NFR-002 / PR-1 / PR-2: centralize hierarchical task scope.
CREATE OR REPLACE FUNCTION can_manage_org_unit(target_org_unit_id INT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    get_my_role_level() >= 5
    OR target_org_unit_id = get_my_org_unit_id()
    OR (
      get_my_role_level() = 4
      AND EXISTS (
        SELECT 1 FROM org_units
        WHERE id = target_org_unit_id
          AND parent_id = get_my_org_unit_id()
      )
    )
  );
$$;

CREATE OR REPLACE FUNCTION can_access_task_scope(
  target_org_unit_id INT,
  target_owner_id UUID,
  target_reviewer_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    get_my_role_level() >= 5
    OR can_manage_org_unit(target_org_unit_id)
    OR target_owner_id = auth.uid()
    OR target_reviewer_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "tasks_read" ON tasks;
CREATE POLICY tasks_read ON tasks
  FOR SELECT USING (
    can_access_task_scope(org_unit_id, owner_id, reviewer_id)
  );

DROP POLICY IF EXISTS "tasks_insert" ON tasks;
CREATE POLICY tasks_insert ON tasks
  FOR INSERT WITH CHECK (
    get_my_role_level() >= 3
    AND can_manage_org_unit(org_unit_id)
  );

DROP POLICY IF EXISTS "tasks_update" ON tasks;
CREATE POLICY tasks_update ON tasks
  FOR UPDATE
  USING (
    get_my_role_level() >= 2
    AND (
      owner_id = auth.uid()
      OR reviewer_id = auth.uid()
      OR (get_my_role_level() >= 3 AND can_manage_org_unit(org_unit_id))
    )
  )
  WITH CHECK (
    get_my_role_level() >= 2
    AND can_manage_org_unit(org_unit_id)
    AND (
      owner_id = auth.uid()
      OR reviewer_id = auth.uid()
      OR get_my_role_level() >= 3
    )
  );

DROP POLICY IF EXISTS "task_comments_insert" ON task_comments;
CREATE POLICY task_comments_insert ON task_comments
  FOR INSERT WITH CHECK (
    get_my_role_level() >= 2
    AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_comments.task_id
        AND can_access_task_scope(t.org_unit_id, t.owner_id, t.reviewer_id)
    )
  );

DROP POLICY IF EXISTS "task_comments_read" ON task_comments;
CREATE POLICY task_comments_read ON task_comments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_comments.task_id
        AND can_access_task_scope(t.org_unit_id, t.owner_id, t.reviewer_id)
    )
  );

DROP POLICY IF EXISTS "evidence_requirements_read" ON evidence_requirements;
CREATE POLICY evidence_requirements_read ON evidence_requirements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = evidence_requirements.task_id
        AND can_access_task_scope(t.org_unit_id, t.owner_id, t.reviewer_id)
    )
  );

DROP POLICY IF EXISTS "evidence_requirements_write" ON evidence_requirements;
CREATE POLICY evidence_requirements_write ON evidence_requirements
  FOR ALL
  USING (
    get_my_role_level() >= 3
    AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = evidence_requirements.task_id
        AND can_manage_org_unit(t.org_unit_id)
    )
  )
  WITH CHECK (
    get_my_role_level() >= 3
    AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = evidence_requirements.task_id
        AND can_manage_org_unit(t.org_unit_id)
    )
  );

DROP POLICY IF EXISTS "task_evidence_read" ON task_evidence;
CREATE POLICY task_evidence_read ON task_evidence
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM evidence_requirements er
      JOIN tasks t ON t.id = er.task_id
      WHERE er.id = task_evidence.requirement_id
        AND can_access_task_scope(t.org_unit_id, t.owner_id, t.reviewer_id)
    )
  );

DROP POLICY IF EXISTS "task_evidence_insert" ON task_evidence;
CREATE POLICY task_evidence_insert ON task_evidence
  FOR INSERT WITH CHECK (
    get_my_role_level() >= 2
    AND uploader_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM evidence_requirements er
      JOIN tasks t ON t.id = er.task_id
      WHERE er.id = task_evidence.requirement_id
        AND can_access_task_scope(t.org_unit_id, t.owner_id, t.reviewer_id)
        AND (
          t.owner_id = auth.uid()
          OR t.reviewer_id = auth.uid()
          OR (get_my_role_level() >= 3 AND can_manage_org_unit(t.org_unit_id))
        )
    )
  );

DROP POLICY IF EXISTS "deadline_change_requests_read" ON deadline_change_requests;
CREATE POLICY deadline_change_requests_read ON deadline_change_requests
  FOR SELECT USING (
    requested_by = auth.uid()
    OR approver_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = deadline_change_requests.task_id
        AND can_access_task_scope(t.org_unit_id, t.owner_id, t.reviewer_id)
    )
  );

DROP POLICY IF EXISTS "deadline_change_requests_insert" ON deadline_change_requests;
CREATE POLICY deadline_change_requests_insert ON deadline_change_requests
  FOR INSERT WITH CHECK (
    get_my_role_level() >= 2
    AND requested_by = auth.uid()
    AND status = 'Menunggu approval'
    AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = deadline_change_requests.task_id
        AND t.owner_id = auth.uid()
        AND can_access_task_scope(t.org_unit_id, t.owner_id, t.reviewer_id)
    )
  );

DROP POLICY IF EXISTS "deadline_change_requests_update" ON deadline_change_requests;
CREATE POLICY deadline_change_requests_update ON deadline_change_requests
  FOR UPDATE
  USING (
    get_my_role_level() >= 4
    AND status = 'Menunggu approval'
    AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = deadline_change_requests.task_id
        AND can_manage_org_unit(t.org_unit_id)
    )
  )
  WITH CHECK (
    get_my_role_level() >= 4
    AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = deadline_change_requests.task_id
        AND can_manage_org_unit(t.org_unit_id)
    )
  );

DROP POLICY IF EXISTS "task_reminders_read" ON task_reminders;
CREATE POLICY task_reminders_read ON task_reminders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_reminders.task_id
        AND can_access_task_scope(t.org_unit_id, t.owner_id, t.reviewer_id)
    )
  );

DROP POLICY IF EXISTS "task_reminders_update" ON task_reminders;
CREATE POLICY task_reminders_update ON task_reminders
  FOR UPDATE
  USING (
    get_my_role_level() >= 2
    AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_reminders.task_id
        AND can_access_task_scope(t.org_unit_id, t.owner_id, t.reviewer_id)
        AND (t.owner_id = auth.uid() OR t.reviewer_id = auth.uid())
    )
  )
  WITH CHECK (
    get_my_role_level() >= 2
    AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_reminders.task_id
        AND can_access_task_scope(t.org_unit_id, t.owner_id, t.reviewer_id)
        AND (t.owner_id = auth.uid() OR t.reviewer_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "task_supports_read" ON task_supports;
CREATE POLICY task_supports_read ON task_supports
  FOR SELECT USING (
    needed_from_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_supports.task_id
        AND can_access_task_scope(t.org_unit_id, t.owner_id, t.reviewer_id)
    )
  );

DROP POLICY IF EXISTS "task_supports_insert" ON task_supports;
CREATE POLICY task_supports_insert ON task_supports
  FOR INSERT WITH CHECK (
    get_my_role_level() >= 2
    AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_supports.task_id
        AND t.owner_id = auth.uid()
        AND can_access_task_scope(t.org_unit_id, t.owner_id, t.reviewer_id)
    )
  );

DROP POLICY IF EXISTS "task_supports_update" ON task_supports;
CREATE POLICY task_supports_update ON task_supports
  FOR UPDATE
  USING (
    get_my_role_level() >= 2
    AND (needed_from_id = auth.uid() OR EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_supports.task_id
        AND t.owner_id = auth.uid()
        AND can_access_task_scope(t.org_unit_id, t.owner_id, t.reviewer_id)
    ))
  )
  WITH CHECK (
    get_my_role_level() >= 2
    AND (needed_from_id = auth.uid() OR EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_supports.task_id
        AND t.owner_id = auth.uid()
        AND can_access_task_scope(t.org_unit_id, t.owner_id, t.reviewer_id)
    ))
  );

DROP POLICY IF EXISTS "task_reassignments_read" ON task_reassignments;
CREATE POLICY task_reassignments_read ON task_reassignments
  FOR SELECT USING (
    from_user_id = auth.uid()
    OR to_user_id = auth.uid()
    OR (get_my_role_level() >= 3 AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_reassignments.task_id
        AND can_access_task_scope(t.org_unit_id, t.owner_id, t.reviewer_id)
    ))
  );

DROP POLICY IF EXISTS "wbs_items_read" ON wbs_items;
CREATE POLICY wbs_items_read ON wbs_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = wbs_items.task_id
        AND can_access_task_scope(t.org_unit_id, t.owner_id, t.reviewer_id)
    )
  );

DROP POLICY IF EXISTS "wbs_items_write" ON wbs_items;
CREATE POLICY wbs_items_write ON wbs_items
  FOR ALL
  USING (
    get_my_role_level() >= 2
    AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = wbs_items.task_id
        AND can_access_task_scope(t.org_unit_id, t.owner_id, t.reviewer_id)
        AND (
          t.owner_id = auth.uid()
          OR (get_my_role_level() >= 3 AND can_manage_org_unit(t.org_unit_id))
        )
    )
  )
  WITH CHECK (
    get_my_role_level() >= 2
    AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = wbs_items.task_id
        AND can_access_task_scope(t.org_unit_id, t.owner_id, t.reviewer_id)
        AND (
          t.owner_id = auth.uid()
          OR (get_my_role_level() >= 3 AND can_manage_org_unit(t.org_unit_id))
        )
    )
  );
