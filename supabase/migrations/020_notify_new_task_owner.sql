-- T-210 / FR-020: task creation must always notify its initial PIC.
CREATE OR REPLACE FUNCTION public.notify_task_owner_on_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, task_id, type, title, body)
  VALUES (
    NEW.owner_id,
    NEW.id,
    'task_assigned',
    'Task baru ditugaskan kepada Anda',
    'Anda ditetapkan sebagai PIC task "' || NEW.title || '".'
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_task_owner_on_create() FROM PUBLIC;

CREATE TRIGGER tasks_notify_initial_owner
AFTER INSERT ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.notify_task_owner_on_create();
