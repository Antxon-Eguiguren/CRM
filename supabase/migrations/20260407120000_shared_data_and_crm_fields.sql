-- Shared workspace: any authenticated user can read/write all rows (not per-user isolation).
DROP POLICY IF EXISTS "Users manage own clients" ON clients;
DROP POLICY IF EXISTS "Users manage own contacts" ON contacts;
DROP POLICY IF EXISTS "Users manage own projects" ON projects;

CREATE POLICY "Authenticated users full access clients"
  ON clients FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access contacts"
  ON contacts FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users full access projects"
  ON projects FOR ALL
  USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- Clients: comments, classification, origin
ALTER TABLE clients ADD COLUMN IF NOT EXISTS comments TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_type TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_origin TEXT;

-- Projects: display name and type
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_name TEXT NOT NULL DEFAULT '';
ALTER TABLE projects ADD COLUMN IF NOT EXISTS project_type TEXT;

-- Projects: replace boolean payment_done with numeric paid (amount received for this project)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS paid NUMERIC(12, 2);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'projects'
      AND column_name = 'payment_done'
  ) THEN
    UPDATE projects
    SET paid = CASE
      WHEN payment_done IS TRUE THEN COALESCE(amount, 0)
      ELSE 0
    END
    WHERE paid IS NULL;

    ALTER TABLE projects DROP COLUMN payment_done;
  END IF;
END $$;

UPDATE projects SET paid = 0 WHERE paid IS NULL;
ALTER TABLE projects ALTER COLUMN paid SET NOT NULL;
ALTER TABLE projects ALTER COLUMN paid SET DEFAULT 0;
