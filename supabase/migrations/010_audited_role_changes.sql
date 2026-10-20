-- T-107 / NFR-003 / FR-092: profile changes must use audited server actions.
-- Service-role-backed actions perform role assignment and write audit_logs with
-- compensating rollback; authenticated clients cannot bypass that workflow.
DROP POLICY IF EXISTS "users_update_superadmin" ON users;
DROP POLICY IF EXISTS "users_update_own" ON users;
