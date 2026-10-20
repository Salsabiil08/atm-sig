-- T-402 / FR-051 / FR-052 / FR-058: atomically create due reminders once per deadline.
CREATE OR REPLACE FUNCTION public.process_task_reminder_checkpoints(p_now TIMESTAMPTZ DEFAULT now())
RETURNS TABLE (
  reminder_id UUID,
  task_id UUID,
  owner_id UUID,
  checkpoint_pct INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  task_row RECORD;
  elapsed_pct NUMERIC;
  work_completed_pct NUMERIC;
  checkpoint_value INT;
  inserted_reminder_id UUID;
  reminder_title TEXT;
  reminder_body TEXT;
BEGIN
  IF p_now IS NULL THEN
    RAISE EXCEPTION 'Waktu scheduler tidak valid';
  END IF;

  FOR task_row IN
    SELECT t.id, t.title, t.owner_id, t.status, t.progress_pct,
      t.start_date, t.due_date,
      EXTRACT(EPOCH FROM (t.due_date - t.start_date)) AS duration_seconds
    FROM public.tasks t
    WHERE t.status <> 'Done'
      AND t.start_date <= p_now
      AND p_now < t.due_date
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = t.owner_id AND u.status = 'aktif'
      )
    ORDER BY t.due_date, t.id
  LOOP
    elapsed_pct :=
      EXTRACT(EPOCH FROM (p_now - task_row.start_date))
      / NULLIF(task_row.duration_seconds, 0) * 100;

    IF task_row.duration_seconds < 86400 THEN
      SELECT ROUND(
        SUM(w.weight) FILTER (WHERE w.is_done)
        / NULLIF(SUM(w.weight), 0)
        * 100
      )
      INTO work_completed_pct
      FROM public.wbs_items w
      WHERE w.task_id = task_row.id
        AND NOT EXISTS (
          SELECT 1
          FROM public.wbs_items child
          WHERE child.parent_id = w.id
        );

      IF work_completed_pct IS NULL THEN
        CONTINUE;
      END IF;
    ELSE
      work_completed_pct := task_row.progress_pct;
    END IF;

    FOREACH checkpoint_value IN ARRAY ARRAY[50, 80, 90]
    LOOP
      IF elapsed_pct < checkpoint_value THEN
        CONTINUE;
      END IF;
      IF checkpoint_value = 50 AND work_completed_pct >= 50 THEN
        CONTINUE;
      END IF;
      IF task_row.duration_seconds < 86400
        AND work_completed_pct >= checkpoint_value
      THEN
        CONTINUE;
      END IF;

      reminder_title := 'Reminder ' || checkpoint_value || '% untuk task';
      reminder_body := 'Task "' || task_row.title || '" telah melewati checkpoint '
        || checkpoint_value || '%. Silakan perbarui progres atau tanggapi reminder.';

      INSERT INTO public.task_reminders (
        task_id, checkpoint_pct, due_date_version, sent_at
      )
      VALUES (
        task_row.id, checkpoint_value, task_row.due_date, p_now
      )
      ON CONFLICT DO NOTHING
      RETURNING id INTO inserted_reminder_id;

      IF inserted_reminder_id IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, task_id, type, title, body, sent_at)
        VALUES (
          task_row.owner_id,
          task_row.id,
          'reminder_' || checkpoint_value,
          reminder_title,
          reminder_body,
          p_now
        );
        reminder_id := inserted_reminder_id;
        task_id := task_row.id;
        owner_id := task_row.owner_id;
        checkpoint_pct := checkpoint_value;
        RETURN NEXT;
      END IF;
      inserted_reminder_id := NULL;
    END LOOP;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.process_task_reminder_checkpoints(TIMESTAMPTZ) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.process_task_reminder_checkpoints(TIMESTAMPTZ) TO service_role;
  END IF;
END;
$$;
