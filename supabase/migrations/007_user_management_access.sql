-- T-103 / FR-005: profile writes are restricted to server-authorized user management.
-- The service-role-backed server actions enforce GM/SM organizational scope.
DROP POLICY IF EXISTS "users_update_own" ON users;
DROP POLICY IF EXISTS "users_update_superadmin" ON users;

CREATE POLICY "users_update_superadmin" ON users
  FOR UPDATE
  USING (get_my_role_level() = 6)
  WITH CHECK (get_my_role_level() = 6);
