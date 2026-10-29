-- Reduce recurring HTTP invocations from every minute to twice per hour.
-- Existing job commands, secrets, and active state remain unchanged.
DO $$
DECLARE
  v_job record;
BEGIN
  FOR v_job IN
    SELECT jobid
    FROM cron.job
    WHERE jobname IN ('atm-reminders-prod', 'atm-push-preview-test')
  LOOP
    PERFORM cron.alter_job(
      job_id := v_job.jobid,
      schedule := '*/30 * * * *'
    );
  END LOOP;
END;
$$;
