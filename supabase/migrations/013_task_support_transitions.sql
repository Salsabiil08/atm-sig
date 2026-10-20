-- T-202 / FR-022 / BR-002: support recipients can fulfill requests once.
ALTER TABLE task_supports
  ADD CONSTRAINT task_supports_description_not_blank
  CHECK (length(btrim(description)) > 0);

DROP POLICY IF EXISTS task_supports_insert ON task_supports;
CREATE POLICY task_supports_insert ON task_supports
  FOR INSERT WITH CHECK (
    get_my_role_level() >= 2
    AND needed_from_id <> auth.uid()
    AND EXISTS (
      SELECT 1
      FROM users recipient
      WHERE recipient.id = task_supports.needed_from_id
        AND recipient.status = 'aktif'
    )
    AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = task_supports.task_id
        AND t.owner_id = auth.uid()
        AND can_access_task_scope(t.org_unit_id, t.owner_id, t.reviewer_id)
    )
  );

DROP POLICY IF EXISTS task_supports_update ON task_supports;
CREATE POLICY task_supports_update ON task_supports
  FOR UPDATE
  USING (
    get_my_role_level() >= 2
    AND needed_from_id = auth.uid()
    AND status = 'diminta'
  )
  WITH CHECK (
    get_my_role_level() >= 2
    AND needed_from_id = auth.uid()
    AND status = 'diberikan'
  );

CREATE OR REPLACE FUNCTION enforce_task_support_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND (
    NEW.task_id IS DISTINCT FROM OLD.task_id
    OR NEW.needed_from_id IS DISTINCT FROM OLD.needed_from_id
    OR NEW.description IS DISTINCT FROM OLD.description
    OR OLD.status <> 'diminta'
    OR NEW.status <> 'diberikan'
  ) THEN
    RAISE EXCEPTION 'Permintaan support hanya dapat ditandai diberikan oleh penerimanya';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER task_support_transition_guard
  BEFORE UPDATE ON task_supports
  FOR EACH ROW
  EXECUTE FUNCTION enforce_task_support_transition();
