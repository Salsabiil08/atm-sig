-- T-204 / FR-025 / BR-010: keep an immutable record of each PIC progress update.
CREATE TABLE public.task_progress_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  changed_by UUID NOT NULL REFERENCES public.users(id),
  progress_pct INT NOT NULL CHECK (progress_pct BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX task_progress_history_task_created_idx
  ON public.task_progress_history (task_id, created_at DESC);

ALTER TABLE public.task_progress_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_progress_history_read ON public.task_progress_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.tasks t
      WHERE t.id = task_progress_history.task_id
        AND can_access_task_scope(t.org_unit_id, t.owner_id, t.reviewer_id)
    )
  );

CREATE OR REPLACE FUNCTION public.record_task_progress_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.progress_pct IS DISTINCT FROM OLD.progress_pct THEN
    IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM NEW.owner_id THEN
      RAISE EXCEPTION 'Hanya PIC task yang dapat memperbarui progress';
    END IF;

    INSERT INTO public.task_progress_history (task_id, changed_by, progress_pct)
    VALUES (NEW.id, auth.uid(), NEW.progress_pct);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER task_progress_history_after_update
  AFTER UPDATE OF progress_pct ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.record_task_progress_change();
