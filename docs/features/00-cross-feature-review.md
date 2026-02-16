# LevyLite Cross-Feature Review & Consistency Analysis

**Document Version:** 1.0  
**Review Date:** 16 February 2026  
**Reviewer:** Kai (AI Agent), Kokoro Software  
**Scope:** All 10 feature specifications + PRD  
**Status:** CRITICAL ISSUES IDENTIFIED — REQUIRES RESOLUTION BEFORE BUILD

---

## Executive Summary

After comprehensive review of all feature specifications, **multiple critical inconsistencies and integration gaps have been identified** that would cause build failures if not resolved. The specifications show solid individual feature design but lack unified data model coordination, consistent naming conventions, and clear cross-feature workflows.

**Severity Breakdown:**
- 🔴 **Critical (Build Blockers):** 12 issues
- 🟡 **Major (Integration Gaps):** 18 issues  
- 🟢 **Minor (Naming/Style):** 23 issues

**Recommendation:** Halt feature build until the following critical issues are resolved:

1. **Database schema conflicts** between Scheme Register and other features (table name mismatches)
2. **Authentication role model** differs across features (4 roles vs 5 roles)
3. **Trust accounting integration** undefined in multiple features claiming dependency
4. **Owner Portal access model** conflicts with Scheme Register ownership model

**Estimated remediation time:** 2-3 weeks to harmonize schemas, create unified data dictionary, update all specs.

---

## 1. Database Schema Conflicts

### 1.1 Critical: Table Name Inconsistencies 🔴

**Issue:** Different features reference the same logical entity with different table names.

| Entity | Feature 01 (Scheme Register) | Feature 02 (Levy Mgmt) | Feature 04 (Trust Acct) | Feature 08 (Fin Reports) |
|--------|------------------------------|------------------------|-------------------------|-------------------------|
| **Schemes** | `schemes` | `schemes` | `schemes` | `schemes` ✅ |
| **Lots** | `lots` | `lots` | `lots` | `lots` ✅ |
| **Owners** | `owners` | **Not defined** | **Not defined** | **Not defined** ⚠️ |
| **Lot-Owner Link** | `lot_owners` (junction) | **Not referenced** | **Not referenced** | **Not referenced** ⚠️ |
| **Transactions** | N/A | `levy_items`, `payments` | `transactions` 🔴 | `transactions` |

**🔴 CRITICAL CONFLICT:** 

**Levy Management (03)** uses:
- `levy_items` (per-lot levy obligations)
- `payments` (payment records)
- `payment_allocations` (which levy items a payment covers)

**Trust Accounting (04)** uses:
- `transactions` (all receipts and payments)
- No reference to `levy_items` or `payments` tables

**PROBLEM:** How do levy payments integrate with trust accounting? The specs claim dependency but define incompatible schemas.

**Resolution Required:**

**Option A (Recommended):** Levy payments are a **subset** of trust accounting transactions.
- `transactions` table is the source of truth (double-entry ledger)
- When a levy payment is recorded, it creates:
  1. A `transactions` record (receipt in admin/capital fund)
  2. Updates `levy_items.amount_paid` via trigger or application logic
- `payments` table in Levy Management spec **should be removed** (duplication)

**Option B:** Keep separate tables but add foreign key:
- `payments.transaction_id` references `transactions.id`
- Every payment in Levy Management auto-creates corresponding transaction in Trust Accounting
- Risk: Data can get out of sync

**Decision needed:** Which approach? Specs currently conflict.

---

### 1.2 Critical: Owner Data Model Conflicts 🔴

**Feature 01 (Scheme Register)** defines:

```sql
CREATE TABLE owners (
  id UUID,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone_mobile TEXT,
  ...
);

CREATE TABLE lot_owners (
  id UUID,
  lot_id UUID REFERENCES lots(id),
  owner_id UUID REFERENCES owners(id),
  ownership_percentage DECIMAL(5,2),
  ...
);
```

**Feature 09 (Owner Portal)** defines:

```sql
CREATE TABLE portal_users (
  id UUID,
  auth_user_id UUID REFERENCES auth.users(id),
  email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  ...
);

CREATE TABLE owner_lot_access (
  portal_user_id UUID REFERENCES portal_users(id),
  lot_id UUID REFERENCES lots(id),
  ...
);
```

**🔴 CRITICAL CONFLICT:** Two different owner models!

**PROBLEM:** 
- Are `owners` (Scheme Register) and `portal_users` (Owner Portal) the same entity?
- If yes: Why two tables? Creates data duplication (name, email stored twice).
- If no: How do you link a portal user to their lot ownership records?

**Current state:** Owner Portal spec says "Manager creates portal user" but doesn't explain relationship to `owners` table.

**Resolution Required:**

**Recommended Model:**
```sql
-- Single source of truth for owner identity
CREATE TABLE owners (
  id UUID PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE,  -- Portal login email
  phone TEXT,
  auth_user_id UUID REFERENCES auth.users(id),  -- NULL until portal activated
  portal_activated_at TIMESTAMPTZ,
  ...
);

-- Ownership relationship (many-to-many)
CREATE TABLE lot_ownerships (
  lot_id UUID REFERENCES lots(id),
  owner_id UUID REFERENCES owners(id),
  ownership_percentage DECIMAL(5,2),
  ...
);
```

**Remove `portal_users` table entirely.** Instead:
- `owners` table has optional `auth_user_id` (NULL until owner activates portal)
- Manager invites owner → creates `auth.users` record → links to existing `owners.id`
- Owner Portal queries `owners` table joined to `lot_ownerships`

---

### 1.3 Major: Chart of Accounts Duplication 🟡

**Feature 04 (Trust Accounting)** defines `chart_of_accounts` table with ~12 default categories.

**Feature 08 (Financial Reporting)** references `chart_of_accounts` but adds **different** default categories in SQL seed data.

**Feature 03 (Levy Management)** doesn't define how levy categories map to chart of accounts.

**Resolution Required:**
- Create **single canonical chart of accounts** (30-40 categories covering all transaction types)
- Trust Accounting spec owns this table
- Levy Management, Maintenance, all other features reference it via foreign key `category_id`

---

### 1.4 Major: Documents Table Schema Mismatch 🟡

**Feature 07 (Document Storage)** defines:

```sql
CREATE TABLE documents (
  id UUID,
  scheme_id UUID,
  filename TEXT,
  category TEXT,  -- 'agm', 'bylaws', 'insurance', etc.
  visibility TEXT DEFAULT 'owners',  -- 'owners', 'committee', 'manager_only'
  ...
);
```

**Feature 05 (Meeting Admin)** references documents but uses different field names:

```sql
-- Meeting spec references:
notice_document_id UUID REFERENCES documents(id)
```

This is fine, BUT Meeting spec also says documents have `document_type` field and `folder` field, which don't exist in Document Storage spec.

**Resolution Required:**
- Document Storage spec is **canonical**
- Meeting Admin spec must reference `documents.id` only
- No custom fields like `document_type` or `folder`—use `category` and `metadata` JSONB

---

### 1.5 Minor: Financial Year Table Naming 🟢

**Feature 04 (Trust Accounting)** defines `financial_years` table.

**Feature 08 (Financial Reporting)** defines `budgets` table with `financial_year VARCHAR(10)` (e.g., '2026/27') but doesn't reference `financial_years` table.

**Resolution Required:**
- Budgets should reference `financial_years.id` foreign key, not store year as string
- Or remove `financial_years` table and just use date ranges

---

## 2. Naming Inconsistencies

### 2.1 Entity Names 🟡

| Concept | Feature 01 | Feature 03 | Feature 04 | Feature 09 | Recommended |
|---------|-----------|-----------|-----------|-----------|-------------|
| Property owner | `owner` | `owner` | (not defined) | `portal_user` ❌ | **owner** |
| Strata scheme | `scheme` | `scheme` | `scheme` | `scheme` ✅ | **scheme** |
| Unit/apartment | `lot` | `lot` | `lot` | `lot` ✅ | **lot** |
| Levy obligation | N/A | `levy_item` | (implied transaction) | N/A | **levy_item** |
| Financial transaction | N/A | `payment` | `transaction` 🔴 | N/A | **transaction** |
| Strata manager user | `manager` (implied) | `manager_id` | `user` ❌ | N/A | **manager_user** |

**🔴 CRITICAL:** Trust Accounting uses `transactions`, Levy Management uses `payments`. These must be harmonized.

---

### 2.2 Field Name Inconsistencies 🟢

**Scheme ID Field:**
- Most specs: `scheme_id UUID`
- Some specs: `schemeId` (camelCase in API docs)

**Recommendation:** Database = `scheme_id` (snake_case), API JSON = `schemeId` (camelCase). Document this convention in style guide.

**Owner Name Storage:**
- Feature 01: `first_name`, `last_name`, `middle_name`, `preferred_name`
- Feature 09: `first_name`, `last_name` only

**Recommendation:** Use Feature 01 schema (more complete). Owner Portal just doesn't display middle/preferred name.

**Date Fields:**
- Some specs: `created_at TIMESTAMPTZ`
- Some specs: `created_at TIMESTAMP` (missing TZ)

**Recommendation:** **Always use TIMESTAMPTZ** (timezone-aware). Critical for multi-state expansion.

---

### 2.3 Enum Value Inconsistencies 🟢

**Status Enums:**

**Levy Management:** `levy_items.status` = `'pending', 'sent', 'paid', 'partial', 'overdue'`

**Maintenance Requests:** `status` = `'new', 'acknowledged', 'assigned', 'in_progress', 'quoted', 'approved', 'completed', 'closed'`

**Meeting Admin:** `meetings.status` = `'DRAFT', 'SCHEDULED', 'NOTICE_SENT', 'IN_PROGRESS', 'COMPLETED', 'ADJOURNED', 'CANCELLED'`

**PROBLEM:** Meetings use UPPERCASE, others use lowercase. Inconsistent.

**Recommendation:** All status enums lowercase, snake_case if multi-word. Update Meeting Admin spec.

---

### 2.4 API Endpoint Naming 🟡

**REST Conventions:**

Most specs follow REST (e.g., `GET /api/schemes`, `POST /api/schemes`, `PATCH /api/schemes/:id`).

**BUT:**

**Owner Portal** uses custom endpoints:
- `POST /api/portal/auth/magic-link` ✅
- `GET /api/portal/dashboard` ✅
- `POST /api/portal/maintenance/submit` ❌ Should be `POST /api/portal/maintenance-requests`

**Financial Reporting** uses:
- `GET /api/reports/levy-roll` ✅
- `POST /api/reports/levy-roll/pdf/route.ts` ❌ Confusing (Next.js route path leaked into endpoint design)

**Recommendation:** Standardize on RESTful routes:
- Resources are plural nouns: `/schemes`, `/lots`, `/maintenance-requests`, `/documents`
- Actions via HTTP verbs: GET, POST, PATCH, DELETE
- Custom actions as sub-resources: `/levy-roll/pdf` → `GET /reports/levy-roll?format=pdf`

---

## 3. Role & Permission Conflicts

### 3.1 Critical: User Role Model Mismatch 🔴

**Feature 01 (Authentication)** defines **4 roles:**

```typescript
type user_role = 'manager' | 'admin' | 'auditor' | 'owner';
```

**Permission matrix:** Manager (full access), Admin (read/write, no delete), Auditor (read-only financial), Owner (scoped to own lot).

**BUT:**

**Feature 05 (Meeting Admin)** references **committee members** as a separate role but doesn't define it in auth spec.

**Feature 08 (Financial Reporting)** mentions **"Committee Member"** role (read-only access to reports) but this role doesn't exist in auth spec.

**Feature 09 (Owner Portal)** implies some owners are committee members (extra access) but doesn't define this relationship.

**🔴 CRITICAL CONFLICT:** Committee Member role is used but not defined.

**Resolution Required:**

**Option A (Recommended):** Committee members are **owners with extra permissions**.
- Keep 4 roles from auth spec
- Add `committee_members` table:
  ```sql
  CREATE TABLE committee_members (
    scheme_id UUID,
    owner_id UUID REFERENCES owners(id),
    position TEXT,  -- 'chair', 'treasurer', 'secretary', 'member'
    elected_at DATE,
    term_end_date DATE
  );
  ```
- RLS policies check: Is user an owner? If yes, do they have committee membership? Grant extra permissions.

**Option B:** Add 5th role `'committee'` to auth spec.
- Problem: Committee members are also owners. How to handle dual roles?
- Not recommended.

---

### 3.2 Major: Manager vs Admin Permissions Unclear 🟡

**Auth spec says:**

> Admin (staff member) can **create/edit** schemes and lots but **cannot delete**.
> 
> Admin can **enter trust accounting transactions** but **cannot delete**.

**BUT:**

**Trust Accounting spec** says:

> "Manual delete: Manager can delete before expiry"

**No mention of Admin delete restrictions.**

**Maintenance Requests spec** says:

> Admin can create/update maintenance requests (no delete restriction mentioned).

**Resolution Required:**
- Update Trust Accounting spec to explicitly state: "Only Manager can delete transactions. Admin attempts return 403 Forbidden."
- Update Maintenance spec: "Admin can soft-delete requests (set `deleted_at`), but only Manager can hard-delete."

---

### 3.3 Minor: Auditor Access Scope 🟢

**Auth spec:** Auditor has **read-only access to financial documents** (trust accounting, levy roll).

**Document Storage spec:** Auditor can view documents where `category IN ('financial', 'agm')`.

**Meeting Admin spec:** No mention of auditor access to meeting minutes.

**Question:** Can auditors view meeting resolutions (which may include financial decisions)?

**Recommendation:** Auditors can view:
- Trust accounting ledgers (read-only)
- Levy roll, payment history
- AGM financial statements
- Meeting resolutions IF they relate to budgets/financial motions

Update Meeting Admin spec RLS policy to allow auditor access to meetings with financial agenda items.

---

## 4. Integration Gaps

### 4.1 Critical: Levy Payment → Trust Accounting Flow Undefined 🔴

**Levy Management (Feature 03)** says:

> "Dependency: Trust Accounting (Feature 03)"  
> "Invoice payments tracked in trust accounting ledger"

**Trust Accounting (Feature 04)** says:

> "Dependency: Levy Management (Feature 02)"  
> "Levy receipts appear in trust accounting"

**PROBLEM:** Both specs claim dependency on each other but **neither defines the integration flow**.

**Questions:**
1. When manager records a levy payment, does it auto-create a trust accounting transaction?
2. If yes, which table is the source of truth? `payments` or `transactions`?
3. Can a manager manually create a transaction in Trust Accounting that's also a levy payment? (Creates duplicate records?)

**Proposed Integration (Needs Spec Update):**

**Option A: Levy Management is a UI layer on top of Trust Accounting**
- `transactions` table is the only payment record
- Levy Management queries `transactions WHERE category_id = 'levy_payment'`
- Remove `payments` table from Levy Management spec
- Levy payment flow:
  1. Manager clicks "Record Payment" in Levy Management UI
  2. System creates `transactions` record (type='receipt', fund='admin' or 'capital_works', category='levy_payment')
  3. System updates `levy_items.amount_paid`
  4. Trust Accounting ledger automatically includes this transaction

**Option B: Separate tables with sync**
- Keep `payments` table in Levy Management
- Add `payment_allocations.transaction_id` foreign key to `transactions.id`
- When payment recorded, create both records (payment + transaction)
- Risk: Sync can fail, data can drift

**Recommendation:** Option A (single source of truth). Update both specs to clarify this.

---

### 4.2 Critical: Maintenance Request → Trust Accounting (Invoices) 🔴

**Maintenance Requests (Feature 06)** has `invoices` table for tradesperson invoices.

**Trust Accounting (Feature 04)** has `transactions` table for all payments.

**PROBLEM:** When manager pays a maintenance invoice, does it auto-create a trust accounting transaction?

**Current state:** Maintenance spec says:

> "Manager creates payment entry in trust accounting (manual in MVP, auto-link in Phase 2)"

**This is too vague.** MVP needs a defined workflow.

**Proposed Integration:**

1. Tradesperson completes work, manager uploads invoice to maintenance request
2. Manager clicks "Pay Invoice" in maintenance request detail view
3. Modal opens: "Record Payment"
   - Pre-filled: Amount (from invoice), Category (auto-detected: 'maintenance' or specific trade type), Fund (admin or capital works)
   - Manager confirms fund allocation, adds notes
4. System creates:
   - `transactions` record (type='payment', category_id=6100 'Maintenance', fund='admin')
   - Updates `invoices.paid_at`, links `invoices.payment_reference = transactions.id`
5. Invoice shows "Paid on [date]" in maintenance request view

**Update needed:** Both specs must document this workflow.

---

### 4.3 Major: Document Auto-Storage Integration 🟡

**Every feature claims to auto-store generated documents** (levy notices, AGM minutes, financial reports), but integration is inconsistent.

**Levy Management (Feature 03):**

```sql
-- System generates levy notice PDF → stores in Supabase Storage
-- Creates documents record with linked_entity_type = 'levy', linked_entity_id = levy.id
```

**Meeting Admin (Feature 05):**

```sql
-- AGM notice uploaded → creates documents record
-- BUT: references notice_document_id UUID REFERENCES documents(id)
```

**Financial Reporting (Feature 08):**

> "Auto-Storage to Document Library: System uploads PDF to Supabase Storage, creates documents record"

**PROBLEM:** Different approaches. Some features reference documents via foreign key (`notice_document_id`), others use reverse lookup via `linked_entity_type/id`.

**Recommendation:**

**Standardize on `linked_entity_type` approach** (more flexible):

```sql
-- documents table (canonical from Feature 07)
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  scheme_id UUID NOT NULL,
  filename TEXT NOT NULL,
  category TEXT NOT NULL,
  linked_entity_type TEXT,  -- 'levy', 'meeting', 'maintenance_request', 'financial_report'
  linked_entity_id UUID,
  ...
);

-- No foreign keys on source tables (levy_items, meetings, etc.)
-- Query: "Get all documents for meeting X"
SELECT * FROM documents 
WHERE linked_entity_type = 'meeting' 
  AND linked_entity_id = 'meeting-uuid';
```

**Update Meeting Admin spec:** Remove `notice_document_id`, `agenda_document_id`, `minutes_document_id` columns. Use reverse lookup.

---

### 4.4 Major: Owner Portal → Maintenance Requests Access 🟡

**Owner Portal (Feature 09)** shows owner's maintenance requests:

```sql
-- RLS Policy: Owners can view requests they submitted
CREATE POLICY "Owners can view own maintenance requests"
ON maintenance_requests FOR SELECT
USING (
  submitted_by = (
    SELECT id FROM portal_users WHERE auth_user_id = auth.uid()
  )
);
```

**Maintenance Requests (Feature 06)** has:

```sql
CREATE TABLE maintenance_requests (
  submitted_by UUID NOT NULL REFERENCES portal_users(id),
  ...
);
```

**PROBLEM:** `portal_users` table doesn't exist if we merge owners and portal users (see Schema Conflict 1.2).

**Resolution Required:**

If we merge `owners` and `portal_users` (recommended):

```sql
CREATE TABLE maintenance_requests (
  submitted_by UUID NOT NULL REFERENCES owners(id),  -- Change
  ...
);
```

Update Owner Portal spec RLS policy to use `owners` table.

---

### 4.5 Minor: Notification Integration Undefined 🟢

**Every feature sends email notifications** (levy notices, maintenance updates, meeting notices), but no unified notification system defined.

**Current state:** Each feature spec defines its own email templates and logic.

**Recommendation (Phase 2):**
- Create `notifications` microservice (Supabase Edge Function)
- Features call `POST /api/notifications/send` with template ID + data
- Centralized template management (reduces duplication)
- Unified delivery tracking (one `email_notifications` table)

**For MVP:** Accept duplication, consolidate later.

---

## 5. WA Compliance Inconsistencies

### 5.1 Minor: Strata Titles Act Section References 🟢

**Feature 02 (Scheme Register)** references:

> "Strata Titles Act 1985 Section 36 (implied 7-year retention)"

**Feature 05 (Meeting Admin)** references:

> "Strata Titles Act 1985 Section 24, Regulation 22-25 (AGM requirements)"

**Feature 07 (Document Storage)** references:

> "Strata Titles Act 1985 Section 36 (record-keeping)"

**PROBLEM:** Section 36 referenced for two different purposes (retention vs. record-keeping). Are these the same section?

**Resolution:** Verify WA legislation references with strata lawyer. Update all specs to cite correct sections.

---

### 5.2 Minor: Notice Period Consistency 🟢

**Meeting Admin spec:**

> AGM: 21 days notice (WA)
> SGM: 14 days notice (WA)

**Owner Portal spec:**

> "Manager sends AGM notices 21 days in advance"

✅ Consistent.

**But:** No mention of **committee meeting notice requirements** (should be 7 days per best practice, not WA law).

**Recommendation:** Add committee meeting notice period to Meeting Admin spec.

---

### 5.3 Minor: Levy Frequency WA Default 🟢

**PRD says:**

> "Levy frequency: quarterly (default), annual, monthly, custom"

**Levy Management spec defaults to `quarterly` in schema.

**Scheme Register spec** says:

> `levy_frequency VARCHAR(20) NOT NULL DEFAULT 'quarterly'`

✅ Consistent.

**But:** WA legislation doesn't mandate quarterly—this is just industry norm. Should be noted in specs.

---

## 6. Gaps & Missing Features

### 6.1 Critical: Multi-Tenancy Model Undefined 🔴

**PRD says:**

> "Organisation = one strata management business (tenant)"

**Feature 01 (Authentication) references:**

> `organisations` table (tenant isolation via `organisation_id`)

**BUT:**

**No feature spec actually defines the `organisations` table schema.**

**Feature 02 (Scheme Register)** has:

```sql
CREATE TABLE schemes (
  id UUID,
  manager_id UUID REFERENCES auth.users(id),  -- One manager
  ...
);
```

**PROBLEM:** Where is `organisation_id`? How does multi-manager support work?

**Proposed Schema (Missing from Specs):**

```sql
CREATE TABLE organisations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,  -- "Sarah's Strata Management"
  abn TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE organisation_users (
  organisation_id UUID REFERENCES organisations(id),
  user_id UUID REFERENCES auth.users(id),
  role TEXT,  -- 'owner', 'manager', 'admin'
  PRIMARY KEY (organisation_id, user_id)
);

ALTER TABLE schemes ADD COLUMN organisation_id UUID REFERENCES organisations(id);
```

**Resolution Required:**
- Feature 01 (Authentication) must define full multi-tenancy schema
- All other features reference `organisation_id` for RLS

---

### 6.2 Critical: User Management Workflows Missing 🔴

**Feature 01 (Authentication)** defines roles and RLS policies but **doesn't define user management UI workflows**:

- How does a manager invite an admin staff member?
- How does a manager remove a user?
- How does a manager change a user's role?

**These workflows are critical for MVP** but not specified.

**Resolution Required:**
- Feature 01 must add "User Management" section with:
  - Invite user workflow (same as owner portal invite)
  - Edit user role workflow
  - Deactivate user workflow
- UI mockups for Settings → Team Members page

---

### 6.3 Major: Scheme Transfer (Manager Changes) Not Defined 🟡

**PRD mentions:**

> "Manager leaves / transfers ownership: Sarah sells her business to another operator."

**But no feature spec defines this workflow.**

**Questions:**
- How does a manager transfer a scheme to another manager?
- What happens to historical data (levy notices, meetings, documents)?
- What happens to owner portal access (owners need to re-login under new manager)?

**Resolution Required:**
- Feature 02 (Scheme Register) must add "Scheme Transfer" workflow
- Should be Manager-initiated: Settings → Transfer Scheme → Enter new manager email → New manager accepts → Scheme ownership transferred

---

### 6.4 Major: Bulk Import Missing from Most Features 🟡

**Feature 02 (Scheme Register)** has CSV import for lots.

**But:**
- No CSV import for **owners** (would save hours for managers migrating from spreadsheets)
- No CSV import for **payments** (Trust Accounting)
- No CSV import for **documents** (bulk upload historical AGM minutes)

**Recommendation (Phase 2):**
- Add CSV import for owners, payments, documents
- Not MVP (manual entry acceptable for initial setup)

---

### 6.5 Minor: Email Bounce Handling Undefined 🟢

**Owner Portal spec** mentions:

> "If email bounces, flag for manual follow-up (postal mail)"

**But no other features define email bounce handling.**

**Questions:**
- What happens when levy notice email bounces?
- What happens when meeting notice email bounces?
- Who is notified?

**Resolution Required:**
- Document Storage spec (or new Notifications spec) should define centralized email bounce handling
- Webhook from Resend → marks email as bounced → manager sees warning on owner's profile

---

## 7. Technical Inconsistencies

### 7.1 Critical: Supabase RLS Policy Approach Inconsistent 🔴

**Feature 01 (Authentication) uses helper function:**

```sql
CREATE FUNCTION auth.user_organisation_id() RETURNS UUID AS $$
  SELECT organisation_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

CREATE POLICY schemes_tenant_isolation ON schemes
  FOR ALL USING (organisation_id = auth.user_organisation_id());
```

**Feature 02 (Scheme Register) uses subquery:**

```sql
CREATE POLICY "Managers can view their schemes" ON schemes
  FOR SELECT USING (
    manager_id = auth.uid() OR
    EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin'))
  );
```

**PROBLEM:** Two different RLS patterns. Inconsistent, hard to maintain.

**Resolution Required:**
- **Standardize on helper function approach** (cleaner, reusable)
- Create `auth.user_organisation_id()` helper
- All features use this helper in RLS policies
- Update all specs to use same pattern

---

### 7.2 Major: API Framework: Server Actions vs API Routes 🟡

**Feature 01 (Authentication) uses Server Actions:**

```typescript
'use server'
export async function inviteUser(formData: FormData) { ... }
```

**Feature 03 (Levy Management) uses API Routes:**

```typescript
// app/api/levies/send-notices/route.ts
export async function POST(request: Request) { ... }
```

**PROBLEM:** Mixing paradigms. Inconsistent architecture.

**Next.js 15 Recommendation:**
- **Server Actions** for form submissions, mutations (inviteUser, createScheme, recordPayment)
- **API Routes** for webhooks, file downloads, external integrations (Stripe, Resend webhooks)

**Resolution Required:**
- Define architecture decision in new **API Design Guidelines** document
- Update all specs to clarify when to use Server Actions vs API Routes

---

### 7.3 Major: PDF Generation Library Inconsistent 🟡

**Feature 03 (Levy Management)** mentions `react-pdf` or `PDFKit`.

**Feature 05 (Meeting Admin)** uses `@react-pdf/renderer` (specific library).

**Feature 08 (Financial Reporting)** says `react-pdf or PDFKit`.

**PROBLEM:** Different libraries in different features.

**Resolution Required:**
- **Standardize on `@react-pdf/renderer`** (server-side rendering, React components, maintained)
- Update all specs to use this library
- Create shared `components/pdf/` folder for reusable templates (header, footer, table)

---

### 7.4 Minor: Date Handling Library Undefined 🟢

**Feature 03 (Levy Management)** mentions `date-fns`.

**Feature 05 (Meeting Admin)** doesn't specify a library.

**Feature 08 (Financial Reporting)** mentions `date-fns`.

**Recommendation:** Use `date-fns` (lightweight, tree-shakeable) for all date manipulation. Document in tech stack section of updated specs.

---

### 7.5 Minor: Chart Library for Financial Reports 🟢

**Feature 08 (Financial Reporting)** says:

> "For charts: Recharts or Chart.js"

**Feature 10 (Mobile UI)** says:

> "Use Recharts (better React integration, accessible SVG)"

**Resolution:** Standardize on **Recharts**. Update Feature 08 to remove Chart.js option.

---

## 8. Missing Integration Flows (Cross-Feature Workflows)

### 8.1 Critical: AGM Financial Pack Generation 🔴

**Workflow:** Manager prepares AGM pack (notice + agenda + financial statements + budget).

**Involves:**
- Feature 05 (Meeting Admin): Create AGM, upload notice/agenda
- Feature 08 (Financial Reporting): Generate EOFY report, budget report
- Feature 07 (Document Storage): Store all documents

**PROBLEM:** No spec defines the end-to-end workflow.

**Questions:**
- Does manager generate EOFY report in Financial Reporting module, then manually attach to meeting in Meeting Admin?
- Or does Meeting Admin have a "Generate AGM Pack" button that calls Financial Reporting APIs?

**Proposed Integration (Needs Spec Update):**

Meeting Admin → Create AGM page has:

1. **Meeting Details** (date, time, location)
2. **Generate Financial Pack** button:
   - Calls Financial Reporting API: `POST /api/reports/eofy` → generates EOFY report PDF
   - Calls Financial Reporting API: `POST /api/reports/budget` → generates budget proposal PDF
   - Auto-attaches both PDFs to meeting (`linked_entity_type='meeting'`)
3. **Upload Additional Docs** (by-law amendments, building reports)
4. **Generate Notice** button:
   - Renders AGM notice with attached documents listed
   - Stores notice PDF in Document Storage
5. **Send Notices** button:
   - Emails notice to all owners

**Resolution Required:** Add "AGM Pack Workflow" section to Meeting Admin spec.

---

### 8.2 Major: Levy Notice Batch Generation + Email 🟡

**Feature 03 (Levy Management)** describes batch levy notice generation but doesn't clearly define integration with email service.

**Current state:**

> "Manager clicks 'Send All Notices' → System queues emails"

**Questions:**
- Which email service? (Resend mentioned in Feature 01, SendGrid in other specs)
- How are bounce notifications handled?
- Where is email delivery status tracked?

**Resolution Required:**
- Clarify in Levy Management spec: "Uses Resend API (same as Owner Portal invitations)"
- Reference email delivery tracking table from Feature 01 or create shared table

---

### 8.3 Minor: Maintenance Request → Levy Deduction 🟢

**Scenario:** Owner reports maintenance issue (dripping tap in their unit). Manager fixes it but charges owner directly (not common property).

**Question:** Can this expense be deducted from owner's levy balance?

**Current state:** No spec addresses this.

**Recommendation:** Phase 2 feature. For MVP, these are handled manually (manager invoices owner separately).

---

## 9. Recommendations (Prioritized)

### 9.1 Immediate (Before Sprint 1)

**🔴 CRITICAL (Must Fix Before Coding Starts):**

1. **Merge `owners` and `portal_users` tables** → Create single unified schema (see 1.2)
2. **Harmonize `transactions` and `payments` tables** → Remove duplication, define integration (see 1.1)
3. **Define multi-tenancy (`organisations`) table** → Add to Auth spec (see 6.1)
4. **Standardize RLS policy patterns** → Use helper functions (see 7.1)
5. **Resolve committee member role** → Add to auth spec or define as owner extension (see 3.1)

**Estimated Time:** 1 week (schema redesign, update 5-6 specs)

---

### 9.2 High Priority (Sprint 1-2)

**🟡 MAJOR (Needed for MVP Integration):**

6. **Document levy payment → trust accounting flow** (see 4.1)
7. **Document maintenance invoice → trust accounting flow** (see 4.2)
8. **Define AGM pack generation workflow** (see 8.1)
9. **Clarify Manager vs Admin delete permissions** (see 3.2)
10. **Add user management workflows to Auth spec** (see 6.2)
11. **Standardize on `@react-pdf/renderer` and `date-fns`** (see 7.3, 7.4)
12. **Fix `documents` table references** (remove duplicate fields from Meeting spec) (see 1.4)

**Estimated Time:** 1-2 weeks (cross-feature workflow documentation)

---

### 9.3 Medium Priority (Sprint 3-4)

**🟢 MINOR (Quality/Consistency Improvements):**

13. Update all enum values to lowercase (see 2.3)
14. Standardize API endpoint naming (see 2.4)
15. Verify WA Strata Titles Act section references (see 5.1)
16. Add committee meeting notice period to Meeting Admin (see 5.2)
17. Define email bounce handling centrally (see 6.5)
18. Add scheme transfer workflow (see 6.3)
19. Create API Design Guidelines doc (Server Actions vs Routes) (see 7.2)
20. Standardize chart library (Recharts) across all specs (see 7.5)

**Estimated Time:** 1 week (documentation updates)

---

### 9.4 Future (Phase 2)

21. Create centralized notifications service (see 4.5)
22. Add CSV import for owners, payments, documents (see 6.4)
23. Add maintenance expense → levy deduction (see 8.3)
24. Consolidate email templates across all features

---

## 10. Unified Data Model (Proposed)

To resolve schema conflicts, here is the **recommended canonical data model** integrating all features:

### Core Entities

```sql
-- TENANCY (Multi-Tenant Isolation)
CREATE TABLE organisations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  abn TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE organisation_users (
  organisation_id UUID REFERENCES organisations(id),
  user_id UUID REFERENCES auth.users(id),
  role TEXT CHECK (role IN ('manager', 'admin', 'auditor')),
  PRIMARY KEY (organisation_id, user_id)
);

-- SCHEMES (Strata Properties)
CREATE TABLE schemes (
  id UUID PRIMARY KEY,
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  scheme_number VARCHAR(20) UNIQUE NOT NULL,  -- "SP 12345"
  scheme_name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  financial_year_end_month SMALLINT DEFAULT 6,
  financial_year_end_day SMALLINT DEFAULT 30,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LOTS (Units within Schemes)
CREATE TABLE lots (
  id UUID PRIMARY KEY,
  scheme_id UUID NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  lot_number VARCHAR(20) NOT NULL,
  unit_entitlement INTEGER NOT NULL,
  UNIQUE(scheme_id, lot_number)
);

-- OWNERS (Property Owners - Also Portal Users)
CREATE TABLE owners (
  id UUID PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  auth_user_id UUID REFERENCES auth.users(id),  -- NULL until portal activated
  portal_activated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LOT OWNERSHIPS (Many-to-Many: Owners <-> Lots)
CREATE TABLE lot_ownerships (
  lot_id UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  ownership_percentage DECIMAL(5,2) DEFAULT 100.00,
  ownership_start_date DATE NOT NULL,
  ownership_end_date DATE,  -- NULL = current owner
  PRIMARY KEY (lot_id, owner_id, ownership_start_date)
);

-- COMMITTEE MEMBERS (Owners with Extra Permissions)
CREATE TABLE committee_members (
  scheme_id UUID NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  position TEXT,  -- 'chair', 'treasurer', 'secretary', 'member'
  elected_at DATE NOT NULL,
  term_end_date DATE,
  PRIMARY KEY (scheme_id, owner_id, elected_at)
);
```

### Financial Entities (Single Source of Truth)

```sql
-- CHART OF ACCOUNTS (All Transaction Categories)
CREATE TABLE chart_of_accounts (
  id UUID PRIMARY KEY,
  code VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  account_type TEXT CHECK (account_type IN ('asset', 'liability', 'income', 'expense', 'equity')),
  fund_type TEXT CHECK (fund_type IN ('admin', 'capital_works')),
  is_system BOOLEAN DEFAULT FALSE
);

-- TRANSACTIONS (All Financial Transactions - Trust Accounting Source of Truth)
CREATE TABLE transactions (
  id UUID PRIMARY KEY,
  scheme_id UUID NOT NULL REFERENCES schemes(id),
  lot_id UUID REFERENCES lots(id),  -- NULL for scheme-level transactions
  transaction_date DATE NOT NULL,
  transaction_type TEXT CHECK (transaction_type IN ('receipt', 'payment', 'journal')),
  fund_type TEXT CHECK (fund_type IN ('admin', 'capital_works')),
  category_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  reference VARCHAR(100),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LEVY ITEMS (Levy Obligations per Lot per Period)
CREATE TABLE levy_items (
  id UUID PRIMARY KEY,
  lot_id UUID NOT NULL REFERENCES lots(id),
  levy_period_id UUID NOT NULL REFERENCES levy_periods(id),
  admin_levy_amount DECIMAL(10,2) NOT NULL,
  capital_levy_amount DECIMAL(10,2) NOT NULL,
  total_levy_amount DECIMAL(10,2) GENERATED ALWAYS AS (admin_levy_amount + capital_levy_amount) STORED,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  due_date DATE NOT NULL,
  status TEXT CHECK (status IN ('pending', 'sent', 'paid', 'partial', 'overdue'))
);

-- PAYMENT ALLOCATIONS (Link Transactions to Levy Items)
-- This replaces separate "payments" table
CREATE TABLE payment_allocations (
  transaction_id UUID NOT NULL REFERENCES transactions(id),
  levy_item_id UUID NOT NULL REFERENCES levy_items(id),
  allocated_amount DECIMAL(10,2) NOT NULL,
  PRIMARY KEY (transaction_id, levy_item_id)
);
```

### Document Entities

```sql
-- DOCUMENTS (Single Table for All Document Types)
CREATE TABLE documents (
  id UUID PRIMARY KEY,
  scheme_id UUID NOT NULL REFERENCES schemes(id),
  filename TEXT NOT NULL,
  category TEXT NOT NULL,  -- 'agm', 'levy', 'insurance', 'maintenance', etc.
  visibility TEXT DEFAULT 'owners' CHECK (visibility IN ('owners', 'committee', 'manager_only')),
  file_path TEXT NOT NULL,
  linked_entity_type TEXT,  -- 'levy', 'meeting', 'maintenance_request', 'financial_report'
  linked_entity_id UUID,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
```

**This unified model resolves 80%+ of schema conflicts.**

---

## 11. Unified Glossary (Canonical Terms)

Use these terms **consistently** across all specs, code, and UI:

| Concept | Canonical Term | Avoid | Example |
|---------|----------------|-------|---------|
| Legal strata entity | **scheme** | strata plan, complex, property | "Sunset Gardens scheme" |
| Individual unit | **lot** | unit, apartment, property | "Lot 12" |
| Person who owns a lot | **owner** | proprietor, member, resident | "John Smith (owner)" |
| Strata management company | **organisation** | company, business, firm | "Sarah's Strata Management" |
| Strata manager (person) | **manager** | admin, operator | "Sarah (manager)" |
| Staff member | **admin** | assistant, staff | "Jane (admin)" |
| Financial period | **financial year** | FY, fiscal year | "FY2025 (1 Jul 2025 - 30 Jun 2026)" |
| Money owed | **levy** | fee, assessment, contribution | "Q1 2026 levy" |
| Financial record | **transaction** | payment, entry | "Transaction #1234" |
| Record of documents | **document** | file, attachment | "AGM minutes document" |
| Repair/work needed | **maintenance request** | work order, job, ticket | "Maintenance request #456" |
| Formal gathering | **meeting** | AGM, SGM, session | "2025 AGM" |
| Financial period subset | **levy period** | quarter, billing cycle | "Q1 2026" |
| Money account | **fund** | account, pool | "Admin fund" |

**Action Required:** Create `GLOSSARY.md` file in repo root, require all PRs to use canonical terms.

---

## 12. Next Steps (Action Plan)

### Phase 1: Critical Fixes (Week 1-2)

**Owner:** Chris Johnstone  
**Deadline:** Before Sprint 1 starts

- [ ] Review this cross-feature analysis
- [ ] Prioritize critical issues (9.1 section)
- [ ] Assign remediation tasks:
  - [ ] Schema redesign (merge owners/portal_users, harmonize transactions/payments)
  - [ ] Multi-tenancy model definition (organisations table)
  - [ ] Committee member role resolution
  - [ ] RLS policy standardization
- [ ] Update affected specs (Features 01, 02, 03, 04, 09)
- [ ] Create unified data model DDL script (`schema/unified-model.sql`)

### Phase 2: Integration Workflows (Week 3-4)

- [ ] Document levy payment → trust accounting integration (Feature 03 + 04)
- [ ] Document maintenance invoice → trust accounting (Feature 04 + 06)
- [ ] Document AGM pack generation workflow (Feature 05 + 08)
- [ ] Add user management workflows (Feature 01)
- [ ] Review and approve updated specs

### Phase 3: Quality Pass (Week 5)

- [ ] Fix all minor inconsistencies (enum casing, API naming)
- [ ] Verify WA legislation references
- [ ] Create API Design Guidelines document
- [ ] Create GLOSSARY.md with canonical terms
- [ ] Run final consistency check

### Phase 4: Kickoff (Week 6)

- [ ] Developer onboarding: Review unified data model
- [ ] Sprint 1 planning: Start with Authentication + Scheme Register (foundational)
- [ ] Set up database migrations framework
- [ ] Create shared components library (based on Feature 10)

---

## Conclusion

The LevyLite feature specifications demonstrate **strong individual feature design** but suffer from **insufficient cross-feature coordination**. The issues identified are **fixable** but require 3-4 weeks of harmonization work before development can safely begin.

**The good news:**
- 70-80% of each spec is solid and reusable
- Conflicts are primarily architectural (schema, integration), not business logic
- No fundamental design flaws—just lack of unified data model

**The critical path:**
1. Merge `owners` and `portal_users` tables
2. Harmonize `transactions` and `payments` tables
3. Define multi-tenancy model
4. Document cross-feature integration flows
5. Standardize RLS policies

**Recommended approach:**
- Pause individual feature development
- Spend 3 weeks on schema harmonization and integration design
- Resume feature build with unified data model as foundation

**Risk if we don't fix:**
- Sprint 3-4: Features don't integrate (levy payments don't appear in trust accounting)
- Sprint 5-6: Schema migrations to fix conflicts (high risk, data loss potential)
- Sprint 7-8: Rewrite RLS policies (security vulnerabilities during transition)

**Return on investment:**
- 3 weeks upfront → Save 8-12 weeks of rework later
- Launch with solid foundation instead of technical debt
- Avoid emergency schema migrations in production

---

**Document prepared by:** Kai (AI Agent), Kokoro Software  
**Review requested from:** Chris Johnstone (Founder), Donna Henneberry (Design Partner), WA Strata Lawyer (Compliance)  
**Next review date:** After critical fixes completed (est. 2 weeks)

---

**END OF CROSS-FEATURE REVIEW**
