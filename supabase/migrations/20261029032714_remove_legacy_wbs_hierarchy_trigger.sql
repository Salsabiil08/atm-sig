-- The R.03 hierarchy guard supersedes the legacy trigger. Keeping both causes
-- child-WBS inserts to execute the old guard through RLS. Its empty search_path
-- makes the legacy get_my_role_level() policy fail with "relation users does
-- not exist", which rolls back the complete task bundle.
--
-- The active wbs_hierarchy_r03 trigger still enforces same-task parents,
-- prevents self-parenting, and limits the hierarchy to two levels.
DROP TRIGGER IF EXISTS trg_guard_wbs_hierarchy ON public.wbs_items;
DROP FUNCTION IF EXISTS public.guard_wbs_hierarchy();
