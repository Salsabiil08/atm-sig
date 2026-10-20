CREATE OR REPLACE FUNCTION public.enforce_reminder_notification_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  task_owner_id UUID;
BEGIN
  IF NEW.type NOT IN ('reminder_50', 'reminder_80', 'reminder_90') THEN
    RETURN NEW;
  END IF;

  IF NEW.task_id IS NULL THEN
    RAISE EXCEPTION 'Reminder harus terhubung ke task';
  END IF;

  SELECT t.owner_id
  INTO task_owner_id
  FROM public.tasks t
  WHERE t.id = NEW.task_id;

  IF task_owner_id IS NULL OR NEW.user_id IS DISTINCT FROM task_owner_id THEN
    RAISE EXCEPTION 'Reminder hanya dapat dikirim kepada PIC task';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_reminder_notification_owner() FROM PUBLIC;

DROP TRIGGER IF EXISTS reminder_notification_owner_guard ON public.notifications;
CREATE TRIGGER reminder_notification_owner_guard
  BEFORE INSERT OR UPDATE OF user_id, task_id, type
  ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_reminder_notification_owner();
