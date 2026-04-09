-- Clients: company name; origin → source; drop client_type
ALTER TABLE clients ADD COLUMN IF NOT EXISTS company_name TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'client_origin'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'source'
  ) THEN
    ALTER TABLE clients RENAME COLUMN client_origin TO source;
  END IF;
END $$;

ALTER TABLE clients DROP COLUMN IF EXISTS client_type;

-- Contacts: optional client; phone → personal_phone; company, work phone, position
ALTER TABLE contacts ALTER COLUMN client_id DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'phone'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'contacts' AND column_name = 'personal_phone'
  ) THEN
    ALTER TABLE contacts RENAME COLUMN phone TO personal_phone;
  END IF;
END $$;

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS work_phone TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS position TEXT;

-- Projects: project_number → reference; amount → budget; invoiced; status includes proposal
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'project_number'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'reference'
  ) THEN
    ALTER TABLE projects RENAME COLUMN project_number TO reference;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'amount'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'budget'
  ) THEN
    ALTER TABLE projects RENAME COLUMN amount TO budget;
  END IF;
END $$;

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_status_check;
ALTER TABLE projects ADD CONSTRAINT projects_status_check
  CHECK (status IN ('proposal', 'planned', 'in_progress', 'completed'));

ALTER TABLE projects ADD COLUMN IF NOT EXISTS invoiced NUMERIC(12, 2);
UPDATE projects SET invoiced = 0 WHERE invoiced IS NULL;
ALTER TABLE projects ALTER COLUMN invoiced SET NOT NULL;
ALTER TABLE projects ALTER COLUMN invoiced SET DEFAULT 0;

UPDATE projects
SET project_type = NULL
WHERE project_type IS NOT NULL
  AND project_type NOT IN (
    'consultancy',
    'team_coaching',
    'coaching',
    'recruitment',
    'assessment',
    'training'
  );

ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_project_type_check;
ALTER TABLE projects ADD CONSTRAINT projects_project_type_check
  CHECK (
    project_type IS NULL
    OR project_type IN (
      'consultancy',
      'team_coaching',
      'coaching',
      'recruitment',
      'assessment',
      'training'
    )
  );
