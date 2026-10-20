-- FR-111 / BR-081: PIC timeline date changes must use the approved request flow.
CREATE OR REPLACE FUNCTION public.guard_task_start_date_update()
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
  IF NEW.start_date IS NOT DISTINCT FROM OLD.start_date THEN
    RETURN NEW;
  END IF;

  IF actor_id IS NULL AND auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Perubahan timeline harus dilakukan melalui alur aplikasi';
  END IF;

  SELECT r.level, u.status INTO actor_role_level, actor_status
  FROM public.users u JOIN public.roles r ON r.id = u.role_id
  WHERE u.id = actor_id;
  IF actor_status IS DISTINCT FROM 'aktif' OR actor_role_level IS NULL THEN
    RAISE EXCEPTION 'Pengguna aktif diperlukan untuk mengubah timeline task';
  END IF;
  IF actor_role_level < 3 THEN
    RAISE EXCEPTION 'PIC harus mengajukan perubahan timeline melalui alur pengajuan';
  END IF;
  IF NOT public.can_manage_org_unit(OLD.org_unit_id)
    OR NOT public.can_manage_org_unit(NEW.org_unit_id)
  THEN
    RAISE EXCEPTION 'Task berada di luar cakupan organisasi Anda';
  END IF;
  IF NEW.start_date >= NEW.due_date THEN
    RAISE EXCEPTION 'Tanggal mulai harus sebelum tenggat';
  END IF;

  INSERT INTO public.audit_logs (user_id, action, object, old_value, new_value)
  VALUES (
    actor_id,
    'update_start_date_direct',
    'tasks:' || NEW.id,
    OLD.start_date::TEXT,
    NEW.start_date::TEXT
  );

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_task_start_date_update() FROM PUBLIC;

CREATE TRIGGER tasks_start_date_scope_guard
  BEFORE UPDATE OF start_date ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.guard_task_start_date_update();
