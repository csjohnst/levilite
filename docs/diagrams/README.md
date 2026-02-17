# LevyLite Diagrams

Master index for all Mermaid architecture and workflow diagrams. These diagrams are the visual companion to the [feature specifications](../features/) and [unified data model](../features/00-unified-data-model.md).

---

## How to Use These Diagrams

1. **During build:** Reference ER diagrams (01-08) when writing database migrations and RLS policies.
2. **During implementation:** Reference flow/sequence diagrams (10-43) when building UI flows and server actions.
3. **During code review:** Check that data flows match the integration overview (50) and that entity names match the [glossary](../features/00-glossary.md).
4. **Onboarding:** Start with the ER Overview (07) and System Architecture (42) for a high-level understanding.

All diagrams use [Mermaid](https://mermaid.js.org/) syntax and render in GitHub, VS Code (with Mermaid extension), and most Markdown viewers.

---

## Diagram Index

### Entity Relationship Diagrams

| File | Description |
|------|-------------|
| [01-er-core.md](01-er-core.md) | Core entities: organisations, schemes, lots, owners, lot_ownerships, committee_members, tenants (8 tables) |
| [02-er-financial.md](02-er-financial.md) | Financial entities: chart_of_accounts, financial_years, transactions, transaction_lines, levy_schedules, levy_periods, levy_items, payment_allocations, budgets, budget_line_items, bank_statements, reconciliations (12 tables) |
| [03-er-meetings.md](03-er-meetings.md) | Meeting entities: meetings, agenda_items, attendees, proxies, resolutions, minutes (6 tables) |
| [04-er-maintenance.md](04-er-maintenance.md) | Maintenance entities: maintenance_requests, maintenance_comments, tradespeople, quotes, invoices, maintenance_attachments (6 tables) |
| [05-er-documents.md](05-er-documents.md) | Document entities: documents, document_versions, document_audit_log (3 tables) |
| [06-er-system.md](06-er-system.md) | System entities: audit_log, invitations, notifications, email_log (4 tables) |
| [07-er-overview.md](07-er-overview.md) | High-level overview of all 44 tables grouped by domain with cross-domain relationships |
| [08-er-subscription.md](08-er-subscription.md) | Subscription & billing entities: subscription_plans, subscriptions, usage_tracking, platform_invoices, payment_events (5 tables) |

### Authentication & Security

| File | Description |
|------|-------------|
| [10-auth-flows.md](10-auth-flows.md) | Authentication flows: staff login (password/magic link/OAuth), owner portal magic link, user invitation, owner portal activation, session lifecycle |
| [11-auth-roles.md](11-auth-roles.md) | Role hierarchy, permission matrix (CRUD by role), RLS enforcement flow, committee member overlay |
| [12-multi-tenancy.md](12-multi-tenancy.md) | RLS policy flow for staff and owner access paths, dual auth model, tenant isolation architecture, cross-tenant blocking |

### Financial System

| File | Description |
|------|-------------|
| [20-levy-lifecycle.md](20-levy-lifecycle.md) | Levy item status state diagram, full levy workflow (schedule to payment), levy calculation formula, period generation |
| [21-trust-accounting.md](21-trust-accounting.md) | Double-entry accounting trigger flow, ledger examples, admin vs capital works fund flow, bank reconciliation workflow |
| [22-payment-flows.md](22-payment-flows.md) | Levy payment flow (FIFO allocation), maintenance invoice payment flow, payment allocation trigger chain, payment entity relationships |
| [23-budget-reporting.md](23-budget-reporting.md) | Budget lifecycle states, budget-to-levy-schedule generation, financial reporting data flow, budget vs actual comparison, EOFY report workflow |

### Operations

| File | Description |
|------|-------------|
| [30-meeting-workflows.md](30-meeting-workflows.md) | Meeting status states, AGM end-to-end sequence, proxy voting flow (with 5% limit), AGM pack generation, minutes approval workflow |
| [31-maintenance-workflows.md](31-maintenance-workflows.md) | Maintenance request status states, full request-to-payment sequence, maintenance-to-trust-accounting integration, quote approval threshold routing, SLA tracking |
| [32-document-management.md](32-document-management.md) | Storage architecture (Supabase Storage + documents table), visibility/access control, document lifecycle (7-year retention), auto-generated document integration, version control, retention policy by category |

### Subscription & Billing

| File | Description |
|------|-------------|
| [60-signup-onboarding.md](60-signup-onboarding.md) | Signup and onboarding flows: trial signup, organisation creation, free-to-paid conversion, subscription creation sequence |
| [61-billing-lifecycle.md](61-billing-lifecycle.md) | Billing lifecycle diagrams: subscription status state machine, billing cycle flow, dunning and payment recovery, cancellation and data retention |
| [62-stripe-integration.md](62-stripe-integration.md) | Stripe integration flows: Checkout session creation, webhook processing, Customer Portal redirect, BECS Direct Debit setup |
| [63-plan-limits-pricing.md](63-plan-limits-pricing.md) | Plan limits and pricing diagrams: graduated pricing calculation, lot count sync flow, feature gating decision tree, plan limit enforcement |

### User Journeys

| File | Description |
|------|-------------|
| [40-manager-journeys.md](40-manager-journeys.md) | Manager onboarding journey, onboarding flow detail, daily workflow, scheme setup wizard flow |
| [41-owner-portal-journeys.md](41-owner-portal-journeys.md) | Owner activation journey, returning login flow, dashboard components (single/multi-lot), self-service flows, maintenance lifecycle (owner view), notification flow |
| [42-system-architecture.md](42-system-architecture.md) | High-level system architecture (Next.js + Supabase + external services), application layer detail, data flow with RLS, auth architecture, database architecture, external integrations, deployment, cost summary |
| [43-navigation-structure.md](43-navigation-structure.md) | Manager portal navigation tree, owner portal navigation, mobile navigation, feature module dependency map, route map, scheme context switching, information hierarchy |

### Integration

| File | Description |
|------|-------------|
| [50-cross-feature-integration.md](50-cross-feature-integration.md) | Feature integration map, end-to-end data flows (levy payment, maintenance invoice, AGM pack), shared infrastructure, audit trail coverage, cross-feature entity relationship summary |

---

## Consistency Review

This section documents the consistency review performed against the canonical reference documents:
- [00-glossary.md](../features/00-glossary.md) -- canonical terminology
- [00-unified-data-model.md](../features/00-unified-data-model.md) -- canonical table/column names
- [00-cross-feature-review.md](../features/00-cross-feature-review.md) -- known integration issues

### Pricing Update (February 2026)

Pricing in all subscription and billing diagrams (60-63) and feature spec (11-subscription-billing.md) has been verified against the current website pricing:

| Lot Range | Rate (ex GST) |
|-----------|---------------|
| First 10 lots | Free |
| Lots 11-100 | $2.50/lot/mo |
| Lots 101-500 | $1.50/lot/mo |
| Lots 501-2,000 | $1.00/lot/mo |
| Lots 2,001+ | $0.75/lot/mo |

Free tier: 10 lots, 1 scheme. 5 graduated tiers. Annual discount: 2 months free.

### Issues Found and Fixed

| File | Issue | Resolution |
|------|-------|------------|
| 42-system-architecture.md | Section 5 (Database Architecture) referenced pre-unified table names: `portal_users`, `owner_lot_access`, `levy_notices`, `bank_accounts`, `fund_accounts`, `maintenance_request_comments`, `maintenance_request_photos`, `portal_settings`, `notification_preferences`, `email_notifications` | Updated to match unified data model: `levy_items`, `bank_statements`, `budgets`, `maintenance_comments`, `maintenance_attachments`, `audit_log`, `invitations`, `notifications`, `email_log`. Removed separate "Portal" subgraph since owners are part of Core entities. |
| 41-owner-portal-journeys.md | Referenced `maintenance_request_photos` and `maintenance_request_comments` | Updated to `maintenance_attachments` and `maintenance_comments` per unified data model |
| 31-maintenance-workflows.md | Referenced `invoices.transaction_id` in the trust accounting integration flow | Updated to `invoices.payment_reference` per unified data model |
| 41-owner-portal-journeys.md | Owner session TTL shown as 30 days, but canonical auth flows (10-auth-flows.md) specifies 90 days for owners | Updated to 90-day session expiry to match auth specification |

### Verified Consistent

The following aspects were checked and found to be consistent across all diagrams:

- **Entity names** match the glossary: scheme, lot, owner, organisation, manager, admin, auditor, committee member, levy, transaction, fund, etc.
- **Table/column names** match the unified data model: `schemes`, `lots`, `owners`, `lot_ownerships`, `transactions`, `levy_items`, `payment_allocations`, `chart_of_accounts`, etc.
- **Status enums are lowercase**: `pending`, `sent`, `paid`, `draft`, `scheduled`, `notice_sent`, `in_progress`, `completed`, `new`, `acknowledged`, `assigned`, `quoted`, `approved`, `closed`, etc.
- **Role names consistent**: `manager`, `admin`, `auditor`, `owner` (with committee member as an overlay, not a separate role)
- **Relationship cardinalities** are consistent between ER diagrams (01-08) and flow diagrams (20-43, 60-63)
- **Fund types** consistently use `admin` and `capital_works`
- **Meeting types** consistently use `agm`, `sgm`, `committee`
- **Transaction types** consistently use `receipt`, `payment`, `journal`
- **Document visibility** consistently uses `owners`, `committee`, `manager_only`
- **Levy item statuses** consistently use `pending`, `sent`, `paid`, `partial`, `overdue`
- **Double-entry accounting** pattern is consistent across trust accounting (21), payment flows (22), and budget reporting (23) diagrams
- **Payment integration** is consistent: `transactions` is the single source of truth, with `payment_allocations` linking to levy items and `invoices.payment_reference` linking to maintenance payments
- **Subscription statuses** consistently use `trialing`, `active`, `past_due`, `canceled`, `paused`, `free`
- **Subscription table names** match the unified data model: `subscription_plans`, `subscriptions`, `usage_tracking`, `platform_invoices`, `payment_events`
- **Graduated pricing** uses correct tiers: free (first 10), $2.50 (11-100), $1.50 (101-500), $1.00 (501-2,000), $0.75 (2,001+), all ex GST

### Notes

- **Priority labels in 31-maintenance-workflows.md** use descriptive SLA names (emergency, urgent, routine, cosmetic) rather than database enum values (`low`, `medium`, `high`, `urgent`). This is intentional -- the diagrams show the workflow context while the database stores the enum values.
- **Owner portal session TTL** is 90 days for owners (vs 30 days for staff managers/admins). This is a deliberate design decision to reduce friction for infrequent users who may only log in quarterly.

---

## Canonical References

| Document | Purpose |
|----------|---------|
| [00-glossary.md](../features/00-glossary.md) | Standard terminology for all LevyLite documentation, code, and UI |
| [00-unified-data-model.md](../features/00-unified-data-model.md) | Complete database schema (44 tables) -- single source of truth for all table structures |
| [00-cross-feature-review.md](../features/00-cross-feature-review.md) | Cross-feature consistency analysis with known integration issues and resolutions |
