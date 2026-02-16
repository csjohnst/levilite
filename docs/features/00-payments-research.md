# LevyLite Payments & Subscription Platform Research

**Date:** 16 February 2026
**Recommendation:** Stripe (direct integration, not MoR)

---

## Executive Summary

For an Australia-only B2B SaaS targeting strata managers, **Stripe** is the clear winner over Merchant of Record platforms (Paddle, LemonSqueezy). MoR platforms solve global tax compliance — a problem LevyLite doesn't have. Stripe costs roughly half the fees and gives full control of the customer relationship.

---

## Options Compared

### Stripe (Payment Processor)
- **AU domestic cards:** 1.7% + A$0.30
- **Stripe Billing add-on:** 0.7% of recurring volume
- **Effective rate:** ~2.4% + $0.30 per recurring charge
- **Stripe Tax (optional):** +0.5% for automated GST calc (overkill for AU-only — just add 10%)
- **International cards:** 3.5% + A$0.30 (irrelevant — customers are all Australian)
- **Chargeback fee:** A$25 per dispute

### Paddle (Merchant of Record)
- **All-inclusive:** 5% + $0.50 per transaction
- **Includes:** Tax compliance, currency conversion, chargeback handling, subscription management
- **Payout:** Net 15-30 days
- **Legal seller:** Paddle, not you

### LemonSqueezy (Merchant of Record, owned by Stripe)
- **All-inclusive:** 5% + $0.50 per transaction
- **Includes:** Same as Paddle — tax, currency, chargebacks, subscriptions
- **Payout:** Net 15-30 days
- **Legal seller:** LemonSqueezy, not you
- **Note:** Acquired by Stripe in 2024, still operates independently

---

## Cost Comparison (Typical Customer: 100 lots @ $6/lot + GST = $660/mo)

| Provider | Fee per month | Annual cost | Notes |
|----------|-------------|------------|-------|
| Stripe | ~$16.12 | ~$193 | 2.4% + $0.30 |
| Paddle | ~$33.50 | ~$402 | 5% + $0.50 |
| LemonSqueezy | ~$33.50 | ~$402 | 5% + $0.50 |

**Savings with Stripe:** ~$209/year per customer. At 50 customers = **$10,450/year**.

---

## Why NOT Merchant of Record

1. **You don't need global tax compliance** — AU-only, one GST rate (10%)
2. **MoR is the legal seller** — you lose direct customer relationship
3. **Double the fees** for a problem you don't have
4. **Payout delays** — net 15-30 days vs Stripe's daily/weekly
5. **Less control** over billing UX, invoicing, customer communications

## Why Stripe Wins

1. **Half the cost** for domestic-only transactions
2. **Native Supabase integration** — webhook templates, auth helpers
3. **Battle-tested Next.js libraries** — `@stripe/stripe-js`, `stripe` Node SDK
4. **Customer Portal** — self-service billing management (less support burden)
5. **Smart dunning** — ML-based failed payment retry
6. **Usage-based billing** — if you want per-lot metering later
7. **Australian entity** — pays out in AUD, understands ABN/GST
8. **Direct debit** — Stripe AU supports BECS Direct Debit (auto bank payments)
9. **Full control** — your brand, your relationship, your invoices

---

## Recommended Implementation

### Database Integration
- `stripe_customer_id` on `organisations` table
- `stripe_subscription_id` on `subscriptions` table  
- `stripe_price_id` on `subscription_plans` table
- `stripe_invoice_id` on `invoices` table

### Key Stripe Products to Use
- **Stripe Billing** — recurring subscriptions
- **Stripe Checkout** — hosted payment page for onboarding
- **Stripe Customer Portal** — self-service plan management
- **Stripe Webhooks** — sync subscription state to DB

### Webhook Events to Handle
- `checkout.session.completed` — new subscription created
- `invoice.paid` — successful payment, update subscription period
- `invoice.payment_failed` — flag for dunning
- `customer.subscription.updated` — plan changes, cancellations
- `customer.subscription.deleted` — subscription ended

### Onboarding Flow
1. User signs up → creates org in Supabase
2. Selects plan → redirected to Stripe Checkout
3. Payment succeeds → webhook fires → `subscriptions` table updated
4. User lands in app with active subscription

### Plan Management
1. User clicks "Manage Billing" → redirected to Stripe Customer Portal
2. Can upgrade/downgrade/cancel/update payment method
3. Changes sync back via webhooks

---

## BECS Direct Debit (Bonus)

Stripe AU supports **BECS Direct Debit** — customers authorise direct bank debits. This is common in Australian B2B:
- Lower fees than card (~1% + A$0.30, capped at A$3.50)
- No card expiry issues
- Familiar to business customers
- 3-5 business day settlement

**Recommendation:** Offer both card and BECS Direct Debit at checkout. Strata managers running a business will likely prefer direct debit.

---

## Future Considerations

- **Free tier:** 5 lots, 1 scheme. 14-day trial of full features. After trial, free tier loses trust accounting, bulk levy notices, financial reporting, CSV import/export.
- **If expanding internationally:** Re-evaluate MoR at that point. Could migrate to LemonSqueezy (Stripe-owned) relatively easily since underlying payment rails are Stripe.
- **BPAY:** Not natively supported by Stripe. Could add as manual payment option with reconciliation. Low priority for MVP.
- **Usage-based billing:** Stripe Meters API supports real-time usage events. Could bill per-lot dynamically instead of tier-based. Phase 2 consideration.

---

**Decision: Stripe. Not close.**
