-- Blueprint R.02: Spectator may view only their own login profile,
-- not tasks, organization master data, or colleagues.
-- Private helper avoids a recursive users RLS policy and is not exposed via Data API.
CREATE SCHEMA IF NOT EXISTS atm_private;
REVOKE ALL ON SCHEMA atm_private FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA atm_private TO authenticated;

CREATE OR REPLACE FUNCTION atm_private.is_active_business_user()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.users u
    JOIN public.roles r ON r.id = u.role_id
    WHERE u.id = auth.uid()
      AND u.status = 'aktif'
      AND r.level >= 2
  );
$function$;
REVOKE ALL ON FUNCTION atm_private.is_active_business_user() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION atm_private.is_active_business_user() TO authenticated;

DROP POLICY IF EXISTS users_read_all ON public.users;
DROP POLICY IF EXISTS users_read_scoped ON public.users;
CREATE POLICY users_read_scoped ON public.users FOR SELECT TO authenticated
USING (
  id = (SELECT auth.uid())
  OR (SELECT atm_private.is_active_business_user())
);

DROP POLICY IF EXISTS tasks_read ON public.tasks;
CREATE POLICY tasks_read ON public.tasks FOR SELECT TO authenticated
USING (
  (SELECT atm_private.is_active_business_user())
  AND public.can_access_task_scope(org_unit_id, owner_id, reviewer_id)
);

DROP POLICY IF EXISTS org_units_read_all ON public.org_units;
DROP POLICY IF EXISTS org_units_read_business ON public.org_units;
CREATE POLICY org_units_read_business ON public.org_units FOR SELECT TO authenticated
USING ((SELECT atm_private.is_active_business_user()));
