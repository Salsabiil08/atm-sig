-- T-203 / FR-024 / NFR-005: private evidence storage, scoped by task access.
INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'task-evidence',
  'task-evidence',
  false,
  20971520,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'text/csv']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS task_evidence_storage_read ON storage.objects;
CREATE POLICY task_evidence_storage_read ON storage.objects
  FOR SELECT USING (
    bucket_id = 'task-evidence'
    AND EXISTS (
      SELECT 1
      FROM evidence_requirements er
      JOIN tasks t ON t.id = er.task_id
      WHERE split_part(name, '/', 1) = t.id::text
        AND split_part(name, '/', 2) = er.id::text
        AND split_part(name, '/', 3) <> ''
        AND can_access_task_scope(t.org_unit_id, t.owner_id, t.reviewer_id)
    )
  );

DROP POLICY IF EXISTS task_evidence_storage_insert ON storage.objects;
CREATE POLICY task_evidence_storage_insert ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'task-evidence'
    AND EXISTS (
      SELECT 1
      FROM evidence_requirements er
      JOIN tasks t ON t.id = er.task_id
      WHERE split_part(name, '/', 1) = t.id::text
        AND split_part(name, '/', 2) = er.id::text
        AND split_part(name, '/', 3) <> ''
        AND (
          t.owner_id = auth.uid()
          OR t.reviewer_id = auth.uid()
          OR (get_my_role_level() >= 3 AND can_manage_org_unit(t.org_unit_id))
        )
    )
  );
