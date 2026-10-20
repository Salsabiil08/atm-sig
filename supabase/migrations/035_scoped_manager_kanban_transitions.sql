-- FR-110 / BR-080: scoped task managers may perform ordinary state-machine
-- transitions from Kanban. Review decisions remain reviewer-only.
CREATE OR REPLACE FUNCTION public.enforce_task_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  actor_id UUID := auth.uid();
  actor_role_level INT;
  actor_status TEXT;
  owner_role_level INT;
  allowed_transition BOOLEAN := false;
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Pengguna harus masuk untuk mengubah status task';
  END IF;

  SELECT r.level, u.status INTO actor_role_level, actor_status
  FROM public.users u JOIN public.roles r ON r.id = u.role_id
  WHERE u.id = actor_id;
  IF actor_status IS DISTINCT FROM 'aktif' THEN
    RAISE EXCEPTION 'Pengguna aktif diperlukan untuk mengubah status task';
  END IF;

  SELECT r.level INTO owner_role_level
  FROM public.users u JOIN public.roles r ON r.id = u.role_id
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
      )
      OR (
        owner_role_level >= 5
        AND OLD.status = 'Review'
        AND NEW.status = 'Revisi'
        AND OLD.reviewer_id IS NULL
      );
  ELSIF actor_id = NEW.reviewer_id AND OLD.status = 'Review' THEN
    allowed_transition := NEW.status IN ('Done', 'Revisi');
  ELSIF actor_role_level >= 3 AND public.can_manage_org_unit(OLD.org_unit_id) THEN
    allowed_transition :=
      (OLD.status = 'To do' AND NEW.status = 'In progress')
      OR (OLD.status = 'In progress' AND NEW.status IN ('Blocked', 'Review'))
      OR (OLD.status = 'Blocked' AND NEW.status = 'In progress')
      OR (OLD.status = 'Revisi' AND NEW.status = 'In progress');
  END IF;

  IF NOT allowed_transition THEN
    RAISE EXCEPTION 'Transisi status task tidak diizinkan: % -> %', OLD.status, NEW.status;
  END IF;

  IF OLD.status = 'In progress' AND NEW.status = 'Blocked'
    AND NOT EXISTS (
      SELECT 1 FROM public.task_supports s
      WHERE s.task_id = NEW.id AND s.status = 'diminta'
    )
  THEN
    RAISE EXCEPTION 'Task Blocked wajib memiliki permintaan support yang belum diberikan';
  END IF;

  IF OLD.status = 'Blocked' AND NEW.status = 'In progress'
    AND (
      EXISTS (SELECT 1 FROM public.task_supports s WHERE s.task_id = NEW.id AND s.status = 'diminta')
      OR NOT EXISTS (SELECT 1 FROM public.task_supports s WHERE s.task_id = NEW.id AND s.status = 'diberikan')
    )
  THEN
    RAISE EXCEPTION 'Support task harus diberikan sebelum kembali ke In progress';
  END IF;

  IF NEW.status IN ('Review', 'Done') AND owner_role_level < 5
    AND EXISTS (
      SELECT 1 FROM public.evidence_requirements er
      WHERE er.task_id = NEW.id AND er.mandatory
        AND NOT EXISTS (SELECT 1 FROM public.task_evidence e WHERE e.requirement_id = er.id)
    )
  THEN
    RAISE EXCEPTION 'Semua evidence wajib harus diunggah sebelum Review atau Done';
  END IF;

  IF NEW.status = 'Done' THEN
    NEW.completed_at := COALESCE(NEW.completed_at, now());
  ELSE
    NEW.completed_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;
