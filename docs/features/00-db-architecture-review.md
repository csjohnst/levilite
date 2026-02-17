## LevyLite Database Architecture Review — Final Report

**Reviewer:** Database Architecture Specialist (Subagent)  
**Date:** 16 February 2026  
**Focus:** Multi-tenancy, Account Management, Payment/Subscription

---

## EXECUTIVE SUMMARY

**Verdict:** **DO NOT DEPLOY** until critical issues fixed. Estimated remediation: **40-60 hours**.

**Critical Security Issues Found:** 8  
**High-Priority Gaps:** 12  
**Architecture Score:** 6.5/10 (domain model excellent, security implementation incomplete)

---

## 1. MULTI-TENANT STRUCTURES: CRITICAL SECURITY GAPS

### 🔴 CRITICAL ISSUE #1: `organisations` Table Has No RLS Policy

```sql
-- CURRENT: No protection!
CREATE TABLE organisations (...)
-- Missing: ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;
```

**Impact:** Service role or misconfigured edge function can read ALL organisations across ALL tenants. Leaks company names, ABNs, addresses, phone numbers.

**Fix Required:**
```sql
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;

CREATE POLICY organisations_tenant_isolation ON organisations
  FOR ALL USING (
    id IN (SELECT organisation_id FROM organisation_users WHERE user_id = auth.uid())
  );
```

---

### 🔴 CRITICAL ISSUE #2: `owners` Table Lacks Tenant Scoping

```sql
-- BROKEN RLS POLICY FROM AUTH SPEC:
CREATE POLICY managers_full_access ON owners
  FOR ALL USING (
    EXISTS (SELECT 1 FROM organisation_users WHERE user_id = auth.uid() AND role IN ('manager', 'admin'))
  );
```

**This is CATASTROPHICALLY WRONG.** Manager from Org A can see ALL owners from Org B, C, D...

**Root Cause:** `owners` table has NO `organisation_id` column. Cannot scope to tenant.

**Fix Required:**
```sql
ALTER TABLE owners ADD COLUMN organisation_id UUID NOT NULL REFERENCES organisations(id);

CREATE POLICY owners_tenant_isolation ON owners
  FOR ALL USING (organisation_id = auth.user_organisation_id());

-- Unique constraint must be scoped per org
CREATE UNIQUE INDEX idx_owners_email_per_org ON owners(organisation_id, email);
```

---

### 🔴 CRITICAL ISSUE #3: 28 Tables Missing Direct `organisation_id`

Current design relies on foreign key chain inheritance:

```sql
-- Example: levy_items
lot_id → lots.scheme_id → schemes.organisation_id
```

**Problems:**

1. **Performance:** Every RLS policy requires JOINs. For `levy_items`:
   ```sql
   CREATE POLICY tenant_isolation ON levy_items USING (
     lot_id IN (
       SELECT id FROM lots WHERE scheme_id IN (
         SELECT id FROM schemes WHERE organisation_id = auth.user_organisation_id()
       )
     )
   );
   ```
   This is a **triple-nested subquery** executed on EVERY row access.

2. **Data Leak Risk:** If JOIN fails or is omitted in complex query, rows leak across tenants.

3. **Realtime Performance:** Supabase Realtime evaluates RLS on EVERY change event. Nested subqueries = CPU spike during bulk operations.

**Solution:** Add `organisation_id` to ALL tables.

```sql
-- Example implementation with trigger
ALTER TABLE levy_items ADD COLUMN organisation_id UUID NOT NULL REFERENCES organisations(id);

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

-- Then simplify RLS policy:
CREATE POLICY tenant_isolation ON levy_items
  FOR ALL USING (organisation_id = auth.user_organisation_id());

-- Add index:
CREATE INDEX idx_levy_items_organisation_id ON levy_items(organisation_id);
```

**Tables Requiring This Fix (28 total):**
- `lots`, `lot_ownerships`, `owners`, `committee_members`, `tenants`
- `financial_years`, `transactions`, `transaction_lines`, `levy_schedules`, `levy_periods`, `levy_items`, `payment_allocations`, `budgets`, `budget_line_items`, `bank_statements`, `reconciliations`
- `meetings`, `agenda_items`, `attendees`, `proxies`, `resolutions`, `minutes`
- `maintenance_requests`, `maintenance_comments`, `quotes`, `invoices`, `maintenance_attachments`
- `documents`, `document_versions`

---

### 🔴 CRITICAL ISSUE #4: Service Role Bypass Not Implemented

Edge functions with service role can bypass RLS, but there's no explicit policy to handle this safely.

**Fix Required:**
```sql
-- Example: Allow service role to bypass for background jobs
CREATE POLICY levy_items_service_role ON levy_items
  FOR ALL TO service_role
  USING (true);
```

**Developer Guideline Addition:**
```typescript
// ❌ DANGEROUS: Service role query without org filter
const { data } = await supabase.from('levy_items').select('*').eq('status', 'overdue');

// ✅ SAFE: Always include explicit organisation_id filter
const { data } = await supabase.from('levy_items')
  .select('*')
  .eq('organisation_id', validatedOrgId)
  .eq('status', 'overdue');
```

---

### 🔴 CRITICAL ISSUE #5: `auth.user_organisation_id()` Function Has Ambiguity

```sql
CREATE OR REPLACE FUNCTION auth.user_organisation_id() RETURNS UUID AS $$
  SELECT organisation_id FROM organisation_users WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

**Problem:** `LIMIT 1` returns arbitrary organisation if user belongs to multiple. Database schema ALLOWS `(org_id, user_id)` composite PK = user can have multiple memberships.

**Impact:** If multi-org support is added later, this function silently breaks and returns wrong org.

**Fix Required (MVP):**
```sql
-- Option A: Enforce one org per user
CREATE UNIQUE INDEX idx_organisation_users_one_per_user ON organisation_users(user_id);
```

**Fix Required (Future):**
```sql
-- Option B: Use session variable for multi-org support
CREATE OR REPLACE FUNCTION auth.user_organisation_id() RETURNS UUID AS $$
  SELECT COALESCE(
    current_setting('app.current_organisation_id', true)::uuid,
    (SELECT organisation_id FROM organisation_users WHERE user_id = auth.uid() LIMIT 1)
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

---

### Missing RLS Policies (8 Tables)

| Table | Status | Risk | Fix Effort |
|-------|--------|------|------------|
| `organisations` | ❌ Missing | Critical | 0.5h |
| `transaction_lines` | ❌ Missing | High | 1h |
| `document_versions` | ⚠️ Exists but inefficient | Medium | 1h |
| `chart_of_accounts` | ❌ Missing | Medium | 2h (needs hybrid global/org model) |
| `audit_log` | ⚠️ Exists (managers only) | Low | OK |
| `invitations` | ⚠️ Exists but allows NULL org | Medium | 0.5h |
| `notifications` | ❌ Missing (table exists but no policy defined) | Medium | 0.5h |
| `email_log` | ⚠️ Exists (managers only) | Low | OK |

---

### Missing Indexes for Multi-Tenancy (Critical for Performance)

```sql
-- Add these immediately:
CREATE INDEX idx_owners_organisation_id ON owners(organisation_id);
CREATE INDEX idx_lot_ownerships_organisation_id ON lot_ownerships(organisation_id);
CREATE INDEX idx_transactions_organisation_id ON transactions(organisation_id);
CREATE INDEX idx_levy_items_organisation_id ON levy_items(organisation_id);
CREATE INDEX idx_documents_organisation_id ON documents(organisation_id);

-- Composite indexes for common queries:
CREATE INDEX idx_transactions_org_date ON transactions(organisation_id, transaction_date DESC);
CREATE INDEX idx_levy_items_org_status ON levy_items(organisation_id, status);
CREATE INDEX idx_maintenance_requests_org_status ON maintenance_requests(organisation_id, status);

-- Partial indexes for soft-delete queries:
CREATE INDEX idx_schemes_active ON schemes(organisation_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_active ON transactions(organisation_id, transaction_date DESC) WHERE deleted_at IS NULL;
```

---

### Recommendation: Multi-Tenancy Remediation Plan

**Step 1 (Critical - 8 hours):**
1. Add `organisation_id` to `owners` table (2h)
2. Add RLS policy to `organisations` table (0.5h)
3. Fix `owners` RLS policy (1h)
4. Add `organisation_id` to top 5 high-volume tables: `lots`, `transactions`, `levy_items`, `documents`, `maintenance_requests` (3h)
5. Add missing indexes (1h)
6. Test cross-tenant isolation (0.5h)

**Step 2 (High Priority - 10 hours):**
7. Add `organisation_id` to remaining 23 tables (6h)
8. Implement service role policies (2h)
9. Add composite indexes (2h)

**Step 3 (Post-Launch - 6 hours):**
10. Add partial indexes for soft-delete (1h)
11. Create materialized views for reporting (3h)
12. Implement full-text search indexes (2h)

**Total: 24 hours for multi-tenancy hardening.**

---

## 2. ACCOUNT MANAGEMENT STRUCTURES

### ✅ STRENGTH: Role Model is Sound

```sql
CREATE TABLE organisation_users (
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('manager', 'admin', 'auditor')),
  ...
  PRIMARY KEY (organisation_id, user_id)
);
```

**Good:**
- Clear role hierarchy (manager > admin > auditor > owner)
- Composite PK allows future multi-org support
- Junction table pattern is correct

**Issue:** `owners` table has separate structure with `auth_user_id` column. This creates two parallel auth systems:
- Staff/auditors: `organisation_users` table
- Owners: `owners` table with `auth_user_id`

**Impact:** Code must handle two different auth patterns. Inconsistent.

**Recommendation:**
```sql
-- Option A: Unify into single user table (complex migration)
-- Option B: Accept dual pattern but document clearly (acceptable for MVP)
```

For MVP: **Accept dual pattern.** Owner portal requirements differ enough from staff portal that separate tables make sense.

---

### ⚠️ ISSUE: `committee_members` Not Integrated with Permissions

`committee_members` table exists, but there's NO RLS policy or helper function to check committee membership.

**Use Case:** Committee members should see committee-only documents. Current spec says:
```sql
-- documents.visibility CHECK (visibility IN ('owners', 'committee', 'manager_only'))
```

But there's NO policy enforcing this for committee members!

**Fix Required:**
```sql
-- Helper function
CREATE OR REPLACE FUNCTION auth.is_committee_member(p_scheme_id UUID) 
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM committee_members cm
    JOIN owners o ON cm.owner_id = o.id
    WHERE o.auth_user_id = auth.uid()
      AND cm.scheme_id = p_scheme_id
      AND cm.is_active = TRUE
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- RLS policy for documents
CREATE POLICY documents_committee_access ON documents
  FOR SELECT USING (
    visibility = 'committee' AND auth.is_committee_member(scheme_id)
  );
```

---

### Missing: User Invitation & Onboarding Tables

Auth spec defines invitation flow, but database schema has inconsistencies:

```sql
-- Invitation table exists but column naming is inconsistent:
CREATE TABLE invitations (
  role TEXT,  -- 'manager', 'admin', 'auditor', 'owner'
  owner_id UUID REFERENCES owners(id),  -- For owner portal invitations
  ...
);
```

**Issues:**
1. `role` column allows `'owner'` but `organisation_users` table doesn't support owner role (owners are in separate table)
2. `owner_id` column implies linking to existing `owners` record, but flow should be: invite → create owner → link to lots

**Fix Required:**
```sql
ALTER TABLE invitations ADD COLUMN lot_ids UUID[];  -- For owner portal invites
-- When accepted: create owner record + lot_ownerships records
```

---

### Missing: User Session Management Table

Auth spec mentions limiting concurrent sessions (3 per user), but no database table exists.

**Add:**
```sql
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);
```

---

### Missing: Permission Audit Trail

**Requirement:** Log role changes, user invitations, deactivations.

**Current:** `audit_log` table exists but only logs data changes, not auth events.

**Fix Required:**
```sql
-- Add auth events to audit_log
-- Trigger on organisation_users INSERT/UPDATE/DELETE
CREATE TRIGGER audit_organisation_users 
  AFTER INSERT OR UPDATE OR DELETE ON organisation_users
  FOR EACH ROW EXECUTE FUNCTION log_audit();
```

---

### Recommendation: Account Management Fixes

**Priority 1 (4 hours):**
1. Implement `is_committee_member()` helper and RLS policy (1h)
2. Add `user_sessions` table (1h)
3. Fix `invitations` table for owner portal flow (1h)
4. Add auth event audit logging (1h)

**Priority 2 (2 hours):**
5. Add `owner_id` to `organisation_users` for unified auth view (1h)
6. Document dual auth pattern in tech docs (1h)

---

## 3. PAYMENT & SUBSCRIPTION STRUCTURES: COMPLETELY MISSING

**This is a SaaS product with tiered pricing. There is NO subscription schema.**

### Required Tables (Designed by DB Review Doc)

The review document Section 3 provides excellent subscription schema. I'll highlight critical points:

**1. `subscription_plans` Table:**
```sql
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code VARCHAR(20) NOT NULL UNIQUE,  -- 'free', 'starter', 'professional', 'growth'
  price_per_lot_monthly DECIMAL(10,2) NOT NULL,
  min_lots INTEGER NOT NULL DEFAULT 0,
  max_lots INTEGER,  -- NULL = unlimited
  max_schemes INTEGER,
  features JSONB,  -- Feature flags per plan
  stripe_price_id VARCHAR(100),
  ...
);
```

**Seed Data:**
```sql
INSERT INTO subscription_plans (plan_code, plan_name, price_per_lot_monthly, min_lots, max_lots) VALUES
  ('free', 'Free', 0.00, 1, 10),
  ('starter', 'Starter', 2.50, 11, 100),
  ('professional', 'Professional', 1.50, 101, 500),
  ('growth', 'Growth', 1.00, 501, 2000),
  ('enterprise', 'Enterprise', 0.75, 2001, NULL);
```

**Note:** Pricing updated to match website (Feb 2026): First 10 free, then $2.50/$1.50/$1.00/$0.75 graduated tiers.

---

**2. `subscriptions` Table:**
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status TEXT NOT NULL CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'paused')),
  billed_lots_count INTEGER NOT NULL DEFAULT 0,  -- Snapshot at billing cycle start
  stripe_customer_id VARCHAR(100),
  stripe_subscription_id VARCHAR(100),
  current_period_start DATE NOT NULL,
  current_period_end DATE NOT NULL,
  trial_end_date DATE,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  ...
  UNIQUE(organisation_id)  -- One subscription per org
);
```

**Critical:** `billed_lots_count` is snapshotted at cycle start, not calculated dynamically. Prevents mid-cycle pricing surprises.

---

**3. `usage_tracking` Table:**
```sql
CREATE TABLE usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  tracked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_lots INTEGER NOT NULL DEFAULT 0,
  total_schemes INTEGER NOT NULL DEFAULT 0,
  total_users INTEGER NOT NULL DEFAULT 0,
  snapshot_type TEXT CHECK (snapshot_type IN ('hourly', 'daily', 'billing_cycle')),
  ...
);
```

**Purpose:**
- Billing snapshot: Record lot count at start of billing cycle
- Plan limit enforcement: Alert when org approaches tier limit (e.g., 48/50 lots on Starter)
- Analytics: Track growth over time

---

**4. `invoices` Table:**
```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id),
  invoice_number VARCHAR(50) NOT NULL UNIQUE,
  subtotal DECIMAL(12,2) NOT NULL,
  tax_amount DECIMAL(12,2) DEFAULT 0,  -- GST
  total_amount DECIMAL(12,2) NOT NULL,
  invoice_date DATE NOT NULL,
  due_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'void')),
  stripe_invoice_id VARCHAR(100),
  line_items JSONB,  -- Flexible for add-ons, discounts
  pdf_url TEXT,
  ...
);
```

**Line Items Example (100 lots, graduated pricing):**
```json
{
  "items": [
    {
      "description": "First 10 lots (free)",
      "quantity": 10,
      "unit_price": 0.00,
      "amount": 0.00
    },
    {
      "description": "Lots 11-100 @ $2.50/lot/month",
      "quantity": 90,
      "unit_price": 2.50,
      "amount": 225.00
    },
    {
      "description": "GST (10%)",
      "amount": 22.50
    }
  ],
  "subtotal": 225.00,
  "tax": 22.50,
  "total": 247.50
}
```

---

### Missing: Plan Limit Enforcement

**Use Case:** Org on Starter plan (max 50 lots) tries to add 51st lot.

**Fix Required:**
```sql
-- Function from review doc Section 3:
CREATE OR REPLACE FUNCTION check_plan_limits(org_id UUID)
RETURNS TABLE(within_limits BOOLEAN, message TEXT) AS $$
DECLARE
  current_lots INTEGER;
  plan_max_lots INTEGER;
BEGIN
  current_lots := (SELECT COUNT(*) FROM lots WHERE scheme_id IN (SELECT id FROM schemes WHERE organisation_id = org_id));
  plan_max_lots := (SELECT sp.max_lots FROM subscriptions s JOIN subscription_plans sp ON s.plan_id = sp.id WHERE s.organisation_id = org_id);
  
  IF plan_max_lots IS NOT NULL AND current_lots >= plan_max_lots THEN
    RETURN QUERY SELECT FALSE, format('Lot limit reached: %s/%s. Upgrade to add more lots.', current_lots, plan_max_lots);
  ELSE
    RETURN QUERY SELECT TRUE, 'Within plan limits';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Trigger on lot insert:**
```sql
CREATE OR REPLACE FUNCTION enforce_lot_limit()
RETURNS TRIGGER AS $$
DECLARE
  check_result RECORD;
BEGIN
  SELECT * INTO check_result FROM check_plan_limits((SELECT organisation_id FROM schemes WHERE id = NEW.scheme_id));
  IF NOT check_result.within_limits THEN
    RAISE EXCEPTION '%', check_result.message;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_lot_limit_trigger
  BEFORE INSERT ON lots
  FOR EACH ROW EXECUTE FUNCTION enforce_lot_limit();
```

---

### Missing: Subscription Status → RLS Integration

**Use Case:** Org's subscription expires (status = 'past_due'). They should get read-only access, not full write.

**Fix Required:**
```sql
-- Helper function
CREATE OR REPLACE FUNCTION has_active_subscription()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM subscriptions
    WHERE organisation_id = auth.user_organisation_id()
      AND status IN ('active', 'trialing')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- RLS policy example (schemes table)
CREATE POLICY schemes_write_requires_active_sub ON schemes
  FOR INSERT TO authenticated
  USING (has_active_subscription());

CREATE POLICY schemes_update_requires_active_sub ON schemes
  FOR UPDATE TO authenticated
  USING (has_active_subscription());

CREATE POLICY schemes_delete_requires_active_sub ON schemes
  FOR DELETE TO authenticated
  USING (has_active_subscription());

-- READ access always allowed (can export data even if expired)
CREATE POLICY schemes_read_always ON schemes
  FOR SELECT TO authenticated
  USING (organisation_id = auth.user_organisation_id());
```

---

### Missing: Stripe Webhook Event Log

**Purpose:** Debug failed payments, reconcile subscription changes, replay failed events.

**Fix Required:**
```sql
CREATE TABLE payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id),
  event_type TEXT NOT NULL,  -- 'invoice.paid', 'customer.subscription.updated'
  stripe_event_id VARCHAR(100) NOT NULL UNIQUE,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_events_stripe_event ON payment_events(stripe_event_id);
CREATE INDEX idx_payment_events_processed ON payment_events(processed) WHERE NOT processed;
```

---

### Missing: Free Tier Abuse Prevention

**Problem:** What stops user from creating 10 organisations with 9 lots each = 90 lots on free tier?

**Mitigation Required:**
1. **Email verification:** One email = one organisation
2. **Manual review:** Flag new orgs approaching free tier limit of 10 lots (likely existing business trying to avoid payment)
3. **Usage tracking:** Monitor email patterns (same IP, similar org names)

**Database Support:**
```sql
ALTER TABLE organisations ADD COLUMN created_by_email TEXT NOT NULL;
ALTER TABLE organisations ADD COLUMN requires_manual_review BOOLEAN DEFAULT FALSE;

-- Trigger to flag suspicious sign-ups
CREATE OR REPLACE FUNCTION flag_suspicious_orgs()
RETURNS TRIGGER AS $$
BEGIN
  -- Flag if email has 2+ orgs
  IF (SELECT COUNT(*) FROM organisations WHERE created_by_email = NEW.created_by_email) > 1 THEN
    NEW.requires_manual_review := TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

### Recommendation: Subscription Schema Implementation

**Priority 1 (8 hours):**
1. Create `subscription_plans` table + seed data (1h)
2. Create `subscriptions` table (1h)
3. Create `usage_tracking` table (1h)
4. Implement `check_plan_limits()` function + trigger (2h)
5. Create `invoices` table (1h)
6. Add `has_active_subscription()` helper + RLS policies (2h)

**Priority 2 (4 hours):**
7. Create `payment_events` table (1h)
8. Implement free tier abuse prevention (2h)
9. Add `organisations.subscription_id` foreign key (0.5h)
10. Create billing cycle snapshot function (0.5h)

**Total: 12 hours for complete subscription system.**

---

## CRITICAL ANTI-PATTERNS FOUND

### 1. Enum Values Not Lowercase

❌ **Bad:**
```sql
status TEXT CHECK (status IN ('PENDING', 'SENT', 'PAID'))
```

✅ **Good:**
```sql
status TEXT CHECK (status IN ('pending', 'sent', 'paid'))
```

**Found in:** Spec is inconsistent. Some enums are lowercase, others might slip through uppercase.

---

### 2. Missing Foreign Key ON DELETE Behavior

Some foreign keys don't specify `ON DELETE CASCADE` or `ON DELETE SET NULL`.

**Example:** `transactions.created_by` should be `ON DELETE SET NULL` (preserve transactions even if user deleted).

**Audit Required:** Review all foreign keys for correct delete behavior.

---

### 3. `DECIMAL(12,2)` for Money Is Correct

✅ **Good:** Using DECIMAL for financial amounts (not FLOAT/DOUBLE).

**Validation:** All money columns use `DECIMAL(12,2)` or similar. Correct.

---

### 4. Missing `DEFAULT NOW()` on Some Timestamps

Some `created_at` columns lack `DEFAULT NOW()`.

**Fix Required:** Audit all timestamp columns, add default where missing.

---

## PRIORITIZED FIX LIST (60 HOURS TOTAL)

### Critical (Must Fix Before Launch) — 24 hours

| Priority | Task | Hours | Blocker? |
|----------|------|-------|----------|
| 1 | Add `organisation_id` to `owners` + fix RLS | 2h | ✅ Yes |
| 2 | Add RLS policy to `organisations` table | 0.5h | ✅ Yes |
| 3 | Add `organisation_id` to top 5 tables | 3h | ✅ Yes |
| 4 | Create subscription schema (4 tables) | 4h | ✅ Yes |
| 5 | Implement plan limit enforcement | 2h | ✅ Yes |
| 6 | Add subscription status → RLS integration | 2h | ✅ Yes |
| 7 | Add missing indexes (multi-tenancy) | 2h | ✅ Yes |
| 8 | Fix service role bypass policies | 2h | ✅ Yes |
| 9 | Add `audit_log` table + triggers | 3h | ⚠️ Compliance |
| 10 | Add `updated_by` columns to critical tables | 1h | ⚠️ Compliance |
| 11 | Test cross-tenant isolation (manual) | 2.5h | ✅ Yes |

**Subtotal: 24 hours**

---

### High Priority (Launch Week) — 16 hours

| Priority | Task | Hours |
|----------|------|-------|
| 12 | Add `organisation_id` to remaining 23 tables | 6h |
| 13 | Add composite indexes | 2h |
| 14 | Implement committee member permissions | 1h |
| 15 | Add `user_sessions` table | 1h |
| 16 | Create `payment_events` table | 1h |
| 17 | Implement free tier abuse prevention | 2h |
| 18 | Add partial indexes for soft-delete | 1h |
| 19 | Fix `chart_of_accounts` RLS (hybrid model) | 2h |

**Subtotal: 16 hours**

---

### Medium Priority (Month 1 Post-Launch) — 20 hours

| Priority | Task | Hours |
|----------|------|-------|
| 20 | Materialized view for fund balances | 3h |
| 21 | Full-text search indexes | 2h |
| 22 | Audit log triggers for all tables | 6h |
| 23 | Add `notifications` table + RLS | 2h |
| 24 | Document dual auth pattern (tech docs) | 2h |
| 25 | Performance testing (1,000 lot simulation) | 3h |
| 26 | Security penetration test (cross-tenant) | 2h |

**Subtotal: 20 hours**

---

## FINAL RECOMMENDATIONS

### 1. DO THIS IMMEDIATELY

**Allocate 1 week (40 hours) to implement Critical + High Priority fixes.** Do NOT write application code until these are done.

**Critical Path:**
1. Multi-tenancy hardening (24h)
2. Subscription schema (12h)
3. Account management fixes (4h)

**Total: 40 hours = 1 week full-time OR 2 weeks part-time**

---

### 2. ARCHITECTURE DECISIONS REQUIRED

**Decision 1:** Denormalize `organisation_id` everywhere?
- **Recommendation:** ✅ Yes (Option A: safety > purity)

**Decision 2:** Chart of accounts global or per-org?
- **Recommendation:** Hybrid (global system accounts + org-specific custom)

**Decision 3:** Expired subscription = locked out or read-only?
- **Recommendation:** Read-only (allow data export)

**Decision 4:** Multi-org support in MVP?
- **Recommendation:** No (add unique constraint on `organisation_users.user_id`)

**Decision 5:** Plan limit enforcement at DB or app layer?
- **Recommendation:** Both (DB trigger for hard stop, app layer for UX warnings)

---

### 3. POST-LAUNCH MONITORING

**Set up alerts for:**
1. Cross-tenant query attempts (monitor audit log for suspicious patterns)
2. Plan limit violations (usage approaching tier max)
3. Failed Stripe webhooks (payment_events.processed = false)
4. Slow queries (>500ms on levy roll, transaction reports)

---

### 4. WHAT'S GOOD

**Strengths of Current Design:**
- ✅ Comprehensive domain modeling (all strata workflows covered)
- ✅ Double-entry accounting implemented correctly
- ✅ Soft-delete pattern (audit trail preservation)
- ✅ Junction tables for many-to-many relationships
- ✅ Supabase Auth integration is sound
- ✅ Trigger-based audit logging approach is correct
- ✅ Document versioning and retention designed well

**The fundamentals are solid. Fix the security gaps and this will be excellent.**

---

## CONCLUSION

**LevyLite database schema: 80% excellent, 20% critical gaps.**

**Primary Concern:** Multi-tenancy security is incomplete. Missing `organisation_id` columns + broken RLS policies = cross-tenant data leak risk.

**Secondary Concern:** No subscription/billing schema exists. This is a SaaS product — billing MUST be in the database from day one.

**Good News:** All issues are fixable in 40-60 hours. Once remediated, this will be a solid foundation for a secure, scalable, compliant strata management SaaS.

**DO NOT DEPLOY until Critical + High Priority fixes complete.**

---

**Report Complete**  
**Next Step:** Create GitHub issues for all Critical items, assign to development sprint.