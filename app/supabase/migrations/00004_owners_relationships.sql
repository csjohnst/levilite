-- Migration 00004: Owners, lot_ownerships, committee_members, tenants
-- Column definitions sourced from docs/features/02-scheme-lot-register.md
-- NOTE: All tables are created first, then RLS policies + triggers applied
-- (to avoid forward-reference issues with lot_ownerships in owners RLS policy)

-- ============================================================
-- 1. CREATE ALL TABLES
-- ============================================================

-- Owners table
CREATE TABLE public.owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Personal details
  title VARCHAR(10),
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  preferred_name VARCHAR(100),

  -- Contact details
  email VARCHAR(255),
  email_secondary VARCHAR(255),
  phone_mobile VARCHAR(20),
  phone_home VARCHAR(20),
  phone_work VARCHAR(20),

  -- Postal address
  postal_address_line1 VARCHAR(255),
  postal_address_line2 VARCHAR(255),
  postal_suburb VARCHAR(100),
  postal_state VARCHAR(3),
  postal_postcode VARCHAR(4),
  postal_country VARCHAR(100) DEFAULT 'Australia',

  -- Legal/tax
  abn VARCHAR(11),
  company_name VARCHAR(255),

  -- Correspondence preferences
  correspondence_method VARCHAR(20) DEFAULT 'email',
  correspondence_language VARCHAR(10) DEFAULT 'en',

  -- Portal access
  portal_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  portal_invite_sent_at TIMESTAMPTZ,
  portal_invite_accepted_at TIMESTAMPTZ,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Constraints
  CONSTRAINT valid_correspondence_method CHECK (correspondence_method IN ('email','postal','both')),
  CONSTRAINT valid_owner_status CHECK (status IN ('active','inactive','deceased')),
  CONSTRAINT email_or_postal_required CHECK (
    email IS NOT NULL OR postal_address_line1 IS NOT NULL
  )
);

-- Lot ownerships (junction table: lots <-> owners)
CREATE TABLE public.lot_ownerships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id UUID NOT NULL REFERENCES public.lots(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,

  -- Ownership details
  ownership_type VARCHAR(50) NOT NULL DEFAULT 'sole',
  ownership_percentage DECIMAL(5,2) DEFAULT 100.00,

  -- Dates
  ownership_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ownership_end_date DATE,

  -- Primary contact for this lot (for joint ownership)
  is_primary_contact BOOLEAN DEFAULT TRUE,

  -- Correspondence for this lot
  receive_levy_notices BOOLEAN DEFAULT TRUE,
  receive_meeting_notices BOOLEAN DEFAULT TRUE,
  receive_maintenance_updates BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_current_lot_owner UNIQUE(lot_id, owner_id, ownership_end_date)
    DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT valid_ownership_type CHECK (ownership_type IN ('sole','joint-tenants','tenants-in-common')),
  CONSTRAINT valid_ownership_percentage CHECK (ownership_percentage > 0 AND ownership_percentage <= 100),
  CONSTRAINT valid_date_range CHECK (
    ownership_end_date IS NULL OR ownership_end_date >= ownership_start_date
  )
);

-- Committee members
CREATE TABLE public.committee_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES public.schemes(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE CASCADE,

  position TEXT NOT NULL CHECK (position IN ('chair','treasurer','secretary','member')),
  elected_at DATE NOT NULL,
  term_end_date DATE,
  is_active BOOLEAN DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_committee_appointment UNIQUE(scheme_id, owner_id, elected_at)
);

-- Tenants
CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id UUID NOT NULL REFERENCES public.lots(id) ON DELETE CASCADE,

  -- Personal details
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,

  -- Contact details
  email VARCHAR(255),
  phone_mobile VARCHAR(20),
  phone_work VARCHAR(20),

  -- Lease details
  lease_start_date DATE,
  lease_end_date DATE,
  lease_type VARCHAR(50),

  -- Emergency contact
  emergency_contact_name VARCHAR(200),
  emergency_contact_phone VARCHAR(20),
  emergency_contact_relationship VARCHAR(100),

  -- Pets (by-law compliance)
  has_pets BOOLEAN DEFAULT FALSE,
  pet_details TEXT,

  -- Vehicle (parking management)
  vehicle_make VARCHAR(100),
  vehicle_model VARCHAR(100),
  vehicle_rego VARCHAR(20),
  vehicle_color VARCHAR(50),

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'current',

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_tenant_status CHECK (status IN ('current','past','pending')),
  CONSTRAINT valid_lease_dates CHECK (
    lease_end_date IS NULL OR lease_end_date >= lease_start_date
  )
);

-- ============================================================
-- 2. INDEXES
-- ============================================================

-- Owners indexes
CREATE INDEX idx_owners_email ON public.owners(email) WHERE email IS NOT NULL;
CREATE INDEX idx_owners_status ON public.owners(status);
CREATE INDEX idx_owners_name ON public.owners(last_name, first_name);
CREATE INDEX idx_owners_search ON public.owners USING gin(
  to_tsvector('english',
    coalesce(first_name, '') || ' ' ||
    coalesce(last_name, '') || ' ' ||
    coalesce(email, '') || ' ' ||
    coalesce(company_name, '')
  )
);

-- Lot ownerships indexes
CREATE INDEX idx_lot_ownerships_lot ON public.lot_ownerships(lot_id);
CREATE INDEX idx_lot_ownerships_owner ON public.lot_ownerships(owner_id);
CREATE INDEX idx_lot_ownerships_current ON public.lot_ownerships(lot_id, owner_id)
  WHERE ownership_end_date IS NULL;

-- Committee members indexes
CREATE INDEX idx_committee_members_scheme ON public.committee_members(scheme_id);
CREATE INDEX idx_committee_members_owner ON public.committee_members(owner_id);
CREATE INDEX idx_committee_members_active ON public.committee_members(scheme_id) WHERE is_active = TRUE;

-- Tenants indexes
CREATE INDEX idx_tenants_lot ON public.tenants(lot_id);
CREATE INDEX idx_tenants_status ON public.tenants(status);
CREATE INDEX idx_tenants_current ON public.tenants(lot_id) WHERE status = 'current';

-- ============================================================
-- 3. RLS POLICIES (all tables exist now, safe to cross-reference)
-- ============================================================

ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lot_ownerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.committee_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- Owners: split per-operation so INSERT works before lot_ownerships exist
-- created_by = auth.uid() allows .insert().select() and editing before lot assignment
CREATE POLICY "owners_select" ON public.owners
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lot_ownerships
      JOIN public.lots ON lots.id = lot_ownerships.lot_id
      JOIN public.schemes ON schemes.id = lots.scheme_id
      WHERE lot_ownerships.owner_id = owners.id
      AND schemes.organisation_id = public.user_organisation_id()
    ) OR
    portal_user_id = auth.uid() OR
    created_by = auth.uid()
  );

CREATE POLICY "owners_insert" ON public.owners
  FOR INSERT WITH CHECK (
    public.user_organisation_id() IS NOT NULL
  );

CREATE POLICY "owners_update" ON public.owners
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.lot_ownerships
      JOIN public.lots ON lots.id = lot_ownerships.lot_id
      JOIN public.schemes ON schemes.id = lots.scheme_id
      WHERE lot_ownerships.owner_id = owners.id
      AND schemes.organisation_id = public.user_organisation_id()
    ) OR
    portal_user_id = auth.uid() OR
    created_by = auth.uid()
  );

CREATE POLICY "owners_delete" ON public.owners
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.lot_ownerships
      JOIN public.lots ON lots.id = lot_ownerships.lot_id
      JOIN public.schemes ON schemes.id = lots.scheme_id
      WHERE lot_ownerships.owner_id = owners.id
      AND schemes.organisation_id = public.user_organisation_id()
    )
  );

-- Lot ownerships: staff via org chain (no owners reference to avoid RLS recursion)
CREATE POLICY "tenant_isolation" ON public.lot_ownerships
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.lots
      JOIN public.schemes ON schemes.id = lots.scheme_id
      WHERE lots.id = lot_ownerships.lot_id
      AND schemes.organisation_id = public.user_organisation_id()
    )
  );

-- Committee members: via scheme → organisation
CREATE POLICY "tenant_isolation" ON public.committee_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.schemes
      WHERE schemes.id = committee_members.scheme_id
      AND schemes.organisation_id = public.user_organisation_id()
    )
  );

-- Tenants: via lot → scheme → organisation
CREATE POLICY "tenant_isolation" ON public.tenants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.lots
      JOIN public.schemes ON schemes.id = lots.scheme_id
      WHERE lots.id = tenants.lot_id
      AND schemes.organisation_id = public.user_organisation_id()
    )
  );

-- ============================================================
-- 4. TRIGGERS
-- ============================================================

CREATE TRIGGER set_owners_updated_at
  BEFORE UPDATE ON public.owners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER owners_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON public.owners
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER set_lot_ownerships_updated_at
  BEFORE UPDATE ON public.lot_ownerships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER lot_ownerships_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON public.lot_ownerships
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER set_committee_members_updated_at
  BEFORE UPDATE ON public.committee_members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER committee_members_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON public.committee_members
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER set_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER tenants_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();
