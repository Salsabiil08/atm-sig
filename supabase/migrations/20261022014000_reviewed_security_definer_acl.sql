-- R.02 audit P0: reviewed SECURITY DEFINER execution policy.
-- Current Production inventory: 29 pre-push functions + 4 push RPC/trigger functions = 33.
-- This migration is intentionally gated behind six-role negative API tests.
-- SECURITY DEFINER is privileged; public role grants must not be inherited by anon.
DO $$
DECLARE
  function_record record;
  total integer;
BEGIN
  SELECT count(*) INTO total
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosecdef AND p.prokind = 'f';

  IF total <> 33 THEN
    RAISE EXCEPTION 'Unexpected SECURITY DEFINER inventory: %, expected 33. Review before deploying', total;
  END IF;

  FOR function_record IN
    SELECT p.oid::regprocedure AS signature, p.proname AS function_name
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef AND p.prokind = 'f'
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated',
      function_record.signature);
    -- The backend's service role may call internal worker functions.
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role',
      function_record.signature);
    -- These three are intentionally exposed to signed-in users and perform
    -- their own actor/role/scope checks. Do not grant any other definer RPC.
    IF function_record.signature::text = ANY(ARRAY[
      'review_task(uuid,task_status,text)',
      'reassign_task(uuid,uuid,text)',
      'decide_deadline_change(uuid,deadline_request_status)'
    ]) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated',
        function_record.signature);
    END IF;
  END LOOP;
END $$;

-- Prevent functions newly created by postgres from inheriting PUBLIC execute.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;

-- Post-migration verification:
-- SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
-- WHERE n.nspname='public' AND p.prosecdef
-- AND has_function_privilege('anon',p.oid,'EXECUTE'); -- expected 0
