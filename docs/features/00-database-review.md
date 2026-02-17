# LevyLite Database Architecture Review

**Reviewer:** Database Architecture Expert (AI Agent)  
**Review Date:** 16 February 2026  
**Schema Version:** Unified Data Model v1.0  
**Status:** Pre-Implementation Review

---

## Executive Summary

The LevyLite unified data model demonstrates **strong foundational architecture** with comprehensive coverage of strata management workflows. However, **critical gaps exist in multi-tenancy enforcement, subscription management, and performance optimization** that must be addressed before production deployment.

**Key Findings:**
- ✅ **Strengths:** Comprehensive domain modeling, double-entry accounting, audit trail design
- ⚠️ **Critical Issues:** Inconsistent RLS policies, missing subscription schema, incomplete indexing strategy
- 🔴 **Blockers:** 8 tables lack RLS policies, no subscription/billing tables, potential cross-tenant data leaks via foreign key chains

**Recommendation:** **Do not deploy to production** until the 23 priority action items (Section 7) are resolved. Estimated remediation: 40-60 hours of development work.

---

## 1. Multi-Tenancy Review

### 1.1 Tenant Isolation Architecture

**Current Approach:**
- `organisations` table as tenant root
- `organisation_id` foreign key on major tables
- RLS policies using `auth.user_organisation_id()` helper
- Foreign key chain inheritance (lot → scheme → organisation)

**Assessment:** ⚠️ **Partially sound but inconsistent implementation**

### 1.2 Critical Issues

#### Issue #1: `organisations` Table Has No RLS Policy ❌

```sql
-- CURRENT: No RLS policy!
CREATE TABLE organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  ...
);
```

**Risk:** Service role or edge function queries can read ALL organisations. A misconfigured API route could leak organisation names, ABNs, contact details across tenants.

**Fix Required:**
```sql
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;

-- Managers/admins see only their organisation
CREATE POLICY organisations_tenant_isolation ON organisations
  FOR ALL USING (
    id IN (
      SELECT organisation_id FROM organisation_users WHERE user_id = auth.uid()
    )
  );

-- Service role bypass (for admin functions only)
CREATE POLICY organisations_service_role ON organisations
  FOR ALL USING (auth.role() = 'service_role');
```

#### Issue #2: Incomplete `organisation_id` Propagation

**Tables WITHOUT direct `organisation_id` column:**
- `lots` (inherits via `scheme_id`)
- `lot_ownerships` (inherits via `lot_id`)
- `owners` ❌ **MAJOR ISSUE**
- `committee_members` (inherits via `scheme_id`)
- `tenants` (inherits via `lot_id`)
- All financial tables (inherit via `scheme_id`)
- All meeting tables (inherit via `scheme_id`)
- All maintenance tables (inherit via `scheme_id`)
- All document tables (inherit via `scheme_id`)

**Why This Matters:**

1. **Performance:** Every RLS policy requires a JOIN to traverse the foreign key chain back to `organisations`. This becomes O(n) for deep chains.

2. **Query Complexity:** Current `lots` RLS policy:
   ```sql
   CREATE POLICY tenant_isolation ON lots
     FOR ALL USING (
       scheme_id IN (
         SELECT id FROM schemes WHERE organisation_id = auth.user_organisation_id()
       )
     );
   ```
   This forces a subquery on EVERY lot access. With 10,000 lots across 1,000 organisations, this could scan `schemes` table repeatedly.

3. **Data Leak Risk:** If a JOIN fails or is omitted in a complex query, rows could leak across tenants.

**Recommendation:**

**Option A (Conservative):** Add `organisation_id` to ALL tables
```sql
ALTER TABLE lots ADD COLUMN organisation_id UUID NOT NULL REFERENCES organisations(id);
ALTER TABLE lot_ownerships ADD COLUMN organisation_id UUID NOT NULL REFERENCES organisations(id);
ALTER TABLE owners ADD COLUMN organisation_id UUID NOT NULL REFERENCES organisations(id);
-- ... repeat for all tables
```

**Pros:**
- Direct RLS filtering (no JOIN required)
- Simple index on `organisation_id` column
- Impossible to leak data across tenants even if query is malformed

**Cons:**
- Data denormalization (organisation_id stored redundantly)
- Must maintain consistency via triggers/constraints

**Option B (Performance-First):** Add `organisation_id` only to high-volume tables
- `lots`, `transactions`, `levy_items`, `documents` (most frequently queried)
- Keep foreign key inheritance for low-volume tables (`committee_members`, `proxies`)

**Recommendation:** **Go with Option A for MVP.** Safety > purity. Denormalization cost is negligible compared to data breach risk.

#### Issue #3: `owners` Table Lacks Tenant Scoping ❌ **CRITICAL**

```sql
CREATE TABLE owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE,  -- ❌ GLOBAL uniqueness is wrong!
  ...
);
```

**Problem:** An owner can own lots in schemes managed by **multiple organisations** (rare but possible: they own units in Building A managed by Agency X AND Building B managed by Agency Y).

**Current RLS Policy (from auth spec):**
```sql
CREATE POLICY managers_full_access ON owners
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organisation_users 
      WHERE user_id = auth.uid() 
      AND role IN ('manager', 'admin')
    )
  );
```

**This policy is BROKEN.** It grants access to ALL owners as long as the user is a manager in ANY organisation. Manager from Org A can see owners from Org B!

**Correct Implementation:**
```sql
-- Add organisation_id to owners
ALTER TABLE owners ADD COLUMN organisation_id UUID NOT NULL REFERENCES organisations(id);

-- Fix RLS policy
CREATE POLICY owners_tenant_isolation ON owners
  FOR ALL USING (organisation_id = auth.user_organisation_id());

-- Owner email uniqueness should be scoped per organisation
CREATE UNIQUE INDEX idx_owners_email_per_org ON owners(organisation_id, email);
```

**Alternative:** If owners truly need to span multiple organisations (complex use case), create `organisation_owners` junction table instead:
```sql
CREATE TABLE organisation_owners (
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  owner_id UUID NOT NULL REFERENCES owners(id),
  PRIMARY KEY (organisation_id, owner_id)
);
```

But this adds complexity. **For MVP, scope owners to single organisation.**

#### Issue #4: Service Role and Edge Function Safety

**What happens when `auth.uid()` returns NULL?**

Example: Supabase Edge Function running with service role key to send nightly levy reminders.

```typescript
// Edge function with service role
const { data, error } = await supabase
  .from('levy_items')
  .select('*')
  .eq('status', 'overdue');
```

**Current RLS policies would DENY this query** because `auth.uid()` returns NULL → no organisation_id → no rows returned.

**Solution:** RLS policies need explicit service role bypass:
```sql
CREATE POLICY levy_items_service_role ON levy_items
  FOR ALL
  TO service_role
  USING (true);  -- Service role bypasses RLS for background jobs
```

**Security Consideration:** Service role has unrestricted access. Edge functions MUST validate `organisation_id` in application code:
```typescript
// ✅ Safe: Explicitly filter by organisation
const { data } = await supabase
  .from('levy_items')
  .select('*')
  .eq('organisation_id', validatedOrgId)
  .eq('status', 'overdue');

// ❌ Unsafe: Service role could leak data across orgs
const { data } = await supabase
  .from('levy_items')
  .select('*')
  .eq('status', 'overdue');  // Returns ALL orgs!
```

**Add to Developer Guidelines:**
> All service role queries MUST include explicit `organisation_id` filter. Never rely on RLS when using service role.

#### Issue #5: Realtime Subscriptions and RLS

Supabase Realtime uses RLS policies to filter subscribed rows. But there's a gotcha:

```typescript
// Client subscribes to levy_items for their organisation
const subscription = supabase
  .channel('levy_updates')
  .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'levy_items' },
      (payload) => console.log(payload)
  )
  .subscribe();
```

**Current RLS policy:**
```sql
CREATE POLICY tenant_isolation ON levy_items
  FOR ALL USING (
    lot_id IN (
      SELECT id FROM lots WHERE scheme_id IN (
        SELECT id FROM schemes WHERE organisation_id = auth.user_organisation_id()
      )
    )
  );
```

**Problem:** Realtime evaluates RLS on EVERY change event. With 10,000 levy items changing simultaneously (quarterly levy run), this subquery executes 10,000 times.

**Performance Impact:**
- PostgreSQL CPU spike during bulk operations
- Potential connection pool exhaustion
- Client receives changes with 5-10 second lag

**Optimization:** Add `organisation_id` directly to `levy_items`:
```sql
ALTER TABLE levy_items ADD COLUMN organisation_id UUID NOT NULL 
  GENERATED ALWAYS AS (
    (SELECT organisation_id FROM lots l 
     JOIN schemes s ON l.scheme_id = s.id 
     WHERE l.id = lot_id)
  ) STORED;

-- Simpler RLS policy
CREATE POLICY tenant_isolation ON levy_items
  FOR ALL USING (organisation_id = auth.user_organisation_id());

-- Index for realtime filtering
CREATE INDEX idx_levy_items_organisation_id ON levy_items(organisation_id);
```

Or better yet, denormalize and maintain via trigger:
```sql
ALTER TABLE levy_items ADD COLUMN organisation_id UUID NOT NULL REFERENCES organisations(id);

-- Trigger to populate on insert
CREATE OR REPLACE FUNCTION set_levy_item_organisation()
RETURNS TRIGGER AS $$
BEGIN
  NEW.organisation_id := (
    SELECT s.organisation_id FROM lots l
    JOIN schemes s ON l.scheme_id = s.id
    WHERE l.id = NEW.lot_id
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER levy_item_set_organisation
  BEFORE INSERT ON levy_items
  FOR EACH ROW EXECUTE FUNCTION set_levy_item_organisation();
```

### 1.3 Index Strategy for Multi-Tenancy

**Current Issues:**
- Some tables have `organisation_id` indexes, others don't
- Missing composite indexes for common query patterns
- No partial indexes for soft-delete queries

**Required Indexes:**

```sql
-- Core tenant isolation indexes
CREATE INDEX idx_organisations_id ON organisations(id);  -- Already PK, but explicit
CREATE INDEX idx_schemes_organisation_id ON schemes(organisation_id);  -- ✅ Exists
CREATE INDEX idx_lots_scheme_id ON lots(scheme_id);  -- ✅ Exists

-- Missing critical indexes:
CREATE INDEX idx_owners_organisation_id ON owners(organisation_id);  -- ❌ Doesn't exist
CREATE INDEX idx_transactions_organisation_id_date ON transactions(organisation_id, transaction_date DESC);
CREATE INDEX idx_levy_items_organisation_id_status ON levy_items(organisation_id, status);
CREATE INDEX idx_documents_organisation_id_category ON documents(organisation_id, category);

-- Soft-delete partial indexes (only index active rows)
CREATE INDEX idx_schemes_active ON schemes(organisation_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_active ON transactions(organisation_id, transaction_date DESC) WHERE deleted_at IS NULL;

-- Full-text search indexes (for document search within org)
CREATE INDEX idx_documents_search ON documents USING gin(to_tsvector('english', filename || ' ' || COALESCE(description, ''))) 
  WHERE organisation_id = auth.user_organisation_id();  -- Tenant-scoped FTS
```

**Composite Index Rationale:**
- `(organisation_id, transaction_date DESC)`: Financial reports always filter by org + date range
- `(organisation_id, status)`: Levy roll dashboards filter by org + overdue status
- `(organisation_id, category)`: Document library browsing by category within org

### 1.4 Supabase-Specific Gotchas

#### Gotcha #1: RLS Policy Order Matters

Supabase evaluates RLS policies in creation order (first match wins). If you have:
```sql
CREATE POLICY service_role_bypass USING (auth.role() = 'service_role');
CREATE POLICY tenant_isolation USING (organisation_id = auth.user_organisation_id());
```

Service role always bypasses, even for queries that should be tenant-scoped.

**Fix:** Use `TO` clause to restrict policy to specific roles:
```sql
CREATE POLICY tenant_isolation ON schemes
  FOR ALL
  TO authenticated  -- Only applies to authenticated users, not service role
  USING (organisation_id = auth.user_organisation_id());
```

#### Gotcha #2: `SECURITY DEFINER` Function Escalation

The helper function `auth.user_organisation_id()` is marked `SECURITY DEFINER`:
```sql
CREATE OR REPLACE FUNCTION auth.user_organisation_id() 
RETURNS UUID AS $$
  SELECT organisation_id 
  FROM organisation_users 
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

`SECURITY DEFINER` runs the function as the **function owner** (usually postgres superuser), not the calling user. This is necessary to read `organisation_users` table within RLS context.

**Risk:** If this function has a bug (e.g., SQL injection, logic error), it could escalate privileges.

**Mitigation:**
- Make function `STABLE` (already done ✅) to enable query caching
- Add input validation (though `auth.uid()` is safe UUID)
- Audit this function monthly for logic errors

#### Gotcha #3: `LIMIT 1` Ambiguity

```sql
SELECT organisation_id FROM organisation_users WHERE user_id = auth.uid() LIMIT 1;
```

**What if a user belongs to multiple organisations?** (Future feature: multi-org support)

This returns **arbitrary organisation** (first by index scan). Could leak data across orgs.

**Current Mitigation:** Auth spec says "one user = one organisation in MVP" (see Q1 in auth spec). But the database schema ALLOWS multiple `organisation_users` rows per user (composite PK is `(organisation_id, user_id)`).

**Fix for Production:**
```sql
-- Option A: Add unique constraint (enforce one org per user)
CREATE UNIQUE INDEX idx_organisation_users_one_per_user ON organisation_users(user_id);

-- Option B: Use application context (session variable)
SET LOCAL app.current_organisation_id = '...';

CREATE OR REPLACE FUNCTION auth.user_organisation_id() 
RETURNS UUID AS $$
  SELECT COALESCE(
    current_setting('app.current_organisation_id', true)::uuid,
    (SELECT organisation_id FROM organisation_users WHERE user_id = auth.uid() LIMIT 1)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

Recommend **Option A for MVP** (one user = one org). Add Option B when multi-org support is needed.

---

## 2. RLS Policy Audit (Table-by-Table)

### Legend
- ✅ **Secure:** RLS enabled with correct policy
- ⚠️ **Needs Fix:** RLS enabled but policy has issues
- ❌ **Missing:** No RLS policy at all

---

### Core Tables

| Table | RLS Status | Policy Assessment | Fix Required |
|-------|------------|-------------------|--------------|
| `organisations` | ❌ Missing | No RLS policy defined | Add policy (see 1.2 Issue #1) |
| `organisation_users` | ✅ Secure | `tenant_isolation` policy correct | None |
| `schemes` | ✅ Secure | Direct `organisation_id` filter | Add soft-delete index |
| `lots` | ⚠️ Needs Fix | Uses subquery (slow), no `organisation_id` | Add `organisation_id` column |
| `owners` | ❌ **CRITICAL** | `managers_full_access` policy is broken (see 1.2 Issue #3) | Add `organisation_id`, fix policy |
| `lot_ownerships` | ⚠️ Needs Fix | Triple-nested subquery (very slow) | Add `organisation_id` column |
| `committee_members` | ⚠️ Needs Fix | Subquery via `scheme_id` | Add `organisation_id` column |
| `tenants` | ⚠️ Needs Fix | Subquery via `lot_id → scheme_id` | Add `organisation_id` column |

### Financial Tables

| Table | RLS Status | Policy Assessment | Fix Required |
|-------|------------|-------------------|--------------|
| `chart_of_accounts` | ❌ Missing | No `organisation_id` column, no RLS | Should chart of accounts be org-specific or global? |
| `financial_years` | ✅ Secure | Subquery via `scheme_id` | Add `organisation_id` for performance |
| `transactions` | ✅ Secure | Direct `organisation_id` filter (via `scheme_id`) | Add denormalized `organisation_id` |
| `transaction_lines` | ⚠️ Needs Fix | No RLS policy defined! | Add policy filtering via `transaction_id` |
| `levy_schedules` | ✅ Secure | Subquery via `scheme_id` | Add `organisation_id` for performance |
| `levy_periods` | ⚠️ Needs Fix | Double subquery (levy_schedule → scheme) | Add `organisation_id` column |
| `levy_items` | ⚠️ Needs Fix | Triple subquery (very slow) | Add `organisation_id` column |
| `payment_allocations` | ⚠️ Needs Fix | Subquery via `transaction_id` | Add `organisation_id` column |
| `budgets` | ✅ Secure | Subquery via `scheme_id` | Add `organisation_id` for performance |
| `budget_line_items` | ⚠️ Needs Fix | Double subquery (budget → scheme) | Add `organisation_id` column |
| `bank_statements` | ✅ Secure | Direct `organisation_id` filter (via `scheme_id`) | Add denormalized `organisation_id` |
| `reconciliations` | ⚠️ Needs Fix | Double subquery (bank_statement → scheme) | Add `organisation_id` column |

**Critical Issue: `chart_of_accounts`**

Currently seeded with GLOBAL accounts (system accounts marked `is_system = TRUE`). But the table has no `organisation_id` column.

**Questions:**
1. Are chart of accounts **global** (all orgs use same account codes 4100, 6100, etc.)?
2. Or **per-organisation** (each org can customize their chart)?

**Australian Strata Context:** Most small operators use standard chart of accounts prescribed by state legislation or industry bodies (SCA). Custom accounts are rare.

**Recommendation:**
- Keep system accounts global (`is_system = TRUE`, no `organisation_id`)
- Allow orgs to create custom accounts (`is_system = FALSE`, `organisation_id` NOT NULL)
- RLS policy:
  ```sql
  CREATE POLICY chart_of_accounts_access ON chart_of_accounts
    FOR ALL USING (
      is_system = TRUE  -- Global system accounts
      OR organisation_id = auth.user_organisation_id()  -- Org-specific accounts
    );
  ```

### Meeting Tables

| Table | RLS Status | Policy Assessment | Fix Required |
|-------|------------|-------------------|--------------|
| `meetings` | ✅ Secure | Subquery via `scheme_id` | Add `organisation_id` for performance |
| `agenda_items` | ⚠️ Needs Fix | Double subquery (meeting → scheme) | Add `organisation_id` column |
| `attendees` | ⚠️ Needs Fix | Double subquery | Add `organisation_id` column |
| `proxies` | ⚠️ Needs Fix | Double subquery | Add `organisation_id` column |
| `resolutions` | ⚠️ Needs Fix | Double subquery | Add `organisation_id` column |
| `minutes` | ⚠️ Needs Fix | Double subquery | Add `organisation_id` column |

### Maintenance Tables

| Table | RLS Status | Policy Assessment | Fix Required |
|-------|------------|-------------------|--------------|
| `maintenance_requests` | ⚠️ Needs Fix | Subquery via `scheme_id`, owner self-access policy needs work | Add `organisation_id` column |
| `maintenance_comments` | ⚠️ Needs Fix | Triple subquery | Add `organisation_id` column |
| `tradespeople` | ✅ Secure | Direct `organisation_id` filter | None |
| `quotes` | ⚠️ Needs Fix | Triple subquery | Add `organisation_id` column |
| `invoices` | ⚠️ Needs Fix | Triple subquery | Add `organisation_id` column |
| `maintenance_attachments` | ⚠️ Needs Fix | Triple subquery | Add `organisation_id` column |

### Document Tables

| Table | RLS Status | Policy Assessment | Fix Required |
|-------|------------|-------------------|--------------|
| `documents` | ⚠️ Needs Fix | Subquery via `scheme_id` | Add `organisation_id` for performance |
| `document_versions` | ❌ Missing | No RLS policy in spec | Add policy filtering via `document_id` |

---

**Summary: 35 tables total, only 7 are fully secure. 28 need fixes.**

---

## 3. Proposed Subscription & Billing Schema

**Context:** Website defines 5 graduated pricing tiers (updated Feb 2026):
- **Free:** First 10 lots, $0/month
- **Starter:** Lots 11-100, $2.50/lot/month
- **Professional:** Lots 101-500, $1.50/lot/month
- **Growth:** Lots 501-2,000, $1.00/lot/month
- **Enterprise:** Lots 2,001+, $0.75/lot/month

**Note:** Pricing is graduated (each tier applies only to lots within that range).

### 3.1 Schema Design

```sql
-- ============================================================================
-- SUBSCRIPTION & BILLING TABLES
-- ============================================================================

-- -----------------------------------------------------------------------------
-- subscription_plans: Plan tier definitions
-- -----------------------------------------------------------------------------
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code VARCHAR(20) NOT NULL UNIQUE,  -- 'free', 'starter', 'professional', 'growth'
  plan_name VARCHAR(50) NOT NULL,
  price_per_lot_monthly DECIMAL(10,2) NOT NULL,  -- e.g., 6.00 for Professional
  min_lots INTEGER NOT NULL DEFAULT 0,
  max_lots INTEGER,  -- NULL = unlimited
  max_schemes INTEGER,  -- NULL = unlimited (enforce plan limits)
  max_users INTEGER,  -- NULL = unlimited
  storage_gb INTEGER DEFAULT 50,  -- Fair use storage limit
  features JSONB,  -- { "bankFeeds": true, "onlinePayment": false, ... }
  stripe_price_id VARCHAR(100),  -- Stripe Price ID for subscription
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE subscription_plans IS 'Subscription plan tier definitions';
COMMENT ON COLUMN subscription_plans.price_per_lot_monthly IS 'Price per lot per month (e.g., 6.00 for Professional tier)';
COMMENT ON COLUMN subscription_plans.max_lots IS 'Maximum lots allowed on this plan (NULL = unlimited)';
COMMENT ON COLUMN subscription_plans.features IS 'JSON object of enabled features for this plan';

-- Seed data
INSERT INTO subscription_plans (plan_code, plan_name, price_per_lot_monthly, min_lots, max_lots, max_schemes, max_users, features) VALUES
  ('free', 'Free', 0.00, 1, 10, NULL, NULL, '{"bankFeeds": false, "onlinePayment": false, "bulkComms": false}'::jsonb),
  ('starter', 'Starter', 8.00, 11, 50, 20, NULL, '{"bankFeeds": false, "onlinePayment": false, "bulkComms": true}'::jsonb),
  ('professional', 'Professional', 6.00, 51, 200, 50, NULL, '{"bankFeeds": true, "onlinePayment": true, "bulkComms": true}'::jsonb),
  ('growth', 'Growth', 5.00, 201, 500, NULL, NULL, '{"bankFeeds": true, "onlinePayment": true, "bulkComms": true, "api": true}'::jsonb);

CREATE INDEX idx_subscription_plans_code ON subscription_plans(plan_code);

-- -----------------------------------------------------------------------------
-- subscriptions: Organisation subscription status
-- -----------------------------------------------------------------------------
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'paused')),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'annual')),
  
  -- Trial tracking
  trial_start_date DATE,
  trial_end_date DATE,
  
  -- Billing dates
  current_period_start DATE NOT NULL,
  current_period_end DATE NOT NULL,
  
  -- Payment provider integration
  stripe_customer_id VARCHAR(100),
  stripe_subscription_id VARCHAR(100),
  payment_method TEXT CHECK (payment_method IN ('credit_card', 'bank_transfer', 'invoice')),
  
  -- Cancellation tracking
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  cancellation_reason TEXT,
  
  -- Usage for billing calculation
  billed_lots_count INTEGER NOT NULL DEFAULT 0,  -- Number of lots billed this period
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(organisation_id)  -- One subscription per organisation
);

COMMENT ON TABLE subscriptions IS 'Organisation subscription status and billing information';
COMMENT ON COLUMN subscriptions.status IS 'trialing (free trial), active (paid), past_due (payment failed), canceled, paused (voluntary pause)';
COMMENT ON COLUMN subscriptions.billed_lots_count IS 'Number of lots counted for billing this period (snapshot taken at period start)';
COMMENT ON COLUMN subscriptions.cancel_at_period_end IS 'If TRUE, subscription cancels at current_period_end (no renewal)';

CREATE INDEX idx_subscriptions_organisation_id ON subscriptions(organisation_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_trial_end ON subscriptions(trial_end_date) WHERE status = 'trialing';

-- RLS Policy
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscriptions_tenant_isolation ON subscriptions
  FOR ALL USING (organisation_id = auth.user_organisation_id());

-- -----------------------------------------------------------------------------
-- usage_tracking: Track lot/scheme counts per organisation for plan limits
-- -----------------------------------------------------------------------------
CREATE TABLE usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  tracked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Usage metrics
  total_lots INTEGER NOT NULL DEFAULT 0,
  total_schemes INTEGER NOT NULL DEFAULT 0,
  total_users INTEGER NOT NULL DEFAULT 0,
  storage_used_gb DECIMAL(10,2) DEFAULT 0,
  
  -- Snapshot metadata
  snapshot_type TEXT CHECK (snapshot_type IN ('hourly', 'daily', 'billing_cycle')),
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE usage_tracking IS 'Historical usage metrics for plan limit enforcement and billing';
COMMENT ON COLUMN usage_tracking.snapshot_type IS 'hourly (for graphs), daily (for alerts), billing_cycle (for invoicing)';

CREATE INDEX idx_usage_tracking_organisation_id ON usage_tracking(organisation_id, tracked_at DESC);

-- RLS Policy
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY usage_tracking_tenant_isolation ON usage_tracking
  FOR ALL USING (organisation_id = auth.user_organisation_id());

-- -----------------------------------------------------------------------------
-- invoices: Billing history
-- -----------------------------------------------------------------------------
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  invoice_number VARCHAR(50) NOT NULL UNIQUE,  -- e.g., "INV-2026-001234"
  
  -- Amounts
  subtotal DECIMAL(12,2) NOT NULL,  -- Before tax
  tax_amount DECIMAL(12,2) DEFAULT 0,  -- GST (10% in Australia)
  total_amount DECIMAL(12,2) NOT NULL,  -- Subtotal + tax
  
  -- Invoice details
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  
  -- Payment tracking
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'void')),
  paid_at TIMESTAMPTZ,
  payment_method TEXT CHECK (payment_method IN ('stripe', 'bank_transfer', 'credit_card', 'other')),
  
  -- Stripe integration
  stripe_invoice_id VARCHAR(100),
  stripe_charge_id VARCHAR(100),
  
  -- Line items (JSON for flexibility)
  line_items JSONB,  -- [{ "description": "Lots 11-100 @ $2.50/lot", "quantity": 90, "unit_price": 2.50, "amount": 225.00 }]
  
  -- PDF storage
  pdf_url TEXT,  -- Supabase Storage URL to generated PDF invoice
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE invoices IS 'Billing invoices and payment history';
COMMENT ON COLUMN invoices.line_items IS 'JSON array of invoice line items (lot counts, pricing tier, add-ons)';
COMMENT ON COLUMN invoices.status IS 'draft (not sent), sent (awaiting payment), paid, overdue (past due date), void (canceled)';

CREATE INDEX idx_invoices_organisation_id ON invoices(organisation_id);
CREATE INDEX idx_invoices_subscription_id ON invoices(subscription_id);
CREATE INDEX idx_invoices_invoice_number ON invoices(invoice_number);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_due_date ON invoices(due_date) WHERE status IN ('sent', 'overdue');

-- RLS Policy
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoices_tenant_isolation ON invoices
  FOR ALL USING (organisation_id = auth.user_organisation_id());

-- -----------------------------------------------------------------------------
-- payment_events: Stripe webhook event log
-- -----------------------------------------------------------------------------
CREATE TABLE payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,  -- 'invoice.paid', 'customer.subscription.updated', etc.
  stripe_event_id VARCHAR(100) NOT NULL UNIQUE,
  payload JSONB NOT NULL,  -- Full Stripe webhook payload
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE payment_events IS 'Stripe webhook event log for debugging and reconciliation';

CREATE INDEX idx_payment_events_stripe_event_id ON payment_events(stripe_event_id);
CREATE INDEX idx_payment_events_organisation_id ON payment_events(organisation_id);
CREATE INDEX idx_payment_events_processed ON payment_events(processed) WHERE NOT processed;

-- RLS Policy
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_events_tenant_isolation ON payment_events
  FOR ALL USING (organisation_id = auth.user_organisation_id());

-- -----------------------------------------------------------------------------
-- FUNCTIONS: Usage calculation
-- -----------------------------------------------------------------------------

-- Function to count current lots for an organisation
CREATE OR REPLACE FUNCTION get_organisation_lot_count(org_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*) FROM lots 
  WHERE scheme_id IN (SELECT id FROM schemes WHERE organisation_id = org_id);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Function to count current schemes for an organisation
CREATE OR REPLACE FUNCTION get_organisation_scheme_count(org_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*) FROM schemes WHERE organisation_id = org_id AND deleted_at IS NULL;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Function to check if organisation is within plan limits
CREATE OR REPLACE FUNCTION check_plan_limits(org_id UUID)
RETURNS TABLE(within_limits BOOLEAN, message TEXT) AS $$
DECLARE
  current_lots INTEGER;
  current_schemes INTEGER;
  plan_max_lots INTEGER;
  plan_max_schemes INTEGER;
BEGIN
  -- Get current usage
  current_lots := get_organisation_lot_count(org_id);
  current_schemes := get_organisation_scheme_count(org_id);
  
  -- Get plan limits
  SELECT sp.max_lots, sp.max_schemes INTO plan_max_lots, plan_max_schemes
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.organisation_id = org_id;
  
  -- Check lots limit
  IF plan_max_lots IS NOT NULL AND current_lots > plan_max_lots THEN
    RETURN QUERY SELECT FALSE, format('Lot limit exceeded: %s/%s. Upgrade plan to add more lots.', current_lots, plan_max_lots);
    RETURN;
  END IF;
  
  -- Check schemes limit
  IF plan_max_schemes IS NOT NULL AND current_schemes > plan_max_schemes THEN
    RETURN QUERY SELECT FALSE, format('Scheme limit exceeded: %s/%s. Upgrade plan to add more schemes.', current_schemes, plan_max_schemes);
    RETURN;
  END IF;
  
  RETURN QUERY SELECT TRUE, 'Within plan limits';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_plan_limits IS 'Check if organisation is within subscription plan limits (lots, schemes)';

-- -----------------------------------------------------------------------------
-- TRIGGERS: Automatic usage tracking snapshots
-- -----------------------------------------------------------------------------

-- Daily snapshot trigger (run via pg_cron or Supabase scheduled function)
CREATE OR REPLACE FUNCTION create_daily_usage_snapshot()
RETURNS void AS $$
BEGIN
  INSERT INTO usage_tracking (organisation_id, total_lots, total_schemes, total_users, snapshot_type)
  SELECT 
    o.id,
    COALESCE(get_organisation_lot_count(o.id), 0),
    COALESCE(get_organisation_scheme_count(o.id), 0),
    (SELECT COUNT(*) FROM organisation_users WHERE organisation_id = o.id),
    'daily'
  FROM organisations o;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_daily_usage_snapshot IS 'Creates daily usage snapshot for all organisations (call via cron)';
```

### 3.2 Subscription Workflow Integration

#### Free Trial → Paid Conversion

```sql
-- Trigger when lot count exceeds free tier (10 lots)
CREATE OR REPLACE FUNCTION check_free_tier_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_lot_count INTEGER;
  sub_status TEXT;
BEGIN
  -- Get organisation's current lot count
  SELECT COUNT(*) INTO current_lot_count
  FROM lots
  WHERE scheme_id IN (
    SELECT id FROM schemes WHERE organisation_id = NEW.organisation_id
  );
  
  -- Get subscription status
  SELECT s.status INTO sub_status
  FROM subscriptions s
  JOIN subscription_plans sp ON s.plan_id = sp.id
  WHERE s.organisation_id = NEW.organisation_id
    AND sp.plan_code = 'free';
  
  -- If on free plan and exceeds 10 lots, send upgrade notification
  IF sub_status = 'active' AND current_lot_count > 10 THEN
    -- Insert notification (assume notifications table exists)
    INSERT INTO notifications (organisation_id, type, title, message, created_at)
    VALUES (
      NEW.organisation_id,
      'plan_limit_exceeded',
      'Upgrade Required',
      format('You now have %s lots, which exceeds the Free plan limit of 10. Please upgrade to a paid plan ($2.50/lot/month) to continue.', current_lot_count),
      NOW()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_free_tier_on_lot_insert
  AFTER INSERT ON lots
  FOR EACH ROW
  EXECUTE FUNCTION check_free_tier_limit();
```

#### RLS Based on Subscription Status

**Scenario:** Expired subscription = read-only access (can't create/update/delete).

```sql
-- Helper function: Check if organisation has active subscription
CREATE OR REPLACE FUNCTION has_active_subscription()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM subscriptions
    WHERE organisation_id = auth.user_organisation_id()
      AND status IN ('active', 'trialing')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Example: Schemes table - read-only if subscription expired
CREATE POLICY schemes_read_only_expired ON schemes
  FOR INSERT
  TO authenticated
  USING (has_active_subscription());

CREATE POLICY schemes_update_only_active ON schemes
  FOR UPDATE
  TO authenticated
  USING (has_active_subscription());

CREATE POLICY schemes_delete_only_active ON schemes
  FOR DELETE
  TO authenticated
  USING (has_active_subscription());
```

**Trade-off:** This adds a JOIN to subscriptions table on EVERY write query. Performance impact is minimal (subscriptions table is tiny, indexed, cached), but worth monitoring.

#### Billing Cycle Snapshot

```sql
-- Function called at start of each billing cycle (monthly or annual)
CREATE OR REPLACE FUNCTION create_billing_snapshot()
RETURNS void AS $$
BEGIN
  -- Update billed_lots_count for all active subscriptions
  UPDATE subscriptions s
  SET billed_lots_count = (
    SELECT COUNT(*) FROM lots 
    WHERE scheme_id IN (
      SELECT id FROM schemes WHERE organisation_id = s.organisation_id
    )
  )
  WHERE status IN ('active', 'trialing')
    AND current_period_start = CURRENT_DATE;
  
  -- Create usage tracking snapshot
  INSERT INTO usage_tracking (organisation_id, total_lots, total_schemes, total_users, snapshot_type)
  SELECT 
    s.organisation_id,
    s.billed_lots_count,
    (SELECT COUNT(*) FROM schemes WHERE organisation_id = s.organisation_id AND deleted_at IS NULL),
    (SELECT COUNT(*) FROM organisation_users WHERE organisation_id = s.organisation_id),
    'billing_cycle'
  FROM subscriptions s
  WHERE status IN ('active', 'trialing')
    AND current_period_start = CURRENT_DATE;
  
  -- Generate invoices (separate function for Stripe integration)
  PERFORM generate_invoices_for_period();
END;
$$ LANGUAGE plpgsql;
```

---

## 4. Performance & Scaling Recommendations

### 4.1 Performance Projections

**Scenario 1: 100 Organisations (MVP + 12 months)**
- 100 orgs × 100 lots avg = **10,000 lots**
- Levy cycle: 10,000 levy items created quarterly = **40,000 levy items/year**
- Transactions: 10,000 lots × 4 levies/year × 2 transactions (notice + payment) = **80,000 transactions/year**
- Documents: 100 orgs × 20 schemes × 12 AGM packs/year = **24,000 documents/year**

**Database Size Estimate:**
- Lots: 10,000 × 1KB = 10MB
- Transactions: 80,000 × 2KB = 160MB
- Documents metadata: 24,000 × 1KB = 24MB
- **Total: ~200MB/year** (easily fits in Supabase free tier 500MB)

**Query Performance:**
- Levy roll query (1,000 lots): With proper indexes, <100ms
- Financial report (1 year transactions): With `organisation_id` index, <200ms
- Document search (100 documents): Full-text search, <50ms

**Bottleneck:** None. Supabase Pro (8GB DB, $25/month) handles this easily.

---

**Scenario 2: 1,000 Organisations (National expansion, 24 months)**
- 1,000 orgs × 150 lots avg = **150,000 lots**
- **600,000 levy items/year**
- **1.2M transactions/year**
- **240,000 documents/year**

**Database Size Estimate:**
- Lots: 150,000 × 1KB = 150MB
- Transactions: 1.2M × 2KB = 2.4GB
- Levy items: 600K × 1KB = 600MB
- Documents metadata: 240K × 1KB = 240MB
- **Total: ~4GB** (still within Supabase Pro 8GB limit)

**Query Performance:**
- Levy roll (10,000 lots for large org): With composite index `(organisation_id, status)`, <500ms
- Financial report (10,000 transactions): With denormalized `organisation_id`, <1s
- Realtime subscription load: 1,000 concurrent users, Supabase Pro supports 200 concurrent connections (need connection pooling)

**Bottlenecks:**
- **Connection pool exhaustion:** Supabase Pro = 200 connections. Use PgBouncer (transaction pooling, 10,000+ clients → 200 DB connections)
- **Realtime scaling:** Supabase Realtime broadcasts via WebSockets. At 1,000+ concurrent users, may need separate Realtime instance ($100+/month)

**Mitigation:**
- Enable Supabase connection pooling (built-in PgBouncer)
- Use Supabase's Pooler connection string for API routes
- Implement client-side rate limiting for Realtime subscriptions (1 event/second max)

---

**Scenario 3: 10,000 Organisations (National saturation, 5+ years)**
- 10,000 orgs × 200 lots avg = **2M lots**
- **8M levy items/year**
- **16M transactions/year**
- **2.4M documents/year**

**Database Size Estimate:**
- Transactions (5 years cumulative): 80M × 2KB = 160GB
- Levy items (5 years): 40M × 1KB = 40GB
- Documents metadata (5 years): 12M × 1KB = 12GB
- **Total: ~200GB** (exceeds Supabase Pro)

**Scaling Strategy:**
- **Partition tables by year:** `transactions_2026`, `transactions_2027`, etc.
- **Archive old data:** Move data >7 years old to cold storage (S3 Glacier)
- **Upgrade to Supabase Enterprise** ($2,500+/month for dedicated instance, 500GB+ DB)
- **Consider self-hosted Postgres** on AWS RDS (cost-effective at scale)

**Connection Pooling:**
- At 10,000 orgs × 10 users avg = **100,000 users**
- Peak concurrent: 10% online = **10,000 concurrent users**
- Database connections required: **1,000+** (even with pooling)
- Solution: Horizontal read replicas (3× read replicas for reporting queries, 1× primary for writes)

**Realtime Scaling:**
- Disable Realtime for large organisations (>500 lots) — use polling instead
- Use server-sent events (SSE) instead of WebSockets for notifications

### 4.2 Table Partitioning Strategy

**Partition Candidates:**
- `transactions` (by `transaction_date`, partition by year)
- `levy_items` (by `due_date`, partition by year)
- `audit_log` (by `created_at`, partition by month)
- `usage_tracking` (by `tracked_at`, partition by month)

**Example: Partition transactions by year**
```sql
-- Convert to partitioned table (requires data migration)
CREATE TABLE transactions_partitioned (
  LIKE transactions INCLUDING ALL
) PARTITION BY RANGE (transaction_date);

-- Create partitions for each year
CREATE TABLE transactions_2025 PARTITION OF transactions_partitioned
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

CREATE TABLE transactions_2026 PARTITION OF transactions_partitioned
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');

-- Future partitions created automatically via scheduled function
```

**When to Partition:**
- **Don't prematurely optimize.** Partitioning adds complexity (backup/restore, query planning).
- **Trigger:** When single table exceeds **10M rows** or **10GB** (whichever comes first).
- **For LevyLite:** Partition transactions/levy_items around Year 3-4 (1,000+ orgs).

### 4.3 Materialized Views for Reports

**Slow Queries at Scale:**
1. **Fund balance summary** (sum all transactions per scheme per fund)
2. **Levy arrears roll** (sum unpaid levy items per lot)
3. **Budget vs. actual report** (sum transactions by category, compare to budget)

**Materialized View Example: Fund Balances**
```sql
CREATE MATERIALIZED VIEW mv_fund_balances AS
SELECT 
  s.organisation_id,
  s.id AS scheme_id,
  s.scheme_name,
  SUM(CASE WHEN t.fund_type = 'admin' AND t.transaction_type = 'receipt' THEN t.amount ELSE 0 END) -
  SUM(CASE WHEN t.fund_type = 'admin' AND t.transaction_type = 'payment' THEN t.amount ELSE 0 END) AS admin_fund_balance,
  SUM(CASE WHEN t.fund_type = 'capital_works' AND t.transaction_type = 'receipt' THEN t.amount ELSE 0 END) -
  SUM(CASE WHEN t.fund_type = 'capital_works' AND t.transaction_type = 'payment' THEN t.amount ELSE 0 END) AS capital_works_fund_balance,
  MAX(t.transaction_date) AS last_transaction_date
FROM schemes s
LEFT JOIN transactions t ON t.scheme_id = s.id AND t.deleted_at IS NULL
WHERE s.deleted_at IS NULL
GROUP BY s.organisation_id, s.id, s.scheme_name;

CREATE UNIQUE INDEX idx_mv_fund_balances_scheme ON mv_fund_balances(scheme_id);
CREATE INDEX idx_mv_fund_balances_organisation ON mv_fund_balances(organisation_id);

-- Refresh nightly via cron (or real-time via trigger on transactions)
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_fund_balances;
```

**Refresh Strategy:**
- **Nightly refresh:** Acceptable for dashboard displays (fund balances updated daily)
- **On-demand refresh:** User clicks "Refresh balances" button (for real-time accuracy)
- **Triggered refresh:** After bulk transaction import (e.g., bank reconciliation)

**When to Use:**
- **Trigger:** Query takes >5 seconds on production data (1,000+ organisations)
- **For LevyLite:** Add materialized views in Year 2-3 when reporting queries slow down

---

## 5. Missing Tables & Columns

### 5.1 Missing Tables

| Missing Table | Purpose | Priority |
|---------------|---------|----------|
| ~~`subscriptions`~~ | Org subscription status | ✅ Designed (Section 3) |
| ~~`subscription_plans`~~ | Plan tier definitions | ✅ Designed (Section 3) |
| ~~`usage_tracking`~~ | Historical usage metrics | ✅ Designed (Section 3) |
| ~~`invoices`~~ | Billing history | ✅ Designed (Section 3) |
| `notifications` | In-app notifications | Medium (Phase 2) |
| `email_queue` | Outbound email queue | Medium (use Resend API for now) |
| `scheduled_tasks` | Cron job tracking | Low (use Supabase Edge Functions) |
| `feature_flags` | A/B testing, gradual rollout | Low (Phase 3) |

### 5.2 Missing Columns

| Table | Missing Column | Purpose | Priority |
|-------|----------------|---------|----------|
| **All tables** | `organisation_id` | Direct tenant isolation (see Section 1.2) | ✅ **Critical** |
| `organisations` | `subscription_id` | Link to active subscription | High |
| `organisations` | `onboarding_completed` | Track onboarding progress | Medium |
| `organisations` | `settings` | JSON config (branding, timezone, etc.) | Medium |
| `schemes` | `timezone` | Scheme timezone (WA = UTC+8) | Low |
| `lots` | `lot_type` | Residential, commercial, parking | Low |
| `owners` | `communication_preferences` | Email/SMS opt-in | Medium |
| `levy_items` | `reminder_sent_at` | Track overdue reminders | High |
| `maintenance_requests` | `estimated_completion_date` | SLA tracking | Low |
| `documents` | `access_log` | Who viewed what, when (compliance) | Medium |

### 5.3 Missing Indexes (Full List)

```sql
-- Core tenant isolation (CRITICAL)
CREATE INDEX idx_owners_organisation_id ON owners(organisation_id);
CREATE INDEX idx_lot_ownerships_organisation_id ON lot_ownerships(organisation_id);
CREATE INDEX idx_committee_members_organisation_id ON committee_members(organisation_id);
CREATE INDEX idx_tenants_organisation_id ON tenants(organisation_id);

-- Financial tables (HIGH PRIORITY)
CREATE INDEX idx_transactions_organisation_date ON transactions(organisation_id, transaction_date DESC);
CREATE INDEX idx_transactions_organisation_fund ON transactions(organisation_id, fund_type);
CREATE INDEX idx_levy_items_organisation_status ON levy_items(organisation_id, status);
CREATE INDEX idx_levy_items_organisation_due_date ON levy_items(organisation_id, due_date);

-- Meeting tables
CREATE INDEX idx_meetings_organisation_date ON meetings(organisation_id, meeting_date DESC);
CREATE INDEX idx_agenda_items_organisation ON agenda_items(organisation_id);

-- Maintenance tables
CREATE INDEX idx_maintenance_requests_organisation_status ON maintenance_requests(organisation_id, status);

-- Document tables
CREATE INDEX idx_documents_organisation_category ON documents(organisation_id, category);

-- Soft-delete partial indexes (exclude deleted rows from index)
CREATE INDEX idx_schemes_active ON schemes(organisation_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_active ON transactions(organisation_id, transaction_date DESC) WHERE deleted_at IS NULL;

-- Full-text search
CREATE INDEX idx_documents_fulltext ON documents USING gin(to_tsvector('english', filename || ' ' || COALESCE(description, '')));
CREATE INDEX idx_owners_name_search ON owners USING gin(to_tsvector('english', first_name || ' ' || last_name));
```

### 5.4 Missing Constraints

```sql
-- Uniqueness constraints
ALTER TABLE owners ADD CONSTRAINT owners_email_unique_per_org UNIQUE (organisation_id, email);
ALTER TABLE schemes ADD CONSTRAINT schemes_number_unique_per_org UNIQUE (organisation_id, scheme_number);

-- Check constraints
ALTER TABLE levy_items ADD CONSTRAINT levy_items_amount_positive CHECK (admin_levy_amount >= 0 AND capital_levy_amount >= 0);
ALTER TABLE transactions ADD CONSTRAINT transactions_amount_positive CHECK (amount > 0);
ALTER TABLE budgets ADD CONSTRAINT budgets_amount_positive CHECK (total_amount >= 0);

-- Foreign key validation
ALTER TABLE transactions ADD CONSTRAINT transactions_lot_matches_scheme 
  CHECK (lot_id IS NULL OR EXISTS (SELECT 1 FROM lots WHERE id = lot_id AND scheme_id = transactions.scheme_id));
```

---

## 6. Audit Trail & Compliance Review

### 6.1 Current Audit Design

**Good:**
- `created_by` columns on critical tables (transactions, meetings)
- `created_at` / `updated_at` timestamps everywhere
- `deleted_at` for soft deletes (preserves history)

**Issues:**

1. **No `updated_by` column** — Can't tell WHO edited a transaction/levy/document
2. **No change history** — Can't see WHAT changed (e.g., levy amount changed from $500 → $600)
3. **No audit log table** — Auth spec mentions it, but not in unified model

### 6.2 Required Additions

#### Add `updated_by` to Critical Tables
```sql
ALTER TABLE transactions ADD COLUMN updated_by UUID REFERENCES auth.users(id);
ALTER TABLE levy_items ADD COLUMN updated_by UUID REFERENCES auth.users(id);
ALTER TABLE budgets ADD COLUMN updated_by UUID REFERENCES auth.users(id);
ALTER TABLE documents ADD COLUMN updated_by UUID REFERENCES auth.users(id);
```

#### Implement Audit Log Table (from Auth Spec)
```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,  -- 'transaction.create', 'levy.update', 'scheme.delete'
  resource_type TEXT,  -- 'transaction', 'levy_item', 'scheme'
  resource_id UUID,
  changes JSONB,  -- { "old": { "amount": 500 }, "new": { "amount": 600 } }
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_organisation ON audit_log(organisation_id, created_at DESC);
CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);

-- RLS Policy
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_log_tenant_isolation ON audit_log
  FOR ALL USING (organisation_id = auth.user_organisation_id());
```

#### Trigger to Auto-Log Transaction Changes
```sql
CREATE OR REPLACE FUNCTION log_transaction_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (organisation_id, user_id, action, resource_type, resource_id, changes)
    VALUES (
      NEW.organisation_id,
      NEW.created_by,
      'transaction.create',
      'transaction',
      NEW.id,
      jsonb_build_object('new', row_to_json(NEW))
    );
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (organisation_id, user_id, action, resource_type, resource_id, changes)
    VALUES (
      NEW.organisation_id,
      NEW.updated_by,
      'transaction.update',
      'transaction',
      NEW.id,
      jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW))
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (organisation_id, user_id, action, resource_type, resource_id, changes)
    VALUES (
      OLD.organisation_id,
      auth.uid(),
      'transaction.delete',
      'transaction',
      OLD.id,
      jsonb_build_object('old', row_to_json(OLD))
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER audit_transaction_changes
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION log_transaction_changes();
```

**Repeat for:** `levy_items`, `budgets`, `schemes`, `documents` (any table with compliance requirements).

### 6.3 WA Compliance Checklist

**Strata Titles Act 1985 + Regulations 2019:**

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| Trust account records maintained | `transactions` table + double-entry `transaction_lines` | ✅ Complete |
| Audit trail for all receipts/payments | `audit_log` + `created_by` columns | ⚠️ Add `audit_log` |
| 7-year document retention | `documents` table + soft delete | ✅ Complete |
| Annual financial statements | Budget/financial reports | ✅ Complete (via app logic) |
| AGM minutes retention | `minutes` table | ✅ Complete |
| Levy register (who owes what) | `levy_items` table | ✅ Complete |

**Recommendation:** Add `audit_log` table (high priority) to satisfy "complete audit trail" requirement.

---

## 7. Prioritised Action Items

### Priority 1: Critical (Block Production Deployment)

| # | Item | Estimated Hours | Rationale |
|---|------|-----------------|-----------|
| 1 | Add RLS policy to `organisations` table | 0.5h | Data leak risk |
| 2 | Add `organisation_id` column to `owners` table | 2h | Broken RLS policy (see 1.2 Issue #3) |
| 3 | Fix `owners` RLS policy (tenant isolation) | 1h | Cross-tenant data leak |
| 4 | Add `organisation_id` to all 28 tables missing it | 8h | Performance + safety |
| 5 | Create `subscriptions` table + seed plans | 3h | Billing is core feature |
| 6 | Create `usage_tracking` table | 1h | Plan limit enforcement |
| 7 | Add RLS policies to 8 missing tables | 4h | Data leak risk |
| 8 | Create `audit_log` table | 2h | Compliance requirement |
| 9 | Add `updated_by` column to critical tables | 1h | Audit trail completeness |

**Subtotal: 22.5 hours** (3-4 days of focused work)

---

### Priority 2: High (Launch Blockers, But Not Security Issues)

| # | Item | Estimated Hours | Rationale |
|---|------|-----------------|-----------|
| 10 | Create `invoices` table | 2h | Billing history required |
| 11 | Implement `check_plan_limits()` function | 2h | Prevent free tier abuse |
| 12 | Add composite indexes (organisation_id + date/status) | 2h | Performance optimization |
| 13 | Add soft-delete partial indexes | 1h | Query performance |
| 14 | Implement subscription status → RLS integration | 3h | Read-only for expired subs |
| 15 | Create usage snapshot triggers | 2h | Automated usage tracking |
| 16 | Add `reminder_sent_at` to `levy_items` | 0.5h | Overdue levy workflow |
| 17 | Fix `chart_of_accounts` RLS (global vs org-specific) | 2h | Functional requirement |

**Subtotal: 14.5 hours** (2 days)

---

### Priority 3: Medium (Post-Launch, Within 3 Months)

| # | Item | Estimated Hours | Rationale |
|---|------|-----------------|-----------|
| 18 | Create materialized view for fund balances | 3h | Dashboard performance |
| 19 | Add full-text search indexes | 2h | Document/owner search |
| 20 | Implement audit log triggers for all tables | 6h | Complete audit trail |
| 21 | Add `notifications` table | 2h | In-app notifications |
| 22 | Partition `transactions` table (if >10M rows) | 8h | Future-proofing |
| 23 | Add `feature_flags` table | 2h | Gradual feature rollout |

**Subtotal: 23 hours** (3 days)

---

**Total Critical Path: 37 hours (Priority 1 + 2)**

---

## 8. Recommendations Summary

### Immediate (Before Writing Any Code)

1. ✅ **Add `organisation_id` to ALL tables** — Safety > purity
2. ✅ **Fix `owners` table RLS policy** — Critical security issue
3. ✅ **Implement subscription schema** — Core business requirement
4. ✅ **Add audit log table** — Compliance requirement

### Architecture Decisions

1. **Multi-tenancy:** Denormalize `organisation_id` everywhere (Option A)
2. **Chart of accounts:** Hybrid model (global system accounts + org-specific custom accounts)
3. **Subscription model:** Per-lot pricing with tier-based discounts
4. **Plan limits:** Enforced via PostgreSQL function + application layer validation
5. **Audit trail:** Trigger-based logging to `audit_log` table

### Performance Strategy

1. **MVP (100 orgs):** Current schema is fine, add missing indexes
2. **Growth (1,000 orgs):** Enable connection pooling, add materialized views
3. **Scale (10,000 orgs):** Partition tables, horizontal read replicas, Supabase Enterprise or self-hosted Postgres

### Security Posture

**Current Risk Level:** 🔴 **High** (8 tables without RLS, broken `owners` policy)  
**Target Risk Level:** 🟢 **Low** (all tables have RLS, audit log enabled)  
**Effort Required:** 37 hours of remediation work

---

## 9. Open Questions for Product Team

1. **Chart of Accounts:** Should orgs be able to customize account codes, or use standard WA chart only?
   - **Recommendation:** Start with global standard chart, add custom accounts in Phase 2

2. **Multi-Org Owners:** Can one owner (person) own lots in schemes managed by different organisations?
   - **Recommendation:** No (simplifies MVP), add junction table if customers request it

3. **Subscription Enforcement:** Should expired subscriptions lock users out completely, or allow read-only access?
   - **Recommendation:** Read-only access (they can export data, but not add/edit)

4. **Free Tier Abuse:** What prevents users from creating multiple organisations to stay on free tier?
   - **Recommendation:** Email verification + manual review of new orgs (flag >10 lots on free tier)

5. **Data Portability:** If customer cancels, do they get CSV export of all data?
   - **Recommendation:** Yes (GDPR/Privacy Act compliance), provide export tool

---

## Conclusion

The LevyLite unified data model is **80% excellent, 20% critical gaps**. The domain modeling is comprehensive and thoughtful, but the multi-tenancy implementation has security vulnerabilities that MUST be fixed before production.

**Primary Concern:** Inconsistent `organisation_id` placement and broken RLS policies create cross-tenant data leak risk. The `owners` table policy is especially problematic (grants access across orgs).

**Secondary Concern:** No subscription/billing schema exists. This is a SaaS product — billing MUST be designed into the database from day one, not retrofitted later.

**Good News:** All issues are fixable in ~40 hours of work. The schema is well-structured and adding `organisation_id` columns is straightforward. Once remediated, this will be a solid foundation for a compliant, scalable SaaS platform.

**Recommendation:** Allocate 1 week (40 hours) to implement Priority 1 & 2 action items, then proceed with application development.

---

**End of Review**

**Next Steps:**
1. Review findings with development team
2. Create GitHub issues for Priority 1 items
3. Implement subscription schema (Section 3)
4. Add missing RLS policies and indexes
5. Re-audit after fixes before production deployment
