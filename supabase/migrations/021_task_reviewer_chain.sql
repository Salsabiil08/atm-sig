-- T-301 / FR-040 / BR-070 / D-015: reviewer must be the active direct supervisor.
CREATE OR REPLACE FUNCTION public.enforce_task_reviewer_chain()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  owner_role_level INT;
  owner_supervisor_id UUID;
  owner_status public.user_status;
  reviewer_role_level INT;
  reviewer_status public.user_status;
BEGIN
  SELECT r.level, u.supervisor_id, u.status
  INTO owner_role_level, owner_supervisor_id, owner_status
  FROM public.users u
  JOIN public.roles r ON r.id = u.role_id
  WHERE u.id = NEW.owner_id;

  IF owner_role_level IS NULL OR owner_status <> 'aktif' OR owner_role_level < 2 THEN
    RAISE EXCEPTION 'PIC task harus merupakan user aktif yang dapat mengerjakan task';
  END IF;

  IF owner_role_level >= 5 THEN
    IF NEW.reviewer_id IS NOT NULL THEN
      RAISE EXCEPTION 'Task milik GM atau Super Admin tidak boleh memiliki reviewer';
    END IF;
    RETURN NEW;
  END IF;

  IF owner_supervisor_id IS NULL OR NEW.reviewer_id IS DISTINCT FROM owner_supervisor_id THEN
    RAISE EXCEPTION 'Reviewer harus atasan langsung PIC';
  END IF;

  SELECT r.level, u.status
  INTO reviewer_role_level, reviewer_status
  FROM public.users u
  JOIN public.roles r ON r.id = u.role_id
  WHERE u.id = NEW.reviewer_id;

  IF reviewer_status IS DISTINCT FROM 'aktif'
    OR reviewer_role_level IS DISTINCT FROM owner_role_level + 1
  THEN
    RAISE EXCEPTION 'Role reviewer tidak sesuai rantai review';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_task_reviewer_chain() FROM PUBLIC;

CREATE TRIGGER tasks_reviewer_chain_guard_insert
  BEFORE INSERT ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_task_reviewer_chain();

CREATE TRIGGER tasks_reviewer_chain_guard_update
  BEFORE UPDATE OF owner_id, reviewer_id ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_task_reviewer_chain();
