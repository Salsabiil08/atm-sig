CREATE OR REPLACE FUNCTION public.notify_task_supervisors(
  p_task_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_body TEXT,
  p_include_direct_reviewer BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, task_id, type, title, body)
  SELECT DISTINCT recipients.user_id, task_row.id, p_type, p_title, p_body
  FROM public.tasks task_row
  JOIN public.org_units task_unit ON task_unit.id = task_row.org_unit_id
  CROSS JOIN LATERAL (
    SELECT task_row.reviewer_id AS user_id
    WHERE p_include_direct_reviewer
    UNION
    SELECT sm.id
    FROM public.users sm
    JOIN public.roles role ON role.id = sm.role_id AND role.level = 4
    WHERE sm.org_unit_id = CASE
      WHEN task_unit.type = 'section' THEN task_unit.parent_id
      ELSE task_unit.id
    END
    UNION
    SELECT user_row.id
    FROM public.users user_row
    JOIN public.roles role ON role.id = user_row.role_id
    WHERE role.level IN (5, 6)
  ) recipients
  JOIN public.users recipient ON recipient.id = recipients.user_id
  WHERE task_row.id = p_task_id
    AND recipient.status = 'aktif'
    AND recipient.id <> task_row.owner_id;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_task_supervisors(UUID, TEXT, TEXT, TEXT, BOOLEAN) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.notify_supervisors_on_reminder_response()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  task_title TEXT;
BEGIN
  IF NEW.response IS NULL OR NEW.response IS NOT DISTINCT FROM OLD.response THEN
    RETURN NEW;
  END IF;

  SELECT t.title INTO task_title
  FROM public.tasks t
  WHERE t.id = NEW.task_id;

  PERFORM public.notify_task_supervisors(
    NEW.task_id,
    'reminder_response',
    'Tanggapan PIC atas reminder',
    'PIC menanggapi reminder "' || task_title || '": ' || NEW.response,
    true
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_supervisors_on_reminder_response() FROM PUBLIC;
DROP TRIGGER IF EXISTS reminder_response_notify_supervisors ON public.task_reminders;
CREATE TRIGGER reminder_response_notify_supervisors
  AFTER UPDATE OF response ON public.task_reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_supervisors_on_reminder_response();

CREATE OR REPLACE FUNCTION public.notify_supervisors_on_progress_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.progress_pct IS DISTINCT FROM OLD.progress_pct THEN
    PERFORM public.notify_task_supervisors(
      NEW.id,
      'task_progress_updated',
      'PIC memperbarui progres task',
      'Progres task "' || NEW.title || '" diperbarui menjadi ' || NEW.progress_pct || '%.',
      true
    );
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_supervisors_on_progress_change() FROM PUBLIC;
DROP TRIGGER IF EXISTS task_progress_notify_supervisors ON public.tasks;
CREATE TRIGGER task_progress_notify_supervisors
  AFTER UPDATE OF progress_pct ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_supervisors_on_progress_change();

CREATE OR REPLACE FUNCTION public.notify_supervisors_on_deadline_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  task_title TEXT;
BEGIN
  SELECT t.title INTO task_title FROM public.tasks t WHERE t.id = NEW.task_id;
  PERFORM public.notify_task_supervisors(
    NEW.task_id,
    'deadline_change_requested',
    'Pengajuan perubahan tenggat',
    'PIC mengajukan perubahan tenggat untuk task "' || task_title || '": '
      || NEW.reason,
    false
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_supervisors_on_deadline_request() FROM PUBLIC;
DROP TRIGGER IF EXISTS deadline_request_notify_supervisors ON public.deadline_change_requests;
CREATE TRIGGER deadline_request_notify_supervisors
  AFTER INSERT ON public.deadline_change_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_supervisors_on_deadline_request();

CREATE OR REPLACE FUNCTION public.notify_pic_on_deadline_decision()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  task_title TEXT;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status OR NEW.status = 'Menunggu approval' THEN
    RETURN NEW;
  END IF;

  SELECT t.title INTO task_title FROM public.tasks t WHERE t.id = NEW.task_id;
  INSERT INTO public.notifications (user_id, task_id, type, title, body)
  VALUES (
    NEW.requested_by,
    NEW.task_id,
    'deadline_change_decision',
    'Keputusan pengajuan tenggat',
    'Pengajuan perubahan tenggat untuk task "' || task_title || '" '
      || CASE WHEN NEW.status = 'Disetujui' THEN 'disetujui.' ELSE 'ditolak.' END
  );
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_pic_on_deadline_decision() FROM PUBLIC;
DROP TRIGGER IF EXISTS deadline_decision_notify_pic ON public.deadline_change_requests;
CREATE TRIGGER deadline_decision_notify_pic
  AFTER UPDATE OF status ON public.deadline_change_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_pic_on_deadline_decision();
