-- R.03: retain immutable task lifecycle checkpoints from this migration forward.
-- Historical state prior to the baseline cannot be fabricated or proven accurate.
CREATE TABLE IF NOT EXISTS public.task_state_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  actor_id uuid,
  old_status public.task_status,
  new_status public.task_status NOT NULL,
  old_owner_id uuid,
  new_owner_id uuid NOT NULL,
  old_completed_at timestamptz,
  new_completed_at timestamptz,
  is_baseline boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS task_state_events_task_time_idx
  ON public.task_state_events(task_id,occurred_at,id);
ALTER TABLE public.task_state_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.task_state_events FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.task_state_events TO authenticated;
CREATE POLICY task_state_events_read_scoped ON public.task_state_events
FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.tasks t WHERE t.id=task_state_events.task_id
      AND public.can_access_task_scope(t.org_unit_id,t.owner_id,t.reviewer_id)
  )
);
CREATE OR REPLACE FUNCTION public.record_task_state_r03()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
  IF TG_OP='UPDATE' AND NEW.status IS NOT DISTINCT FROM OLD.status
    AND NEW.owner_id IS NOT DISTINCT FROM OLD.owner_id
    AND NEW.completed_at IS NOT DISTINCT FROM OLD.completed_at THEN RETURN NEW; END IF;
  INSERT INTO public.task_state_events (
    task_id,actor_id,old_status,new_status,old_owner_id,new_owner_id,
    old_completed_at,new_completed_at,is_baseline
  ) VALUES (
    NEW.id,auth.uid(),
    CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.status END,
    NEW.status,
    CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.owner_id END,
    NEW.owner_id,
    CASE WHEN TG_OP='INSERT' THEN NULL ELSE OLD.completed_at END,
    NEW.completed_at,
    TG_OP='INSERT'
  );
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.record_task_state_r03()
  FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS task_state_tracking_r03 ON public.tasks;
CREATE TRIGGER task_state_tracking_r03
AFTER INSERT OR UPDATE OF status,owner_id,completed_at ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.record_task_state_r03();

-- Capture current known status as a baseline. Do NOT mislabel this as
-- historical state before this point. Existing rows may have incomplete history.
INSERT INTO public.task_state_events (
  task_id,occurred_at,actor_id,new_status,new_owner_id,new_completed_at,is_baseline
)
SELECT t.id,transaction_timestamp(),NULL,t.status,t.owner_id,t.completed_at,true
FROM public.tasks t
WHERE NOT EXISTS (
  SELECT 1 FROM public.task_state_events e WHERE e.task_id=t.id
);

-- Nobody can forge or delete lifecycle events via the Data API.
REVOKE INSERT,UPDATE,DELETE,TRUNCATE ON public.task_state_events FROM authenticated,anon;
