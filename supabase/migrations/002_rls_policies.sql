-- T-003 — Migration 002: Row Level Security (RLS)
-- NFR-001, ADR-0001 konsekuensi #1
-- Aktifkan RLS sebagai lapisan pertahanan tambahan di Supabase.
-- Catatan: RBAC utama tetap di Server Action/Route Handler (PR-1).

-- ============================================================
-- Aktifkan RLS pada semua tabel
-- ============================================================
ALTER TABLE roles                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_units               ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks                   ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_reassignments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_supports           ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments           ENABLE ROW LEVEL SECURITY;
ALTER TABLE evidence_requirements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_evidence           ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_reminders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE deadline_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications           ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs              ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Helper: ambil role level user yang sedang login
-- ============================================================
CREATE OR REPLACE FUNCTION get_my_role_level()
RETURNS INT
LANGUAGE sql STABLE
AS $$
  SELECT r.level
  FROM users u
  JOIN roles r ON r.id = u.role_id
  WHERE u.id = auth.uid()
  LIMIT 1;
$$;

-- Helper: ambil org_unit_id user yang sedang login
CREATE OR REPLACE FUNCTION get_my_org_unit_id()
RETURNS INT
LANGUAGE sql STABLE
AS $$
  SELECT org_unit_id FROM users WHERE id = auth.uid() LIMIT 1;
$$;

-- ============================================================
-- Policy: roles & org_units — semua user boleh membaca (data master)
-- ============================================================
CREATE POLICY "roles_read_all"     ON roles      FOR SELECT USING (true);
CREATE POLICY "org_units_read_all" ON org_units  FOR SELECT USING (true);

-- Hanya Super Admin (level 6) yang boleh mengubah master data
CREATE POLICY "roles_write_superadmin" ON roles
  FOR ALL USING (get_my_role_level() = 6);

CREATE POLICY "org_units_write_superadmin" ON org_units
  FOR ALL USING (get_my_role_level() = 6);

-- ============================================================
-- Policy: users
-- ============================================================
-- Semua user aktif bisa membaca profil user lain (untuk dropdown PIC, dll.)
CREATE POLICY "users_read_all" ON users
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- User hanya bisa update profilnya sendiri;
-- perubahan role dilakukan oleh pihak berwenang lewat Server Action
CREATE POLICY "users_update_own" ON users
  FOR UPDATE USING (id = auth.uid());

-- ============================================================
-- Policy: tasks — akses berdasarkan org_unit dan role level
-- ============================================================
CREATE POLICY "tasks_read" ON tasks
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      -- GM (5) dan Super Admin (6): lihat semua
      get_my_role_level() >= 5
      -- SM (4): lihat task di unitnya
      OR (get_my_role_level() = 4 AND org_unit_id IN (
            SELECT id FROM org_units
            WHERE id = get_my_org_unit_id()
               OR parent_id = get_my_org_unit_id()
          ))
      -- Manager (3) dan bawahnya: task di section sendiri atau miliknya
      OR org_unit_id = get_my_org_unit_id()
      OR owner_id = auth.uid()
      OR reviewer_id = auth.uid()
    )
  );

-- ============================================================
-- Policy: notifications — user hanya melihat notifikasi miliknya
-- ============================================================
CREATE POLICY "notifications_read_own" ON notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE USING (user_id = auth.uid());

-- ============================================================
-- Policy: audit_logs — semua authenticated user bisa membaca,
-- tidak ada yang bisa mengubah/menghapus (INSERT saja via server)
-- ============================================================
CREATE POLICY "audit_logs_read" ON audit_logs
  FOR SELECT USING (auth.uid() IS NOT NULL);
