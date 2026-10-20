-- T-305 / FR-064 / BR-041: enforce and audit direct deadline edits atomically.
CREATE OR REPLACE FUNCTION public.audit_direct_deadline_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  actor_id UUID := auth.uid();
  actor_role_level INT;
  actor_status public.user_status;
BEGIN
  IF OLD.due_date IS NOT DISTINCT FROM NEW.due_date THEN
    RETURN NEW;
  END IF;

  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Perubahan deadline langsung harus dilakukan oleh user yang login';
  END IF;

  SELECT r.level, u.status
  INTO actor_role_level, actor_status
  FROM public.users u
  JOIN public.roles r ON r.id = u.role_id
  WHERE u.id = actor_id;

  IF actor_status IS DISTINCT FROM 'aktif' OR actor_role_level IS NULL OR actor_role_level < 3 THEN
    RAISE EXCEPTION 'Hanya Manager, SM, GM, atau Super Admin aktif yang dapat mengubah deadline langsung';
  END IF;
  IF NOT public.can_manage_org_unit(OLD.org_unit_id)
    OR NOT public.can_manage_org_unit(NEW.org_unit_id)
  THEN
    RAISE EXCEPTION 'Task berada di luar cakupan organisasi Anda';
  END IF;
  IF NEW.due_date <= now() OR NEW.due_date <= NEW.start_date THEN
    RAISE EXCEPTION 'Deadline baru harus berada di masa depan dan setelah tanggal mulai';
  END IF;

  INSERT INTO public.audit_logs (user_id, action, object, old_value, new_value)
  VALUES (
    actor_id,
    'update_deadline_direct',
    'tasks:' || NEW.id,
    OLD.due_date::TEXT,
    NEW.due_date::TEXT
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_direct_deadline_update() FROM PUBLIC;

CREATE TRIGGER tasks_direct_deadline_audit
  BEFORE UPDATE OF due_date ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_direct_deadline_update();
