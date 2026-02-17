-- Migration 00002: Core tables (organisations, organisation_users)

-- Organisations table
CREATE TABLE public.organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  abn VARCHAR(11),
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(255),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organisation users (junction table linking auth.users to organisations)
CREATE TABLE public.organisation_users (
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('manager', 'admin', 'auditor')),
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ,
  PRIMARY KEY (organisation_id, user_id)
);

-- Indexes
CREATE INDEX idx_organisation_users_user ON public.organisation_users(user_id);
CREATE INDEX idx_organisation_users_org ON public.organisation_users(organisation_id);

-- Row-level security
ALTER TABLE public.organisations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organisation_users ENABLE ROW LEVEL SECURITY;

-- Policies: users can see their own organisation
CREATE POLICY "tenant_isolation" ON public.organisations
  FOR ALL USING (id = auth.user_organisation_id());

-- Policies: users can see members of their organisation
CREATE POLICY "tenant_isolation" ON public.organisation_users
  FOR ALL USING (organisation_id = auth.user_organisation_id());

-- Trigger: auto-update updated_at on organisations
CREATE TRIGGER set_organisations_updated_at
  BEFORE UPDATE ON public.organisations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
