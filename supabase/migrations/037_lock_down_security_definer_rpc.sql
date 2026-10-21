-- T-601 — NFR-001, NFR-003
-- SECURITY DEFINER functions run with the function owner's privileges, so
-- only explicitly used user-facing RPCs and server workers stay executable.
DO $$
DECLARE
  function_signature TEXT;
BEGIN
  FOR function_signature IN
    SELECT p.oid::regprocedure::TEXT
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef
      AND p.prokind = 'f'
  LOOP
    EXECUTE format(
      'REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      function_signature
    );
  END LOOP;
END;
$$;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- These RPCs validate auth.uid(), actor role, and organizational scope before
-- making the corresponding business change.
GRANT EXECUTE ON FUNCTION public.reassign_task(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_task(UUID, public.task_status, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_deadline_change(UUID, public.deadline_request_status) TO authenticated;
