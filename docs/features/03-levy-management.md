# Feature Specification: Levy Management

**Product:** LevyLite  
**Feature:** Levy Management (Core Module)  
**Version:** 1.0 MVP  
**Date:** 16 February 2026  
**Author:** Chris Johnstone  
**Dependencies:** Scheme Register, Owner Management, Trust Accounting, Document Storage, Email Service  

---

## 1. Overview

Levy Management is the **central revenue and compliance feature** of LevyLite. It automates the quarterly/annual cycle of calculating levies based on approved budgets, generating compliant levy notices, tracking payments, managing arrears, and producing statutory reports required under the WA Strata Titles Act 1985.

**Core User Story:** Sarah, a sole practitioner managing 15 strata schemes, currently spends 8-10 hours per quarter manually creating levy notices in Word, emailing them individually, and tracking payments in Excel. She loses 2-3 hours per month chasing arrears and struggles to produce accurate levy roll reports for AGMs. LevyLite reduces this to 30 minutes of review time per quarter via automation.

---

## 2. Business Requirements

### 2.1 Functional Requirements

| ID | Requirement | Priority | Compliance |
|----|-------------|----------|------------|
| **LM-1** | Configure levy schedules per scheme (quarterly, annual, monthly, custom) | P0 | WA Act: levies determined by strata company |
| **LM-2** | Calculate levies per lot based on unit entitlement (admin fund + capital works fund) | P0 | WA Act s35: levies proportional to unit entitlement |
| **LM-3** | Generate PDF levy notices compliant with WA Strata Titles Act | P0 | WA Regulations 2019: prescribed notice content |
| **LM-4** | Email levy notices to owners with delivery tracking | P0 | Operational efficiency |
| **LM-5** | Manually record payments (bank transfer, cheque, cash) and allocate to levy periods | P0 | Trust accounting requirement |
| **LM-6** | Track arrears and trigger reminder workflows (7, 14, 30 days overdue) | P0 | Cash flow management |
| **LM-7** | Generate levy roll reports (amounts due, paid, outstanding per lot) | P0 | WA Act: required for AGM financial statements |
| **LM-8** | Support special levies (one-off levies for capital projects) | P1 | WA Act s36: special purpose levies |
| **LM-9** | Handle partial payments and overpayments/credits | P1 | Operational flexibility |
| **LM-10** | Calculate interest on overdue levies (if applicable under WA law) | P2 | Revenue recovery (subject to by-laws) |

### 2.2 Non-Functional Requirements

- **Performance:** Batch generate 100 levy notices in <30 seconds
- **Reliability:** Zero data loss in payment recording (PostgreSQL ACID compliance)
- **Usability:** Manager can configure new levy schedule in <5 minutes
- **Compliance:** Full audit trail of all levy calculations, notices, and payments
- **Security:** Only scheme managers + authorized users can modify levy data (Supabase RLS)

---

## 3. Levy Schedules

### 3.1 Schedule Configuration

**User Flow:**
1. Manager navigates to **Scheme → Settings → Levy Schedules**
2. Creates new schedule or edits existing
3. Configures:
   - **Frequency:** Quarterly (default), Annual, Monthly, Custom (define specific dates)
   - **Fund split:** Admin fund % vs Capital Works fund %
   - **Budget year:** Financial year (e.g., 1 July 2026 - 30 June 2027)
   - **Total budget:** Admin fund total + Capital works fund total (from AGM-approved budget)
   - **Levy periods:** Auto-generate based on frequency (e.g., Q1: 1 July - 30 Sept, Q2: 1 Oct - 31 Dec)
4. System calculates levy amounts per lot based on unit entitlements
5. Manager reviews and activates schedule

**Example:**
- **Scheme:** ABC Strata Plan 12345 (10 lots)
- **Budget FY2027:** Admin $48,000 | Capital Works $24,000
- **Frequency:** Quarterly
- **Lot 1 entitlement:** 1/10 (10%)
- **Lot 1 quarterly levy:** Admin $1,200 + Capital Works $600 = **$1,800 per quarter**

### 3.2 Special Levies

**Use Case:** Building needs $50,000 roof replacement. Strata company passes special resolution at SGM to raise special levy.

**User Flow:**
1. Manager creates **Special Levy** (separate from regular schedule)
2. Defines:
   - **Purpose:** "Roof replacement Stage 2"
   - **Total amount:** $50,000
   - **Due date:** 30 days from notice issue
   - **Allocation:** By unit entitlement OR custom (e.g., only owners on floors 3-5)
3. System generates special levy notices (separate PDF template)
4. Manager emails to affected owners

**Compliance:** WA Strata Titles Act s36 allows special levies via special resolution (75% vote).

### 3.3 Budget-Based Calculation

**Formula:**
```
Levy per lot per period = (Total Budget for Fund × Unit Entitlement) ÷ Number of Periods

Example:
Admin Fund Levy = ($48,000 × 0.10) ÷ 4 quarters = $1,200/quarter
Capital Works Levy = ($24,000 × 0.10) ÷ 4 quarters = $600/quarter
Total Quarterly Levy = $1,800
```

**Edge Cases:**
- **Mid-year budget change:** Pro-rata adjustment for remaining periods (manager manually edits schedule)
- **New lot added mid-year:** Manager creates levy schedule for new lot, pro-rated for remaining periods
- **Lot sold during period:** Levy responsibility passes to new owner at settlement (tracked in owner register, not automated in MVP)

### 3.4 Rounding Rules

**Problem:** $48,000 ÷ 10 lots ÷ 4 quarters = $1,200.00 (clean). But $48,000 ÷ 12 lots ÷ 4 quarters = $1,000.00 (clean). $48,001 ÷ 12 ÷ 4 = $1,000.02083...

**Rule:**
- Round to **nearest cent** per lot per period
- Total levy across all lots may be $0.01-$0.10 different from budget due to rounding
- Rounding difference goes to **admin fund** (small, immaterial)
- Display rounding note in levy schedule: "Total levies $48,000.12 (budget $48,000.00, rounding difference $0.12)"

**Implementation:** PostgreSQL `NUMERIC(10,2)` type, `ROUND(amount, 2)` in calculation queries.

---

## 4. Levy Calculation Engine

### 4.1 Calculation Inputs

**From Database:**
- Scheme budget (admin fund, capital works fund)
- Levy schedule (frequency, periods, start/end dates)
- Lot register (lot number, unit entitlement)
- Owner register (linked to lot)

**Calculation Logic:**
```sql
-- Calculate levy for each lot for a specific period
WITH lot_levies AS (
  SELECT 
    l.id AS lot_id,
    l.lot_number,
    l.unit_entitlement,
    ls.admin_fund_total,
    ls.capital_works_fund_total,
    ls.periods_per_year,
    ROUND((ls.admin_fund_total * l.unit_entitlement / ls.periods_per_year), 2) AS admin_levy,
    ROUND((ls.capital_works_fund_total * l.unit_entitlement / ls.periods_per_year), 2) AS capital_levy
  FROM lots l
  JOIN levy_schedules ls ON l.scheme_id = ls.scheme_id
  WHERE ls.active = true
)
SELECT 
  lot_id,
  lot_number,
  admin_levy,
  capital_levy,
  (admin_levy + capital_levy) AS total_levy
FROM lot_levies;
```

### 4.2 Levy Items (Per-Lot-Per-Period Records)

**Data Model:**
```sql
levy_items (
  id: UUID,
  scheme_id: UUID FK,
  lot_id: UUID FK,
  levy_period_id: UUID FK,
  admin_levy_amount: NUMERIC(10,2),
  capital_levy_amount: NUMERIC(10,2),
  total_levy_amount: NUMERIC(10,2) GENERATED,
  due_date: DATE,
  status: ENUM('pending', 'sent', 'paid', 'partial', 'overdue'),
  notice_sent_at: TIMESTAMP,
  paid_at: TIMESTAMP,
  amount_paid: NUMERIC(10,2),
  balance: NUMERIC(10,2) GENERATED AS (total_levy_amount - COALESCE(amount_paid, 0))
)
```

**Status Workflow:**
- **pending:** Levy calculated but notice not yet sent
- **sent:** Notice emailed to owner, payment not received
- **partial:** Some payment received but balance remains
- **paid:** Fully paid
- **overdue:** Due date passed, balance > 0

### 4.3 Validation Rules

| Rule | Validation | Error Message |
|------|------------|---------------|
| **Budget > 0** | `admin_fund_total > 0 AND capital_works_fund_total >= 0` | "Admin fund budget must be greater than zero" |
| **Entitlements sum to 1** | `SUM(unit_entitlement) = 1.0` per scheme | "Total unit entitlements must equal 1.0 (currently {sum})" |
| **Periods valid** | `periods_per_year IN (1,2,4,12)` OR custom dates non-overlapping | "Invalid period frequency" |
| **Due date future** | `due_date >= CURRENT_DATE` when creating new period | "Due date must be in the future" |

---

## 5. Levy Notice Generation

### 5.1 PDF Template Specification

**Library:** `@react-pdf/renderer` (React components → PDF)

**Document Structure:**

```
┌─────────────────────────────────────────────┐
│ [Strata Company Letterhead]                │
│ ABC Strata Company SP12345                  │
│ 123 Example Street, Perth WA 6000          │
│ ABN: 12 345 678 901                        │
├─────────────────────────────────────────────┤
│ LEVY NOTICE                                 │
│ Notice Date: 25 June 2026                   │
│ Due Date: 31 July 2026                      │
├─────────────────────────────────────────────┤
│ Owner: John Smith                           │
│ Lot: 5 / SP12345                            │
│ Address: 5/123 Example St, Perth WA 6000    │
├─────────────────────────────────────────────┤
│ LEVY DETAILS                                │
│                                             │
│ Period: Q1 FY2027 (1 July - 30 Sept 2026)  │
│                                             │
│ Admin Fund Levy:          $1,200.00         │
│ Capital Works Fund Levy:    $600.00         │
│ ─────────────────────────────────────       │
│ Total Due:                $1,800.00         │
│                                             │
│ Unit Entitlement: 1/10 (10%)                │
├─────────────────────────────────────────────┤
│ PAYMENT INSTRUCTIONS                        │
│                                             │
│ BSB: 066-123  Account: 12345678             │
│ Account Name: ABC Strata Co Trust Account   │
│ Reference: LOT5-Q12027                      │
│                                             │
│ Please pay by 31 July 2026                  │
├─────────────────────────────────────────────┤
│ ARREARS (if any)                            │
│ Previous Balance Owing: $450.00             │
│ TOTAL AMOUNT DUE: $2,250.00                 │
├─────────────────────────────────────────────┤
│ NOTES                                       │
│ Levies are payable under s35 of the Strata  │
│ Titles Act 1985 (WA). Failure to pay may    │
│ result in recovery action as per s77.       │
│                                             │
│ Questions? Contact: Sarah Johnson           │
│ Email: sarah@example.com | Ph: 08 9xxx xxxx │
└─────────────────────────────────────────────┘
```

### 5.2 Required Content (WA Compliance)

**Strata Titles (General) Regulations 2019 - Schedule 1 (Form 1: Levy Notice):**

1. ✅ Strata company name and plan number
2. ✅ Owner name and lot number
3. ✅ Levy period (dates)
4. ✅ Admin fund levy amount
5. ✅ Capital works (sinking) fund levy amount
6. ✅ Total levy amount
7. ✅ Due date
8. ✅ Payment instructions (bank account details)
9. ✅ Arrears (if any) from previous periods
10. ✅ Legal reference (Strata Titles Act)
11. ✅ Contact details for queries

**Optional (recommended):**
- Unit entitlement (transparency)
- Payment reference (auto-reconciliation)
- QR code for online payment (Phase 2: online payment portal)

### 5.3 Batch Generation

**User Flow:**
1. Manager navigates to **Levies → [Period] → Generate Notices**
2. Reviews levy items (100 lots)
3. Clicks **Generate All PDFs**
4. System:
   - Queries all lots in scheme with status = 'pending'
   - For each lot, renders PDF via `react-pdf`
   - Saves PDF to Supabase Storage: `/levy-notices/{scheme_id}/{period_id}/{lot_id}.pdf`
   - Updates `levy_items.notice_generated_at = NOW()`
5. Progress bar shows 1/100, 2/100... 100/100 (30 seconds total)
6. Manager reviews generated PDFs (random spot check: Lot 1, Lot 50, Lot 100)
7. Proceeds to **Email Delivery** step

**Performance:** 
- Target: 100 PDFs in <30 seconds (300ms per PDF)
- Use server-side rendering (Next.js API route) + background job queue (Supabase Edge Functions or Vercel background functions)
- For >500 lots, queue job and email manager when complete

### 5.4 PDF Storage

**Location:** Supabase Storage bucket `levy-notices` (private, requires authentication)

**Path Structure:**
```
/levy-notices/
  {scheme_id}/
    {levy_period_id}/
      {lot_id}.pdf
      metadata.json (levy period details, generation timestamp)
```

**Retention:** 7 years (compliance requirement). Auto-delete after 7 years via Supabase Storage lifecycle policy.

**Access Control (Supabase RLS):**
- Managers: Can read all PDFs for their schemes
- Owners: Can read only their own lot's PDFs (via owner portal)
- Auditors: Read-only access to all PDFs

---

## 6. Email Delivery

### 6.1 Email Service

**Provider:** Resend
- **Resend:** Developer-friendly API, 100 emails/day free, $20/month for 50K emails, excellent delivery analytics

**Architecture:**
- Next.js API route `/api/levies/send-notices` triggered by manager
- Calls Resend API with email template + PDF attachment
- Logs delivery status in database

### 6.2 Email Template

**Subject:** `Levy Notice - Lot {lot_number} - Due {due_date}`

**Body (HTML + Plain Text):**

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; color: #333; }
    .header { background: #0066cc; color: white; padding: 20px; }
    .content { padding: 20px; }
    .footer { background: #f5f5f5; padding: 10px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h2>ABC Strata Company</h2>
    <p>Levy Notice - Lot {lot_number}</p>
  </div>
  <div class="content">
    <p>Dear {owner_name},</p>
    
    <p>Your levy notice for <strong>Lot {lot_number}</strong> is now due.</p>
    
    <p><strong>Period:</strong> {period_description}<br>
    <strong>Amount Due:</strong> ${total_levy}<br>
    <strong>Due Date:</strong> {due_date}</p>
    
    <p><strong>Payment Details:</strong><br>
    BSB: {bsb}<br>
    Account: {account_number}<br>
    Reference: <strong>{payment_reference}</strong></p>
    
    <p>Please find attached your detailed levy notice (PDF).</p>
    
    <p>You can also view and pay your levy online at:<br>
    <a href="{owner_portal_url}">Owner Portal Login</a></p>
    
    <p>If you have any questions, please contact {manager_name} at {manager_email} or {manager_phone}.</p>
    
    <p>Thank you,<br>
    {manager_name}<br>
    {strata_company_name}</p>
  </div>
  <div class="footer">
    <p>This levy is payable under the Strata Titles Act 1985 (WA). Failure to pay by the due date may result in interest charges and recovery action.</p>
  </div>
</body>
</html>
```

**Plain Text Version:** Auto-generated fallback (strip HTML tags, preserve structure)

### 6.3 Delivery Tracking

**Database Schema:**
```sql
levy_notice_emails (
  id: UUID PRIMARY KEY,
  levy_item_id: UUID FK,
  recipient_email: VARCHAR,
  sent_at: TIMESTAMP,
  email_provider_id: VARCHAR (Resend message ID),
  status: ENUM('queued', 'sent', 'delivered', 'bounced', 'failed'),
  opened_at: TIMESTAMP,
  clicked_at: TIMESTAMP,
  bounce_reason: TEXT,
  created_at: TIMESTAMP DEFAULT NOW()
)
```

**Tracking Implementation:**
1. **Sent:** Resend returns message ID → store in `email_provider_id`
2. **Delivered:** Resend webhook `email.delivered` → update status
3. **Bounced:** Resend webhook `email.bounced` → update status, flag owner as "no email" (fallback to postal mail)
4. **Opened:** Resend webhook `email.opened` → update `opened_at` (tracking pixel)
5. **Clicked:** Resend webhook `email.clicked` → update `clicked_at` (link click)

**UI Display:**
- Levy items table shows delivery status icon:
  - ✅ Delivered (green)
  - ⚠️ Bounced (red) - action required
  - ⏳ Queued (gray)
  - 📧 Sent but not delivered (yellow)

### 6.4 Batch Email Sending

**User Flow:**
1. Manager clicks **Send All Notices** (after reviewing PDFs)
2. Confirmation modal: "Send 100 levy notices to owners?"
3. System queues emails (rate limit: 10 emails/second to avoid spam filters)
4. Progress bar: "Sent 50/100 emails..."
5. Completion: "All notices sent. 98 delivered, 2 bounced (see details)"
6. Bounced emails flagged for manual follow-up (postal mail or phone call)

**Fallback for Owners Without Email:**
- System detects `owner.email IS NULL` or previous bounce
- Flags levy item as "Manual Delivery Required"
- Manager exports PDF, prints, and mails via postal service
- Manually marks as "Sent via post" in UI

---

## 7. Payment Recording

### 7.1 Manual Payment Entry

**User Flow:**
1. Manager receives bank statement (CSV or manual review)
2. Navigates to **Payments → Record Payment**
3. Enters:
   - **Scheme:** ABC Strata Plan 12345
   - **Lot:** Lot 5 (auto-suggest from scheme)
   - **Amount:** $1,800.00
   - **Payment Date:** 28 July 2026
   - **Payment Method:** Bank Transfer (dropdown: Bank Transfer, Cheque, Cash, Direct Debit)
   - **Reference:** "LOT5-Q12027" (helps auto-match)
   - **Notes:** (optional) "Westpac transfer"
4. System searches for matching levy item:
   - Matches by lot + amount + period
   - If exact match found → auto-allocates
   - If no match or multiple periods owing → shows allocation UI
5. Manager confirms allocation → payment recorded

**Payment Allocation UI:**
```
Payment: $2,250.00 from Lot 5

Outstanding Levies for Lot 5:
☑ Q4 FY2026 Arrears: $450.00 (overdue)
☑ Q1 FY2027: $1,800.00 (current)
──────────────────────────────────
Total Allocated: $2,250.00 ✅

[Record Payment]
```

### 7.2 Partial Payments

**Scenario:** Owner pays $1,000 of $1,800 levy.

**User Flow:**
1. Manager records payment: $1,000
2. System detects `amount < total_levy_amount`
3. Updates levy item:
   - `status = 'partial'`
   - `amount_paid = $1,000`
   - `balance = $800`
4. Levy item shows in arrears dashboard as "Partial Payment - $800 owing"
5. Next payment of $800 → closes levy item to `status = 'paid'`

**Allocation Rule (Multiple Outstanding Levies):**
- **Oldest first (FIFO):** Pay Q1 arrears before Q2 current
- Example: Owner owes Q1 $1,800 + Q2 $1,800 = $3,600 total. Pays $2,000.
  - Allocate $1,800 to Q1 (fully paid)
  - Allocate $200 to Q2 (partial)
  - Q1 status = 'paid', Q2 status = 'partial', Q2 balance = $1,600

### 7.3 Overpayments & Credits

**Scenario:** Owner accidentally pays $2,000 for $1,800 levy.

**User Flow:**
1. Manager records payment: $2,000
2. System detects `amount > total_levy_amount`
3. Allocates $1,800 to current levy (closes it)
4. Creates **credit** of $200 for next period
5. Credit stored in `owner_credits` table:
   ```sql
   owner_credits (
     id: UUID,
     lot_id: UUID FK,
     amount: NUMERIC(10,2),
     created_at: TIMESTAMP,
     applied_to_levy_item_id: UUID FK (when used),
     status: ENUM('available', 'applied')
   )
   ```
6. Next levy period: System auto-applies credit
   - Lot 5 Q2 levy = $1,800
   - Credit available = $200
   - Notice shows: "Levy $1,800 - Credit $200 = **Amount Due: $1,600**"

**Credit Refund:** If owner sells lot mid-year, manager can issue refund (manual process: contact owner, arrange bank transfer, record in notes).

### 7.4 Payment Integration with Trust Accounting

Levy payments are recorded as trust accounting transactions (single source of truth). The Levy Management module provides the UI layer for recording payments, but all financial data lives in the `transactions` table (defined in Feature 04 - Trust Accounting).

**Payment Recording Flow:**
1. Manager clicks "Record Payment" on a levy item
2. System creates a `transactions` record:
   - `transaction_type = 'receipt'`
   - `fund_type = 'admin'` or `'capital_works'` (based on levy split)
   - `category_id` = levy payment category from chart of accounts
   - `lot_id` = the lot making the payment
3. System creates `payment_allocations` record(s) linking the transaction to specific levy items
4. System updates `levy_items.amount_paid` via trigger
5. System updates `levy_items.status` ('paid', 'partial', 'overdue')

**Payment Allocations Table:**
```sql
CREATE TABLE payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  levy_item_id UUID NOT NULL REFERENCES levy_items(id) ON DELETE CASCADE,
  allocated_amount DECIMAL(10,2) NOT NULL CHECK (allocated_amount > 0),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(transaction_id, levy_item_id)
);
```

**Overpayments:** If payment exceeds total levy amount, excess is recorded as a credit on the owner's account (stored as a negative `levy_item` or credit transaction).

**Partial Payments:** FIFO allocation — oldest outstanding levy item is paid first.

---

## 8. Arrears Management

### 8.1 Overdue Detection

**Logic:**
```sql
-- Daily cron job (via Supabase Edge Function or pg_cron)
UPDATE levy_items
SET status = 'overdue'
WHERE 
  status IN ('sent', 'partial') 
  AND due_date < CURRENT_DATE
  AND balance > 0;
```

**Dashboard Widget:**
```
┌────────────────────────────────────┐
│ 🔴 ARREARS SUMMARY                 │
├────────────────────────────────────┤
│ Total Overdue: $12,450.00          │
│ Lots in Arrears: 8 / 120 (6.7%)    │
│                                    │
│ 0-30 days: 4 lots ($3,200)         │
│ 31-60 days: 2 lots ($4,500) ⚠️     │
│ 61-90 days: 1 lot ($2,250) 🚨      │
│ >90 days: 1 lot ($2,500) 🚨🚨      │
│                                    │
│ [View Arrears Report]              │
└────────────────────────────────────┘
```

### 8.2 Arrears Dashboard

**URL:** `/schemes/{scheme_id}/arrears`

**Table View:**

| Lot | Owner | Levy Period | Due Date | Amount Due | Days Overdue | Last Contact | Actions |
|-----|-------|-------------|----------|------------|--------------|--------------|---------|
| 12 | Jane Doe | Q1 FY2027 | 31 Jul 2026 | $1,800 | 35 days | 5 Aug (email) | [Send Reminder] [Call Owner] [Record Payment] |
| 7 | Bob Smith | Q4 FY2026 | 30 Jun 2026 | $2,250 | 67 days | 10 Jul (SMS) | [Send Final Notice] [Legal Action] |

**Filters:**
- Days overdue: <30, 31-60, 61-90, >90
- Amount range: <$1K, $1K-$5K, >$5K
- Scheme (if viewing all schemes)

### 8.3 Reminder Workflow

**Automated Reminder Schedule:**

| Days Overdue | Action | Template |
|--------------|--------|----------|
| **7 days** | Email reminder (gentle) | "Your levy was due 7 days ago. Please pay by [date] to avoid further action." |
| **14 days** | Email + SMS reminder | "Your levy is now 14 days overdue. Please contact us to arrange payment." |
| **30 days** | Final notice email + phone call flag | "Final Notice: Your levy is 30 days overdue. Failure to pay within 7 days may result in legal action as per Strata Titles Act s77." |
| **60+ days** | Manual escalation (legal) | Manager decides: Engage debt collector, magistrates court claim, or payment plan |

**User Flow (Automated):**
1. Nightly cron job checks `levy_items` where `status = 'overdue'`
2. Calculates `days_overdue = CURRENT_DATE - due_date`
3. For each milestone (7, 14, 30 days), generates reminder email
4. Logs reminder in `arrears_reminders` table
5. Emails sent via Resend, tracking delivery

**Manual Reminder:**
- Manager clicks **Send Reminder** on arrears dashboard
- Pre-filled email template (editable)
- Logs as "Manual reminder sent by [Manager Name]"

### 8.4 Interest Calculation (Optional)

**WA Legislation:** Strata Titles Act s35(4) allows strata company to charge interest on unpaid levies **if prescribed by by-laws**.

**Implementation (Phase 2):**
- Check if scheme has by-law allowing interest (stored in `schemes.interest_rate_annual`)
- Calculate daily interest: `balance × (interest_rate / 365)`
- Generate monthly interest charges (new levy item type: 'interest')
- Include in next levy notice: "Arrears $1,800 + Interest $22.50 = $1,822.50"

**MVP Decision:** **Out of scope** (most small schemes don't charge interest; adds complexity). Add in Phase 2 if customer demand.

### 8.5 Arrears Reporting

**Report:** Arrears by Lot (PDF/CSV export)

**Columns:**
- Lot number
- Owner name
- Levy period(s) overdue
- Original levy amount
- Amount paid
- Balance owing
- Days overdue
- Reminders sent (count)
- Last contact date

**Use Case:** Manager presents arrears report to strata council meeting to decide on legal action.

---

## 9. Levy Roll Report

### 9.1 Purpose

The **Levy Roll** is a statutory report showing all lots in a scheme, levy amounts, payments, and balances for a specific period. Required for AGM financial statements (WA Strata Titles Act).

### 9.2 Report Structure

**Header:**
```
ABC STRATA COMPANY - LEVY ROLL
Plan Number: SP12345
Period: Q1 FY2027 (1 July - 30 September 2026)
Report Date: 15 August 2026
```

**Table:**

| Lot | Owner | Entitlement | Admin Levy | Capital Levy | Total Levy | Paid | Balance | Status |
|-----|-------|-------------|------------|--------------|------------|------|---------|--------|
| 1 | Smith, J. | 10% | $1,200 | $600 | $1,800 | $1,800 | $0.00 | ✅ Paid |
| 2 | Doe, A. | 8% | $960 | $480 | $1,440 | $1,440 | $0.00 | ✅ Paid |
| 3 | Lee, K. | 12% | $1,440 | $720 | $2,160 | $0.00 | $2,160 | 🔴 Overdue |
| ... | | | | | | | | |
| **Total** | | **100%** | **$48,000** | **$24,000** | **$72,000** | **$68,400** | **$3,600** | **95% collected** |

**Footer:**
- Arrears summary: "3 lots in arrears totaling $3,600 (5% of total levies)"
- Prepared by: Sarah Johnson, Manager
- Signature line (for AGM presentation)

### 9.3 Export Formats

- **PDF:** Professional report for AGM pack (print-ready)
- **CSV:** Export to Excel for further analysis
- **Excel (.xlsx):** Formatted spreadsheet with formulas (using `exceljs` library)

### 9.4 Historical Levy Roll

**Use Case:** Manager needs to show levy collection history for past 3 years (for AGM or auditor).

**UI:** Dropdown to select period (Q1 FY2027, Q4 FY2026, Q3 FY2026...)

**Data Retention:** Keep `levy_items` records for 7+ years (compliance).

---

## 10. Database Schema (Full DDL)

```sql
-- ============================================
-- LEVY MANAGEMENT SCHEMA
-- ============================================

-- Levy Schedules (per scheme, per budget year)
CREATE TABLE levy_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  budget_year_start DATE NOT NULL, -- e.g., 2026-07-01 (FY2027)
  budget_year_end DATE NOT NULL,   -- e.g., 2027-06-30
  admin_fund_total NUMERIC(10,2) NOT NULL CHECK (admin_fund_total > 0),
  capital_works_fund_total NUMERIC(10,2) NOT NULL CHECK (capital_works_fund_total >= 0),
  frequency VARCHAR(20) NOT NULL CHECK (frequency IN ('annual', 'quarterly', 'monthly', 'custom')),
  periods_per_year INTEGER NOT NULL CHECK (periods_per_year IN (1,2,4,12)),
  active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(scheme_id, budget_year_start) -- One schedule per scheme per year
);

-- Levy Periods (individual periods within a schedule, e.g., Q1, Q2)
CREATE TABLE levy_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  levy_schedule_id UUID NOT NULL REFERENCES levy_schedules(id) ON DELETE CASCADE,
  period_number INTEGER NOT NULL, -- 1, 2, 3, 4 for quarterly
  period_name VARCHAR(50) NOT NULL, -- "Q1 FY2027"
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  due_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'closed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(levy_schedule_id, period_number)
);

-- Levy Items (per lot, per period)
CREATE TABLE levy_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  levy_period_id UUID NOT NULL REFERENCES levy_periods(id) ON DELETE CASCADE,
  levy_type VARCHAR(20) DEFAULT 'regular' CHECK (levy_type IN ('regular', 'special', 'interest')),
  admin_levy_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  capital_levy_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  special_levy_amount NUMERIC(10,2) DEFAULT 0,
  total_levy_amount NUMERIC(10,2) GENERATED ALWAYS AS 
    (admin_levy_amount + capital_levy_amount + COALESCE(special_levy_amount, 0)) STORED,
  due_date DATE NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'paid', 'partial', 'overdue')),
  amount_paid NUMERIC(10,2) DEFAULT 0,
  balance NUMERIC(10,2) GENERATED ALWAYS AS (total_levy_amount - COALESCE(amount_paid, 0)) STORED,
  notice_generated_at TIMESTAMPTZ,
  notice_sent_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lot_id, levy_period_id) -- One levy item per lot per period
);

-- Payments (from owners)
CREATE TABLE payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL,
  payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('bank_transfer', 'cheque', 'cash', 'direct_debit', 'credit_card')),
  reference VARCHAR(100), -- Bank reference, cheque number, etc.
  notes TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Payment Allocations (which levy items a payment covers)
CREATE TABLE payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  levy_item_id UUID NOT NULL REFERENCES levy_items(id) ON DELETE CASCADE,
  allocated_amount NUMERIC(10,2) NOT NULL CHECK (allocated_amount > 0),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Owner Credits (overpayments carried forward)
CREATE TABLE owner_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  reason VARCHAR(100), -- "Overpayment Q1 FY2027"
  status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'applied', 'refunded')),
  applied_to_levy_item_id UUID REFERENCES levy_items(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  applied_at TIMESTAMPTZ
);

-- Levy Notice Emails (delivery tracking)
CREATE TABLE levy_notice_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  levy_item_id UUID NOT NULL REFERENCES levy_items(id) ON DELETE CASCADE,
  recipient_email VARCHAR(255) NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  email_provider_id VARCHAR(100), -- Resend message ID
  status VARCHAR(20) DEFAULT 'queued' CHECK (status IN ('queued', 'sent', 'delivered', 'bounced', 'failed')),
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  bounce_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Arrears Reminders (tracking reminders sent)
CREATE TABLE arrears_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  levy_item_id UUID NOT NULL REFERENCES levy_items(id) ON DELETE CASCADE,
  reminder_type VARCHAR(20) NOT NULL CHECK (reminder_type IN ('auto_7day', 'auto_14day', 'auto_30day', 'manual')),
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  sent_by UUID REFERENCES auth.users(id), -- NULL for automated, user ID for manual
  email_id UUID REFERENCES levy_notice_emails(id),
  notes TEXT
);

-- Special Levies (one-off levies for capital projects)
CREATE TABLE special_levies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  purpose VARCHAR(200) NOT NULL, -- "Roof replacement Stage 2"
  total_amount NUMERIC(10,2) NOT NULL CHECK (total_amount > 0),
  due_date DATE NOT NULL,
  resolution_date DATE, -- Date of SGM resolution approving special levy
  allocation_method VARCHAR(20) DEFAULT 'entitlement' CHECK (allocation_method IN ('entitlement', 'custom')),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_levy_items_scheme ON levy_items(scheme_id);
CREATE INDEX idx_levy_items_lot ON levy_items(lot_id);
CREATE INDEX idx_levy_items_period ON levy_items(levy_period_id);
CREATE INDEX idx_levy_items_status ON levy_items(status);
CREATE INDEX idx_levy_items_due_date ON levy_items(due_date);
CREATE INDEX idx_payments_scheme ON payments(scheme_id);
CREATE INDEX idx_payments_lot ON payments(lot_id);
CREATE INDEX idx_payments_date ON payments(payment_date);

-- Trigger: Update levy_items when payment allocated
CREATE OR REPLACE FUNCTION update_levy_item_payment_status()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE levy_items
  SET 
    amount_paid = COALESCE(amount_paid, 0) + NEW.allocated_amount,
    status = CASE
      WHEN (COALESCE(amount_paid, 0) + NEW.allocated_amount) >= total_levy_amount THEN 'paid'
      WHEN (COALESCE(amount_paid, 0) + NEW.allocated_amount) > 0 THEN 'partial'
      ELSE status
    END,
    paid_at = CASE
      WHEN (COALESCE(amount_paid, 0) + NEW.allocated_amount) >= total_levy_amount 
      THEN (SELECT payment_date FROM payments WHERE id = NEW.payment_id)
      ELSE paid_at
    END,
    updated_at = NOW()
  WHERE id = NEW.levy_item_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_levy_item_payment_status
AFTER INSERT ON payment_allocations
FOR EACH ROW
EXECUTE FUNCTION update_levy_item_payment_status();

-- Trigger: Auto-mark overdue levies (run daily via pg_cron or Edge Function)
CREATE OR REPLACE FUNCTION mark_overdue_levies()
RETURNS void AS $$
BEGIN
  UPDATE levy_items
  SET status = 'overdue', updated_at = NOW()
  WHERE 
    status IN ('sent', 'partial') 
    AND due_date < CURRENT_DATE
    AND balance > 0;
END;
$$ LANGUAGE plpgsql;

-- Row-Level Security (RLS) Policies
ALTER TABLE levy_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE levy_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE levy_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Managers can see all levy data for their schemes
CREATE POLICY managers_levy_schedules ON levy_schedules
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM schemes s 
      WHERE s.id = levy_schedules.scheme_id 
      AND s.organisation_id = auth.user_organisation_id()
    )
  );

CREATE POLICY managers_levy_items ON levy_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM schemes s 
      WHERE s.id = levy_items.scheme_id 
      AND s.organisation_id = auth.user_organisation_id()
    )
  );

-- Owners can see only their own lot's levy items
CREATE POLICY owners_levy_items ON levy_items
  FOR SELECT USING (
    lot_id IN (SELECT lot_id FROM lot_owners WHERE owner_id = auth.uid())
  );
```

---

## 11. API Endpoints

### 11.1 RESTful API Design

**Base URL:** `/api/levies/`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| **GET** | `/schemes/{id}/levy-schedules` | Get all levy schedules for a scheme | Manager |
| **POST** | `/schemes/{id}/levy-schedules` | Create new levy schedule | Manager |
| **PUT** | `/levy-schedules/{id}` | Update levy schedule | Manager |
| **DELETE** | `/levy-schedules/{id}` | Delete levy schedule (if no levy items issued) | Manager |
| **POST** | `/levy-schedules/{id}/generate-periods` | Auto-generate levy periods for schedule | Manager |
| **GET** | `/levy-periods/{id}/levy-items` | Get all levy items for a period | Manager |
| **POST** | `/levy-periods/{id}/calculate-levies` | Calculate levy items for all lots in period | Manager |
| **POST** | `/levy-periods/{id}/generate-notices` | Generate PDF notices for all levy items | Manager |
| **POST** | `/levy-periods/{id}/send-notices` | Email notices to all owners | Manager |
| **GET** | `/levy-items/{id}` | Get specific levy item details | Manager/Owner (own lot) |
| **POST** | `/payments` | Record new payment | Manager |
| **GET** | `/schemes/{id}/arrears` | Get arrears dashboard data | Manager |
| **POST** | `/levy-items/{id}/send-reminder` | Send manual arrears reminder | Manager |
| **GET** | `/schemes/{id}/levy-roll` | Generate levy roll report (PDF/CSV) | Manager |
| **GET** | `/lots/{id}/levy-statement` | Get owner levy statement (all periods, payments, balance) | Manager/Owner (own lot) |

### 11.2 Example API Request/Response

**POST /api/levy-schedules**

Request:
```json
{
  "scheme_id": "550e8400-e29b-41d4-a716-446655440000",
  "budget_year_start": "2026-07-01",
  "budget_year_end": "2027-06-30",
  "admin_fund_total": 48000.00,
  "capital_works_fund_total": 24000.00,
  "frequency": "quarterly",
  "periods_per_year": 4
}
```

Response (201 Created):
```json
{
  "id": "650e8400-e29b-41d4-a716-446655440001",
  "scheme_id": "550e8400-e29b-41d4-a716-446655440000",
  "budget_year_start": "2026-07-01",
  "budget_year_end": "2027-06-30",
  "admin_fund_total": 48000.00,
  "capital_works_fund_total": 24000.00,
  "frequency": "quarterly",
  "periods_per_year": 4,
  "active": true,
  "created_at": "2026-02-16T08:30:00Z"
}
```

**POST /api/levy-periods/{id}/generate-notices**

Request:
```json
{
  "review_before_send": true
}
```

Response (202 Accepted):
```json
{
  "job_id": "batch-gen-750e8400",
  "status": "processing",
  "total_lots": 100,
  "message": "Generating 100 levy notices. Estimated time: 30 seconds.",
  "callback_url": "/api/jobs/batch-gen-750e8400"
}
```

Callback (when complete):
```json
{
  "job_id": "batch-gen-750e8400",
  "status": "completed",
  "results": {
    "total_lots": 100,
    "notices_generated": 100,
    "failed": 0,
    "pdf_urls": [
      "/levy-notices/{scheme_id}/{period_id}/{lot_id}.pdf",
      ...
    ]
  },
  "completed_at": "2026-02-16T08:31:30Z"
}
```

---

## 12. UI Workflows

### 12.1 Create Levy Schedule

**User:** Manager  
**Path:** Schemes → [ABC Strata] → Settings → Levy Schedules → New Schedule

**Steps:**
1. **Budget Year:** Select FY start date (e.g., 1 July 2026) → end date auto-fills (30 June 2027)
2. **Budgets:**
   - Admin Fund: $48,000
   - Capital Works Fund: $24,000
3. **Frequency:** Dropdown (Quarterly selected)
4. **Review:** System shows preview:
   - "4 levy periods will be created"
   - "100 lots will be billed each period"
   - "Avg levy per lot per quarter: $1,800 (entitlement-based)"
5. **Confirm:** [Create Schedule]
6. **Auto-generate periods:** Q1, Q2, Q3, Q4 with due dates (30 days after period start)
7. **Success:** "Levy schedule created. Next: Generate levy items for Q1."

### 12.2 Generate & Send Levy Notices

**User:** Manager  
**Path:** Schemes → [ABC Strata] → Levies → Q1 FY2027

**Steps:**
1. **Calculate Levies:** [Calculate Levies for All Lots] → System creates 100 `levy_items` records
2. **Review:** Table shows all lots, amounts, owners
   - Lot 5: $1,800 (Admin $1,200, Capital $600) → Owner: John Smith
   - Spot check 3-5 lots for accuracy
3. **Generate PDFs:** [Generate All Notices] → Progress bar (30 seconds)
4. **Review PDFs:** Click random lots to preview PDF (opens in new tab)
5. **Send Emails:** [Send All Notices]
   - Confirmation modal: "Send 100 emails? This cannot be undone."
   - [Cancel] [Confirm & Send]
6. **Sending:** Progress bar "Sent 50/100..."
7. **Complete:** "98 emails sent successfully. 2 bounced (Lot 12, Lot 45 - see details)."
8. **Follow-up:** Flag bounced lots for postal mail

### 12.3 Record Payment

**User:** Manager  
**Path:** Schemes → [ABC Strata] → Payments → Record Payment

**Steps:**
1. **Scheme:** ABC Strata Plan 12345 (auto-selected if coming from scheme page)
2. **Lot:** Start typing "Lot 5" or "John Smith" → auto-suggest
3. **Amount:** $1,800.00
4. **Date:** 28 July 2026
5. **Method:** Bank Transfer
6. **Reference:** "LOT5-Q12027"
7. **Allocate:** System finds matching levy item (Q1 FY2027, $1,800) → auto-selects
8. **Confirm:** [Record Payment]
9. **Success:** "Payment recorded. Lot 5 Q1 FY2027 marked as PAID."

**Alternative: Partial Payment:**
- Amount: $1,000 (instead of $1,800)
- System shows: "This is a partial payment. Balance remaining: $800."
- Levy item status → 'partial'

### 12.4 View Arrears Dashboard

**User:** Manager  
**Path:** Dashboard → Arrears Widget → [View All Arrears]

**UI:**
```
┌─────────────────────────────────────────────────────────────────┐
│ ARREARS DASHBOARD                             🔴 8 lots overdue │
├─────────────────────────────────────────────────────────────────┤
│ Filters: [All Schemes ▼] [>30 days ▼] [Amount: Any ▼]          │
├─────────────────────────────────────────────────────────────────┤
│ Lot    Owner        Period      Due Date   Amount  Days  Action │
├─────────────────────────────────────────────────────────────────┤
│ 12     Jane Doe     Q1 FY2027   31/07/26   $1,800   35   [Send] │
│ 7      Bob Smith    Q4 FY2026   30/06/26   $2,250   67   [Call] │
│ 23     Amy Lee      Q1 FY2027   31/07/26   $900     35   [Send] │
│ ...                                                              │
├─────────────────────────────────────────────────────────────────┤
│ Total Arrears: $12,450 across 8 lots                            │
│ [Export CSV] [Send Bulk Reminders] [Generate Report]            │
└─────────────────────────────────────────────────────────────────┘
```

**Actions:**
- **Send:** Opens email template, pre-filled with reminder text
- **Call:** Flags lot for phone follow-up (adds note)
- **Export CSV:** Download arrears list for council meeting

---

## 13. Automation & Background Jobs

### 13.1 Auto-Generate Levy Items

**Trigger:** 7 days before new levy period starts

**Implementation:** Supabase Edge Function (scheduled via pg_cron or Vercel Cron)

**Logic:**
```javascript
// Edge Function: auto-generate-levy-items.ts
export async function handler(req: Request) {
  const upcomingPeriods = await supabase
    .from('levy_periods')
    .select('*')
    .eq('status', 'pending')
    .lte('period_start', addDays(new Date(), 7));
  
  for (const period of upcomingPeriods) {
    // Get all lots for the scheme
    const lots = await supabase
      .from('lots')
      .select('*, levy_schedule:levy_schedules!inner(*)')
      .eq('scheme_id', period.scheme_id);
    
    // Calculate levy for each lot
    for (const lot of lots) {
      const adminLevy = round((lot.levy_schedule.admin_fund_total * lot.unit_entitlement) / lot.levy_schedule.periods_per_year, 2);
      const capitalLevy = round((lot.levy_schedule.capital_works_fund_total * lot.unit_entitlement) / lot.levy_schedule.periods_per_year, 2);
      
      await supabase.from('levy_items').insert({
        scheme_id: period.scheme_id,
        lot_id: lot.id,
        levy_period_id: period.id,
        admin_levy_amount: adminLevy,
        capital_levy_amount: capitalLevy,
        due_date: period.due_date,
        status: 'pending'
      });
    }
    
    // Mark period as active
    await supabase.from('levy_periods').update({ status: 'active' }).eq('id', period.id);
  }
  
  return new Response('Levy items generated', { status: 200 });
}
```

**Schedule:** Run daily at 02:00 AWST

### 13.2 Auto-Mark Overdue Levies

**Trigger:** Daily at 03:00 AWST

**Implementation:** PostgreSQL function via pg_cron

```sql
-- Schedule via pg_cron (requires pg_cron extension)
SELECT cron.schedule('mark-overdue-levies', '0 3 * * *', $$
  SELECT mark_overdue_levies();
$$);
```

### 13.3 Auto-Send Arrears Reminders

**Trigger:** Daily at 09:00 AWST (business hours)

**Logic:**
```javascript
// Edge Function: auto-send-arrears-reminders.ts
export async function handler(req: Request) {
  const overdueItems = await supabase
    .from('levy_items')
    .select('*, lot:lots(*), owner:lot_owners(*)')
    .eq('status', 'overdue');
  
  for (const item of overdueItems) {
    const daysOverdue = differenceInDays(new Date(), new Date(item.due_date));
    
    // 7-day reminder
    if (daysOverdue === 7 && !hasReminderSent(item.id, 'auto_7day')) {
      await sendReminderEmail(item, 'auto_7day');
    }
    
    // 14-day reminder
    if (daysOverdue === 14 && !hasReminderSent(item.id, 'auto_14day')) {
      await sendReminderEmail(item, 'auto_14day');
    }
    
    // 30-day final notice
    if (daysOverdue === 30 && !hasReminderSent(item.id, 'auto_30day')) {
      await sendReminderEmail(item, 'auto_30day');
      await flagForManagerReview(item); // Human intervention needed
    }
  }
  
  return new Response('Reminders sent', { status: 200 });
}
```

---

## 14. WA Compliance Requirements

### 14.1 Strata Titles Act 1985 (WA)

| Section | Requirement | Implementation |
|---------|-------------|----------------|
| **s35** | Levies proportional to unit entitlement | ✅ Calculation based on `lot.unit_entitlement` |
| **s35(4)** | Interest on unpaid levies (if by-law permits) | 🟡 Phase 2 (add interest calculation) |
| **s36** | Special levies via special resolution | ✅ `special_levies` table + custom allocation |
| **s77** | Recovery of unpaid levies (debt collection, magistrates court) | 🟡 Arrears dashboard flags >60 days (manual escalation) |
| **s104** | Trust account for strata company funds | ✅ Integrated with Trust Accounting module |

### 14.2 Strata Titles (General) Regulations 2019

| Regulation | Requirement | Implementation |
|------------|-------------|----------------|
| **Schedule 1, Form 1** | Levy notice content (prescribed format) | ✅ PDF template includes all required fields |
| **Reg 56** | Annual return to strata company | 🟡 Trust Accounting module (separate feature) |
| **Reg 73** | Document retention (7 years implied) | ✅ Supabase Storage with 7-year retention policy |

### 14.3 Levy Notice Compliance Checklist

**PDF Template Must Include:**
- ✅ Strata company name and plan number
- ✅ Owner name and lot number
- ✅ Levy period (start and end dates)
- ✅ Admin fund levy amount
- ✅ Capital works fund levy amount (if applicable)
- ✅ Total levy amount
- ✅ Due date
- ✅ Payment instructions (trust account BSB, account number)
- ✅ Reference to Strata Titles Act (legal authority)
- ✅ Manager contact details for queries
- ✅ Outstanding arrears (if any)

### 14.4 Audit Trail Requirements

**Trust Accounting Compliance:**
- Every payment recorded must be traceable to a levy item
- Full audit log: who recorded payment, when, amount, allocation
- Immutable records (no deletion, only void/reversal)
- 7-year retention of all levy notices and payment records

**Implementation:**
- PostgreSQL audit triggers log all INSERT/UPDATE/DELETE on `payments` table
- Soft delete via `deleted_at` timestamp (never hard delete)
- Levy notice PDFs stored permanently in Supabase Storage

---

## 15. Dependencies on Other Features

### 15.1 Scheme Register (Foundation)
- **Dependency:** Must have `schemes` table with plan number, ABN, trust account details
- **Impact:** Cannot create levy schedule without active scheme
- **Data:** Scheme name, address, manager details used in levy notice header

### 15.2 Lot & Owner Register
- **Dependency:** Must have `lots` table with unit entitlement
- **Impact:** Cannot calculate levies without lot register
- **Data:** Owner name, contact email, lot number, unit entitlement used in levy calculation and notice delivery

### 15.3 Trust Accounting Module
- **Dependency:** Payments recorded in Levy Management must sync to Trust Accounting ledger
- **Impact:** Every levy payment = receipt in trust account (admin fund or capital works fund)
- **Integration:** Payment allocation creates corresponding trust accounting transaction
  ```sql
  INSERT INTO trust_transactions (
    scheme_id,
    fund_type,
    transaction_type,
    amount,
    reference,
    payment_id
  )
  SELECT 
    p.scheme_id,
    CASE pa.levy_item_id WHEN li.admin_levy_amount > 0 THEN 'admin_fund' ELSE 'capital_fund' END,
    'receipt',
    pa.allocated_amount,
    p.reference,
    p.id
  FROM payment_allocations pa
  JOIN payments p ON pa.payment_id = p.id
  JOIN levy_items li ON pa.levy_item_id = li.id;
  ```

### 15.4 Document Storage
- **Dependency:** Levy notice PDFs stored in document library
- **Impact:** Owners can download past levy notices from owner portal
- **Retention:** 7-year automatic retention policy

### 15.5 Owner Portal
- **Dependency:** Owners log in to view levy balance, download statements
- **Impact:** Self-service reduces manager workload (no "What's my balance?" emails)
- **Features:**
  - Owner sees: Current levy balance, payment history, download levy notices
  - Owner cannot: Edit levy amounts, view other owners' data

### 15.6 Email Service (Resend/SendGrid)
- **Dependency:** Must configure Resend API key in environment variables
- **Impact:** Cannot send levy notices without email service
- **Fallback:** If email fails, flag for postal mail delivery

---

## 16. Validation Rules

### 16.1 Levy Schedule Validation

| Field | Rule | Error Message |
|-------|------|---------------|
| `admin_fund_total` | > 0 | "Admin fund budget must be greater than zero" |
| `capital_works_fund_total` | >= 0 | "Capital works fund cannot be negative" |
| `budget_year_start` | < `budget_year_end` | "Budget year end must be after start date" |
| `budget_year_end - budget_year_start` | = 1 year (365/366 days) | "Budget year must be exactly 12 months" |
| `periods_per_year` | IN (1,2,4,12) | "Periods must be 1 (annual), 2 (half-yearly), 4 (quarterly), or 12 (monthly)" |
| Unique constraint | No duplicate (scheme_id, budget_year_start) | "Levy schedule already exists for this budget year" |

### 16.2 Levy Item Validation

| Field | Rule | Error Message |
|-------|------|---------------|
| `total_levy_amount` | > 0 | "Total levy must be greater than zero" |
| `due_date` | >= period_start | "Due date must be within or after the levy period" |
| `amount_paid` | <= `total_levy_amount` | Warn (but allow): "Payment exceeds levy amount. Credit will be applied to next period." |
| Unique constraint | No duplicate (lot_id, levy_period_id) | "Levy item already exists for this lot and period" |

### 16.3 Payment Validation

| Field | Rule | Error Message |
|-------|------|---------------|
| `amount` | > 0 | "Payment amount must be greater than zero" |
| `payment_date` | <= CURRENT_DATE | "Payment date cannot be in the future" |
| `payment_method` | IN allowed list | "Invalid payment method" |
| `allocated_amount` | SUM <= `payment.amount` | "Total allocations ($X) exceed payment amount ($Y)" |

---

## 17. Open Questions & Future Enhancements

### 17.1 MVP Open Questions

1. **Interest on Arrears:**
   - Should MVP include interest calculation, or defer to Phase 2?
   - **Decision:** Defer to Phase 2 (adds complexity, most small schemes don't charge interest)

2. **Pro-Rata Levies for Mid-Year Lot Sales:**
   - When lot sold mid-period, who owes the levy? (Typically buyer from settlement date)
   - **Decision:** MVP assumes owner on record at levy generation date pays full amount. Manager manually adjusts if needed (rare edge case).

3. **Multiple Owners per Lot:**
   - Some lots have joint owners (e.g., husband + wife). Send one notice or two?
   - **Decision:** Send one email to primary owner contact (stored in `lot_owners.primary_contact = true`). Both owners can access via owner portal.

4. **Levy Adjustments/Reversals:**
   - What if manager needs to void a levy item (e.g., lot was sold before period started)?
   - **Decision:** Add `void` status to levy_items. Voided items excluded from reports but retained for audit trail.

5. **Bulk Payment Import (Bank CSV):**
   - Should MVP support CSV upload of bank transactions for auto-matching?
   - **Decision:** Phase 2 (requires bank feed integration or CSV parsing logic). MVP = manual entry.

### 17.2 Phase 2 Enhancements

- **Online Payment Portal:** Owners pay via credit card (Stripe) or bank transfer (PayTo). Auto-reconcile payments.
- **Bank Feed Integration:** Auto-import trust account transactions via Yodlee/Basiq. Auto-match to levy items.
- **Interest Calculation:** Automated interest charges for overdue levies (if by-law permits).
- **Payment Plans:** Allow owners to request payment plan (e.g., 3 monthly instalments). Manager approves, system tracks.
- **SMS Reminders:** Send SMS in addition to email for high-priority arrears (Twilio integration).
- **Levy Forecasting:** Predict next year's levy based on budget trends, inflation, reserve fund targets.

### 17.3 Phase 3 (Advanced)

- **AI-Powered Arrears Prediction:** Machine learning model predicts which owners likely to default (based on payment history). Proactive outreach.
- **Multi-Currency Support:** For schemes with overseas owners (e.g., foreign investors). Display levy in AUD + owner's preferred currency.
- **Integration with Accounting Software:** Export levy roll and payments to Xero/MYOB (API integration).
- **Automated Legal Recovery:** For arrears >90 days, auto-generate debt collection letters, magistrates court claim forms (with lawyer review).

---

## 18. Success Metrics

### 18.1 Feature Adoption

- **Goal:** 80% of schemes on platform have active levy schedule within 30 days of onboarding
- **Measure:** `COUNT(DISTINCT scheme_id FROM levy_schedules WHERE active = true) / COUNT(scheme_id FROM schemes)`

### 18.2 Time Savings

- **Goal:** Reduce manager time spent on levy admin by 80% (from 8 hours/quarter to <2 hours)
- **Measure:** User survey post-launch ("How many hours did you save this quarter?")

### 18.3 Payment Collection Rate

- **Goal:** Increase on-time payment rate from ~85% (industry avg) to >90%
- **Measure:** `COUNT(levy_items WHERE status = 'paid' AND paid_at <= due_date) / COUNT(levy_items)`

### 18.4 Arrears Reduction

- **Goal:** Reduce arrears >30 days by 50% (via automated reminders)
- **Measure:** Compare arrears balance at Month 0 (pre-LevyLite) vs Month 6 (post-LevyLite)

### 18.5 Owner Satisfaction

- **Goal:** 70% of owners prefer receiving levy notices via email + owner portal vs postal mail
- **Measure:** Owner survey ("How satisfied are you with receiving levy notices digitally?")

---

## 19. Implementation Plan

### Phase 1: Foundation (Weeks 1-2)
- [ ] Database schema (all tables, indexes, triggers, RLS policies)
- [ ] API endpoints (CRUD for levy schedules, periods, items)
- [ ] Basic UI (create levy schedule, view levy items list)

### Phase 2: Calculation & Generation (Weeks 3-4)
- [ ] Levy calculation engine (unit entitlement-based)
- [ ] PDF generation (react-pdf template)
- [ ] Batch PDF generation (background job)
- [ ] Levy notice content compliance review (WA lawyer)

### Phase 3: Email Delivery (Week 5)
- [ ] Resend API integration
- [ ] Email template (HTML + plain text)
- [ ] Delivery tracking (webhooks, database logging)
- [ ] Batch email sending

### Phase 4: Payments & Arrears (Weeks 6-7)
- [ ] Payment recording UI (manual entry)
- [ ] Payment allocation logic (FIFO, partial payments, overpayments)
- [ ] Arrears dashboard (overdue detection, reporting)
- [ ] Automated reminder system (7, 14, 30 days)

### Phase 5: Reporting & Integration (Week 8)
- [ ] Levy roll report (PDF, CSV export)
- [ ] Owner levy statement (download from owner portal)
- [ ] Trust accounting integration (payment sync)
- [ ] Document storage integration (levy notice PDF retention)

### Phase 6: Testing & Refinement (Weeks 9-10)
- [ ] Beta test with 3-5 design partner schemes
- [ ] Fix bugs, UX improvements
- [ ] Performance testing (100+ lots, batch operations)
- [ ] Compliance review (WA Strata Titles Act checklist)

### Phase 7: Launch Prep (Week 11)
- [ ] User documentation (help articles, video tutorials)
- [ ] Onboarding wizard (first levy schedule setup)
- [ ] Marketing materials (case study, demo video)

### Total MVP Timeline: **11 weeks** (part-time development, 10-15 hours/week)

---

## 20. Conclusion

Levy Management is the **revenue backbone** of LevyLite. By automating the quarterly levy cycle—from schedule configuration to payment tracking to arrears management—LevyLite saves small strata managers 8-10 hours per quarter per scheme. For a manager with 15 schemes, that's **120-150 hours per year** (3-4 weeks of full-time work).

The feature is designed to be **WA-compliant from day one**, with full audit trails, statutory reporting, and prescribed levy notice content. It integrates seamlessly with Trust Accounting, Owner Portal, and Document Storage to provide a complete strata management workflow.

**Key Differentiators:**
- **Unit entitlement-based calculation** (no manual Excel formulas)
- **Batch PDF generation** (100 notices in 30 seconds)
- **Automated arrears reminders** (7, 14, 30 days with delivery tracking)
- **Owner self-service portal** (reduces "What's my balance?" calls by 80%)
- **Full WA legislative compliance** (Strata Titles Act s35, s36, s77)

With this foundation in place, Phase 2 can add online payments, bank feeds, and interest calculation—transforming LevyLite from a manual-entry tool into a **fully automated levy management platform**.

---

**Next Steps:**
1. Review this spec with Donna Henneberry (design partner) for real-world validation
2. Consult WA strata lawyer on levy notice template compliance (~$2K cost, worth it)
3. Begin database schema implementation (Week 1)
4. Build levy calculation engine + unit tests (Week 2)

**Questions?** Contact Chris Johnstone | chris@kokorosoftware.com
