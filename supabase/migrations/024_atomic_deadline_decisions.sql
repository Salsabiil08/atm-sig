-- T-304 / FR-061 / FR-062: decide a deadline request and apply its date atomically.
DROP POLICY IF EXISTS deadline_change_requests_update ON public.deadline_change_requests;

CREATE OR REPLACE FUNCTION public.decide_deadline_change(
  p_request_id UUID,
  p_decision public.deadline_request_status
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  actor_id UUID := auth.uid();
  actor_role_level INT;
  request_task_id UUID;
  request_status public.deadline_request_status;
  request_old_due TIMESTAMPTZ;
  request_new_due TIMESTAMPTZ;
  current_task_due TIMESTAMPTZ;
  task_org_unit_id INT;
BEGIN
  IF actor_id IS NULL OR p_request_id IS NULL
    OR p_decision NOT IN ('Disetujui', 'Ditolak')
  THEN
    RAISE EXCEPTION 'Data keputusan deadline tidak valid';
  END IF;

  SELECT r.level INTO actor_role_level
  FROM public.users u
  JOIN public.roles r ON r.id = u.role_id
  WHERE u.id = actor_id AND u.status = 'aktif';
  IF actor_role_level IS NULL OR actor_role_level < 4 THEN
    RAISE EXCEPTION 'Hanya SM, GM, atau Super Admin yang dapat memutuskan deadline';
  END IF;

  SELECT d.task_id, d.status, d.old_due_date, d.new_due_date, t.org_unit_id, t.due_date
  INTO request_task_id, request_status, request_old_due, request_new_due,
    task_org_unit_id, current_task_due
  FROM public.deadline_change_requests d
  JOIN public.tasks t ON t.id = d.task_id
  WHERE d.id = p_request_id
  FOR UPDATE OF d, t;

  IF request_task_id IS NULL THEN
    RAISE EXCEPTION 'Permohonan deadline tidak ditemukan';
  END IF;
  IF NOT public.can_manage_org_unit(task_org_unit_id) THEN
    RAISE EXCEPTION 'Permohonan deadline berada di luar cakupan Anda';
  END IF;
  IF request_status <> 'Menunggu approval' THEN
    RAISE EXCEPTION 'Permohonan deadline sudah diproses';
  END IF;

  IF p_decision = 'Disetujui' THEN
    IF current_task_due IS DISTINCT FROM request_old_due THEN
      RAISE EXCEPTION 'Deadline task telah berubah setelah permohonan dibuat';
    END IF;
    IF request_new_due <= now() THEN
      RAISE EXCEPTION 'Tanggal tenggat baru sudah tidak berada di masa depan';
    END IF;

    UPDATE public.tasks
    SET due_date = request_new_due
    WHERE id = request_task_id;
  END IF;

  UPDATE public.deadline_change_requests
  SET status = p_decision,
      approver_id = actor_id,
      decided_at = now()
  WHERE id = p_request_id;

  RETURN p_request_id;
END;
$$;

REVOKE ALL ON FUNCTION public.decide_deadline_change(UUID, public.deadline_request_status) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.decide_deadline_change(UUID, public.deadline_request_status) TO authenticated;
