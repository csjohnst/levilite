-- Migration 00003: Schemes and Lots tables
-- Column definitions sourced from docs/features/02-scheme-lot-register.md (feature spec is source of truth)

-- Schemes table
CREATE TABLE public.schemes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id),

  -- Basic identification
  scheme_number VARCHAR(20) NOT NULL UNIQUE,
  scheme_name VARCHAR(255) NOT NULL,
  scheme_type VARCHAR(50) NOT NULL DEFAULT 'strata',

  -- Address
  street_address VARCHAR(255) NOT NULL,
  suburb VARCHAR(100) NOT NULL,
  state VARCHAR(3) NOT NULL DEFAULT 'WA',
  postcode VARCHAR(4) NOT NULL,

  -- Legal & financial
  abn VARCHAR(11),
  acn VARCHAR(9),
  registered_name VARCHAR(255),

  -- Financial year
  financial_year_end_month SMALLINT NOT NULL DEFAULT 6,
  financial_year_end_day SMALLINT NOT NULL DEFAULT 30,

  -- Levy schedule
  levy_frequency VARCHAR(20) NOT NULL DEFAULT 'quarterly',
  levy_due_day SMALLINT NOT NULL DEFAULT 1,

  -- Common property details
  total_lot_entitlement INTEGER NOT NULL DEFAULT 0,
  common_property_area_sqm DECIMAL(10,2),

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Constraints
  CONSTRAINT valid_scheme_number CHECK (scheme_number ~ '^SP\s?\d{4,6}$'),
  CONSTRAINT valid_state CHECK (state IN ('WA','NSW','VIC','QLD','SA','TAS','NT','ACT')),
  CONSTRAINT valid_fy_month CHECK (financial_year_end_month BETWEEN 1 AND 12),
  CONSTRAINT valid_fy_day CHECK (financial_year_end_day BETWEEN 1 AND 31),
  CONSTRAINT valid_levy_frequency CHECK (levy_frequency IN ('monthly','quarterly','annual','custom')),
  CONSTRAINT valid_status CHECK (status IN ('active','inactive','archived'))
);

-- Indexes
CREATE INDEX idx_schemes_organisation ON public.schemes(organisation_id);
CREATE INDEX idx_schemes_status ON public.schemes(status);
CREATE INDEX idx_schemes_state ON public.schemes(state);
CREATE INDEX idx_schemes_search ON public.schemes USING gin(
  to_tsvector('english',
    coalesce(scheme_name, '') || ' ' ||
    coalesce(scheme_number, '') || ' ' ||
    coalesce(street_address, '') || ' ' ||
    coalesce(suburb, '')
  )
);

-- Row-level security
ALTER TABLE public.schemes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.schemes
  FOR ALL USING (organisation_id = auth.user_organisation_id());

-- Triggers
CREATE TRIGGER set_schemes_updated_at
  BEFORE UPDATE ON public.schemes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER schemes_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON public.schemes
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_log_trigger();

-- ============================================================
-- Lots table
-- ============================================================

CREATE TABLE public.lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES public.schemes(id) ON DELETE CASCADE,

  -- Lot identification
  lot_number VARCHAR(20) NOT NULL,
  unit_number VARCHAR(20),
  street_address VARCHAR(255),

  -- Lot type
  lot_type VARCHAR(50) NOT NULL DEFAULT 'residential',

  -- Entitlements
  unit_entitlement INTEGER NOT NULL,
  voting_entitlement INTEGER,

  -- Physical details
  floor_area_sqm DECIMAL(8,2),
  balcony_area_sqm DECIMAL(8,2),
  total_area_sqm DECIMAL(8,2),
  bedrooms SMALLINT,
  bathrooms DECIMAL(2,1),
  car_bays SMALLINT,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  occupancy_status VARCHAR(20) DEFAULT 'owner-occupied',

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Constraints
  CONSTRAINT unique_lot_per_scheme UNIQUE(scheme_id, lot_number),
  CONSTRAINT valid_lot_type CHECK (lot_type IN ('residential','commercial','parking','storage','other')),
  CONSTRAINT valid_lot_status CHECK (status IN ('active','inactive','sold')),
  CONSTRAINT valid_occupancy CHECK (occupancy_status IN ('owner-occupied','tenanted','vacant','unknown')),
  CONSTRAINT positive_entitlement CHECK (unit_entitlement > 0)
);

-- Indexes
CREATE INDEX idx_lots_scheme ON public.lots(scheme_id);
CREATE INDEX idx_lots_status ON public.lots(status);
CREATE INDEX idx_lots_type ON public.lots(lot_type);
CREATE INDEX idx_lots_lot_number ON public.lots(lot_number);

-- Row-level security
ALTER TABLE public.lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.lots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.schemes
      WHERE schemes.id = lots.scheme_id
      AND schemes.organisation_id = auth.user_organisation_id()
    )
  );

-- Triggers
CREATE TRIGGER set_lots_updated_at
  BEFORE UPDATE ON public.lots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER lots_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON public.lots
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_log_trigger();

-- Function: recalculate scheme total_lot_entitlement when lots change
CREATE OR REPLACE FUNCTION public.update_scheme_total_entitlement()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.schemes
  SET total_lot_entitlement = (
    SELECT COALESCE(SUM(unit_entitlement), 0)
    FROM public.lots
    WHERE scheme_id = COALESCE(NEW.scheme_id, OLD.scheme_id)
    AND status = 'active'
  )
  WHERE id = COALESCE(NEW.scheme_id, OLD.scheme_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_total_entitlement
  AFTER INSERT OR UPDATE OR DELETE ON public.lots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_scheme_total_entitlement();
