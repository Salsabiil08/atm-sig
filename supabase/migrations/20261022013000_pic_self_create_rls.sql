-- R.02 D-01: Staff/PIC may create ONLY their own task in their section.
-- Preserve existing Manager+ rules exactly; never permit cross-user PIC assignment.
-- Apply only after negative tests on staging / reviewed migration.
DROP POLICY IF EXISTS tasks_insert ON public.tasks;
CREATE POLICY tasks_insert ON public.tasks
FOR INSERT TO authenticated
WITH CHECK (
  (
    public.get_my_role_level() >= 3
    AND public.can_manage_org_unit(org_unit_id)
  )
  OR (
    public.get_my_role_level() = 2
    AND (SELECT auth.uid()) IS NOT NULL
    AND owner_id = (SELECT auth.uid())
    AND assigner_id = (SELECT auth.uid())
    AND parent_task_id IS NULL
    AND status = 'To do'::public.task_status
    AND progress_pct = 0
    AND completed_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.users me
      WHERE me.id = (SELECT auth.uid())
        AND me.status = 'aktif'
        AND me.org_unit_id = tasks.org_unit_id
        AND me.supervisor_id IS NOT NULL
        AND me.supervisor_id = tasks.reviewer_id
    )
  )
);

-- Allow a PIC to define evidence requirements ONLY for their own task,
-- without giving PICs permission to modify evidence requirements on other tasks.
DROP POLICY IF EXISTS evidence_requirements_pic_insert ON public.evidence_requirements;
CREATE POLICY evidence_requirements_pic_insert
ON public.evidence_requirements FOR INSERT TO authenticated
WITH CHECK (
  public.get_my_role_level() = 2
  AND EXISTS (
    SELECT 1 FROM public.tasks t
    WHERE t.id = evidence_requirements.task_id
      AND t.owner_id = (SELECT auth.uid())
      AND t.assigner_id = (SELECT auth.uid())
      AND t.status = 'To do'::public.task_status
      AND t.org_unit_id = public.get_my_org_unit_id()
  )
);
