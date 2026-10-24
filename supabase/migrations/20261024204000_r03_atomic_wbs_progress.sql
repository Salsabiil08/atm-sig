-- R.03 WBS changes are transactionally tied to the task progress and audit.
-- The new functions execute with the authenticated caller's RLS (SECURITY INVOKER).
CREATE OR REPLACE FUNCTION public.recalculate_task_wbs_progress_r03(p_task_id uuid)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public AS $$
DECLARE total_weight numeric; done_weight numeric; new_progress integer;
BEGIN
  SELECT coalesce(sum(w.weight),0),coalesce(sum(w.weight) FILTER(WHERE w.is_done),0)
    INTO total_weight,done_weight
  FROM public.wbs_items w WHERE w.task_id=p_task_id
    AND NOT EXISTS (SELECT 1 FROM public.wbs_items c WHERE c.parent_id=w.id);
  new_progress:=CASE WHEN total_weight>0 THEN round(done_weight*100/total_weight)::int ELSE 0 END;
  UPDATE public.tasks SET progress_pct=new_progress WHERE id=p_task_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Task tidak dapat diperbarui sesuai izin PIC'; END IF;
  RETURN new_progress;
END; $$;
REVOKE ALL ON FUNCTION public.recalculate_task_wbs_progress_r03(uuid)
  FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.add_wbs_item_r03(
  p_task_id uuid,p_title text,p_weight numeric,p_parent_id uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public AS $$
DECLARE v_task public.tasks%ROWTYPE; v_new_id uuid;
BEGIN
  IF auth.uid() IS NULL OR p_task_id IS NULL OR
     p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 1 AND 200
     OR p_weight IS NULL OR p_weight<=0 OR p_weight>100 THEN
    RAISE EXCEPTION 'Item WBS tidak valid';
  END IF;
  SELECT * INTO v_task FROM public.tasks WHERE id=p_task_id FOR UPDATE;
  IF NOT FOUND OR v_task.owner_id IS DISTINCT FROM auth.uid()
    OR v_task.status NOT IN ('To do','In progress','Revisi') THEN
    RAISE EXCEPTION 'Hanya PIC task aktif yang dapat menambah WBS';
  END IF;
  INSERT INTO public.wbs_items(task_id,parent_id,title,weight,is_done)
  VALUES(p_task_id,p_parent_id,btrim(p_title),p_weight,false)
  RETURNING id INTO v_new_id;
  PERFORM public.recalculate_task_wbs_progress_r03(p_task_id);
  RETURN v_new_id;
END; $$;
REVOKE ALL ON FUNCTION public.add_wbs_item_r03(uuid,text,numeric,uuid)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.add_wbs_item_r03(uuid,text,numeric,uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.toggle_wbs_item_r03(
  p_task_id uuid,p_wbs_item_id uuid,p_is_done boolean
) RETURNS integer LANGUAGE plpgsql SECURITY INVOKER
SET search_path=pg_catalog,public AS $$
DECLARE v_task public.tasks%ROWTYPE; v_result integer;
BEGIN
  IF auth.uid() IS NULL OR p_task_id IS NULL OR p_wbs_item_id IS NULL OR p_is_done IS NULL THEN
    RAISE EXCEPTION 'Item WBS tidak valid';
  END IF;
  SELECT * INTO v_task FROM public.tasks WHERE id=p_task_id FOR UPDATE;
  IF NOT FOUND OR v_task.owner_id IS DISTINCT FROM auth.uid()
    OR v_task.status NOT IN ('To do','In progress','Revisi') THEN
    RAISE EXCEPTION 'Hanya PIC task aktif yang dapat memperbarui WBS';
  END IF;
  IF EXISTS (SELECT 1 FROM public.wbs_items WHERE parent_id=p_wbs_item_id) THEN
    RAISE EXCEPTION 'Hanya item WBS leaf yang dapat ditandai selesai';
  END IF;
  UPDATE public.wbs_items SET is_done=p_is_done
  WHERE id=p_wbs_item_id AND task_id=p_task_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'WBS di luar task Anda'; END IF;
  SELECT public.recalculate_task_wbs_progress_r03(p_task_id) INTO v_result;
  RETURN v_result;
END; $$;
REVOKE ALL ON FUNCTION public.toggle_wbs_item_r03(uuid,uuid,boolean)
  FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.toggle_wbs_item_r03(uuid,uuid,boolean)
  TO authenticated;
