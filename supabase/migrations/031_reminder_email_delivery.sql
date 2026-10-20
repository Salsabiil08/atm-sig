CREATE TABLE public.task_reminder_email_deliveries (
  reminder_id UUID PRIMARY KEY REFERENCES public.task_reminders(id) ON DELETE CASCADE,
  claimed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  attempts INT NOT NULL DEFAULT 0 CHECK (attempts >= 0)
);

ALTER TABLE public.task_reminder_email_deliveries ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.queue_task_reminder_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  INSERT INTO public.task_reminder_email_deliveries (reminder_id)
  VALUES (NEW.id)
  ON CONFLICT (reminder_id) DO NOTHING;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.queue_task_reminder_email() FROM PUBLIC;
CREATE TRIGGER task_reminder_email_queue
  AFTER INSERT ON public.task_reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.queue_task_reminder_email();

CREATE OR REPLACE FUNCTION public.claim_due_reminder_emails(
  p_now TIMESTAMPTZ DEFAULT now(),
  p_batch_size INT DEFAULT 50
)
RETURNS TABLE (
  reminder_id UUID,
  task_id UUID,
  owner_id UUID,
  owner_email TEXT,
  task_title TEXT,
  checkpoint_pct INT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_now IS NULL OR p_batch_size < 1 OR p_batch_size > 100 THEN
    RAISE EXCEPTION 'Parameter email reminder tidak valid';
  END IF;

  RETURN QUERY
  WITH eligible AS (
    SELECT delivery.reminder_id
    FROM public.task_reminder_email_deliveries delivery
    JOIN public.task_reminders reminder ON reminder.id = delivery.reminder_id
    JOIN public.tasks task ON task.id = reminder.task_id
    JOIN public.users owner ON owner.id = task.owner_id
    WHERE delivery.sent_at IS NULL
      AND (
        delivery.claimed_at IS NULL
        OR delivery.claimed_at < p_now - INTERVAL '15 minutes'
      )
      AND reminder.response IS NULL
      AND reminder.sent_at <= p_now - INTERVAL '72 hours'
      AND task.status <> 'Done'
      AND task.due_date > p_now
      AND owner.status = 'aktif'
    ORDER BY reminder.sent_at, reminder.id
    LIMIT p_batch_size
    FOR UPDATE OF delivery SKIP LOCKED
  ),
  claimed AS (
    UPDATE public.task_reminder_email_deliveries delivery
    SET claimed_at = p_now,
        attempts = delivery.attempts + 1
    FROM eligible
    WHERE delivery.reminder_id = eligible.reminder_id
    RETURNING delivery.reminder_id
  )
  SELECT reminder.id, task.id, task.owner_id, owner.email, task.title, reminder.checkpoint_pct
  FROM claimed
  JOIN public.task_reminders reminder ON reminder.id = claimed.reminder_id
  JOIN public.tasks task ON task.id = reminder.task_id
  JOIN public.users owner ON owner.id = task.owner_id
  ORDER BY reminder.sent_at, reminder.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_reminder_email_sent(
  p_reminder_id UUID,
  p_sent_at TIMESTAMPTZ DEFAULT now()
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF p_reminder_id IS NULL OR p_sent_at IS NULL THEN
    RAISE EXCEPTION 'Parameter email reminder tidak valid';
  END IF;

  UPDATE public.task_reminder_email_deliveries
  SET sent_at = p_sent_at
  WHERE reminder_id = p_reminder_id
    AND claimed_at IS NOT NULL
    AND sent_at IS NULL;
  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_due_reminder_emails(TIMESTAMPTZ, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mark_reminder_email_sent(UUID, TIMESTAMPTZ) FROM PUBLIC;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.claim_due_reminder_emails(TIMESTAMPTZ, INT) TO service_role;
    GRANT EXECUTE ON FUNCTION public.mark_reminder_email_sent(UUID, TIMESTAMPTZ) TO service_role;
  END IF;
END;
$$;
