-- Expand category and recurring-template access while preserving section scope.

DROP POLICY IF EXISTS task_categories_read_scoped ON public.task_categories;
DROP POLICY IF EXISTS task_categories_manage_scoped ON public.task_categories;

CREATE POLICY task_categories_read_scoped ON public.task_categories
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid()) AND u.status = 'aktif'
    )
    AND public.get_my_role_level() >= 2
    AND (
      public.get_my_role_level() >= 5
      OR (public.get_my_role_level() = 4 AND public.can_manage_org_unit(org_unit_id))
      OR (public.get_my_role_level() IN (2, 3) AND org_unit_id = public.get_my_org_unit_id())
    )
  );

CREATE POLICY task_categories_manage_scoped ON public.task_categories
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid()) AND u.status = 'aktif'
    )
    AND public.get_my_role_level() >= 3
    AND (
      public.get_my_role_level() >= 5
      OR (public.get_my_role_level() = 4 AND public.can_manage_org_unit(org_unit_id))
      OR (public.get_my_role_level() = 3 AND org_unit_id = public.get_my_org_unit_id())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid()) AND u.status = 'aktif'
    )
    AND public.get_my_role_level() >= 3
    AND (
      public.get_my_role_level() >= 5
      OR (public.get_my_role_level() = 4 AND public.can_manage_org_unit(org_unit_id))
      OR (public.get_my_role_level() = 3 AND org_unit_id = public.get_my_org_unit_id())
    )
  );

DROP POLICY IF EXISTS task_templates_read_scoped ON public.task_templates;
DROP POLICY IF EXISTS task_templates_manage_scoped ON public.task_templates;

CREATE POLICY task_templates_read_scoped ON public.task_templates
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid()) AND u.status = 'aktif'
    )
    AND public.get_my_role_level() >= 2
    AND (
      public.get_my_role_level() >= 5
      OR (public.get_my_role_level() = 4 AND public.can_manage_org_unit(org_unit_id))
      OR (public.get_my_role_level() = 3 AND org_unit_id = public.get_my_org_unit_id())
      OR (
        public.get_my_role_level() = 2
        AND org_unit_id = public.get_my_org_unit_id()
        AND owner_id = (SELECT auth.uid())
        AND created_by = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY task_templates_manage_scoped ON public.task_templates
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid()) AND u.status = 'aktif'
    )
    AND public.get_my_role_level() >= 2
    AND (
      public.get_my_role_level() >= 5
      OR (public.get_my_role_level() = 4 AND public.can_manage_org_unit(org_unit_id))
      OR (public.get_my_role_level() = 3 AND org_unit_id = public.get_my_org_unit_id())
      OR (
        public.get_my_role_level() = 2
        AND org_unit_id = public.get_my_org_unit_id()
        AND owner_id = (SELECT auth.uid())
        AND created_by = (SELECT auth.uid())
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = (SELECT auth.uid()) AND u.status = 'aktif'
    )
    AND public.get_my_role_level() >= 2
    AND (
      public.get_my_role_level() >= 5
      OR (public.get_my_role_level() = 4 AND public.can_manage_org_unit(org_unit_id))
      OR (public.get_my_role_level() = 3 AND org_unit_id = public.get_my_org_unit_id())
      OR (
        public.get_my_role_level() = 2
        AND org_unit_id = public.get_my_org_unit_id()
        AND owner_id = (SELECT auth.uid())
        AND created_by = (SELECT auth.uid())
      )
    )
  );

GRANT UPDATE ON public.task_templates TO authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_task_category_scope() FROM PUBLIC, anon, authenticated;
