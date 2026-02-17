-- Migration 00012: Levy Management (Phase 2)
-- Tables: levy_schedules, levy_periods, levy_items, payments, payment_allocations
-- Column definitions sourced from docs/features/03-levy-management.md (feature spec is source of truth)
-- NOTE: All tables created first, then indexes, then RLS, then policies, then trigger functions, then triggers
-- (to avoid forward-reference issues and respect the Phase 1 lessons learned)

-- ============================================================
-- 1. CREATE ALL TABLES
-- ============================================================

-- Levy Schedules (per scheme, per budget year)
CREATE TABLE public.levy_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES public.schemes(id) ON DELETE CASCADE,

  -- Budget year
  budget_year_start DATE NOT NULL,
  budget_year_end DATE NOT NULL,

  -- Fund totals (from AGM-approved budget)
  admin_fund_total NUMERIC(10,2) NOT NULL,
  capital_works_fund_total NUMERIC(10,2) NOT NULL,

  -- Schedule configuration
  frequency VARCHAR(20) NOT NULL,
  periods_per_year INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,

  -- Metadata
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_admin_fund CHECK (admin_fund_total > 0),
  CONSTRAINT valid_capital_works_fund CHECK (capital_works_fund_total >= 0),
  CONSTRAINT valid_frequency CHECK (frequency IN ('annual', 'quarterly', 'monthly', 'custom')),
  CONSTRAINT valid_periods_per_year CHECK (periods_per_year IN (1, 2, 4, 12)),
  CONSTRAINT valid_budget_year_range CHECK (budget_year_end > budget_year_start),
  CONSTRAINT unique_schedule_per_scheme_year UNIQUE(scheme_id, budget_year_start)
);

-- Levy Periods (individual periods within a schedule, e.g. Q1, Q2, Q3, Q4)
CREATE TABLE public.levy_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  levy_schedule_id UUID NOT NULL REFERENCES public.levy_schedules(id) ON DELETE CASCADE,

  -- Period identification
  period_number INTEGER NOT NULL,
  period_name VARCHAR(50) NOT NULL,

  -- Date range
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  due_date DATE NOT NULL,

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'pending',

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_period_status CHECK (status IN ('pending', 'active', 'closed')),
  CONSTRAINT valid_period_range CHECK (period_end >= period_start),
  CONSTRAINT unique_period_per_schedule UNIQUE(levy_schedule_id, period_number)
);

-- Levy Items (per lot, per period)
CREATE TABLE public.levy_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES public.schemes(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES public.lots(id) ON DELETE CASCADE,
  levy_period_id UUID NOT NULL REFERENCES public.levy_periods(id) ON DELETE CASCADE,

  -- Levy type
  levy_type VARCHAR(20) NOT NULL DEFAULT 'regular',

  -- Levy amounts
  admin_levy_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  capital_levy_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  special_levy_amount NUMERIC(10,2) DEFAULT 0,

  -- Generated: total = admin + capital + special
  total_levy_amount NUMERIC(10,2) GENERATED ALWAYS AS (
    admin_levy_amount + capital_levy_amount + COALESCE(special_levy_amount, 0)
  ) STORED,

  -- Due date and status
  due_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',

  -- Payment tracking
  amount_paid NUMERIC(10,2) NOT NULL DEFAULT 0,

  -- Generated: balance = total - paid
  -- NOTE: Cannot reference another generated column (total_levy_amount), so we expand the formula
  balance NUMERIC(10,2) GENERATED ALWAYS AS (
    (admin_levy_amount + capital_levy_amount + COALESCE(special_levy_amount, 0)) - COALESCE(amount_paid, 0)
  ) STORED,

  -- Notice tracking
  notice_generated_at TIMESTAMPTZ,
  notice_sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_levy_type CHECK (levy_type IN ('regular', 'special', 'interest')),
  CONSTRAINT valid_levy_item_status CHECK (status IN ('pending', 'sent', 'paid', 'partial', 'overdue')),
  CONSTRAINT unique_lot_per_period UNIQUE(lot_id, levy_period_id)
);

-- Payments (standalone for Phase 2; will integrate with transactions table in Phase 3)
CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES public.schemes(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES public.lots(id) ON DELETE CASCADE,

  -- Payment details
  amount NUMERIC(10,2) NOT NULL,
  payment_date DATE NOT NULL,
  payment_method VARCHAR(50) NOT NULL,
  reference VARCHAR(100),
  notes TEXT,

  -- Metadata
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_payment_amount CHECK (amount > 0),
  CONSTRAINT valid_payment_method CHECK (payment_method IN ('bank_transfer', 'cheque', 'cash', 'direct_debit', 'bpay'))
);

-- Payment Allocations (junction: payments <-> levy_items)
CREATE TABLE public.payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  levy_item_id UUID NOT NULL REFERENCES public.levy_items(id) ON DELETE CASCADE,

  -- Allocation
  allocated_amount NUMERIC(10,2) NOT NULL,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_allocated_amount CHECK (allocated_amount > 0)
);

-- ============================================================
-- 2. INDEXES
-- ============================================================

-- Levy schedules indexes
CREATE INDEX idx_levy_schedules_scheme ON public.levy_schedules(scheme_id);
CREATE INDEX idx_levy_schedules_active ON public.levy_schedules(scheme_id) WHERE active = true;

-- Levy periods indexes
CREATE INDEX idx_levy_periods_schedule ON public.levy_periods(levy_schedule_id);
CREATE INDEX idx_levy_periods_status ON public.levy_periods(status);
CREATE INDEX idx_levy_periods_due_date ON public.levy_periods(due_date);

-- Levy items indexes
CREATE INDEX idx_levy_items_scheme ON public.levy_items(scheme_id);
CREATE INDEX idx_levy_items_lot ON public.levy_items(lot_id);
CREATE INDEX idx_levy_items_period ON public.levy_items(levy_period_id);
CREATE INDEX idx_levy_items_status ON public.levy_items(status);
CREATE INDEX idx_levy_items_due_date ON public.levy_items(due_date);
CREATE INDEX idx_levy_items_lot_status ON public.levy_items(lot_id, status);

-- Payments indexes
CREATE INDEX idx_payments_scheme ON public.payments(scheme_id);
CREATE INDEX idx_payments_lot ON public.payments(lot_id);
CREATE INDEX idx_payments_date ON public.payments(payment_date);

-- Payment allocations indexes
CREATE INDEX idx_payment_allocations_payment ON public.payment_allocations(payment_id);
CREATE INDEX idx_payment_allocations_levy_item ON public.payment_allocations(levy_item_id);

-- ============================================================
-- 3. ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE public.levy_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.levy_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.levy_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_allocations ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. RLS POLICIES
-- ============================================================

-- levy_schedules: scheme_id -> schemes.organisation_id = user_organisation_id()
CREATE POLICY "levy_schedules_select" ON public.levy_schedules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.schemes
      WHERE schemes.id = levy_schedules.scheme_id
      AND schemes.organisation_id = public.user_organisation_id()
    )
  );

CREATE POLICY "levy_schedules_insert" ON public.levy_schedules
  FOR INSERT WITH CHECK (
    public.user_organisation_id() IS NOT NULL
  );

CREATE POLICY "levy_schedules_update" ON public.levy_schedules
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.schemes
      WHERE schemes.id = levy_schedules.scheme_id
      AND schemes.organisation_id = public.user_organisation_id()
    )
  );

CREATE POLICY "levy_schedules_delete" ON public.levy_schedules
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.schemes
      WHERE schemes.id = levy_schedules.scheme_id
      AND schemes.organisation_id = public.user_organisation_id()
    )
  );

-- levy_periods: chain through levy_schedules -> scheme_id -> schemes.organisation_id
CREATE POLICY "levy_periods_select" ON public.levy_periods
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.levy_schedules
      JOIN public.schemes ON schemes.id = levy_schedules.scheme_id
      WHERE levy_schedules.id = levy_periods.levy_schedule_id
      AND schemes.organisation_id = public.user_organisation_id()
    )
  );

CREATE POLICY "levy_periods_insert" ON public.levy_periods
  FOR INSERT WITH CHECK (
    public.user_organisation_id() IS NOT NULL
  );

CREATE POLICY "levy_periods_update" ON public.levy_periods
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.levy_schedules
      JOIN public.schemes ON schemes.id = levy_schedules.scheme_id
      WHERE levy_schedules.id = levy_periods.levy_schedule_id
      AND schemes.organisation_id = public.user_organisation_id()
    )
  );

CREATE POLICY "levy_periods_delete" ON public.levy_periods
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.levy_schedules
      JOIN public.schemes ON schemes.id = levy_schedules.scheme_id
      WHERE levy_schedules.id = levy_periods.levy_schedule_id
      AND schemes.organisation_id = public.user_organisation_id()
    )
  );

-- levy_items: scheme_id -> schemes.organisation_id = user_organisation_id()
CREATE POLICY "levy_items_select" ON public.levy_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.schemes
      WHERE schemes.id = levy_items.scheme_id
      AND schemes.organisation_id = public.user_organisation_id()
    )
  );

CREATE POLICY "levy_items_insert" ON public.levy_items
  FOR INSERT WITH CHECK (
    public.user_organisation_id() IS NOT NULL
  );

CREATE POLICY "levy_items_update" ON public.levy_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.schemes
      WHERE schemes.id = levy_items.scheme_id
      AND schemes.organisation_id = public.user_organisation_id()
    )
  );

CREATE POLICY "levy_items_delete" ON public.levy_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.schemes
      WHERE schemes.id = levy_items.scheme_id
      AND schemes.organisation_id = public.user_organisation_id()
    )
  );

-- payments: scheme_id -> schemes.organisation_id = user_organisation_id()
CREATE POLICY "payments_select" ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.schemes
      WHERE schemes.id = payments.scheme_id
      AND schemes.organisation_id = public.user_organisation_id()
    )
  );

CREATE POLICY "payments_insert" ON public.payments
  FOR INSERT WITH CHECK (
    public.user_organisation_id() IS NOT NULL
  );

CREATE POLICY "payments_update" ON public.payments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.schemes
      WHERE schemes.id = payments.scheme_id
      AND schemes.organisation_id = public.user_organisation_id()
    )
  );

CREATE POLICY "payments_delete" ON public.payments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.schemes
      WHERE schemes.id = payments.scheme_id
      AND schemes.organisation_id = public.user_organisation_id()
    )
  );

-- payment_allocations: chain through payments -> scheme_id -> schemes.organisation_id
CREATE POLICY "payment_allocations_select" ON public.payment_allocations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.payments
      JOIN public.schemes ON schemes.id = payments.scheme_id
      WHERE payments.id = payment_allocations.payment_id
      AND schemes.organisation_id = public.user_organisation_id()
    )
  );

CREATE POLICY "payment_allocations_insert" ON public.payment_allocations
  FOR INSERT WITH CHECK (
    public.user_organisation_id() IS NOT NULL
  );

CREATE POLICY "payment_allocations_update" ON public.payment_allocations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.payments
      JOIN public.schemes ON schemes.id = payments.scheme_id
      WHERE payments.id = payment_allocations.payment_id
      AND schemes.organisation_id = public.user_organisation_id()
    )
  );

CREATE POLICY "payment_allocations_delete" ON public.payment_allocations
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.payments
      JOIN public.schemes ON schemes.id = payments.scheme_id
      WHERE payments.id = payment_allocations.payment_id
      AND schemes.organisation_id = public.user_organisation_id()
    )
  );

-- ============================================================
-- 5. TRIGGER FUNCTIONS
-- ============================================================

-- Trigger function: update levy_item amount_paid and status when a payment allocation is inserted
-- Must be SECURITY DEFINER because it UPDATEs an RLS-protected table (levy_items)
CREATE OR REPLACE FUNCTION public.update_levy_item_on_payment_allocation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_total_paid NUMERIC(10,2);
  v_total_levy NUMERIC(10,2);
  v_payment_date DATE;
BEGIN
  -- Calculate total paid from all allocations for this levy item
  SELECT COALESCE(SUM(allocated_amount), 0)
  INTO v_total_paid
  FROM public.payment_allocations
  WHERE levy_item_id = NEW.levy_item_id;

  -- Get the total levy amount (expanded from generated column formula)
  SELECT (admin_levy_amount + capital_levy_amount + COALESCE(special_levy_amount, 0))
  INTO v_total_levy
  FROM public.levy_items
  WHERE id = NEW.levy_item_id;

  -- Get payment date for paid_at
  SELECT payment_date
  INTO v_payment_date
  FROM public.payments
  WHERE id = NEW.payment_id;

  -- Update the levy item
  UPDATE public.levy_items
  SET
    amount_paid = v_total_paid,
    status = CASE
      WHEN v_total_paid >= v_total_levy THEN 'paid'
      WHEN v_total_paid > 0 THEN 'partial'
      ELSE status
    END,
    paid_at = CASE
      WHEN v_total_paid >= v_total_levy THEN v_payment_date::TIMESTAMPTZ
      ELSE paid_at
    END
  WHERE id = NEW.levy_item_id;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 6. TRIGGERS
-- ============================================================

-- updated_at triggers (reuse existing function)
CREATE TRIGGER set_levy_schedules_updated_at
  BEFORE UPDATE ON public.levy_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_levy_items_updated_at
  BEFORE UPDATE ON public.levy_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit log triggers (reuse existing function)
CREATE TRIGGER levy_schedules_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON public.levy_schedules
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER levy_periods_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON public.levy_periods
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER levy_items_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON public.levy_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER payments_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER payment_allocations_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON public.payment_allocations
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

-- Payment allocation trigger: update levy_item paid amount and status
CREATE TRIGGER update_levy_item_on_allocation
  AFTER INSERT ON public.payment_allocations
  FOR EACH ROW EXECUTE FUNCTION public.update_levy_item_on_payment_allocation();
