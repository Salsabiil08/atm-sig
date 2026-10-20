-- T-205 / FR-026 / BR-001: enforce the task state machine for authenticated API writes.
CREATE OR REPLACE FUNCTION public.enforce_task_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  actor_id UUID := auth.uid();
  owner_role_level INT;
  allowed_transition BOOLEAN := false;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Pengguna harus masuk untuk mengubah status task';
  END IF;

  SELECT r.level INTO owner_role_level
  FROM public.users u
  JOIN public.roles r ON r.id = u.role_id
  WHERE u.id = NEW.owner_id;

  IF actor_id = NEW.owner_id THEN
    allowed_transition :=
      (OLD.status = 'To do' AND NEW.status = 'In progress')
      OR (OLD.status = 'In progress' AND NEW.status IN ('Blocked', 'Review'))
      OR (OLD.status = 'Blocked' AND NEW.status = 'In progress')
      OR (OLD.status = 'Revisi' AND NEW.status = 'In progress')
      OR (
        owner_role_level >= 5
        AND OLD.status IN ('In progress', 'Review')
        AND NEW.status = 'Done'
      );
  ELSIF actor_id = NEW.reviewer_id AND OLD.status = 'Review' THEN
    allowed_transition := NEW.status IN ('Done', 'Revisi');
  END IF;

  IF NOT allowed_transition THEN
    RAISE EXCEPTION 'Transisi status task tidak diizinkan: % -> %', OLD.status, NEW.status;
  END IF;

  IF NEW.status = 'Done' THEN
    NEW.completed_at := COALESCE(NEW.completed_at, now());
  ELSE
    NEW.completed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER task_status_transition_guard
  BEFORE UPDATE OF status ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_task_status_transition();
