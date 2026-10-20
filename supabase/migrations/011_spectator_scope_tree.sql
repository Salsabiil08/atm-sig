-- T-108 / S-5: Spectator reads the assigned org unit and its descendants only.
CREATE OR REPLACE FUNCTION can_manage_org_unit(target_org_unit_id INT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    get_my_role_level() >= 5
    OR target_org_unit_id = get_my_org_unit_id()
    OR (
      get_my_role_level() = 1
      AND target_org_unit_id IN (
        WITH RECURSIVE visible_org_units AS (
          SELECT id FROM org_units WHERE id = get_my_org_unit_id()
          UNION ALL
          SELECT child.id
          FROM org_units child
          JOIN visible_org_units parent ON child.parent_id = parent.id
        )
        SELECT id FROM visible_org_units
      )
    )
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
