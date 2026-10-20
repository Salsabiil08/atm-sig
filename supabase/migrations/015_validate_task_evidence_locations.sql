-- T-203 / FR-024: accept only HTTPS links or paths in the private evidence bucket.
ALTER TABLE public.task_evidence
  ADD CONSTRAINT task_evidence_file_or_link_format
  CHECK (
    file_or_link ~ '^https://[^[:space:]]+$'
    OR file_or_link ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.(pdf|jpg|png|csv)$'
  );
