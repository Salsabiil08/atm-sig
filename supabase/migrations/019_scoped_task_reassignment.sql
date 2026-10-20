-- T-207 / FR-030 / FR-031 / BR-050 / BR-051: move task ownership atomically.
CREATE OR REPLACE FUNCTION public.reassign_task(
  p_task_id UUID,
  p_new_owner_id UUID,
  p_reason TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  actor_id UUID := auth.uid();
  actor_role_level INT;
  actor_org_unit_id INT;
  task_owner_id UUID;
  task_org_unit_id INT;
  task_title TEXT;
  target_role_level INT;
  target_org_unit_id INT;
  target_supervisor_id UUID;
  target_name TEXT;
  reassignment_id UUID;
  allowed_target BOOLEAN := false;
  task_in_scope BOOLEAN := false;
  target_in_scope BOOLEAN := false;
BEGIN
  IF actor_id IS NULL OR p_task_id IS NULL OR p_new_owner_id IS NULL
    OR p_reason IS NULL OR length(btrim(p_reason)) = 0
  THEN
    RAISE EXCEPTION 'Data pemindahan task tidak valid';
  END IF;

  SELECT r.level, u.org_unit_id INTO actor_role_level, actor_org_unit_id
  FROM public.users u
  JOIN public.roles r ON r.id = u.role_id
  WHERE u.id = actor_id AND u.status = 'aktif';
  IF actor_role_level IS NULL THEN
    RAISE EXCEPTION 'Pengguna aktif tidak ditemukan';
  END IF;

  SELECT t.owner_id, t.org_unit_id, t.title
  INTO task_owner_id, task_org_unit_id, task_title
  FROM public.tasks t
  WHERE t.id = p_task_id
  FOR UPDATE;
  IF task_owner_id IS NULL THEN
    RAISE EXCEPTION 'Task tidak ditemukan';
  END IF;
  IF task_owner_id = p_new_owner_id THEN
    RAISE EXCEPTION 'PIC baru harus berbeda dari PIC saat ini';
  END IF;

  SELECT r.level, u.org_unit_id, u.supervisor_id, u.name
  INTO target_role_level, target_org_unit_id, target_supervisor_id, target_name
  FROM public.users u
  JOIN public.roles r ON r.id = u.role_id
  WHERE u.id = p_new_owner_id AND u.status = 'aktif';
  IF target_role_level IS NULL OR target_role_level < 2 THEN
    RAISE EXCEPTION 'PIC tujuan harus berupa user aktif yang dapat mengerjakan task';
  END IF;

  IF actor_role_level = 3 THEN
    allowed_target := target_role_level = 2 AND target_org_unit_id = actor_org_unit_id;
    task_in_scope := task_org_unit_id = actor_org_unit_id;
    target_in_scope := target_org_unit_id = actor_org_unit_id;
  ELSIF actor_role_level = 4 THEN
    allowed_target := target_role_level IN (2, 3);
  ELSIF actor_role_level = 5 THEN
    allowed_target := target_role_level BETWEEN 2 AND 4;
  ELSIF actor_role_level >= 6 THEN
    allowed_target := true;
    task_in_scope := true;
    target_in_scope := true;
  END IF;

  IF actor_role_level = 4 OR actor_role_level = 5 THEN
    WITH RECURSIVE org_tree(id) AS (
      SELECT actor_org_unit_id
      UNION ALL
      SELECT child.id
      FROM public.org_units child
      JOIN org_tree parent ON child.parent_id = parent.id
    )
    SELECT EXISTS (
      SELECT 1 FROM org_tree WHERE id = task_org_unit_id
    ), EXISTS (
      SELECT 1 FROM org_tree WHERE id = target_org_unit_id
    )
    INTO task_in_scope, target_in_scope;
  END IF;

  IF NOT task_in_scope OR NOT target_in_scope OR NOT allowed_target THEN
    RAISE EXCEPTION 'PIC tujuan berada di luar cakupan atau kewenangan Anda';
  END IF;

  IF target_role_level < 5 AND (
    target_supervisor_id IS NULL OR NOT EXISTS (
      SELECT 1 FROM public.users supervisor
      WHERE supervisor.id = target_supervisor_id AND supervisor.status = 'aktif'
    )
  ) THEN
    RAISE EXCEPTION 'PIC tujuan tidak memiliki atasan aktif';
  END IF;

  INSERT INTO public.task_reassignments (task_id, from_user_id, to_user_id, reason)
  VALUES (p_task_id, task_owner_id, p_new_owner_id, btrim(p_reason))
  RETURNING id INTO reassignment_id;

  UPDATE public.tasks
  SET owner_id = p_new_owner_id,
      org_unit_id = target_org_unit_id,
      reviewer_id = CASE WHEN target_role_level >= 5 THEN NULL ELSE target_supervisor_id END
  WHERE id = p_task_id;

  INSERT INTO public.notifications (user_id, task_id, type, title, body)
  VALUES (
    p_new_owner_id,
    p_task_id,
    'task_assigned',
    'Task baru ditugaskan kepada Anda',
    'Task "' || task_title || '" dialihkan kepada Anda. Alasan: ' || btrim(p_reason)
  );

  RETURN reassignment_id;
END;
$$;

REVOKE ALL ON FUNCTION public.reassign_task(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reassign_task(UUID, UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.guard_task_owner_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.task_reassignments r
      WHERE r.task_id = OLD.id
        AND r.from_user_id = OLD.owner_id
        AND r.to_user_id = NEW.owner_id
        AND r.created_at >= transaction_timestamp()
    ) THEN
      RAISE EXCEPTION 'Pemindahan PIC harus dilakukan melalui alur pemindahan task';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER task_owner_change_guard
  BEFORE UPDATE OF owner_id ON public.tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_task_owner_change();
