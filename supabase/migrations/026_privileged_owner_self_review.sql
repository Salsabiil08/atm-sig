-- T-307 / BR-022 / D-019: allow GM and Super Admin task owners to self-review.
CREATE OR REPLACE FUNCTION public.enforce_task_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
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
      )
      OR (
        owner_role_level >= 5
        AND OLD.status = 'Review'
        AND NEW.status = 'Revisi'
        AND OLD.reviewer_id IS NULL
      );
  ELSIF actor_id = NEW.reviewer_id AND OLD.status = 'Review' THEN
    allowed_transition := NEW.status IN ('Done', 'Revisi');
  END IF;

  IF NOT allowed_transition THEN
    RAISE EXCEPTION 'Transisi status task tidak diizinkan: % -> %', OLD.status, NEW.status;
  END IF;

  IF OLD.status = 'In progress'
    AND NEW.status = 'Blocked'
    AND NOT EXISTS (
      SELECT 1 FROM public.task_supports s
      WHERE s.task_id = NEW.id AND s.status = 'diminta'
    )
  THEN
    RAISE EXCEPTION 'Task Blocked wajib memiliki permintaan support yang belum diberikan';
  END IF;

  IF OLD.status = 'Blocked'
    AND NEW.status = 'In progress'
    AND EXISTS (
      SELECT 1 FROM public.task_supports s
      WHERE s.task_id = NEW.id AND s.status = 'diminta'
    )
  THEN
    RAISE EXCEPTION 'Support task harus diberikan sebelum kembali ke In progress';
  END IF;

  IF OLD.status = 'Blocked'
    AND NEW.status = 'In progress'
    AND NOT EXISTS (
      SELECT 1 FROM public.task_supports s
      WHERE s.task_id = NEW.id AND s.status = 'diberikan'
    )
  THEN
    RAISE EXCEPTION 'Support task harus diberikan sebelum kembali ke In progress';
  END IF;

  IF NEW.status IN ('Review', 'Done') AND owner_role_level < 5
    AND EXISTS (
      SELECT 1
      FROM public.evidence_requirements er
      WHERE er.task_id = NEW.id
        AND er.mandatory
        AND NOT EXISTS (
          SELECT 1 FROM public.task_evidence e
          WHERE e.requirement_id = er.id
        )
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

CREATE OR REPLACE FUNCTION public.require_reviewer_rejection_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  actor_id UUID := auth.uid();
  owner_role_level INT;
  valid_reviewer BOOLEAN;
BEGIN
  IF NEW.status = 'Revisi' AND OLD.status = 'Review' THEN
    SELECT r.level INTO owner_role_level
    FROM public.users u
    JOIN public.roles r ON r.id = u.role_id
    WHERE u.id = OLD.owner_id;

    valid_reviewer :=
      actor_id = OLD.reviewer_id
      OR (
        OLD.reviewer_id IS NULL
        AND actor_id = OLD.owner_id
        AND owner_role_level >= 5
      );

    IF NOT valid_reviewer
      OR NOT EXISTS (
        SELECT 1
        FROM public.task_comments c
        WHERE c.task_id = OLD.id
          AND c.user_id = actor_id
          AND c.created_at >= transaction_timestamp()
      )
    THEN
      RAISE EXCEPTION 'Penolakan review wajib menyertakan komentar reviewer';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.review_task(
  p_task_id UUID,
  p_decision public.task_status,
  p_comment TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  actor_id UUID := auth.uid();
  task_owner_id UUID;
  task_reviewer_id UUID;
  task_status_value public.task_status;
  owner_role_level INT;
  valid_reviewer BOOLEAN;
BEGIN
  IF actor_id IS NULL OR p_task_id IS NULL OR p_decision NOT IN ('Done', 'Revisi') THEN
    RAISE EXCEPTION 'Data keputusan review tidak valid';
  END IF;

  IF p_comment IS NOT NULL AND length(btrim(p_comment)) > 5000 THEN
    RAISE EXCEPTION 'Komentar maksimal 5000 karakter';
  END IF;
  IF p_decision = 'Revisi' AND (p_comment IS NULL OR length(btrim(p_comment)) = 0) THEN
    RAISE EXCEPTION 'Komentar wajib diisi untuk menolak task';
  END IF;

  SELECT t.owner_id, t.reviewer_id, t.status, r.level
  INTO task_owner_id, task_reviewer_id, task_status_value, owner_role_level
  FROM public.tasks t
  JOIN public.users u ON u.id = t.owner_id
  JOIN public.roles r ON r.id = u.role_id
  WHERE t.id = p_task_id
  FOR UPDATE OF t;

  valid_reviewer :=
    actor_id = task_reviewer_id
    OR (
      task_reviewer_id IS NULL
      AND actor_id = task_owner_id
      AND owner_role_level >= 5
    );
  IF NOT valid_reviewer OR task_status_value <> 'Review' THEN
    RAISE EXCEPTION 'Hanya reviewer atau pemilik GM/Super Admin tanpa reviewer pada task berstatus Review yang dapat memutuskan';
  END IF;

  IF p_comment IS NOT NULL AND length(btrim(p_comment)) > 0 THEN
    INSERT INTO public.task_comments (task_id, user_id, body)
    VALUES (p_task_id, actor_id, btrim(p_comment));
  END IF;

  UPDATE public.tasks
  SET status = p_decision
  WHERE id = p_task_id;

  RETURN p_task_id;
END;
$$;
