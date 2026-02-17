# LevyLite Build Order

**Date:** 17 February 2026
**Approach:** Incremental phases, each delivering a working vertical slice. Side-project pace (~10-15 hrs/week).

---

## Guiding Principles

1. **Each phase produces something usable** — not just database tables, but screens you can click through
2. **Migrate only the tables you need** — don't create all 44 tables upfront
3. **RLS from day one** — every table gets row-level security when it's created, not bolted on later
4. **Seed data early** — create a test organisation with realistic schemes/lots/owners so you can see real workflows
5. **Feature gating comes last** — build everything as if it's a paid plan, add free tier restrictions in the final phase

---

## Phase 1: Foundation

**Goal:** A logged-in manager can create an organisation, add schemes, add lots, and manage owners.

### Database (11 tables)
```
organisations
organisation_users
schemes
lots
owners
lot_ownerships
committee_members
tenants
audit_log
invitations
notifications
```

### What to build
- Supabase project setup (auth, database, storage)
- Auth flow: email/password signup, magic link login
- Auth hook: on signup → create organisation + organisation_users record
- RLS helper function: `auth.user_organisation_id()`
- Dashboard shell (sidebar nav, scheme switcher, top bar)
- Schemes CRUD (create, edit, list)
- Lots CRUD within a scheme
- Owners CRUD with lot ownership assignment
- Committee member assignment
- CSV import for lots (bulk migration from spreadsheets)
- Seed script: 3 test schemes, 15 lots, 10 owners

### Key decisions to make
- Dashboard layout (sidebar vs top nav — check diagram 43)
- Scheme switcher behaviour (global context vs per-page)

### Done when
- You can sign up, create a scheme, add lots, assign owners, and see them all in a dashboard
- RLS prevents cross-org data leakage (test with two separate users)

---

## Phase 2: Levy Management

**Goal:** A manager can create levy schedules, generate levy notices, record payments, and see arrears.

### Database (4 tables)
```
levy_schedules
levy_periods
levy_items
payment_allocations
```

### What to build
- Levy schedule setup per scheme (quarterly/annual, admin fund + capital works fund rates)
- Generate levy period (creates levy_items for each lot based on entitlement)
- Levy roll view (table: lot, owner, levy due, paid, balance)
- Record manual payment against a levy item (FIFO allocation)
- Arrears dashboard (overdue > 30 days highlighted)
- PDF levy notice generation (per lot)
- Email levy notices to owners (one-by-one or bulk)
- Owner levy statement (PDF: levy history, payments, balance)

### Key integration
- `payment_allocations` links payments to levy items
- Status tracking: `pending` → `sent` → `paid` / `partial` / `overdue`
- This is the core value prop — get it right

### Done when
- You can set up a quarterly levy, generate notices for all lots, record a payment, and see the levy roll update

---

## Phase 3: Trust Accounting

**Goal:** Double-entry ledger with bank reconciliation. Levy payments from Phase 2 flow into the ledger automatically.

### Database (5 tables)
```
chart_of_accounts
financial_years
transactions
transaction_lines
bank_statements
reconciliations
```

### What to build
- Chart of accounts setup (seed default GL structure: admin fund, capital works fund, income, expense categories)
- Transaction entry (receipt, payment, journal)
- Auto-create transaction_lines trigger (double-entry: every debit has a matching credit)
- Link levy payments to transactions (payment in Phase 2 creates a receipt transaction here)
- Transaction list with filtering (by date, type, fund, amount)
- Bank statement CSV upload
- Bank reconciliation screen (match bank rows to transactions)
- Trial balance report
- Fund balance summary (admin fund + capital works fund balances)

### Key integration
- Levy payment recorded in Phase 2 → trigger creates transaction + transaction_lines here
- `payment_allocations.transaction_id` links the two domains
- Audit log captures all transaction changes

### Done when
- Levy payments automatically appear in the ledger
- You can reconcile a bank statement against transactions
- Trial balance balances (debits = credits)

---

## Phase 4: Documents & Reporting

**Goal:** Upload/store documents with 7-year retention. Generate financial reports for AGMs and accountants.

### Database (5 tables)
```
documents
document_versions
document_audit_log
budgets
budget_line_items
```

### What to build
- Document upload (Supabase Storage) with metadata (type, category, scheme)
- Document list with search and filtering
- Document categories (AGM, contracts, insurance, by-laws, correspondence)
- Access control (manager-only vs owner-visible documents)
- Budget creation per scheme per financial year
- Budget vs actual report (compare budget_line_items against transaction totals)
- Income statement report (receipts vs payments by category)
- Levy roll report (export-ready for committee)
- EOFY summary report (for accountant)
- PDF export for all reports

### Done when
- You can upload documents, organise them by scheme, and download them
- You can create a budget and see a budget vs actual report
- Reports generate correct numbers from the ledger

---

## Phase 5: Maintenance & Meetings

**Goal:** Full maintenance request lifecycle and meeting administration including AGM pack generation.

### Database (8 tables)
```
maintenance_requests
maintenance_comments
tradespeople
quotes
invoices
meetings
agenda_items
resolutions
```

### What to build

**Maintenance:**
- Maintenance request submission (manager creates, or owner submits via portal in Phase 6)
- Tradesperson directory (name, trade, contact, ABN)
- Request workflow: `new` → `acknowledged` → `assigned` → `quoted` → `approved` → `in_progress` → `completed`
- Attach quotes and invoices
- Invoice payment → creates transaction in trust accounting (Phase 3)
- Internal notes / comments

**Meetings:**
- Create meeting (AGM/SGM/committee: date, time, location)
- Agenda items
- Record resolutions (motion text, passed/failed, vote count)
- AGM pack generation: pulls levy roll, financial statements, budget — bundles as documents
- Email meeting notices to owners

### Done when
- You can log a maintenance request, assign a tradesperson, approve a quote, pay an invoice, and see the payment flow through to the ledger
- You can create an AGM, generate the pack, and email notices

---

## Phase 6: Owner Portal

**Goal:** Owners can self-serve: view levies, download documents, submit maintenance requests, see meeting info.

### Database (0 new tables)
Uses existing tables with owner-scoped RLS policies.

### What to build
- Owner magic link login (separate from staff auth flow)
- Owner dashboard: levy balance, next payment due, upcoming AGM
- Levy history view (payments, balances, download statements)
- Document library (scheme-level docs visible to owners)
- Submit maintenance request (with photo upload)
- View maintenance request status
- View meeting notices and past minutes
- Update own contact details (manager approves changes)
- Multi-lot view (for owners with lots across multiple schemes)

### Key considerations
- 90-day session TTL (vs 30 days for staff)
- RLS strictly scoped: owners see only their lots, their levies, their requests
- No access to trust accounting ledger, other owners' data, or internal notes

### Done when
- An owner can log in via magic link, see their levy balance, download the latest AGM pack, and submit a maintenance request — without contacting the manager

---

## Phase 7: Subscription & Billing

**Goal:** Stripe integration, plan limits, free tier enforcement, self-service billing management.

### Database (5 tables)
```
subscription_plans
subscriptions
usage_tracking
platform_invoices
payment_events
```

### What to build
- Stripe account setup (test mode first)
- Configure Stripe graduated pricing (5 tiers matching website)
- Subscription record created on signup (status: `trialing`)
- 14-day trial with all features
- Trial expiry flow (→ free tier if ≤10 lots, or prompt to subscribe)
- Stripe Checkout integration (monthly/annual, card + BECS)
- Stripe webhook handler (`checkout.session.completed`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.updated`, `customer.subscription.deleted`)
- Plan limit enforcement: trigger on lots table blocks inserts beyond free tier
- Feature gating: paid-only features show "Upgrade to unlock" on free tier
- `has_active_subscription()` RLS function: blocks writes when subscription is expired
- Stripe Customer Portal integration (update payment method, view invoices, cancel)
- Settings > Billing page (current plan, usage, invoice history)
- Smart dunning: 7-day grace period, email reminders, eventual cancellation
- Data retention: 90-day read-only after cancellation, then purge

### Done when
- A user can sign up, trial for 14 days, subscribe via Stripe, and manage their billing
- Free tier users are correctly limited to 10 lots and gated features
- Failed payments trigger the dunning flow

---

## Phase 8: Polish & Launch Prep

**Goal:** Production-ready for beta customers.

### What to build
- Email infrastructure (Resend): levy notices, meeting notices, maintenance updates, trial reminders, payment receipts
- `email_log` table for audit trail
- Notification system (in-app notifications)
- Error tracking (Sentry)
- Analytics (Plausible or PostHog)
- Security audit: verify all RLS policies, test cross-tenant isolation
- Performance: add database indexes, optimise queries
- Mobile responsiveness pass (all key screens)
- Onboarding wizard (first scheme + lots setup)
- Help text / empty states throughout the UI
- Terms of service + privacy policy pages
- DNS: point `app.levylite.com.au` to Vercel
- Supabase: upgrade to Pro, enable daily backups, configure PITR

### Done when
- You'd be comfortable giving a real strata manager access

---

## Migration Summary

| Phase | New Tables | Running Total |
|-------|-----------|---------------|
| 1. Foundation | 11 | 11 |
| 2. Levy Management | 4 | 15 |
| 3. Trust Accounting | 5 | 20 |
| 4. Documents & Reporting | 5 | 25 |
| 5. Maintenance & Meetings | 8 | 33 |
| 6. Owner Portal | 0 | 33 |
| 7. Subscription & Billing | 5 | 38 |
| 8. Polish & Launch | 1 (email_log) | 39 |

**Note:** The remaining 5 tables from the 44-table data model (`attendees`, `proxies`, `minutes`, `maintenance_attachments`, `document_audit_log`) are created alongside their parent features but excluded from counts above for simplicity.

---

## What NOT to Build

These are explicitly out of scope for MVP (per PRD Section 6):

- Automated bank feeds (Yodlee/Basiq) — manual CSV upload is fine
- Online levy payment by owners (Stripe/PayTo) — manual recording is fine
- Online AGM voting — just record results manually
- Native mobile app — responsive web is fine
- AI features — no auto-categorisation or draft minutes
- Multi-state compliance — WA only for launch
- API access for accountants — export CSV/PDF instead
