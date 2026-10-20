-- FR-100 / CR-0003 / D-032..D-035: enforce category scope in Postgres and
-- treat a missed 08:00 Jakarta cron window as skipped.

DROP POLICY task_categories_read_active ON public.task_categories;
CREATE POLICY task_categories_read_scoped ON public.task_categories
  FOR SELECT USING (
    get_my_role_level() >= 4
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND status = 'aktif')
    AND can_manage_org_unit(org_unit_id)
  );

CREATE OR REPLACE FUNCTION public.validate_task_category_scope()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  org_unit_type public.org_unit_type;
BEGIN
  SELECT type INTO org_unit_type
  FROM public.org_units WHERE id = NEW.org_unit_id;
  IF org_unit_type IS DISTINCT FROM 'section' THEN
    RAISE EXCEPTION 'Kategori task harus berada pada section';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.org_unit_id IS DISTINCT FROM OLD.org_unit_id THEN
    RAISE EXCEPTION 'Cakupan kategori tidak dapat diubah';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER task_categories_scope_guard
  BEFORE INSERT OR UPDATE ON public.task_categories
  FOR EACH ROW EXECUTE FUNCTION public.validate_task_category_scope();

-- Keep the original body as a private worker. The wrapper records a missed
-- run when cron did not claim the 08:00 WIB slot within its five-minute window.
ALTER FUNCTION public.process_task_template_runs(TIMESTAMPTZ)
  RENAME TO process_task_template_runs_worker;
REVOKE ALL ON FUNCTION public.process_task_template_runs_worker(TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_task_template_runs_worker(TIMESTAMPTZ) FROM service_role;

CREATE OR REPLACE FUNCTION public.process_task_template_runs(p_now TIMESTAMPTZ DEFAULT now())
RETURNS TABLE(created_count INT, skipped_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  template_row RECORD;
  missed_count INT := 0;
  worker_created INT := 0;
  worker_skipped INT := 0;
BEGIN
  IF p_now IS NULL THEN RAISE EXCEPTION 'Waktu scheduler tidak valid'; END IF;

  FOR template_row IN
    SELECT t.id, t.next_run_at, t.recurrence, t.recurrence_day
    FROM public.task_templates t
    WHERE t.is_active
      AND t.next_run_at <= p_now
      AND t.next_run_at + interval '5 minutes' <= p_now
      AND (t.next_run_at AT TIME ZONE 'Asia/Jakarta')::date
        = (p_now AT TIME ZONE 'Asia/Jakarta')::date
    ORDER BY t.next_run_at, t.id
    FOR UPDATE SKIP LOCKED
  LOOP
    INSERT INTO public.task_template_runs(template_id, scheduled_for, outcome)
    VALUES (template_row.id, template_row.next_run_at, 'skipped')
    ON CONFLICT (template_id, scheduled_for) DO NOTHING;

    UPDATE public.task_templates
    SET next_run_at = public.next_task_template_run(
      template_row.recurrence, template_row.recurrence_day, p_now
    )
    WHERE id = template_row.id;
    missed_count := missed_count + 1;
  END LOOP;

  SELECT worker.created_count, worker.skipped_count INTO worker_created, worker_skipped
  FROM public.process_task_template_runs_worker(p_now) AS worker;

  RETURN QUERY SELECT worker_created, worker_skipped + missed_count;
END;
$$;

REVOKE ALL ON FUNCTION public.process_task_template_runs(TIMESTAMPTZ) FROM PUBLIC;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.process_task_template_runs(TIMESTAMPTZ) TO service_role;
  END IF;
END $$;
