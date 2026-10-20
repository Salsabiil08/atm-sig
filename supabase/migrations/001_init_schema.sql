-- T-003 — Migration 001: Seed roles (6 role resmi) dan org_units (1 dept, 2 unit, 7 section)
-- FR-006, BR-060, D-010, D-011
-- Jalankan di Supabase SQL Editor atau via supabase db push

-- ============================================================
-- ENUM TYPES
-- ============================================================
DO $$ BEGIN
  CREATE TYPE org_unit_type AS ENUM ('department', 'unit', 'section');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE task_status AS ENUM ('To do', 'In progress', 'Blocked', 'Review', 'Revisi', 'Done');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE support_status AS ENUM ('diminta', 'diberikan');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE deadline_request_status AS ENUM ('Menunggu approval', 'Disetujui', 'Ditolak');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE task_priority AS ENUM ('rendah', 'sedang', 'tinggi');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('aktif', 'nonaktif');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============================================================
-- TABEL roles (FR-006, D-010)
-- 6 role resmi — tidak boleh ditambah tanpa Change Request
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id    SERIAL PRIMARY KEY,
  name  TEXT NOT NULL UNIQUE,
  level INT  NOT NULL UNIQUE CHECK (level BETWEEN 1 AND 6)
);

-- ============================================================
-- TABEL org_units (FR-006, D-011)
-- Self-referencing: department → unit → section
-- ============================================================
CREATE TABLE IF NOT EXISTS org_units (
  id        SERIAL PRIMARY KEY,
  parent_id INT  REFERENCES org_units(id) ON DELETE RESTRICT,
  name      TEXT NOT NULL,
  type      org_unit_type NOT NULL
);

-- ============================================================
-- TABEL users (FR-002, FR-003, BR-060, BR-061)
-- id = Supabase Auth UUID
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY,  -- sama dengan auth.users.id
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE,
  role_id       INT  NOT NULL REFERENCES roles(id),
  org_unit_id   INT  NOT NULL REFERENCES org_units(id),
  supervisor_id UUID REFERENCES users(id),
  status        user_status NOT NULL DEFAULT 'aktif'
);

-- ============================================================
-- TABEL tasks (FR-020, BR-001)
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       UUID NOT NULL REFERENCES users(id),
  assigner_id    UUID NOT NULL REFERENCES users(id),
  reviewer_id    UUID REFERENCES users(id),   -- NULL untuk task GM/Super Admin (D-015)
  org_unit_id    INT  NOT NULL REFERENCES org_units(id),
  parent_task_id UUID REFERENCES tasks(id),
  title          TEXT NOT NULL,
  priority       task_priority NOT NULL DEFAULT 'sedang',
  status         task_status   NOT NULL DEFAULT 'To do',
  progress_pct   INT  NOT NULL DEFAULT 0 CHECK (progress_pct BETWEEN 0 AND 100),
  start_date     TIMESTAMPTZ NOT NULL,
  due_date       TIMESTAMPTZ NOT NULL,
  completed_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT due_after_start CHECK (due_date > start_date)
);

-- ============================================================
-- TABEL task_reassignments (FR-030, FR-031, BR-050, BR-051)
-- ============================================================
CREATE TABLE IF NOT EXISTS task_reassignments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  from_user_id UUID NOT NULL REFERENCES users(id),
  to_user_id   UUID NOT NULL REFERENCES users(id),
  reason       TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABEL task_supports (FR-022, BR-002)
-- ============================================================
CREATE TABLE IF NOT EXISTS task_supports (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id        UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  needed_from_id UUID NOT NULL REFERENCES users(id),
  description    TEXT NOT NULL,
  status         support_status NOT NULL DEFAULT 'diminta'
);

-- ============================================================
-- TABEL task_comments (task detail / komentar reviewer)
-- ============================================================
CREATE TABLE IF NOT EXISTS task_comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id),
  body       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABEL evidence_requirements + task_evidence (FR-023, FR-024, BR-020)
-- ============================================================
CREATE TABLE IF NOT EXISTS evidence_requirements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  mandatory   BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS task_evidence (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requirement_id UUID NOT NULL REFERENCES evidence_requirements(id) ON DELETE CASCADE,
  uploader_id    UUID NOT NULL REFERENCES users(id),
  file_or_link   TEXT NOT NULL,
  uploaded_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABEL task_reminders (BR-030..BR-037, FR-058)
-- Satu baris per checkpoint per versi deadline (idempoten)
-- ============================================================
CREATE TABLE IF NOT EXISTS task_reminders (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id        UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  checkpoint_pct INT  NOT NULL CHECK (checkpoint_pct IN (50, 80, 90)),
  sent_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  response       TEXT,
  responded_at   TIMESTAMPTZ,
  -- Satu checkpoint per task (BR-037); kolom due_date_version menjamin idempotensi setelah perubahan deadline
  due_date_version TIMESTAMPTZ NOT NULL,
  UNIQUE (task_id, checkpoint_pct, due_date_version)
);

-- ============================================================
-- TABEL deadline_change_requests (FR-060..FR-064, BR-040..BR-042)
-- ============================================================
CREATE TABLE IF NOT EXISTS deadline_change_requests (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id),
  old_due_date TIMESTAMPTZ NOT NULL,
  new_due_date TIMESTAMPTZ NOT NULL,
  reason       TEXT NOT NULL,
  status       deadline_request_status NOT NULL DEFAULT 'Menunggu approval',
  approver_id  UUID REFERENCES users(id),
  decided_at   TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- TABEL notifications (FR-055, FR-080, BR-035)
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id  UUID REFERENCES tasks(id) ON DELETE SET NULL,
  type     TEXT NOT NULL,  -- contoh: 'reminder_80', 'task_assigned', 'review_approved'
  sent_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at  TIMESTAMPTZ
);

-- ============================================================
-- TABEL audit_logs (FR-092, NFR-003, PR-4)
-- Immutable — tidak dapat diubah/dihapus dari aplikasi
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id),
  action     TEXT NOT NULL,
  object     TEXT NOT NULL,   -- mis. 'tasks:uuid', 'users:uuid'
  old_value  TEXT,
  new_value  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- SEED: 6 Role resmi (tidak boleh diubah tanpa Change Request)
-- ============================================================
INSERT INTO roles (name, level) VALUES
  ('Spectator',  1),
  ('Staff/PIC',  2),
  ('Manager',    3),
  ('SM',         4),
  ('GM',         5),
  ('Super Admin',6)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- SEED: Struktur organisasi (FR-006, D-011)
-- 1 Department → 2 Unit → 7 Section
-- ============================================================
INSERT INTO org_units (id, parent_id, name, type) VALUES
  (1, NULL, 'Department of Accounting',    'department'),
  (2, 1,    'Unit Accounting',             'unit'),
  (3, 1,    'Unit Reporting',              'unit'),
  -- 5 section di bawah Unit Accounting (D-011)
  (4, 2,    'Section Cost Accounting',     'section'),
  (5, 2,    'Section General Accounting',  'section'),
  (6, 2,    'Section Tax',                 'section'),
  (7, 2,    'Section Fixed Asset',         'section'),
  (8, 2,    'Section AP/AR',               'section'),
  -- 2 section di bawah Unit Reporting (D-011)
  (9, 3,    'Section Management Report',   'section'),
  (10, 3,   'Section External Report',     'section')
ON CONFLICT (id) DO NOTHING;
