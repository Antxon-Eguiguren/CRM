-- CRM PoC: clients, contacts, projects with row-level security.
-- Run via Supabase SQL editor, or `supabase db push` if using the Supabase CLI.

-- Clients
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cif TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_clients_user ON clients(user_id);
CREATE INDEX idx_clients_name ON clients(user_id, name);

-- Contacts
CREATE TABLE contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contacts_client ON contacts(client_id);
CREATE INDEX idx_contacts_user ON contacts(user_id);

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_number TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned', 'in_progress', 'completed')),
  start_date DATE,
  end_date DATE,
  amount NUMERIC(12,2) DEFAULT 0,
  payment_done BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_client ON projects(client_id);
CREATE INDEX idx_projects_user ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(user_id, status);

-- Row Level Security (single-user but future-proof)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own clients"
  ON clients FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own contacts"
  ON contacts FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own projects"
  ON projects FOR ALL USING (auth.uid() = user_id);
