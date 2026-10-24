-- R.03: transaction-safe task bundle, at most two WBS levels, and audited organization changes.
-- SECURITY INVOKER for task create; existing RLS applies to all inserts.
-- Apply in STAGING before deploying code that invokes these functions.

CREATE OR REPLACE FUNCTION public.create_task_bundle_r03(
  p_owner_id uuid, p_reviewer_id uuid, p_org_unit_id integer,
  p_parent_task_id uuid, p_title text, p_priority public.task_priority,
  p_start_date timestamptz, p_due_date timestamptz,
  p_category_id uuid DEFAULT NULL, p_evidence jsonb DEFAULT '[]'::jsonb,
  p_wbs jsonb DEFAULT '[]'::jsonb, p_support jsonb DEFAULT '[]'::jsonb
) RETURNS uuid
LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_role integer;
  v_task uuid;
  v_item jsonb;
  v_i integer;
  v_n integer;
  v_parent_idx integer;
  v_ids uuid[] := ARRAY[]::uuid[];
  v_weights numeric[] := ARRAY[]::numeric[];
  v_parent_indices integer[] := ARRAY[]::integer[];
  v_leaf_total numeric := 0;
  v_weight numeric;
  v_text text;
  v_recipient uuid;
BEGIN
  SELECT r.level INTO v_role FROM public.users u JOIN public.roles r ON u.role_id=r.id
    WHERE u.id=v_actor AND u.status='aktif';
  IF v_actor IS NULL OR COALESCE(v_role,0)<2 THEN RAISE EXCEPTION 'Akun tidak berwenang'; END IF;
  IF p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 1 AND 200
     OR p_start_date IS NULL OR p_due_date IS NULL OR p_start_date >= p_due_date THEN
    RAISE EXCEPTION 'Data task tidak valid';
  END IF;
  IF jsonb_typeof(p_evidence) <> 'array' OR jsonb_array_length(p_evidence)>30 OR
     jsonb_typeof(p_wbs) <> 'array' OR jsonb_array_length(p_wbs)>100 OR
     jsonb_typeof(p_support) <> 'array' OR jsonb_array_length(p_support)>20 THEN
    RAISE EXCEPTION 'Data child task tidak valid';
  END IF;
  -- Explicit PIC rule; managers remain controlled by existing tasks_insert RLS.
  IF v_role=2 AND (p_owner_id<>v_actor OR p_org_unit_id<>public.get_my_org_unit_id()
      OR p_parent_task_id IS NOT NULL OR p_reviewer_id IS DISTINCT FROM
          (SELECT supervisor_id FROM public.users WHERE id=v_actor)) THEN
    RAISE EXCEPTION 'PIC hanya dapat membuat task untuk dirinya dalam section sendiri';
  END IF;
  IF p_category_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.task_categories c JOIN public.org_units ou ON ou.id=p_org_unit_id
    WHERE c.id=p_category_id AND c.is_active
      AND c.org_unit_id IN (p_org_unit_id, COALESCE(ou.parent_id,-1))
  ) THEN RAISE EXCEPTION 'Kategori tidak aktif atau tidak cocok'; END IF;
  -- Application validates supervisor chain before calling this RPC; DB constraint/RLS
  -- is still authoritative for each write.
  INSERT INTO public.tasks(owner_id,assigner_id,reviewer_id,org_unit_id,parent_task_id,
      title,priority,start_date,due_date,category_id)
    VALUES(p_owner_id,v_actor,p_reviewer_id,p_org_unit_id,p_parent_task_id,
      btrim(p_title),p_priority,p_start_date,p_due_date,p_category_id)
    RETURNING id INTO v_task;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_evidence)
  LOOP
    v_text:=btrim(COALESCE(v_item->>'description',''));
    IF length(v_text) NOT BETWEEN 1 AND 200 OR jsonb_typeof(v_item->'mandatory')<>'boolean' THEN
      RAISE EXCEPTION 'Persyaratan evidence tidak valid';
    END IF;
    INSERT INTO public.evidence_requirements(task_id,description,mandatory)
      VALUES(v_task,v_text,(v_item->>'mandatory')::boolean);
  END LOOP;

  -- WBS root first, child can refer only to an earlier root index (0-based).
  v_n:=jsonb_array_length(p_wbs);
  FOR v_i IN 0..v_n-1 LOOP
    v_item:=p_wbs->v_i;
    v_text:=btrim(COALESCE(v_item->>'title',''));
    IF length(v_text) NOT BETWEEN 1 AND 200 OR jsonb_typeof(v_item->'weight')<>'number' THEN
      RAISE EXCEPTION 'WBS harus memiliki judul dan bobot numerik';
    END IF;
    v_weight:=(v_item->>'weight')::numeric;
    IF v_weight<0 OR v_weight>100 THEN RAISE EXCEPTION 'Bobot WBS di luar rentang'; END IF;
    v_parent_idx:=NULL;
    IF v_item ? 'parentIndex' AND v_item->'parentIndex'<>'null'::jsonb THEN
      IF jsonb_typeof(v_item->'parentIndex')<>'number' THEN RAISE EXCEPTION 'Parent WBS tidak valid'; END IF;
      v_parent_idx:=(v_item->>'parentIndex')::integer;
      IF v_parent_idx<0 OR v_parent_idx>=v_i OR v_parent_indices[v_parent_idx+1] IS NOT NULL THEN
        RAISE EXCEPTION 'WBS maksimal dua tingkat, induk harus merupakan root sebelumnya';
      END IF;
    END IF;
    INSERT INTO public.wbs_items(task_id,parent_id,title,weight,is_done)
      VALUES(v_task,CASE WHEN v_parent_idx IS NULL THEN NULL ELSE v_ids[v_parent_idx+1] END,v_text,v_weight,false)
      RETURNING id INTO v_recipient;
    v_ids:=array_append(v_ids,v_recipient);
    v_parent_indices:=array_append(v_parent_indices,v_parent_idx);
    v_weights:=array_append(v_weights,v_weight);
  END LOOP;
  -- Only leaves count toward task progress. Sum must be exactly 100 if WBS exists.
  IF v_n>0 THEN
    FOR v_i IN 1..v_n LOOP
      IF NOT EXISTS (SELECT 1 FROM unnest(v_parent_indices) AS child_parent(idx) WHERE idx = v_i-1) THEN
        v_leaf_total:=v_leaf_total+v_weights[v_i];
      END IF;
    END LOOP;
    IF abs(v_leaf_total-100)>0.01 THEN RAISE EXCEPTION 'Total bobot leaf WBS harus 100%%'; END IF;
  END IF;

  IF jsonb_array_length(p_support)>0 AND p_owner_id<>v_actor THEN
    RAISE EXCEPTION 'Support awal hanya dapat diajukan oleh PIC pembuat';
  END IF;
  FOR v_item IN SELECT value FROM jsonb_array_elements(p_support)
  LOOP
    v_text:=btrim(COALESCE(v_item->>'description',''));
    IF length(v_text) NOT BETWEEN 1 AND 1000 OR
       COALESCE(v_item->>'neededFromId','') !~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' THEN
      RAISE EXCEPTION 'Permintaan support tidak valid';
    END IF;
    v_recipient:=(v_item->>'neededFromId')::uuid;
    IF v_recipient=v_actor OR NOT EXISTS
      (SELECT 1 FROM public.users WHERE id=v_recipient AND status='aktif') THEN
      RAISE EXCEPTION 'Penerima support tidak aktif';
    END IF;
    INSERT INTO public.task_supports(task_id,needed_from_id,description,status)
      VALUES(v_task,v_recipient,v_text,'diminta');
  END LOOP;
  RETURN v_task;
END;
$$;
REVOKE ALL ON FUNCTION public.create_task_bundle_r03(uuid,uuid,integer,uuid,text,public.task_priority,timestamptz,timestamptz,uuid,jsonb,jsonb,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_task_bundle_r03(uuid,uuid,integer,uuid,text,public.task_priority,timestamptz,timestamptz,uuid,jsonb,jsonb,jsonb) TO authenticated;

-- Direct writes to org_units must pass hierarchy validation too, not just UI.
CREATE OR REPLACE FUNCTION public.guard_org_unit_r03()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS $$
DECLARE v_parent public.org_units%ROWTYPE; v_depth integer;
BEGIN
  IF public.get_my_role_level()<>6 THEN RAISE EXCEPTION 'Hanya Super Admin dapat mengubah organisasi'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  NEW.name:=btrim(NEW.name);
  IF length(NEW.name) NOT BETWEEN 2 AND 100 THEN RAISE EXCEPTION 'Nama organisasi 2-100 karakter'; END IF;
  IF NEW.type='department' THEN
    IF NEW.parent_id IS NOT NULL THEN RAISE EXCEPTION 'Department tidak memiliki induk'; END IF;
  ELSE
    IF NEW.parent_id IS NULL THEN RAISE EXCEPTION 'Unit/section wajib memiliki induk'; END IF;
    SELECT * INTO v_parent FROM public.org_units WHERE id=NEW.parent_id FOR KEY SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Induk organisasi tidak ditemukan'; END IF;
    IF NEW.type='unit' AND v_parent.type<>'department' THEN RAISE EXCEPTION 'Unit harus berada di bawah Department'; END IF;
    IF NEW.type='section' AND v_parent.type<>'unit' THEN RAISE EXCEPTION 'Section harus berada di bawah Unit'; END IF;
  END IF;
  IF TG_OP='UPDATE' AND (NEW.type IS DISTINCT FROM OLD.type OR NEW.parent_id IS DISTINCT FROM OLD.parent_id)
     AND (EXISTS(SELECT 1 FROM public.org_units WHERE parent_id=OLD.id)
       OR EXISTS(SELECT 1 FROM public.users WHERE org_unit_id=OLD.id)
       OR EXISTS(SELECT 1 FROM public.tasks WHERE org_unit_id=OLD.id)) THEN
    RAISE EXCEPTION 'Struktur dengan anak/pengguna/task tidak boleh dipindahkan atau diubah jenis';
  END IF;
  IF NEW.id=NEW.parent_id THEN RAISE EXCEPTION 'Organisasi tidak dapat menjadi induknya sendiri'; END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS org_unit_hierarchy_r03 ON public.org_units;
CREATE TRIGGER org_unit_hierarchy_r03 BEFORE INSERT OR UPDATE ON public.org_units
FOR EACH ROW EXECUTE FUNCTION public.guard_org_unit_r03();

-- The trigger is SECURITY DEFINER ONLY to write immutable audit as the table
-- owner; it checks actor role even if a DB privilege inadvertently broadens.
CREATE OR REPLACE FUNCTION public.audit_org_unit_r03()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path=pg_catalog,public AS $$
DECLARE actor uuid:=auth.uid(); value_id integer;
BEGIN
  IF actor IS NULL OR public.get_my_role_level()<>6 THEN RAISE EXCEPTION 'Akses organisasi ditolak'; END IF;
  value_id:=CASE WHEN TG_OP='DELETE' THEN OLD.id ELSE NEW.id END;
  INSERT INTO public.audit_logs(user_id,action,object,old_value,new_value)
    VALUES(actor,'org_'||lower(TG_OP),'org_units:'||value_id::text,
       CASE WHEN TG_OP='INSERT' THEN NULL ELSE to_jsonb(OLD)::text END,
       CASE WHEN TG_OP='DELETE' THEN NULL ELSE to_jsonb(NEW)::text END);
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END; $$;
REVOKE EXECUTE ON FUNCTION public.guard_org_unit_r03() FROM PUBLIC,anon,authenticated;
REVOKE EXECUTE ON FUNCTION public.audit_org_unit_r03() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS org_unit_audit_r03 ON public.org_units;
CREATE TRIGGER org_unit_audit_r03 AFTER INSERT OR UPDATE OR DELETE ON public.org_units
FOR EACH ROW EXECUTE FUNCTION public.audit_org_unit_r03();
