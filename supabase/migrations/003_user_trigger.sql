-- T-003 — Migration 003: Trigger user baru otomatis Spectator
-- FR-002, BR-061 — Saat auth.users baru dibuat, profil dengan role Spectator otomatis terbentuk.

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  spectator_role_id INT;
  default_unit_id   INT;
BEGIN
  -- Ambil ID role Spectator
  SELECT id INTO spectator_role_id FROM roles WHERE name = 'Spectator' LIMIT 1;

  -- Ambil ID unit default (Department of Accounting, type = department)
  SELECT id INTO default_unit_id FROM org_units WHERE type = 'department' LIMIT 1;

  INSERT INTO users (id, name, email, role_id, org_unit_id, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    spectator_role_id,
    default_unit_id,
    'aktif'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Trigger aktif saat user baru dibuat di Supabase Auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
