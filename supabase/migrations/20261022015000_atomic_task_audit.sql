-- R.02 P1: task mutations and audit evidence commit in the SAME database transaction.
-- Apply after the reviewed function ACL migration and before deploying matching code.
CREATE OR REPLACE FUNCTION public.audit_tasks_transactionally()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  actor_id uuid := auth.uid();
  task_id uuid;
  audit_action text;
BEGIN
  -- System scheduler runs without a user JWT; user-facing changes must have actor.
  IF actor_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND to_jsonb(NEW) IS NOT DISTINCT FROM to_jsonb(OLD) THEN
    RETURN NEW;
  END IF;

  task_id := CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END;
  audit_action := CASE
    WHEN TG_OP = 'INSERT' THEN 'create'
    WHEN TG_OP = 'DELETE' THEN 'delete'
    WHEN OLD.status = 'Review' AND NEW.status IN ('Done', 'Revisi') THEN 'review_task'
    WHEN OLD.status IS DISTINCT FROM NEW.status THEN 'update_status'
    ELSE 'update'
  END;

  INSERT INTO public.audit_logs (user_id, action, object, old_value, new_value)
  VALUES (
    actor_id,
    audit_action,
    'tasks:' || task_id::text,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD)::text END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW)::text END
  );

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.audit_tasks_transactionally()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.audit_tasks_transactionally() TO service_role;

DROP TRIGGER IF EXISTS tasks_transactional_audit ON public.tasks;
CREATE TRIGGER tasks_transactional_audit
AFTER INSERT OR UPDATE OR DELETE ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.audit_tasks_transactionally();
