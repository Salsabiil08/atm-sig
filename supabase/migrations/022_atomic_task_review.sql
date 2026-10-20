-- T-302 / FR-041 / BR-021: rejection and its mandatory reviewer comment are atomic.
CREATE OR REPLACE FUNCTION public.require_reviewer_rejection_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.status = 'Revisi' AND OLD.status = 'Review' THEN
    IF auth.uid() IS DISTINCT FROM OLD.reviewer_id
      OR NOT EXISTS (
        SELECT 1
        FROM public.task_comments c
        WHERE c.task_id = OLD.id
          AND c.user_id = auth.uid()
          AND c.created_at >= transaction_timestamp()
      )
    THEN
      RAISE EXCEPTION 'Penolakan review wajib menyertakan komentar reviewer';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.require_reviewer_rejection_comment() FROM PUBLIC;

CREATE TRIGGER task_rejection_comment_guard
  BEFORE UPDATE OF status ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.require_reviewer_rejection_comment();

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
  task_reviewer_id UUID;
  task_status_value public.task_status;
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

  SELECT t.reviewer_id, t.status
  INTO task_reviewer_id, task_status_value
  FROM public.tasks t
  WHERE t.id = p_task_id
  FOR UPDATE;

  IF task_reviewer_id IS DISTINCT FROM actor_id OR task_status_value <> 'Review' THEN
    RAISE EXCEPTION 'Hanya reviewer task berstatus Review yang dapat memutuskan';
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

REVOKE ALL ON FUNCTION public.review_task(UUID, public.task_status, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.review_task(UUID, public.task_status, TEXT) TO authenticated;
