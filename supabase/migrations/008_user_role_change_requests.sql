-- T-105 / FR-004 / D-024: GM may request an assignment change for Super Admin review.
CREATE TABLE role_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id),
  requested_role_id INT NOT NULL REFERENCES roles(id),
  requested_org_unit_id INT NOT NULL REFERENCES org_units(id),
  requested_supervisor_id UUID REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  decided_by UUID REFERENCES users(id),
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT role_change_decision_consistency CHECK (
    (status = 'pending' AND decided_by IS NULL AND decided_at IS NULL)
    OR (status IN ('approved', 'rejected') AND decided_by IS NOT NULL AND decided_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX role_change_requests_one_pending_per_target
  ON role_change_requests (target_user_id)
  WHERE status = 'pending';

ALTER TABLE role_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY role_change_requests_read ON role_change_requests
  FOR SELECT USING (
    requested_by = auth.uid() OR get_my_role_level() = 6
  );

CREATE POLICY role_change_requests_insert_gm ON role_change_requests
  FOR INSERT WITH CHECK (
    get_my_role_level() = 5
    AND requested_by = auth.uid()
    AND status = 'pending'
    AND decided_by IS NULL
    AND decided_at IS NULL
  );

CREATE POLICY role_change_requests_decide_superadmin ON role_change_requests
  FOR UPDATE USING (
    get_my_role_level() = 6 AND status = 'pending'
  )
  WITH CHECK (
    get_my_role_level() = 6
    AND status IN ('approved', 'rejected')
    AND decided_by = auth.uid()
    AND decided_at IS NOT NULL
  );

GRANT SELECT, INSERT, UPDATE ON role_change_requests TO authenticated;
