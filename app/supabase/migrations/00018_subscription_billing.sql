-- Migration 00018: Subscription & Billing (Phase 7)
-- Tables: subscription_plans, subscriptions, usage_tracking, platform_invoices, payment_events
-- Helper functions: check_plan_limits(), enforce_lot_limit(), has_active_subscription(), can_access_feature()
-- Seed data: free + paid plans
-- Extends handle_new_user() to create trialing subscription for new orgs

-- ============================================================
-- 1. CREATE ALL TABLES
-- ============================================================

-- Subscription Plans (plan definitions)
CREATE TABLE public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code VARCHAR(50) NOT NULL UNIQUE,
  plan_name VARCHAR(100) NOT NULL,
  description TEXT,

  -- Limits (NULL = unlimited)
  max_lots INTEGER,
  max_schemes INTEGER,

  -- Feature flags
  features JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Stripe price IDs
  stripe_monthly_price_id VARCHAR(255),
  stripe_annual_price_id VARCHAR(255),

  -- Display
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Subscriptions (one per organisation)
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL UNIQUE REFERENCES public.organisations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id),

  -- Status
  status TEXT NOT NULL DEFAULT 'trialing',

  -- Billing
  billing_interval TEXT NOT NULL DEFAULT 'monthly',
  billed_lots_count INTEGER NOT NULL DEFAULT 0,

  -- Stripe references
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255) UNIQUE,

  -- Current billing period
  current_period_start DATE,
  current_period_end DATE,

  -- Trial
  trial_start_date DATE,
  trial_end_date DATE,

  -- Cancellation
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  canceled_at TIMESTAMPTZ,
  data_retention_expires_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_subscription_status CHECK (
    status IN ('trialing', 'active', 'past_due', 'canceled', 'paused', 'free')
  ),
  CONSTRAINT valid_billing_interval CHECK (
    billing_interval IN ('monthly', 'annual')
  )
);

-- Usage Tracking (lot/scheme count snapshots)
CREATE TABLE public.usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,

  -- Snapshot data
  tracked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_lots INTEGER NOT NULL DEFAULT 0,
  total_schemes INTEGER NOT NULL DEFAULT 0,
  total_users INTEGER NOT NULL DEFAULT 0,

  -- Snapshot type
  snapshot_type TEXT NOT NULL DEFAULT 'manual',

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_snapshot_type CHECK (
    snapshot_type IN ('daily', 'billing_cycle', 'manual')
  )
);

-- Platform Invoices (Stripe invoice mirrors)
CREATE TABLE public.platform_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,

  -- Stripe reference
  stripe_invoice_id VARCHAR(255) UNIQUE,
  invoice_number VARCHAR(100),

  -- Amounts (AUD)
  subtotal_ex_gst DECIMAL(12,2) NOT NULL DEFAULT 0,
  gst_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_inc_gst DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- Billing details
  lots_billed INTEGER NOT NULL DEFAULT 0,
  billing_interval TEXT NOT NULL DEFAULT 'monthly',

  -- Dates
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  paid_at TIMESTAMPTZ,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft',

  -- Stripe URLs
  stripe_invoice_url TEXT,
  stripe_pdf_url TEXT,

  -- Line items detail
  line_items JSONB,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_invoice_status CHECK (
    status IN ('draft', 'open', 'paid', 'void', 'uncollectible')
  ),
  CONSTRAINT valid_invoice_billing_interval CHECK (
    billing_interval IN ('monthly', 'annual')
  )
);

-- Payment Events (Stripe webhook event log)
CREATE TABLE public.payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES public.organisations(id) ON DELETE SET NULL,

  -- Event details
  event_type TEXT NOT NULL,
  stripe_event_id VARCHAR(255) NOT NULL UNIQUE,

  -- Payload
  payload JSONB NOT NULL DEFAULT '{}'::JSONB,

  -- Processing status
  processed BOOLEAN NOT NULL DEFAULT false,
  processed_at TIMESTAMPTZ,
  error_message TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. INDEXES
-- ============================================================

-- subscription_plans indexes
CREATE INDEX idx_subscription_plans_active ON public.subscription_plans(is_active, sort_order);
CREATE INDEX idx_subscription_plans_code ON public.subscription_plans(plan_code);

-- subscriptions indexes
CREATE INDEX idx_subscriptions_org ON public.subscriptions(organisation_id);
CREATE INDEX idx_subscriptions_plan ON public.subscriptions(plan_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_subscriptions_stripe_customer ON public.subscriptions(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL;

-- usage_tracking indexes
CREATE INDEX idx_usage_tracking_org ON public.usage_tracking(organisation_id);
CREATE INDEX idx_usage_tracking_subscription ON public.usage_tracking(subscription_id);
CREATE INDEX idx_usage_tracking_tracked_at ON public.usage_tracking(tracked_at DESC);

-- platform_invoices indexes
CREATE INDEX idx_platform_invoices_org ON public.platform_invoices(organisation_id);
CREATE INDEX idx_platform_invoices_subscription ON public.platform_invoices(subscription_id);
CREATE INDEX idx_platform_invoices_status ON public.platform_invoices(status);
CREATE INDEX idx_platform_invoices_date ON public.platform_invoices(invoice_date DESC);

-- payment_events indexes
CREATE INDEX idx_payment_events_org ON public.payment_events(organisation_id);
CREATE INDEX idx_payment_events_type ON public.payment_events(event_type);
CREATE INDEX idx_payment_events_processed ON public.payment_events(processed) WHERE processed = false;
CREATE INDEX idx_payment_events_stripe_event ON public.payment_events(stripe_event_id);

-- ============================================================
-- 3. ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. RLS POLICIES
-- ============================================================

-- subscription_plans: public read for all authenticated users
CREATE POLICY "subscription_plans_select" ON public.subscription_plans
  FOR SELECT TO authenticated
  USING (true);

-- subscriptions: org members can SELECT and UPDATE their own subscription
CREATE POLICY "subscriptions_select" ON public.subscriptions
  FOR SELECT USING (
    organisation_id = public.user_organisation_id()
  );

CREATE POLICY "subscriptions_update" ON public.subscriptions
  FOR UPDATE USING (
    organisation_id = public.user_organisation_id()
  );

-- usage_tracking: org members can SELECT, INSERT restricted to service role
CREATE POLICY "usage_tracking_select" ON public.usage_tracking
  FOR SELECT USING (
    organisation_id = public.user_organisation_id()
  );

-- platform_invoices: org members can SELECT
CREATE POLICY "platform_invoices_select" ON public.platform_invoices
  FOR SELECT USING (
    organisation_id = public.user_organisation_id()
  );

-- payment_events: org members can SELECT
CREATE POLICY "payment_events_select" ON public.payment_events
  FOR SELECT USING (
    organisation_id = public.user_organisation_id()
  );

-- ============================================================
-- 5. HELPER FUNCTIONS
-- ============================================================

-- check_plan_limits: checks if an org is within its lot limit
-- Returns TRUE if within limits, FALSE if at/over limit
CREATE OR REPLACE FUNCTION public.check_plan_limits(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_lots INTEGER;
  v_current_lots INTEGER;
  v_status TEXT;
BEGIN
  -- Get subscription status and plan limits
  SELECT s.status, sp.max_lots
  INTO v_status, v_max_lots
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.organisation_id = p_org_id;

  -- No subscription found: deny
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Only active/trialing/free subscriptions can add lots
  IF v_status NOT IN ('trialing', 'active', 'free') THEN
    RETURN FALSE;
  END IF;

  -- NULL max_lots = unlimited (paid plan)
  IF v_max_lots IS NULL THEN
    RETURN TRUE;
  END IF;

  -- Count current lots across all schemes for this org
  SELECT COUNT(*)
  INTO v_current_lots
  FROM public.lots l
  JOIN public.schemes s ON s.id = l.scheme_id
  WHERE s.organisation_id = p_org_id;

  -- Within limits if current count is strictly less than max
  RETURN v_current_lots < v_max_lots;
END;
$$;

-- enforce_lot_limit: BEFORE INSERT trigger on lots table
-- Blocks lot creation if the org is at its plan limit
CREATE OR REPLACE FUNCTION public.enforce_lot_limit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_max_lots INTEGER;
  v_current_lots INTEGER;
BEGIN
  -- Get the organisation_id from the scheme
  SELECT organisation_id INTO v_org_id
  FROM public.schemes
  WHERE id = NEW.scheme_id;

  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'Scheme not found';
  END IF;

  -- Check plan limits
  IF NOT public.check_plan_limits(v_org_id) THEN
    -- Get current count and limit for the error message
    SELECT sp.max_lots
    INTO v_max_lots
    FROM public.subscriptions s
    JOIN public.subscription_plans sp ON sp.id = s.plan_id
    WHERE s.organisation_id = v_org_id;

    SELECT COUNT(*)
    INTO v_current_lots
    FROM public.lots l
    JOIN public.schemes s ON s.id = l.scheme_id
    WHERE s.organisation_id = v_org_id;

    RAISE EXCEPTION 'Lot limit reached: %/%. Upgrade your plan.',
      v_current_lots, COALESCE(v_max_lots::TEXT, 'unlimited');
  END IF;

  RETURN NEW;
END;
$$;

-- has_active_subscription: checks if an org has an active subscription
CREATE OR REPLACE FUNCTION public.has_active_subscription(p_org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE organisation_id = p_org_id
    AND status IN ('trialing', 'active', 'free')
  );
$$;

-- can_access_feature: checks subscription status + plan feature flag
CREATE OR REPLACE FUNCTION public.can_access_feature(p_org_id UUID, p_feature TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_status TEXT;
  v_trial_end DATE;
  v_features JSONB;
BEGIN
  -- Get subscription details
  SELECT s.status, s.trial_end_date, sp.features
  INTO v_status, v_trial_end, v_features
  FROM public.subscriptions s
  JOIN public.subscription_plans sp ON sp.id = s.plan_id
  WHERE s.organisation_id = p_org_id;

  -- No subscription: deny
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  -- Active subscription: all plan features available
  IF v_status = 'active' THEN
    RETURN COALESCE((v_features ->> p_feature)::BOOLEAN, false);
  END IF;

  -- Trialing: full access if trial is still active
  IF v_status = 'trialing' THEN
    IF v_trial_end IS NULL OR CURRENT_DATE <= v_trial_end THEN
      RETURN COALESCE((v_features ->> p_feature)::BOOLEAN, false);
    END IF;
    -- Trial expired but status not yet updated: deny paid features
    RETURN FALSE;
  END IF;

  -- Free plan: check feature flags (most will be false)
  IF v_status = 'free' THEN
    RETURN COALESCE((v_features ->> p_feature)::BOOLEAN, false);
  END IF;

  -- past_due, canceled, paused: deny
  RETURN FALSE;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.check_plan_limits(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_lot_limit() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_access_feature(UUID, TEXT) TO authenticated;

-- ============================================================
-- 6. TRIGGERS
-- ============================================================

-- updated_at triggers (reuse existing function)
CREATE TRIGGER set_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- enforce_lot_limit trigger on lots table (BEFORE INSERT)
CREATE TRIGGER enforce_lot_limit_on_insert
  BEFORE INSERT ON public.lots
  FOR EACH ROW EXECUTE FUNCTION public.enforce_lot_limit();

-- Audit log triggers
CREATE TRIGGER subscription_plans_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER subscriptions_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER usage_tracking_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON public.usage_tracking
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER platform_invoices_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON public.platform_invoices
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER payment_events_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON public.payment_events
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

-- ============================================================
-- 7. SEED DATA
-- ============================================================

-- Free plan: limited lots/schemes, no paid features
INSERT INTO public.subscription_plans (plan_code, plan_name, description, max_lots, max_schemes, features, is_active, sort_order)
VALUES (
  'free',
  'Free',
  'Get started with basic strata management for a single small scheme.',
  10,
  1,
  '{"trust_accounting": false, "bulk_levy_notices": false, "financial_reporting": false, "csv_import_export": false}'::JSONB,
  true,
  1
);

-- Paid plan: unlimited lots/schemes, all features
INSERT INTO public.subscription_plans (plan_code, plan_name, description, max_lots, max_schemes, features, is_active, sort_order)
VALUES (
  'paid',
  'Professional',
  'Full-featured strata management with unlimited lots, trust accounting, and more.',
  NULL,
  NULL,
  '{"trust_accounting": true, "bulk_levy_notices": true, "financial_reporting": true, "csv_import_export": true}'::JSONB,
  true,
  2
);

-- ============================================================
-- 8. EXTEND SIGNUP TRIGGER
-- ============================================================

-- Replace handle_new_user() to also create a trialing subscription for new orgs
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _org_id UUID;
  _org_name TEXT;
  _invitation RECORD;
  _paid_plan_id UUID;
BEGIN
  -- Check if this is a manager signup (raw_user_meta_data contains 'organisation_name')
  _org_name := NEW.raw_user_meta_data ->> 'organisation_name';

  IF _org_name IS NOT NULL AND _org_name <> '' THEN
    -- Manager signup: create a new organisation and link the user as manager
    INSERT INTO public.organisations (name)
    VALUES (_org_name)
    RETURNING id INTO _org_id;

    INSERT INTO public.organisation_users (organisation_id, user_id, role, joined_at)
    VALUES (_org_id, NEW.id, 'manager', NOW());

    -- Create trialing subscription linked to the paid plan (full features during trial)
    SELECT id INTO _paid_plan_id FROM public.subscription_plans WHERE plan_code = 'paid' LIMIT 1;

    IF _paid_plan_id IS NOT NULL THEN
      INSERT INTO public.subscriptions (
        organisation_id,
        plan_id,
        status,
        billing_interval,
        trial_start_date,
        trial_end_date
      ) VALUES (
        _org_id,
        _paid_plan_id,
        'trialing',
        'monthly',
        CURRENT_DATE,
        CURRENT_DATE + INTERVAL '14 days'
      );
    END IF;

    RETURN NEW;
  END IF;

  -- Check if there is a pending invitation for this email
  SELECT * INTO _invitation
  FROM public.invitations
  WHERE email = NEW.email
    AND accepted_at IS NULL
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  IF _invitation IS NOT NULL THEN
    -- Invited user: join the existing organisation with the invited role
    INSERT INTO public.organisation_users (organisation_id, user_id, role, invited_by, joined_at)
    VALUES (_invitation.organisation_id, NEW.id, _invitation.role, _invitation.invited_by, NOW());

    -- Mark invitation as accepted
    UPDATE public.invitations
    SET accepted_at = NOW()
    WHERE id = _invitation.id;

    RETURN NEW;
  END IF;

  -- No organisation_name and no invitation -- user signed up without context.
  -- They will need to be invited or create an org later.
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
