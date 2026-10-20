CREATE OR REPLACE FUNCTION public.validate_task_reminder_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF OLD.response IS NOT NULL OR OLD.responded_at IS NOT NULL THEN
    RAISE EXCEPTION 'Reminder ini sudah ditanggapi';
  END IF;

  IF NEW.response IS NULL OR NEW.response NOT IN (
    'Masih on progress',
    'Butuh support',
    'Ajukan perubahan deadline'
  ) THEN
    RAISE EXCEPTION 'Pilihan tanggapan reminder tidak valid';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
    OR NEW.task_id IS DISTINCT FROM OLD.task_id
    OR NEW.checkpoint_pct IS DISTINCT FROM OLD.checkpoint_pct
    OR NEW.sent_at IS DISTINCT FROM OLD.sent_at
    OR NEW.due_date_version IS DISTINCT FROM OLD.due_date_version
  THEN
    RAISE EXCEPTION 'Data reminder tidak dapat diubah';
  END IF;

  NEW.responded_at := statement_timestamp();
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_task_reminder_response() FROM PUBLIC;

DROP TRIGGER IF EXISTS task_reminder_response_guard ON public.task_reminders;
CREATE TRIGGER task_reminder_response_guard
  BEFORE UPDATE OF response, responded_at, id, task_id, checkpoint_pct, sent_at, due_date_version
  ON public.task_reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_task_reminder_response();

DROP POLICY IF EXISTS task_reminders_update ON public.task_reminders;
CREATE POLICY task_reminders_update ON public.task_reminders
  FOR UPDATE
  USING (
    response IS NULL
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_reminders.task_id
        AND t.owner_id = auth.uid()
        AND get_my_role_level() >= 2
    )
  )
  WITH CHECK (
    response IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_reminders.task_id
        AND t.owner_id = auth.uid()
        AND get_my_role_level() >= 2
    )
  );
