-- T-303 / FR-060 / BR-040: validate PIC deadline requests at the database boundary.
ALTER TABLE public.deadline_change_requests
  ADD CONSTRAINT deadline_change_reason_valid
  CHECK (length(btrim(reason)) BETWEEN 1 AND 1000);

CREATE OR REPLACE FUNCTION public.validate_pic_deadline_request()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  task_owner_id UUID;
  task_due_date TIMESTAMPTZ;
  requester_role_level INT;
BEGIN
  SELECT t.owner_id, t.due_date, r.level
  INTO task_owner_id, task_due_date, requester_role_level
  FROM public.tasks t
  JOIN public.users u ON u.id = NEW.requested_by
  JOIN public.roles r ON r.id = u.role_id
  WHERE t.id = NEW.task_id AND u.status = 'aktif';

  IF task_owner_id IS DISTINCT FROM NEW.requested_by OR requester_role_level <> 2 THEN
    RAISE EXCEPTION 'Hanya PIC aktif task yang dapat mengajukan perubahan deadline';
  END IF;
  IF auth.uid() IS NOT NULL AND auth.uid() IS DISTINCT FROM NEW.requested_by THEN
    RAISE EXCEPTION 'Pengaju harus merupakan PIC yang sedang login';
  END IF;
  IF NEW.old_due_date IS DISTINCT FROM task_due_date THEN
    RAISE EXCEPTION 'Deadline lama tidak sesuai dengan deadline task saat ini';
  END IF;
  IF NEW.new_due_date <= now() OR NEW.new_due_date = task_due_date THEN
    RAISE EXCEPTION 'Deadline baru harus berbeda dan berada di masa depan';
  END IF;
  IF NEW.status <> 'Menunggu approval'
    OR NEW.approver_id IS NOT NULL
    OR NEW.decided_at IS NOT NULL
  THEN
    RAISE EXCEPTION 'Pengajuan deadline baru harus menunggu approval';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_pic_deadline_request() FROM PUBLIC;

CREATE TRIGGER deadline_request_insert_guard
  BEFORE INSERT ON public.deadline_change_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_pic_deadline_request();
