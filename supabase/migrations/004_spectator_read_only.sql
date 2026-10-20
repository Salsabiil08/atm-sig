-- FR-002, BR-061 — Spectator users may read but cannot change profile or app data.
-- Profile changes are reserved for the authorized user-management flow.
DROP POLICY IF EXISTS "users_update_own" ON users;

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE
  USING (user_id = auth.uid() AND get_my_role_level() > 1)
  WITH CHECK (user_id = auth.uid() AND get_my_role_level() > 1);
