-- T-201 / FR-021: task deletion is limited to Managers and above in their scope.
DROP POLICY IF EXISTS tasks_delete ON tasks;
CREATE POLICY tasks_delete ON tasks
  FOR DELETE USING (
    get_my_role_level() >= 3
    AND can_manage_org_unit(org_unit_id)
  );
