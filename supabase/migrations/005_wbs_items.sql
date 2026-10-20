-- FR-032, BR-011, OQ-17 — Migration 005: WBS Items table
-- Hierarki WBS maksimal 2 level di bawah task; bobot leaf berjumlah 100%
-- Item WBS level terendah memiliki bobot sama rata secara default.

CREATE TABLE IF NOT EXISTS wbs_items (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  parent_id  UUID REFERENCES wbs_items(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  -- Bobot dalam persen (0–100), jumlah sibling harus = 100%
  weight     NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_done    BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index untuk query cepat per task
CREATE INDEX IF NOT EXISTS wbs_items_task_id_idx ON wbs_items(task_id);
CREATE INDEX IF NOT EXISTS wbs_items_parent_id_idx ON wbs_items(parent_id);

-- RLS untuk wbs_items — akses sesuai akses task
ALTER TABLE wbs_items ENABLE ROW LEVEL SECURITY;

-- Baca: siapapun yang bisa baca task dapat baca wbs_items-nya
CREATE POLICY "wbs_items_read" ON wbs_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = wbs_items.task_id
        AND (
          get_my_role_level() >= 5
          OR (get_my_role_level() = 4 AND t.org_unit_id IN (
                SELECT id FROM org_units
                WHERE id = get_my_org_unit_id()
                   OR parent_id = get_my_org_unit_id()
              ))
          OR t.org_unit_id = get_my_org_unit_id()
          OR t.owner_id = auth.uid()
          OR t.reviewer_id = auth.uid()
        )
    )
  );

-- Tulis: PIC task (owner), Manager/SM/GM/Super Admin dari unit yang sama
CREATE POLICY "wbs_items_write" ON wbs_items
  FOR ALL USING (
    get_my_role_level() >= 2
    AND EXISTS (
      SELECT 1 FROM tasks t
      WHERE t.id = wbs_items.task_id
        AND (
          t.owner_id = auth.uid()
          OR get_my_role_level() >= 3
        )
    )
  );

-- Trigger: update updated_at otomatis
CREATE OR REPLACE FUNCTION update_wbs_items_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER wbs_items_updated_at
  BEFORE UPDATE ON wbs_items
  FOR EACH ROW EXECUTE FUNCTION update_wbs_items_updated_at();
