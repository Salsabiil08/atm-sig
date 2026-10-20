-- FR-100 / CR-0003 / D-032..D-034: scoped categories and recurring task templates.

CREATE TABLE public.task_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_unit_id INT NOT NULL REFERENCES public.org_units(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (org_unit_id, name)
);

CREATE TABLE public.task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_unit_id INT NOT NULL REFERENCES public.org_units(id) ON DELETE RESTRICT,
  category_id UUID NOT NULL REFERENCES public.task_categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 100),
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
  priority public.task_priority NOT NULL DEFAULT 'sedang',
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
  reviewer_id UUID REFERENCES public.users(id) ON DELETE RESTRICT,
  recurrence TEXT NOT NULL CHECK (recurrence IN ('weekly', 'monthly')),
  recurrence_day SMALLINT NOT NULL,
  start_offset_days SMALLINT NOT NULL DEFAULT 0 CHECK (start_offset_days BETWEEN 0 AND 365),
  due_offset_days SMALLINT NOT NULL CHECK (due_offset_days BETWEEN 1 AND 366),
  is_active BOOLEAN NOT NULL DEFAULT true,
  next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT task_template_recurrence_day CHECK (
    (recurrence = 'weekly' AND recurrence_day BETWEEN 1 AND 7)
    OR (recurrence = 'monthly' AND recurrence_day BETWEEN 1 AND 31)
  ),
  CONSTRAINT task_template_due_after_start CHECK (due_offset_days > start_offset_days)
);

CREATE TABLE public.task_template_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.task_templates(id) ON DELETE RESTRICT,
  scheduled_for TIMESTAMPTZ NOT NULL,
  task_id UUID UNIQUE REFERENCES public.tasks(id) ON DELETE SET NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('created', 'skipped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_id, scheduled_for)
);

ALTER TABLE public.tasks
  ADD COLUMN category_id UUID REFERENCES public.task_categories(id) ON DELETE RESTRICT;

CREATE INDEX task_templates_due_idx
  ON public.task_templates(next_run_at)
  WHERE is_active;
CREATE INDEX task_templates_scope_idx
  ON public.task_templates(org_unit_id, is_active);
CREATE INDEX task_template_runs_template_date_idx
  ON public.task_template_runs(template_id, scheduled_for DESC);

GRANT SELECT, INSERT, DELETE ON public.task_categories, public.task_templates TO authenticated;
GRANT SELECT ON public.task_template_runs TO authenticated;
GRANT ALL ON public.task_categories, public.task_templates, public.task_template_runs TO service_role;
GRANT SELECT, INSERT ON public.tasks TO service_role;

ALTER TABLE public.task_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_template_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_categories_read_active ON public.task_categories
  FOR SELECT USING (auth.uid() IS NOT NULL AND is_active);
CREATE POLICY task_categories_manage_scoped ON public.task_categories
  FOR ALL USING (
    get_my_role_level() >= 4
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND status = 'aktif')
    AND can_manage_org_unit(org_unit_id)
  ) WITH CHECK (
    get_my_role_level() >= 4
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND status = 'aktif')
    AND can_manage_org_unit(org_unit_id)
  );
REVOKE UPDATE ON public.task_categories FROM authenticated;
GRANT UPDATE (org_unit_id, name, is_active) ON public.task_categories TO authenticated;

CREATE POLICY task_templates_read_scoped ON public.task_templates
  FOR SELECT USING (
    get_my_role_level() >= 4
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND status = 'aktif')
    AND can_manage_org_unit(org_unit_id)
  );
CREATE POLICY task_templates_manage_scoped ON public.task_templates
  FOR ALL USING (
    get_my_role_level() >= 4
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND status = 'aktif')
    AND can_manage_org_unit(org_unit_id)
  ) WITH CHECK (
    get_my_role_level() >= 4
    AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND status = 'aktif')
    AND can_manage_org_unit(org_unit_id)
  );

CREATE POLICY task_template_runs_read_scoped ON public.task_template_runs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.task_templates t
      WHERE t.id = template_id
        AND get_my_role_level() >= 4
        AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND status = 'aktif')
        AND can_manage_org_unit(t.org_unit_id)
    )
  );

CREATE OR REPLACE FUNCTION public.next_task_template_run(
  p_recurrence TEXT,
  p_recurrence_day SMALLINT,
  p_after TIMESTAMPTZ
)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SET search_path = pg_catalog, public
AS $$
  WITH candidates AS (
    SELECT d::date AS run_date
    FROM generate_series(
      (p_after AT TIME ZONE 'Asia/Jakarta')::date,
      (p_after AT TIME ZONE 'Asia/Jakarta')::date + 40,
      interval '1 day'
    ) AS d
  ), scheduled AS (
    SELECT ((run_date + time '08:00') AT TIME ZONE 'Asia/Jakarta') AS run_at,
      run_date
    FROM candidates
    WHERE (p_recurrence = 'weekly'
        AND extract(isodow FROM run_date)::INT = p_recurrence_day)
      OR (p_recurrence = 'monthly'
        AND run_date = (
          date_trunc('month', run_date)::date
          + LEAST(
              p_recurrence_day,
              extract(day FROM (date_trunc('month', run_date) + interval '1 month - 1 day'))::INT
            ) - 1
        ))
  )
  SELECT run_at FROM scheduled WHERE run_at > p_after ORDER BY run_at LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.set_task_template_next_run()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
    IF NEW.is_active THEN
      NEW.next_run_at := public.next_task_template_run(NEW.recurrence, NEW.recurrence_day, now());
    END IF;
  ELSIF auth.role() = 'service_role' THEN
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
  ELSE
    NEW.created_by := OLD.created_by;
    NEW.created_at := OLD.created_at;
    IF NEW.recurrence IS DISTINCT FROM OLD.recurrence
      OR NEW.recurrence_day IS DISTINCT FROM OLD.recurrence_day
      OR NEW.is_active IS DISTINCT FROM OLD.is_active
    THEN
      IF NEW.is_active THEN
        NEW.next_run_at := public.next_task_template_run(NEW.recurrence, NEW.recurrence_day, now());
      END IF;
    ELSE
      NEW.next_run_at := OLD.next_run_at;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER task_templates_next_run
  BEFORE INSERT OR UPDATE ON public.task_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_task_template_next_run();

CREATE OR REPLACE FUNCTION public.validate_task_template()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  owner_profile RECORD;
  reviewer_profile RECORD;
  category_org_unit_id INT;
  category_is_active BOOLEAN;
  org_unit_type public.org_unit_type;
BEGIN
  SELECT type INTO org_unit_type
  FROM public.org_units WHERE id = NEW.org_unit_id;
  IF org_unit_type IS DISTINCT FROM 'section' THEN
    RAISE EXCEPTION 'Template task harus berada pada section';
  END IF;

  SELECT org_unit_id, is_active INTO category_org_unit_id, category_is_active
  FROM public.task_categories
  WHERE id = NEW.category_id;
  IF category_org_unit_id IS DISTINCT FROM NEW.org_unit_id
    OR (NEW.is_active AND category_is_active IS DISTINCT FROM true)
  THEN
    RAISE EXCEPTION 'Kategori template tidak aktif atau berada di luar section';
  END IF;

  IF NOT NEW.is_active THEN RETURN NEW; END IF;

  SELECT u.id, u.org_unit_id, u.supervisor_id, u.status, r.level
  INTO owner_profile
  FROM public.users u JOIN public.roles r ON r.id = u.role_id
  WHERE u.id = NEW.owner_id;
  IF owner_profile.id IS NULL OR owner_profile.status <> 'aktif'
    OR owner_profile.level < 2 OR (
      owner_profile.level < 5
      AND owner_profile.org_unit_id <> NEW.org_unit_id
      AND NOT (
        owner_profile.level = 4 AND EXISTS (
          SELECT 1 FROM public.org_units
          WHERE id = NEW.org_unit_id AND parent_id = owner_profile.org_unit_id
        )
      )
    )
  THEN
    RAISE EXCEPTION 'PIC template harus aktif dan berada pada section yang dipilih';
  END IF;

  IF owner_profile.level >= 5 THEN
    IF NEW.reviewer_id IS NOT NULL THEN
      RAISE EXCEPTION 'Task GM/Super Admin tidak boleh memiliki reviewer';
    END IF;
  ELSE
    SELECT u.id, u.status, r.level INTO reviewer_profile
    FROM public.users u JOIN public.roles r ON r.id = u.role_id
    WHERE u.id = NEW.reviewer_id;
    IF owner_profile.supervisor_id IS DISTINCT FROM NEW.reviewer_id
      OR reviewer_profile.status IS DISTINCT FROM 'aktif'
      OR reviewer_profile.level IS DISTINCT FROM owner_profile.level + 1
    THEN
      RAISE EXCEPTION 'Reviewer template harus menjadi atasan langsung aktif PIC';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER task_templates_validate
  BEFORE INSERT OR UPDATE
  ON public.task_templates
  FOR EACH ROW EXECUTE FUNCTION public.validate_task_template();

CREATE OR REPLACE FUNCTION public.audit_task_master_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  actor_id UUID := auth.uid();
  entity_id UUID;
  entity_name TEXT;
  before_value TEXT;
  after_value TEXT;
BEGIN
  IF actor_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
  END IF;
  IF TG_TABLE_NAME = 'task_categories' THEN
    entity_name := 'task_categories';
    IF TG_OP = 'DELETE' THEN entity_id := OLD.id; ELSE entity_id := NEW.id; END IF;
  ELSE
    entity_name := 'task_templates';
    IF TG_OP = 'DELETE' THEN entity_id := OLD.id; ELSE entity_id := NEW.id; END IF;
  END IF;
  IF TG_OP <> 'INSERT' THEN before_value := to_jsonb(OLD)::text; END IF;
  IF TG_OP <> 'DELETE' THEN after_value := to_jsonb(NEW)::text; END IF;
  INSERT INTO public.audit_logs(user_id, action, object, old_value, new_value)
  VALUES (actor_id, lower(TG_TABLE_NAME) || '_' || lower(TG_OP),
    entity_name || ':' || entity_id, before_value, after_value);
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

CREATE TRIGGER task_categories_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.task_categories
  FOR EACH ROW EXECUTE FUNCTION public.audit_task_master_change();
CREATE TRIGGER task_templates_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.task_templates
  FOR EACH ROW EXECUTE FUNCTION public.audit_task_master_change();

CREATE OR REPLACE FUNCTION public.validate_task_category_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  category_org_unit_id INT;
  category_active BOOLEAN;
BEGIN
  IF NEW.category_id IS NULL THEN RETURN NEW; END IF;
  SELECT org_unit_id, is_active INTO category_org_unit_id, category_active
  FROM public.task_categories WHERE id = NEW.category_id;
  IF category_active IS DISTINCT FROM true OR category_org_unit_id IS DISTINCT FROM NEW.org_unit_id THEN
    RAISE EXCEPTION 'Kategori task harus aktif dan berada pada section yang sama';
  END IF;
  IF auth.uid() IS NOT NULL AND (
    get_my_role_level() < 3 OR NOT can_manage_org_unit(NEW.org_unit_id)
  ) THEN
    RAISE EXCEPTION 'Hanya Manager ke atas dalam cakupan yang dapat menetapkan kategori task';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tasks_category_scope_guard
  BEFORE INSERT OR UPDATE OF category_id, org_unit_id ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.validate_task_category_assignment();

CREATE OR REPLACE FUNCTION public.process_task_template_runs(p_now TIMESTAMPTZ DEFAULT now())
RETURNS TABLE(created_count INT, skipped_count INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  template_row RECORD;
  scheduled_time TIMESTAMPTZ;
  owner_active BOOLEAN;
  assignment_valid BOOLEAN;
  category_active BOOLEAN;
  created_task_id UUID;
  created_total INT := 0;
  skipped_total INT := 0;
BEGIN
  IF p_now IS NULL THEN RAISE EXCEPTION 'Waktu scheduler tidak valid'; END IF;

  FOR template_row IN
    SELECT t.* FROM public.task_templates t
    WHERE t.is_active AND t.next_run_at <= p_now
    ORDER BY t.next_run_at, t.id
    FOR UPDATE SKIP LOCKED
  LOOP
    scheduled_time := template_row.next_run_at;
    SELECT u.status = 'aktif' INTO owner_active
    FROM public.users u WHERE u.id = template_row.owner_id;
    SELECT c.is_active INTO category_active
    FROM public.task_categories c WHERE c.id = template_row.category_id;
    SELECT EXISTS (
      SELECT 1
      FROM public.users owner
      JOIN public.roles owner_role ON owner_role.id = owner.role_id
      LEFT JOIN public.users reviewer ON reviewer.id = template_row.reviewer_id
      LEFT JOIN public.roles reviewer_role ON reviewer_role.id = reviewer.role_id
      WHERE owner.id = template_row.owner_id
        AND (
          (owner_role.level >= 5 AND template_row.reviewer_id IS NULL)
          OR (
            owner_role.level BETWEEN 2 AND 4
            AND (
              owner.org_unit_id = template_row.org_unit_id
              OR (
                owner_role.level = 4 AND EXISTS (
                  SELECT 1 FROM public.org_units
                  WHERE id = template_row.org_unit_id
                    AND parent_id = owner.org_unit_id
                )
              )
            )
            AND owner.supervisor_id = template_row.reviewer_id
            AND reviewer.status = 'aktif'
            AND reviewer_role.level = owner_role.level + 1
          )
        )
    ) INTO assignment_valid;

    IF (scheduled_time AT TIME ZONE 'Asia/Jakarta')::date
      < (p_now AT TIME ZONE 'Asia/Jakarta')::date
      OR owner_active IS DISTINCT FROM true
      OR category_active IS DISTINCT FROM true
      OR assignment_valid IS DISTINCT FROM true
    THEN
      INSERT INTO public.task_template_runs(template_id, scheduled_for, outcome)
      VALUES (template_row.id, scheduled_time, 'skipped')
      ON CONFLICT (template_id, scheduled_for) DO NOTHING;
      UPDATE public.task_templates SET next_run_at = public.next_task_template_run(
        template_row.recurrence, template_row.recurrence_day, p_now
      ) WHERE id = template_row.id;
      skipped_total := skipped_total + 1;
      CONTINUE;
    END IF;

    INSERT INTO public.tasks (
      owner_id, assigner_id, reviewer_id, org_unit_id, category_id,
      title, priority, status, progress_pct, start_date, due_date
    ) VALUES (
      template_row.owner_id, template_row.created_by, template_row.reviewer_id,
      template_row.org_unit_id, template_row.category_id,
      template_row.title, template_row.priority, 'To do', 0,
      scheduled_time + make_interval(days => template_row.start_offset_days),
      scheduled_time + make_interval(days => template_row.due_offset_days)
    ) RETURNING id INTO created_task_id;

    INSERT INTO public.task_template_runs(template_id, scheduled_for, task_id, outcome)
    VALUES (template_row.id, scheduled_time, created_task_id, 'created')
    ON CONFLICT (template_id, scheduled_for) DO NOTHING;

    INSERT INTO public.audit_logs(user_id, action, object, old_value, new_value)
    VALUES (
      template_row.created_by,
      'create',
      'tasks:' || created_task_id,
      NULL,
      template_row.title || ' (dibuat otomatis dari template ' || template_row.name || ')'
    );

    UPDATE public.task_templates SET next_run_at = public.next_task_template_run(
      template_row.recurrence, template_row.recurrence_day, p_now
    ) WHERE id = template_row.id;
    created_total := created_total + 1;
  END LOOP;

  RETURN QUERY SELECT created_total, skipped_total;
END;
$$;

REVOKE ALL ON FUNCTION public.next_task_template_run(TEXT, SMALLINT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.process_task_template_runs(TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.next_task_template_run(TEXT, SMALLINT, TIMESTAMPTZ) TO authenticated, service_role;
REVOKE UPDATE ON public.task_templates FROM authenticated;
GRANT UPDATE (
  org_unit_id, category_id, name, title, priority, owner_id, reviewer_id,
  recurrence, recurrence_day, start_offset_days, due_offset_days, is_active
) ON public.task_templates TO authenticated;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    GRANT EXECUTE ON FUNCTION public.process_task_template_runs(TIMESTAMPTZ) TO service_role;
  END IF;
END $$;
