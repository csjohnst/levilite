# LevyLite Feature Specification: Subscription & Billing

**Feature ID:** 11
**Version:** 1.0
**Last Updated:** 17 February 2026
**Owner:** Chris Johnstone, Kokoro Software
**Status:** Specification

---

## 1. Overview

This feature covers LevyLite's **SaaS subscription and billing system** -- the business layer that controls how customers sign up for, pay for, and manage their LevyLite subscription. This is the platform billing layer, NOT the strata levy/trust accounting features (covered in features 03 and 04).

### Scope

**In scope:**
- Graduated per-lot pricing model
- Free tier with 14-day full-feature trial
- Stripe integration (Billing, Checkout, Customer Portal, Webhooks)
- Subscription lifecycle management (trial, active, past_due, canceled, paused)
- Plan limit enforcement (lot count, scheme count, feature gating)
- Usage tracking and billing cycle snapshots
- Self-service plan management (upgrade, downgrade, cancel)
- BECS Direct Debit support for Australian B2B customers

**Out of scope:**
- Strata levy collection from lot owners (feature 03)
- Trust accounting (feature 04)
- Financial reporting (feature 08)

### Design Philosophy

1. **No credit card for trial:** Reduce friction. 14-day trial of all features, then choose: stay on free tier or add payment.
2. **Graduated pricing, not tiered plans:** No arbitrary plan names or feature cliffs. Price scales smoothly with lot count. Every paid customer gets every feature.
3. **Stripe handles complexity:** Stripe Billing for recurring charges, Checkout for payment capture, Customer Portal for self-service. We sync state via webhooks, not polling.
4. **Database is source of truth for access control:** Subscription status flows into RLS policies. Expired subscription = read-only access. No application-layer-only gating.

### Success Criteria

- Trial-to-paid conversion rate >15%
- Zero billing errors in first 6 months
- Self-service management handles >90% of billing changes (no support tickets)
- Subscription status changes propagate to RLS within 30 seconds of webhook receipt

---

## 2. User Stories

### Signup & Trial

- **As a strata manager,** I want to sign up for LevyLite without entering a credit card, so I can evaluate the platform risk-free.
- **As a strata manager,** I want a 14-day trial of all features, so I can test trust accounting, bulk levy notices, and financial reporting before paying.
- **As a self-managed scheme treasurer,** I want to use LevyLite for free for my small scheme (10 lots or fewer), so I can manage levies and documents without paying for software.

### Plan Selection & Payment

- **As a strata manager,** I want to see a pricing calculator on the landing page, so I can estimate my monthly cost before signing up.
- **As a strata manager,** I want to choose between monthly and annual billing, so I can save money by paying annually (2 months free).
- **As a strata manager,** I want to pay via BECS Direct Debit, so I can use my business bank account instead of a credit card.

### Subscription Management

- **As a strata manager,** I want to upgrade my subscription immediately when I add more lots, so I am not blocked from adding schemes.
- **As a strata manager,** I want to downgrade at the end of my billing period, so I am not charged for features I no longer need.
- **As a strata manager,** I want to cancel my subscription and retain access until the end of the billing period, so I can export my data before losing write access.
- **As a strata manager,** I want to update my payment method without contacting support, so I can fix a failed payment quickly.
- **As a strata manager,** I want to view my invoice history in the app, so I can download invoices for my records.

### Billing Transparency

- **As a strata manager,** I want to understand how my bill is calculated (graduated pricing), so there are no billing surprises.
- **As a strata manager,** I want to receive an email receipt after each successful payment, so I have a record for my accountant.

---

## 3. Graduated Pricing Model

### Pricing Tiers (ex GST)

All prices are in Australian dollars, exclusive of GST.

| Lot Range | Rate (ex GST) | Cumulative Example |
|-----------|---------------|-------------------|
| **First 10 lots** | Free | $0/month |
| **Lots 11-100** | $2.50/lot/month | 50 lots = 40 x $2.50 = $100/month |
| **Lots 101-500** | $1.50/lot/month | 300 lots = (90 x $2.50) + (200 x $1.50) = $525/month |
| **Lots 501-2,000** | $1.00/lot/month | 1,000 lots = (90 x $2.50) + (400 x $1.50) + (500 x $1.00) = $1,325/month |
| **Lots 2,001+** | $0.75/lot/month | — |

**Graduated pricing** means each tier applies only to lots within that range. There are no price cliffs -- adding one more lot never causes a disproportionate price jump.

### Calculation Example

A customer managing 100 lots across 8 schemes:

```
Lots 1-10:    10 lots x $0     =   $0.00
Lots 11-100:  90 lots x $2.50  = $225.00
                                 --------
Monthly subtotal (ex GST):       $225.00
GST (10%):                        $22.50
Monthly total (inc GST):         $247.50
```

### Annual Billing Discount

**2 months free** when paying annually (pay for 10 months, get 12).

```
Monthly billing:  $225/month x 12 = $2,700/year (ex GST)
Annual billing:   $225/month x 10 = $2,250/year (ex GST) -- save $450
```

### What Paid Includes

All paid subscriptions (11+ lots) include every feature:
- Unlimited schemes
- Unlimited users (managers, admins, auditors)
- Trust accounting
- Bulk levy notices
- Financial reporting
- CSV import/export
- Owner portal
- Document storage (fair use 50GB)
- Email support (24-48h response)

### Price Calculation Function

```typescript
// lib/billing/calculate-price.ts

interface PricingTier {
  minLot: number;
  maxLot: number | null;
  ratePerLot: number; // ex GST, monthly
}

const PRICING_TIERS: PricingTier[] = [
  { minLot: 1, maxLot: 10, ratePerLot: 0 },
  { minLot: 11, maxLot: 100, ratePerLot: 2.5 },
  { minLot: 101, maxLot: 500, ratePerLot: 1.5 },
  { minLot: 501, maxLot: 2000, ratePerLot: 1.0 },
  { minLot: 2001, maxLot: null, ratePerLot: 0.75 },
];

const GST_RATE = 0.10;
const ANNUAL_DISCOUNT_MONTHS = 10; // pay 10, get 12

export function calculateMonthlyPrice(totalLots: number): {
  subtotalExGst: number;
  gst: number;
  totalIncGst: number;
  breakdown: { tier: string; lots: number; rate: number; amount: number }[];
} {
  let remaining = totalLots;
  let subtotal = 0;
  const breakdown: { tier: string; lots: number; rate: number; amount: number }[] = [];

  for (const tier of PRICING_TIERS) {
    if (remaining <= 0) break;

    const tierSize = tier.maxLot
      ? tier.maxLot - tier.minLot + 1
      : remaining;
    const lotsInTier = Math.min(remaining, tierSize);
    const amount = lotsInTier * tier.ratePerLot;

    breakdown.push({
      tier: tier.maxLot
        ? `Lots ${tier.minLot}-${tier.maxLot}`
        : `Lots ${tier.minLot}+`,
      lots: lotsInTier,
      rate: tier.ratePerLot,
      amount,
    });

    subtotal += amount;
    remaining -= lotsInTier;
  }

  const gst = subtotal * GST_RATE;

  return {
    subtotalExGst: subtotal,
    gst,
    totalIncGst: subtotal + gst,
    breakdown,
  };
}

export function calculateAnnualPrice(totalLots: number): {
  subtotalExGst: number;
  gst: number;
  totalIncGst: number;
  monthlyEquivalent: number;
  savings: number;
} {
  const monthly = calculateMonthlyPrice(totalLots);
  const annualSubtotal = monthly.subtotalExGst * ANNUAL_DISCOUNT_MONTHS;
  const gst = annualSubtotal * GST_RATE;
  const fullYearCost = monthly.subtotalExGst * 12;

  return {
    subtotalExGst: annualSubtotal,
    gst,
    totalIncGst: annualSubtotal + gst,
    monthlyEquivalent: annualSubtotal / 12,
    savings: fullYearCost - annualSubtotal,
  };
}
```

---

## 4. Free Tier Restrictions

### During 14-Day Trial

All features are unlocked regardless of lot count. The trial period begins when the organisation is created (not when lots are added).

### After Trial Expiry (Free Tier)

**Limits:**
- Maximum 10 lots
- Maximum 1 scheme

**Included features:**
- Scheme and lot register
- Levy management (manual notices only -- no bulk send)
- Document storage
- Owner portal
- Meeting administration

**Excluded features (require paid subscription):**
- Trust accounting
- Bulk levy notices (email to all owners in one action)
- Financial reporting (income statement, budget vs. actual, EOFY)
- CSV import/export

### Trial Expiry Flow

```
Day 1:   Sign up -> create org -> trial starts (all features)
Day 10:  Email: "Your trial ends in 4 days. Add payment to keep all features."
Day 13:  Email: "Your trial ends tomorrow."
Day 14:  Trial expires.
         -> If org has >10 lots or >1 scheme: prompt to select paid plan.
         -> If org has <=10 lots and <=1 scheme: fallback to free tier.
         -> Excluded features show "Upgrade to unlock" overlay.
```

### Feature Gating Implementation

```typescript
// lib/billing/feature-gate.ts

type Feature =
  | 'trust_accounting'
  | 'bulk_levy_notices'
  | 'financial_reporting'
  | 'csv_import_export';

const PAID_ONLY_FEATURES: Feature[] = [
  'trust_accounting',
  'bulk_levy_notices',
  'financial_reporting',
  'csv_import_export',
];

export function canAccessFeature(
  subscriptionStatus: string,
  trialEndDate: Date | null,
  feature: Feature
): boolean {
  // Active or trialing subscriptions have all features
  if (subscriptionStatus === 'active') return true;

  // During trial, all features are available
  if (subscriptionStatus === 'trialing' && trialEndDate && new Date() < trialEndDate) {
    return true;
  }

  // Free tier: check if feature is paid-only
  return !PAID_ONLY_FEATURES.includes(feature);
}
```

---

## 5. Signup & Onboarding Flow

### Landing Page Pricing Calculator

The public landing page includes an interactive pricing calculator:

1. User enters total number of lots (slider or number input)
2. Calculator shows monthly and annual price with graduated breakdown
3. "Start free trial" CTA button (no credit card required)

### Signup Flow

```
1. Landing page -> Click "Start Free Trial"
2. /signup page:
   - Enter email, full name, organisation name
   - Accept terms of service
   - Submit -> Supabase Auth creates user
3. Auth hook creates:
   - organisation record
   - organisation_users record (role: 'manager')
   - subscription record (status: 'trialing', trial_end_date: NOW() + 14 days)
4. Redirect to /dashboard (onboarding wizard)
5. Onboarding wizard:
   - Step 1: "Add your first scheme" (name, address, plan number)
   - Step 2: "Add lots" (manual or CSV import)
   - Step 3: "Invite your team" (optional, skip for now)
```

### Trial Expiry -> Plan Selection

```
1. Trial expires (14 days after signup)
2. User logs in -> redirect to /billing/select-plan
3. /billing/select-plan page:
   - Shows current lot count
   - Calculates monthly/annual price
   - "Choose Monthly" or "Choose Annual" buttons
4. Click button -> POST /api/billing/create-checkout-session
5. Redirect to Stripe Checkout (hosted page)
6. Payment succeeds -> Stripe webhook fires -> subscription status = 'active'
7. Redirect back to /dashboard
```

### Trial-to-Free Fallback

If the user does not add payment after trial expiry and their organisation has 10 or fewer lots and 1 or fewer schemes:

```
1. Subscription status changes from 'trialing' to 'free'
2. Paid-only features are gated (show "Upgrade to unlock")
3. User can continue using free features indefinitely
4. If they later add lots beyond the free limit, they are prompted to subscribe
```

---

## 6. Stripe Integration

### Stripe Products Used

| Product | Purpose |
|---------|---------|
| **Stripe Billing** | Recurring subscription management |
| **Stripe Checkout** | Hosted payment page for initial subscription |
| **Stripe Customer Portal** | Self-service billing management (update payment, view invoices) |
| **Stripe Webhooks** | Sync subscription state changes to database |
| **Stripe Tax** | Not used -- GST is a flat 10%, calculated in-app |

### Stripe Configuration

```typescript
// Stripe product structure:
// - One Stripe Product: "LevyLite Subscription"
// - Two Stripe Prices (graduated):
//   - Monthly: graduated tiers matching our pricing
//   - Annual: graduated tiers with 2-month discount

// Stripe graduated pricing tiers (configured in Stripe Dashboard):
// Monthly price:
//   - First 10 units: $0/unit
//   - Next 90 units (11-100): $2.50/unit
//   - Next 400 units (101-500): $1.50/unit
//   - Next 1500 units (501-2000): $1.00/unit
//   - Units 2001+: $0.75/unit
//
// Annual price:
//   - Same tiers, multiplied by 10 (annual discount)
```

### BECS Direct Debit

Stripe AU supports BECS Direct Debit for Australian bank account payments:

- Lower fees than card (~1% + A$0.30, capped at A$3.50)
- No card expiry issues
- Familiar to Australian business customers
- 3-5 business day settlement

**Implementation:** Enable BECS Direct Debit as a payment method in Stripe Checkout. Customers choose between card and direct debit during checkout.

```typescript
// When creating checkout session, include BECS as payment method
const session = await stripe.checkout.sessions.create({
  payment_method_types: ['card', 'au_becs_debit'],
  // ...
});
```

### Webhook Events to Handle

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Create/update subscription record, set status = 'active' |
| `invoice.paid` | Update subscription period dates, log payment event |
| `invoice.payment_failed` | Set status = 'past_due', start grace period, send notification |
| `customer.subscription.updated` | Sync plan changes, lot count, billing interval |
| `customer.subscription.deleted` | Set status = 'canceled', start data retention countdown |
| `invoice.created` | Update lot count snapshot for upcoming invoice |

### Smart Dunning

Stripe's built-in Smart Retries automatically retry failed payments using ML-based timing. Configuration:

- Retry schedule: 3 attempts over 7 days (Stripe default)
- After final failure: subscription moves to `past_due`
- Customer receives Stripe's built-in payment failure emails
- LevyLite sends additional in-app notification

---

## 7. Subscription Lifecycle

### States

```
trialing -> active -> past_due -> canceled
                   -> paused (manual, admin-only)
```

| State | Trigger | Access Level | Duration |
|-------|---------|-------------|----------|
| `trialing` | Organisation created | Full access (all features) | 14 days |
| `active` | Successful payment via Stripe Checkout | Full access (all features) | Until period end |
| `past_due` | Payment failed after retry attempts | Read-only access | 7-day grace period |
| `canceled` | Manual cancellation or grace period expired | Read-only access | 90 days data retention |
| `paused` | Admin action (e.g., billing dispute) | Read-only access | Until manually resumed |

### State Transition Diagram

```
[signup]
    |
    v
 trialing -----(14 days)-----> [trial expired]
    |                               |
    | (payment)                     | (<=10 lots, <=1 scheme)
    v                               v
  active <----(payment)------- free tier
    |
    | (payment fails)
    v
 past_due -----(7 days)------> canceled
    |                               |
    | (payment succeeds)            | (90 days)
    v                               v
  active                      [data deleted]
```

### Grace Period (7 Days)

When a payment fails:

1. **Day 0:** Payment fails. Status = `past_due`. Stripe retries automatically.
2. **Day 0:** In-app banner: "Payment failed. Update your payment method to avoid service interruption."
3. **Day 3:** Email: "Your payment is still failing. You have 4 days to update your payment method."
4. **Day 7:** If still unpaid: status = `canceled`. Write access revoked. Email: "Your subscription has been canceled. You have 90 days to export your data."

### Read-Only Access

When status is `past_due`, `canceled`, or `paused`:

- Users can log in and view all data
- Users can export data (CSV, PDF downloads)
- Users cannot create, update, or delete records
- Trust accounting transactions cannot be entered
- Levy notices cannot be sent
- In-app banner shows subscription status and action required

### Data Retention

After cancellation:

- **0-90 days:** Read-only access. Data retained. User can reactivate by paying.
- **90 days:** Email: "Your data will be deleted in 7 days. Export now or reactivate."
- **97 days:** All organisation data permanently deleted (schemes, lots, transactions, documents). Supabase Storage files deleted. Audit log entries retained for compliance.

---

## 8. Plan Limit Enforcement

### Database-Level Enforcement

A trigger on the `lots` table prevents inserting lots beyond the plan limit:

```sql
-- Function to check plan limits
CREATE OR REPLACE FUNCTION check_plan_limits(p_org_id UUID)
RETURNS TABLE(within_limits BOOLEAN, current_lots INTEGER, max_lots INTEGER, message TEXT) AS $$
DECLARE
  v_current_lots INTEGER;
  v_max_lots INTEGER;
  v_sub_status TEXT;
BEGIN
  -- Count current lots for this organisation
  v_current_lots := (
    SELECT COUNT(*)
    FROM lots l
    JOIN schemes s ON l.scheme_id = s.id
    WHERE s.organisation_id = p_org_id
    AND s.deleted_at IS NULL
  );

  -- Get subscription details
  SELECT sub.status, sp.max_lots
  INTO v_sub_status, v_max_lots
  FROM subscriptions sub
  JOIN subscription_plans sp ON sub.plan_id = sp.id
  WHERE sub.organisation_id = p_org_id;

  -- Trialing or active subscriptions with no max_lots = unlimited
  IF v_sub_status IN ('trialing', 'active') AND v_max_lots IS NULL THEN
    RETURN QUERY SELECT TRUE, v_current_lots, v_max_lots, 'Within plan limits'::TEXT;
    RETURN;
  END IF;

  -- Check lot limit
  IF v_max_lots IS NOT NULL AND v_current_lots >= v_max_lots THEN
    RETURN QUERY SELECT FALSE, v_current_lots, v_max_lots,
      format('Lot limit reached: %s/%s. Upgrade your plan to add more lots.', v_current_lots, v_max_lots)::TEXT;
  ELSE
    RETURN QUERY SELECT TRUE, v_current_lots, v_max_lots, 'Within plan limits'::TEXT;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to enforce lot limit on insert
CREATE OR REPLACE FUNCTION enforce_lot_limit()
RETURNS TRIGGER AS $$
DECLARE
  v_org_id UUID;
  v_check RECORD;
BEGIN
  -- Get organisation_id from scheme
  SELECT organisation_id INTO v_org_id
  FROM schemes WHERE id = NEW.scheme_id;

  -- Check limits
  SELECT * INTO v_check FROM check_plan_limits(v_org_id);

  IF NOT v_check.within_limits THEN
    RAISE EXCEPTION '%', v_check.message;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_lot_limit_trigger
  BEFORE INSERT ON lots
  FOR EACH ROW EXECUTE FUNCTION enforce_lot_limit();
```

### Application-Level Enforcement

UI warnings at usage thresholds:

```typescript
// lib/billing/usage-warnings.ts

interface UsageWarning {
  level: 'info' | 'warning' | 'error';
  message: string;
  showUpgradePrompt: boolean;
}

export function getUsageWarning(
  currentLots: number,
  maxLots: number | null
): UsageWarning | null {
  if (maxLots === null) return null; // Unlimited

  const percentage = (currentLots / maxLots) * 100;

  if (percentage >= 100) {
    return {
      level: 'error',
      message: `You have reached your lot limit (${currentLots}/${maxLots}). Upgrade to add more lots.`,
      showUpgradePrompt: true,
    };
  }

  if (percentage >= 90) {
    return {
      level: 'warning',
      message: `You are approaching your lot limit (${currentLots}/${maxLots}). Consider upgrading.`,
      showUpgradePrompt: true,
    };
  }

  if (percentage >= 80) {
    return {
      level: 'info',
      message: `You are using ${currentLots} of ${maxLots} lots.`,
      showUpgradePrompt: false,
    };
  }

  return null;
}
```

### Feature Gating via JSONB

The `subscription_plans.features` JSONB column gates access to specific features:

```sql
-- Example features JSONB for free tier
{
  "trust_accounting": false,
  "bulk_levy_notices": false,
  "financial_reporting": false,
  "csv_import_export": false,
  "owner_portal": true,
  "document_storage": true,
  "meeting_admin": true
}

-- Example features JSONB for paid tier
{
  "trust_accounting": true,
  "bulk_levy_notices": true,
  "financial_reporting": true,
  "csv_import_export": true,
  "owner_portal": true,
  "document_storage": true,
  "meeting_admin": true
}
```

### Downgrade with Lots Over New Limit

When a customer downgrades and their lot count exceeds the free tier limit (10 lots):

1. Downgrade takes effect at period end (not immediately)
2. At period end, if lot count > 10:
   - Subscription moves to `past_due` instead of `free`
   - Email: "You have X lots but the free tier allows 10. Please remove lots or resubscribe."
   - 30-day grace period to either remove lots or resubscribe
3. After grace period: subscription moves to `canceled`, data retention begins

---

## 9. Usage Tracking & Billing

### Lot Count Snapshot

At the start of each billing cycle, a snapshot of the lot count is taken and stored in `usage_tracking`. This snapshot determines the invoice amount for the cycle.

```sql
-- Scheduled function (runs daily via pg_cron or Supabase Edge Function cron)
CREATE OR REPLACE FUNCTION snapshot_billing_usage()
RETURNS void AS $$
DECLARE
  sub RECORD;
BEGIN
  FOR sub IN
    SELECT s.id AS subscription_id, s.organisation_id, s.current_period_start
    FROM subscriptions s
    WHERE s.status IN ('active', 'trialing')
    AND s.current_period_start = CURRENT_DATE
  LOOP
    INSERT INTO usage_tracking (
      organisation_id,
      subscription_id,
      total_lots,
      total_schemes,
      total_users,
      snapshot_type
    )
    SELECT
      sub.organisation_id,
      sub.subscription_id,
      (SELECT COUNT(*) FROM lots l JOIN schemes sc ON l.scheme_id = sc.id
       WHERE sc.organisation_id = sub.organisation_id AND sc.deleted_at IS NULL),
      (SELECT COUNT(*) FROM schemes
       WHERE organisation_id = sub.organisation_id AND deleted_at IS NULL),
      (SELECT COUNT(*) FROM organisation_users
       WHERE organisation_id = sub.organisation_id),
      'billing_cycle';
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Graduated Price Calculation for Stripe

When creating or updating a Stripe subscription, the lot count is reported to Stripe as the quantity for its graduated pricing tiers:

```typescript
// Server action: update Stripe subscription quantity
export async function syncLotCountToStripe(organisationId: string) {
  const supabase = createServerClient();

  // Count current lots
  const { count } = await supabase
    .from('lots')
    .select('id', { count: 'exact' })
    .in('scheme_id',
      supabase.from('schemes')
        .select('id')
        .eq('organisation_id', organisationId)
        .is('deleted_at', null)
    );

  // Get subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('stripe_subscription_id')
    .eq('organisation_id', organisationId)
    .single();

  if (!subscription?.stripe_subscription_id || !count) return;

  // Update Stripe subscription quantity
  const stripeSubscription = await stripe.subscriptions.retrieve(
    subscription.stripe_subscription_id
  );

  await stripe.subscriptions.update(subscription.stripe_subscription_id, {
    items: [{
      id: stripeSubscription.items.data[0].id,
      quantity: count,
    }],
    proration_behavior: 'create_prorations', // Prorate mid-cycle additions
  });
}
```

### Mid-Cycle Additions

When a customer adds lots mid-cycle:

1. Lot is added to the database (trigger validates plan limit)
2. Server action calls `syncLotCountToStripe()` to update quantity
3. Stripe automatically prorates the charge for the remainder of the billing period
4. Next invoice reflects the new lot count at graduated rates

### Usage Analytics

Daily snapshots track growth over time for analytics and billing verification:

```sql
-- Daily snapshot (runs via cron at midnight AEST)
INSERT INTO usage_tracking (organisation_id, total_lots, total_schemes, total_users, snapshot_type)
SELECT
  o.id,
  (SELECT COUNT(*) FROM lots l JOIN schemes s ON l.scheme_id = s.id
   WHERE s.organisation_id = o.id AND s.deleted_at IS NULL),
  (SELECT COUNT(*) FROM schemes WHERE organisation_id = o.id AND deleted_at IS NULL),
  (SELECT COUNT(*) FROM organisation_users WHERE organisation_id = o.id),
  'daily'
FROM organisations o;
```

---

## 10. Self-Service Plan Management

### Upgrade (Immediate, Prorated)

1. User navigates to **Settings > Billing**
2. Clicks "Upgrade Plan" or adds lots beyond current tier
3. If no active subscription: redirected to Stripe Checkout
4. If active subscription: Stripe quantity is updated, prorated charge applied
5. Access to new lot count is immediate

### Downgrade (At Period End)

1. User navigates to **Settings > Billing**
2. Clicks "Change Plan" or removes lots
3. Downgrade scheduled for end of current billing period
4. `cancel_at_period_end` flag set (subscription remains active until period end)
5. At period end: Stripe creates new invoice at lower quantity

### Cancel (At Period End)

1. User navigates to **Settings > Billing**
2. Clicks "Cancel Subscription"
3. Confirmation dialog: "Your subscription will remain active until [date]. After cancellation, you will have read-only access for 90 days."
4. `cancel_at_period_end = true` set on Stripe subscription
5. At period end: subscription status = `canceled`
6. 90-day data retention begins

### Update Payment Method

1. User navigates to **Settings > Billing**
2. Clicks "Update Payment Method"
3. Redirected to Stripe Customer Portal (hosted page)
4. Updates card or BECS Direct Debit details
5. Redirected back to LevyLite

### View Invoices

1. User navigates to **Settings > Billing > Invoices**
2. In-app table showing: invoice date, amount, status, PDF download link
3. Invoice data fetched from `platform_invoices` table (synced from Stripe webhooks)
4. PDF link points to Stripe-hosted invoice PDF

---

## 11. Database Schema

### 11.1 subscription_plans

Defines available subscription plans and their limits.

```sql
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_code VARCHAR(20) NOT NULL UNIQUE,
  plan_name VARCHAR(100) NOT NULL,
  description TEXT,
  max_lots INTEGER,           -- NULL = unlimited (paid tiers)
  max_schemes INTEGER,        -- NULL = unlimited (paid tiers)
  features JSONB NOT NULL DEFAULT '{}',
  stripe_monthly_price_id VARCHAR(100),
  stripe_annual_price_id VARCHAR(100),
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE subscription_plans IS 'Available subscription plans with limits and feature flags';
COMMENT ON COLUMN subscription_plans.plan_code IS 'Unique plan identifier: free, paid';
COMMENT ON COLUMN subscription_plans.max_lots IS 'Maximum lots allowed (NULL = unlimited)';
COMMENT ON COLUMN subscription_plans.max_schemes IS 'Maximum schemes allowed (NULL = unlimited)';
COMMENT ON COLUMN subscription_plans.features IS 'Feature flags JSONB (e.g., trust_accounting: true)';
COMMENT ON COLUMN subscription_plans.stripe_monthly_price_id IS 'Stripe Price ID for monthly billing';
COMMENT ON COLUMN subscription_plans.stripe_annual_price_id IS 'Stripe Price ID for annual billing';
```

**Indexes:**
```sql
CREATE INDEX idx_subscription_plans_code ON subscription_plans(plan_code);
CREATE INDEX idx_subscription_plans_active ON subscription_plans(is_active) WHERE is_active = TRUE;
```

**Seed Data:**
```sql
INSERT INTO subscription_plans (plan_code, plan_name, description, max_lots, max_schemes, features, sort_order) VALUES
(
  'free',
  'Free',
  'For small self-managed schemes (up to 10 lots, 1 scheme)',
  10,
  1,
  '{
    "trust_accounting": false,
    "bulk_levy_notices": false,
    "financial_reporting": false,
    "csv_import_export": false,
    "owner_portal": true,
    "document_storage": true,
    "meeting_admin": true
  }'::jsonb,
  0
),
(
  'paid',
  'LevyLite',
  'Full-featured strata management (graduated per-lot pricing)',
  NULL,
  NULL,
  '{
    "trust_accounting": true,
    "bulk_levy_notices": true,
    "financial_reporting": true,
    "csv_import_export": true,
    "owner_portal": true,
    "document_storage": true,
    "meeting_admin": true
  }'::jsonb,
  1
);
```

**RLS Policy:**
```sql
ALTER TABLE subscription_plans ENABLE ROW LEVEL SECURITY;

-- Plans are public (read-only for all authenticated users)
CREATE POLICY plans_read_all ON subscription_plans
  FOR SELECT TO authenticated
  USING (is_active = TRUE);
```

---

### 11.2 subscriptions

Active subscription for each organisation (one subscription per org).

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  status TEXT NOT NULL DEFAULT 'trialing'
    CHECK (status IN ('trialing', 'active', 'past_due', 'canceled', 'paused', 'free')),
  billing_interval TEXT CHECK (billing_interval IN ('monthly', 'annual')),
  billed_lots_count INTEGER NOT NULL DEFAULT 0,
  stripe_customer_id VARCHAR(100),
  stripe_subscription_id VARCHAR(100) UNIQUE,
  current_period_start DATE,
  current_period_end DATE,
  trial_start_date DATE,
  trial_end_date DATE,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  data_retention_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organisation_id)
);

COMMENT ON TABLE subscriptions IS 'Active subscription per organisation (one-to-one with organisations)';
COMMENT ON COLUMN subscriptions.status IS 'trialing, active, past_due, canceled, paused, free';
COMMENT ON COLUMN subscriptions.billed_lots_count IS 'Snapshot of lot count at billing cycle start';
COMMENT ON COLUMN subscriptions.billing_interval IS 'monthly or annual billing cycle';
COMMENT ON COLUMN subscriptions.cancel_at_period_end IS 'If true, subscription will cancel at current_period_end';
COMMENT ON COLUMN subscriptions.data_retention_expires_at IS 'Date when org data will be permanently deleted (90 days after cancellation)';
```

**Indexes:**
```sql
CREATE INDEX idx_subscriptions_organisation_id ON subscriptions(organisation_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_stripe_customer_id ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_stripe_subscription_id ON subscriptions(stripe_subscription_id);
CREATE INDEX idx_subscriptions_trial_end ON subscriptions(trial_end_date)
  WHERE status = 'trialing';
CREATE INDEX idx_subscriptions_data_retention ON subscriptions(data_retention_expires_at)
  WHERE data_retention_expires_at IS NOT NULL;
```

**RLS Policy:**
```sql
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- Only users within the organisation can view their subscription
CREATE POLICY subscription_tenant_isolation ON subscriptions
  FOR SELECT TO authenticated
  USING (organisation_id = auth.user_organisation_id());

-- Only managers can modify subscription
CREATE POLICY subscription_manager_update ON subscriptions
  FOR UPDATE TO authenticated
  USING (
    organisation_id = auth.user_organisation_id()
    AND EXISTS (
      SELECT 1 FROM organisation_users
      WHERE user_id = auth.uid()
      AND organisation_id = subscriptions.organisation_id
      AND role = 'manager'
    )
  );
```

---

### 11.3 usage_tracking

Snapshots of lot/scheme/user counts for billing and analytics.

```sql
CREATE TABLE usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  tracked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_lots INTEGER NOT NULL DEFAULT 0,
  total_schemes INTEGER NOT NULL DEFAULT 0,
  total_users INTEGER NOT NULL DEFAULT 0,
  snapshot_type TEXT NOT NULL CHECK (snapshot_type IN ('daily', 'billing_cycle', 'manual')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE usage_tracking IS 'Usage snapshots for billing and analytics';
COMMENT ON COLUMN usage_tracking.snapshot_type IS 'daily (analytics), billing_cycle (invoice calculation), manual (ad-hoc)';
COMMENT ON COLUMN usage_tracking.total_lots IS 'Count of active lots across all schemes';
```

**Indexes:**
```sql
CREATE INDEX idx_usage_tracking_org_id ON usage_tracking(organisation_id);
CREATE INDEX idx_usage_tracking_tracked_at ON usage_tracking(tracked_at DESC);
CREATE INDEX idx_usage_tracking_type ON usage_tracking(snapshot_type);
CREATE INDEX idx_usage_tracking_org_type ON usage_tracking(organisation_id, snapshot_type, tracked_at DESC);
```

**RLS Policy:**
```sql
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY usage_tenant_isolation ON usage_tracking
  FOR SELECT TO authenticated
  USING (organisation_id = auth.user_organisation_id());
```

---

### 11.4 platform_invoices

LevyLite platform invoices (synced from Stripe). Distinct from the strata `invoices` table (maintenance work invoices).

```sql
CREATE TABLE platform_invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  stripe_invoice_id VARCHAR(100) NOT NULL UNIQUE,
  invoice_number VARCHAR(50),
  subtotal_ex_gst DECIMAL(12,2) NOT NULL,
  gst_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  total_inc_gst DECIMAL(12,2) NOT NULL,
  lots_billed INTEGER NOT NULL DEFAULT 0,
  billing_interval TEXT CHECK (billing_interval IN ('monthly', 'annual')),
  invoice_date DATE NOT NULL,
  due_date DATE,
  paid_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('draft', 'open', 'paid', 'void', 'uncollectible')),
  stripe_invoice_url TEXT,
  stripe_pdf_url TEXT,
  line_items JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE platform_invoices IS 'LevyLite platform invoices (synced from Stripe)';
COMMENT ON COLUMN platform_invoices.stripe_invoice_url IS 'Stripe-hosted invoice page URL';
COMMENT ON COLUMN platform_invoices.stripe_pdf_url IS 'Stripe-hosted invoice PDF URL';
COMMENT ON COLUMN platform_invoices.line_items IS 'Invoice line item breakdown (graduated pricing)';
```

**Indexes:**
```sql
CREATE INDEX idx_platform_invoices_org_id ON platform_invoices(organisation_id);
CREATE INDEX idx_platform_invoices_subscription_id ON platform_invoices(subscription_id);
CREATE INDEX idx_platform_invoices_stripe_id ON platform_invoices(stripe_invoice_id);
CREATE INDEX idx_platform_invoices_date ON platform_invoices(invoice_date DESC);
CREATE INDEX idx_platform_invoices_status ON platform_invoices(status);
```

**RLS Policy:**
```sql
ALTER TABLE platform_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoices_tenant_isolation ON platform_invoices
  FOR SELECT TO authenticated
  USING (organisation_id = auth.user_organisation_id());
```

---

### 11.5 payment_events

Stripe webhook event log for debugging and reconciliation.

```sql
CREATE TABLE payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID REFERENCES organisations(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  stripe_event_id VARCHAR(100) NOT NULL UNIQUE,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE payment_events IS 'Stripe webhook event log for debugging and audit';
COMMENT ON COLUMN payment_events.stripe_event_id IS 'Stripe event ID (idempotency key)';
COMMENT ON COLUMN payment_events.processed IS 'Whether the event was successfully processed';
COMMENT ON COLUMN payment_events.error_message IS 'Error details if processing failed';
```

**Indexes:**
```sql
CREATE INDEX idx_payment_events_stripe_event ON payment_events(stripe_event_id);
CREATE INDEX idx_payment_events_org_id ON payment_events(organisation_id);
CREATE INDEX idx_payment_events_type ON payment_events(event_type);
CREATE INDEX idx_payment_events_unprocessed ON payment_events(processed)
  WHERE NOT processed;
CREATE INDEX idx_payment_events_created ON payment_events(created_at DESC);
```

**RLS Policy:**
```sql
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;

-- Only managers can view payment events for their organisation
CREATE POLICY payment_events_manager_read ON payment_events
  FOR SELECT TO authenticated
  USING (
    organisation_id = auth.user_organisation_id()
    AND EXISTS (
      SELECT 1 FROM organisation_users
      WHERE user_id = auth.uid() AND role = 'manager'
    )
  );
```

---

## 12. API Endpoints / Server Actions

### POST /api/billing/create-checkout-session

Creates a Stripe Checkout session for new subscriptions.

```typescript
// app/api/billing/create-checkout-session/route.ts
import { stripe } from '@/lib/stripe';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const schema = z.object({
  billingInterval: z.enum(['monthly', 'annual']),
});

export async function POST(request: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  // Validate auth
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Validate role (only managers can manage billing)
  const { data: orgUser } = await supabase
    .from('organisation_users')
    .select('organisation_id, role')
    .eq('user_id', user.id)
    .single();

  if (orgUser?.role !== 'manager') {
    return NextResponse.json({ error: 'Only managers can manage billing' }, { status: 403 });
  }

  const body = await request.json();
  const { billingInterval } = schema.parse(body);

  // Get subscription and plan
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*, subscription_plans(*)')
    .eq('organisation_id', orgUser.organisation_id)
    .single();

  // Get paid plan price ID
  const { data: paidPlan } = await supabase
    .from('subscription_plans')
    .select('stripe_monthly_price_id, stripe_annual_price_id')
    .eq('plan_code', 'paid')
    .single();

  const priceId = billingInterval === 'annual'
    ? paidPlan?.stripe_annual_price_id
    : paidPlan?.stripe_monthly_price_id;

  if (!priceId) {
    return NextResponse.json({ error: 'Price not configured' }, { status: 500 });
  }

  // Count lots for initial quantity
  const { count: lotCount } = await supabase
    .from('lots')
    .select('id', { count: 'exact' })
    .in('scheme_id',
      supabase.from('schemes')
        .select('id')
        .eq('organisation_id', orgUser.organisation_id)
        .is('deleted_at', null)
    );

  // Create or retrieve Stripe customer
  let stripeCustomerId = subscription?.stripe_customer_id;
  if (!stripeCustomerId) {
    const { data: org } = await supabase
      .from('organisations')
      .select('name, email')
      .eq('id', orgUser.organisation_id)
      .single();

    const customer = await stripe.customers.create({
      email: org?.email || user.email,
      name: org?.name,
      metadata: { organisation_id: orgUser.organisation_id },
    });
    stripeCustomerId = customer.id;

    // Save Stripe customer ID
    await supabase
      .from('subscriptions')
      .update({ stripe_customer_id: stripeCustomerId })
      .eq('organisation_id', orgUser.organisation_id);
  }

  // Create Checkout session
  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    payment_method_types: ['card', 'au_becs_debit'],
    mode: 'subscription',
    line_items: [{
      price: priceId,
      quantity: Math.max(lotCount || 1, 1),
    }],
    subscription_data: {
      metadata: { organisation_id: orgUser.organisation_id },
    },
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/billing/select-plan`,
    tax_id_collection: { enabled: true },
  });

  return NextResponse.json({ sessionUrl: session.url });
}
```

### POST /api/billing/create-portal-session

Creates a Stripe Customer Portal session for self-service billing management.

```typescript
// app/api/billing/create-portal-session/route.ts
import { stripe } from '@/lib/stripe';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('organisation_id', (
      await supabase.from('organisation_users')
        .select('organisation_id')
        .eq('user_id', user.id)
        .single()
    ).data?.organisation_id)
    .single();

  if (!subscription?.stripe_customer_id) {
    return NextResponse.json({ error: 'No billing account found' }, { status: 404 });
  }

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/billing`,
  });

  return NextResponse.json({ portalUrl: portalSession.url });
}
```

### POST /api/webhooks/stripe

Handles incoming Stripe webhook events.

```typescript
// app/api/webhooks/stripe/route.ts
import { stripe } from '@/lib/stripe';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import type Stripe from 'stripe';

// Use service role client for webhook handling (no user auth context)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  const body = await request.text();
  const headersList = headers();
  const signature = headersList.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Log event for debugging (idempotent via stripe_event_id UNIQUE)
  const { error: logError } = await supabase
    .from('payment_events')
    .upsert({
      stripe_event_id: event.id,
      event_type: event.type,
      payload: event.data.object as Record<string, unknown>,
    }, { onConflict: 'stripe_event_id' });

  if (logError) {
    console.error('Failed to log payment event:', logError);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;
    }

    // Mark event as processed
    await supabase
      .from('payment_events')
      .update({ processed: true, processed_at: new Date().toISOString() })
      .eq('stripe_event_id', event.id);

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    await supabase
      .from('payment_events')
      .update({ error_message: errorMessage })
      .eq('stripe_event_id', event.id);

    console.error('Webhook handler error:', err);
    return NextResponse.json({ error: 'Handler failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  const organisationId = session.metadata?.organisation_id;
  if (!organisationId) throw new Error('Missing organisation_id in metadata');

  const subscription = await stripe.subscriptions.retrieve(session.subscription as string);

  // Get paid plan ID
  const { data: paidPlan } = await supabase
    .from('subscription_plans')
    .select('id')
    .eq('plan_code', 'paid')
    .single();

  await supabase
    .from('subscriptions')
    .update({
      plan_id: paidPlan!.id,
      status: 'active',
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: subscription.id,
      billing_interval: subscription.items.data[0].plan.interval === 'year' ? 'annual' : 'monthly',
      billed_lots_count: subscription.items.data[0].quantity || 0,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString().split('T')[0],
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString().split('T')[0],
    })
    .eq('organisation_id', organisationId);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;

  // Update subscription period
  const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);

  await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      current_period_start: new Date(stripeSubscription.current_period_start * 1000).toISOString().split('T')[0],
      current_period_end: new Date(stripeSubscription.current_period_end * 1000).toISOString().split('T')[0],
      billed_lots_count: stripeSubscription.items.data[0].quantity || 0,
    })
    .eq('stripe_subscription_id', subscriptionId);

  // Get organisation_id from subscription
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('organisation_id, id')
    .eq('stripe_subscription_id', subscriptionId)
    .single();

  if (sub) {
    // Create platform invoice record
    await supabase
      .from('platform_invoices')
      .upsert({
        organisation_id: sub.organisation_id,
        subscription_id: sub.id,
        stripe_invoice_id: invoice.id,
        invoice_number: invoice.number,
        subtotal_ex_gst: (invoice.subtotal || 0) / 100,
        gst_amount: (invoice.tax || 0) / 100,
        total_inc_gst: (invoice.total || 0) / 100,
        lots_billed: stripeSubscription.items.data[0].quantity || 0,
        invoice_date: new Date(invoice.created * 1000).toISOString().split('T')[0],
        paid_at: new Date().toISOString(),
        status: 'paid',
        stripe_invoice_url: invoice.hosted_invoice_url,
        stripe_pdf_url: invoice.invoice_pdf,
      }, { onConflict: 'stripe_invoice_id' });
  }
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = invoice.subscription as string;

  await supabase
    .from('subscriptions')
    .update({ status: 'past_due' })
    .eq('stripe_subscription_id', subscriptionId);

  // TODO: Send in-app notification and email to manager
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const statusMap: Record<string, string> = {
    active: 'active',
    past_due: 'past_due',
    canceled: 'canceled',
    trialing: 'trialing',
    paused: 'paused',
  };

  const updates: Record<string, unknown> = {
    status: statusMap[subscription.status] || subscription.status,
    cancel_at_period_end: subscription.cancel_at_period_end,
    billed_lots_count: subscription.items.data[0].quantity || 0,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString().split('T')[0],
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString().split('T')[0],
  };

  if (subscription.canceled_at) {
    updates.canceled_at = new Date(subscription.canceled_at * 1000).toISOString();
    // Set data retention expiry (90 days from cancellation)
    const retentionExpiry = new Date(subscription.canceled_at * 1000);
    retentionExpiry.setDate(retentionExpiry.getDate() + 90);
    updates.data_retention_expires_at = retentionExpiry.toISOString();
  }

  await supabase
    .from('subscriptions')
    .update(updates)
    .eq('stripe_subscription_id', subscription.id);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const canceledAt = new Date();
  const retentionExpiry = new Date();
  retentionExpiry.setDate(retentionExpiry.getDate() + 90);

  await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: canceledAt.toISOString(),
      data_retention_expires_at: retentionExpiry.toISOString(),
    })
    .eq('stripe_subscription_id', subscription.id);
}
```

### GET /api/billing/usage

Returns current usage stats for the authenticated organisation.

```typescript
// app/api/billing/usage/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET() {
  const cookieStore = cookies();
  const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: orgUser } = await supabase
    .from('organisation_users')
    .select('organisation_id')
    .eq('user_id', user.id)
    .single();

  if (!orgUser) return NextResponse.json({ error: 'Not in organisation' }, { status: 404 });

  // Get current lot count
  const { count: lotCount } = await supabase
    .from('lots')
    .select('id', { count: 'exact' })
    .in('scheme_id',
      supabase.from('schemes')
        .select('id')
        .eq('organisation_id', orgUser.organisation_id)
        .is('deleted_at', null)
    );

  // Get current scheme count
  const { count: schemeCount } = await supabase
    .from('schemes')
    .select('id', { count: 'exact' })
    .eq('organisation_id', orgUser.organisation_id)
    .is('deleted_at', null);

  // Get subscription
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('*, subscription_plans(*)')
    .eq('organisation_id', orgUser.organisation_id)
    .single();

  return NextResponse.json({
    totalLots: lotCount || 0,
    totalSchemes: schemeCount || 0,
    maxLots: subscription?.subscription_plans?.max_lots || null,
    maxSchemes: subscription?.subscription_plans?.max_schemes || null,
    subscriptionStatus: subscription?.status,
    billingInterval: subscription?.billing_interval,
    currentPeriodEnd: subscription?.current_period_end,
    trialEndDate: subscription?.trial_end_date,
  });
}
```

### Server Action: checkPlanLimits()

```typescript
// app/actions/checkPlanLimits.ts
'use server'

import { createServerClient } from '@/lib/supabase-server';

export async function checkPlanLimits(): Promise<{
  withinLimits: boolean;
  currentLots: number;
  maxLots: number | null;
  currentSchemes: number;
  maxSchemes: number | null;
  message: string;
}> {
  const supabase = createServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: orgUser } = await supabase
    .from('organisation_users')
    .select('organisation_id')
    .eq('user_id', user.id)
    .single();

  if (!orgUser) throw new Error('Not in organisation');

  // Call database function
  const { data, error } = await supabase
    .rpc('check_plan_limits', { p_org_id: orgUser.organisation_id });

  if (error) throw error;

  const result = data[0];
  return {
    withinLimits: result.within_limits,
    currentLots: result.current_lots,
    maxLots: result.max_lots,
    currentSchemes: 0, // TODO: add scheme check
    maxSchemes: null,
    message: result.message,
  };
}
```

---

## 13. Security

### Webhook Signature Verification

All Stripe webhooks are verified using the `stripe-signature` header and `STRIPE_WEBHOOK_SECRET` environment variable. The verification happens before any event processing (see webhook handler in section 12).

```typescript
// Signature verification is handled by stripe.webhooks.constructEvent()
// which throws an error if the signature is invalid.
// STRIPE_WEBHOOK_SECRET must be stored in environment variables, never in code.
```

### Subscription Status -> RLS Integration

Subscription status is enforced at the database level via RLS policies. When a subscription is `past_due` or `canceled`, write access is revoked:

```sql
-- Helper function: check if organisation has active subscription
CREATE OR REPLACE FUNCTION has_active_subscription()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM subscriptions
    WHERE organisation_id = auth.user_organisation_id()
    AND status IN ('active', 'trialing', 'free')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Apply write restriction to key tables
-- Example: schemes table (same pattern for lots, transactions, etc.)
CREATE POLICY schemes_write_requires_active_sub ON schemes
  FOR INSERT TO authenticated
  WITH CHECK (has_active_subscription());

CREATE POLICY schemes_update_requires_active_sub ON schemes
  FOR UPDATE TO authenticated
  USING (has_active_subscription());

CREATE POLICY schemes_delete_requires_active_sub ON schemes
  FOR DELETE TO authenticated
  USING (has_active_subscription());

-- Read access is always allowed (users can export data even when expired)
CREATE POLICY schemes_read_always ON schemes
  FOR SELECT TO authenticated
  USING (organisation_id = auth.user_organisation_id());
```

**Tables requiring write restriction when subscription is inactive:**
- `schemes`, `lots`, `owners`, `lot_ownerships`, `committee_members`, `tenants`
- `transactions`, `transaction_lines`, `levy_schedules`, `levy_periods`, `levy_items`, `payment_allocations`
- `meetings`, `agenda_items`, `resolutions`, `minutes`
- `maintenance_requests`, `maintenance_comments`
- `documents`, `document_versions`
- `budgets`, `budget_line_items`

### Free Tier Abuse Prevention

**Problem:** A user could create multiple organisations with 10 lots each to avoid paying.

**Mitigations:**

1. **One organisation per email:** Enforce via unique constraint on `organisations.created_by_email`.
2. **Flagging suspicious signups:** Trigger flags organisations if the creating email already has other organisations.
3. **Manual review:** Admin dashboard shows flagged organisations for review.

```sql
-- Add created_by_email to organisations
ALTER TABLE organisations ADD COLUMN created_by_email TEXT;

-- Trigger to flag suspicious signups
CREATE OR REPLACE FUNCTION flag_suspicious_orgs()
RETURNS TRIGGER AS $$
BEGIN
  IF (SELECT COUNT(*) FROM organisations WHERE created_by_email = NEW.created_by_email) > 0 THEN
    -- Log for manual review (don't block, just flag)
    INSERT INTO audit_log (action, table_name, record_id, new_values)
    VALUES (
      'suspicious_signup',
      'organisations',
      NEW.id,
      jsonb_build_object('email', NEW.created_by_email, 'reason', 'multiple_orgs_same_email')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER check_suspicious_org
  AFTER INSERT ON organisations
  FOR EACH ROW EXECUTE FUNCTION flag_suspicious_orgs();
```

### Stripe API Key Security

- `STRIPE_SECRET_KEY`: Server-side only, stored in Vercel environment variables
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: Client-side, safe to expose
- `STRIPE_WEBHOOK_SECRET`: Server-side only, used for webhook signature verification
- Keys are never committed to version control (.env.local excluded via .gitignore)

---

## 14. Testing & Edge Cases

### Functional Tests

- Trial signup flow (no credit card -> 14-day trial -> plan selection -> Stripe Checkout)
- Trial expiry with <= 10 lots (auto-fallback to free tier)
- Trial expiry with > 10 lots (prompt to subscribe)
- Stripe Checkout success (webhook fires, subscription activated)
- Stripe Checkout cancel (user returns to plan selection)
- Invoice payment success (subscription period extended)
- Invoice payment failure (status = past_due, grace period starts)
- Grace period expiry (status = canceled)
- Upgrade (lot count increase, prorated billing)
- Downgrade (cancel_at_period_end, lot count decrease)
- Cancel and reactivate within 90 days
- Data deletion after 90-day retention period
- BECS Direct Debit payment flow
- Plan limit enforcement (add lot beyond limit -> error)
- Feature gating (free tier user tries to access trust accounting -> blocked)

### Edge Cases

- **Webhook out of order:** Use `stripe_event_id` UNIQUE constraint for idempotency. Process events based on subscription state, not arrival order.
- **Duplicate webhook delivery:** Upsert on `stripe_event_id` prevents double-processing.
- **Stripe outage:** Subscription state in database remains source of truth. Retry webhook processing for unprocessed events.
- **User deletes lots then cancels:** Lot count at billing cycle start determines invoice. Mid-cycle deletions are not retroactively credited (credit issued on request via support).
- **Annual subscriber wants to switch to monthly:** Handled via Stripe Customer Portal. Prorated credit applied.
- **Multiple managers in organisation:** Only managers can access billing. Any manager can modify billing (no "billing owner" concept in MVP).
- **GST calculation:** Always 10% of subtotal. LevyLite is an Australian business selling to Australian customers. No international tax complexity.
- **Currency:** All amounts in AUD. No currency conversion needed.

### Security Tests

- Webhook endpoint rejects requests without valid Stripe signature
- Non-manager users cannot create checkout sessions or portal sessions
- Cross-tenant isolation: User A cannot view User B's invoices or subscription
- Expired subscription enforces read-only access via RLS
- Stripe API keys not exposed in client-side code or error messages

---

## 15. Dependencies

| Feature | Dependency | Reason |
|---------|------------|--------|
| **01 - Authentication** | Signup flow creates organisation and subscription | Auth hook triggers subscription creation |
| **02 - Scheme & Lot Register** | Lot count drives billing | Plan limits enforced when adding lots |
| **03 - Levy Management** | Bulk levy notices are paid-only | Feature gating checks subscription status |
| **04 - Trust Accounting** | Trust accounting is paid-only | Feature gating checks subscription status |
| **08 - Financial Reporting** | Financial reporting is paid-only | Feature gating checks subscription status |
| **09 - Owner Portal** | Owner portal available on free and paid | No dependency, but portal activity may drive upgrades |

### External Dependencies

| Service | Purpose | Cost |
|---------|---------|------|
| **Stripe Billing** | Subscription management | 0.7% of recurring volume |
| **Stripe Checkout** | Payment capture | Included in card/BECS fees |
| **Stripe Customer Portal** | Self-service billing management | Included |
| **Stripe Webhooks** | Event sync | Included |

---

**Document End**

_For questions or clarifications, contact Chris Johnstone at chris@kokorosoftware.com_
