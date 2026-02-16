# Feature Specification: Trust Accounting

**Feature ID:** 04  
**Feature Name:** Trust Accounting  
**Product:** LevyLite  
**Version:** 1.0 MVP  
**Author:** Kai (AI Assistant)  
**Date:** 16 February 2026  
**Status:** Draft for Review  

---

## 1. Overview

Trust Accounting is the financial backbone of LevyLite, enabling strata managers to maintain WA Strata Titles Act-compliant financial records for each scheme. The system must support double-entry bookkeeping, fund separation (admin vs. capital works), bank reconciliation, audit trails, and EOFY processing while remaining simple enough for sole practitioners who are not accountants.

### Goals

- **Compliance:** Meet WA trust account requirements (audit trail, fund separation, 7-year retention)
- **Simplicity:** Non-accountants can enter transactions, reconcile bank statements, generate reports
- **Accuracy:** Double-entry bookkeeping ensures balances always reconcile
- **Auditability:** Every transaction tracked with who/when/what for Consumer Protection audits
- **Time savings:** Reduce EOFY prep from days to hours, eliminate spreadsheet reconciliation errors

### Key User Stories

1. **As Sarah (sole practitioner)**, I need to enter levy receipts and expense payments so my trust account records are up to date for committee meetings and audits.
2. **As Sarah**, I need to reconcile my bank statement monthly so I can identify missing transactions or errors.
3. **As Sarah**, I need to produce trial balances and fund balance reports so I can present accurate financials at AGMs.
4. **As Sarah's accountant**, I need read-only access to transaction ledgers and EOFY summaries so I can prepare annual financial statements efficiently.
5. **As a Consumer Protection auditor**, I need an immutable audit trail showing all receipts, payments, and edits so I can verify trust account compliance.

---

## 2. Fund Structure

### 2.1 Two-Fund Model

Each strata scheme maintains **two separate funds** as required by WA legislation:

1. **Administrative Fund (Admin Fund)**
   - Covers day-to-day operating expenses (insurance, utilities, management fees, minor maintenance)
   - Funded primarily by regular levies (typically quarterly)
   - Must maintain minimum reserve (typically 3 months' operating expenses)

2. **Capital Works Fund (Sinking Fund / Reserve Fund)**
   - Covers long-term capital expenses (roof replacement, painting, major repairs)
   - Funded by separate capital works levies
   - Accumulates over time, typically 10-year spending plan
   - Cannot be used for admin expenses without owner approval (special resolution)

### 2.2 Fund Balance Tracking

Each fund has:
- **Opening balance** (carried forward from previous financial year)
- **Current balance** (opening + receipts - payments for current FY)
- **Projected balance** (current + budgeted income - budgeted expenses for remainder of FY)

### 2.3 Inter-Fund Transfers

Occasionally funds need to be transferred between admin and capital works (e.g., capital works fund temporarily covers admin shortfall, to be repaid).

**Requirements:**
- Inter-fund transfers must be explicitly tagged (not regular income/expense)
- Require committee resolution reference (e.g., "SGM 15/12/2025 Motion 3")
- Must balance (debit one fund, credit the other)
- Appear on both fund ledgers with clear description

**MVP Scope:** Support manual inter-fund transfer entry with resolution reference. No automated repayment tracking (add in Phase 2).

---

## 3. Chart of Accounts

### 3.1 Standard Chart of Accounts

LevyLite provides a **default chart of accounts** aligned with WA strata best practices. Managers can customise categories but must follow double-entry structure.

#### Income Accounts (Credit accounts)

| Account Code | Account Name | Fund | Description |
|--------------|--------------|------|-------------|
| 4000 | Levies - Admin Fund | Admin | Regular admin levies collected |
| 4010 | Levies - Capital Works | Capital Works | Regular sinking fund levies |
| 4100 | Special Levies - Admin | Admin | One-off admin levies (e.g., insurance spike) |
| 4110 | Special Levies - Capital Works | Capital Works | One-off capital levies (e.g., emergency repairs) |
| 4200 | Interest Income - Admin | Admin | Bank interest earned on admin fund |
| 4210 | Interest Income - Capital Works | Capital Works | Bank interest earned on capital works fund |
| 4300 | Other Income - Admin | Admin | Insurance rebates, sublease income, etc. |
| 4310 | Other Income - Capital Works | Capital Works | Grant income, subsidy, etc. |

#### Expense Accounts (Debit accounts)

| Account Code | Account Name | Fund | Description |
|--------------|--------------|------|-------------|
| 5000 | Insurance - Building | Admin | Strata building insurance premium |
| 5010 | Insurance - Public Liability | Admin | Public liability insurance |
| 5020 | Insurance - Other | Admin | Fidelity, office bearers, etc. |
| 5100 | Utilities - Water | Admin | Common area water usage |
| 5110 | Utilities - Electricity | Admin | Common area electricity |
| 5120 | Utilities - Gas | Admin | Common area gas |
| 5130 | Utilities - Other | Admin | Internet, phone, etc. |
| 5200 | Maintenance - Gardening | Admin | Lawn mowing, landscaping |
| 5210 | Maintenance - Cleaning | Admin | Common area cleaning |
| 5220 | Maintenance - Pool/Spa | Admin | Pool chemicals, servicing |
| 5230 | Maintenance - Pest Control | Admin | Termite, rodent control |
| 5240 | Maintenance - Repairs (General) | Admin | Minor repairs under $1000 |
| 5250 | Maintenance - Plumbing | Admin | Routine plumbing maintenance |
| 5260 | Maintenance - Electrical | Admin | Routine electrical maintenance |
| 5300 | Management Fees | Admin | Strata manager annual/monthly fees |
| 5310 | Administration Costs | Admin | Photocopying, postage, stationery |
| 5320 | Legal Fees | Admin | Solicitor fees, debt collection |
| 5330 | Accounting Fees | Admin | EOFY audit, tax advice |
| 5335 | Audit Fees | Admin | Annual audit, compliance review |
| 5340 | Bank Fees | Admin | Transaction fees, account keeping |
| 5350 | Sundry Expenses | Admin | Miscellaneous, other expenses |
| 5400 | Capital Works - Painting | Capital Works | External/internal painting |
| 5410 | Capital Works - Roofing | Capital Works | Roof repairs, replacement |
| 5420 | Capital Works - Plumbing | Capital Works | Major plumbing works |
| 5430 | Capital Works - Electrical | Capital Works | Major electrical upgrades |
| 5440 | Capital Works - Structural | Capital Works | Foundation, structural repairs |
| 5450 | Capital Works - Other | Capital Works | Other major capital projects |

### 3.2 Customisation

Managers can:
- **Add custom categories** (e.g., "5250 Maintenance - Gate Repairs" if frequently recurring)
- **Archive unused categories** (hide from dropdowns but preserve historical data)
- **Cannot delete categories with transaction history** (data integrity)

**MVP Scope:** Provide default chart above (30-40 accounts). Allow adding custom accounts via UI. No bulk import (add in Phase 2).

---

## 4. Transaction Entry

### 4.1 Double-Entry Bookkeeping Model

Every financial transaction creates **two ledger entries**:
- **Debit** (increases asset/expense, decreases liability/income)
- **Credit** (increases liability/income, decreases asset/expense)

**Example 1: Levy Receipt**
- Debit: Bank Account (Asset) $500
- Credit: Levies - Admin Fund (Income) $500

**Example 2: Insurance Payment**
- Debit: Insurance - Building (Expense) $2,000
- Credit: Bank Account (Asset) $2,000

**Example 3: Inter-Fund Transfer**
- Debit: Admin Fund Bank Account (Asset) $1,000
- Credit: Capital Works Fund Bank Account (Asset) $1,000

### 4.2 Transaction Types

#### Receipt (Money In)
- **Source:** Owner levy payment, interest, insurance rebate, etc.
- **Fields:**
  - Date (required)
  - Fund (Admin or Capital Works)
  - Category (dropdown from income accounts)
  - Amount (required, positive)
  - Payment method (Cash, Cheque, EFT, Direct Debit, Credit Card)
  - Reference (e.g., bank transaction ID, cheque number)
  - Payer (link to owner/lot if levy, or free text if other)
  - Description (optional notes)
- **Bank reconciliation:** Links to bank statement line item

#### Payment (Money Out)
- **Purpose:** Expense paid from trust account
- **Fields:**
  - Date (required)
  - Fund (Admin or Capital Works)
  - Category (dropdown from expense accounts)
  - Amount (required, positive)
  - Payment method (Cheque, EFT, BPAY, Credit Card)
  - Reference (e.g., invoice number, cheque number)
  - Payee (supplier/tradesperson name, link to supplier directory)
  - Attachment (upload invoice PDF)
  - Description (optional notes)
- **Approval workflow (MVP):** Manager enters, no committee approval required (manual process outside system). Phase 2: optional approval workflow for payments >$X.

#### Journal Entry (Manual Adjustment)
- **Purpose:** Corrections, accruals, inter-fund transfers
- **Fields:**
  - Date (required)
  - Fund (Admin or Capital Works or Both)
  - Debit account (dropdown from all accounts)
  - Credit account (dropdown from all accounts)
  - Amount (required, positive)
  - Reference (e.g., "Correction to June electricity")
  - Approval (link to committee resolution if inter-fund transfer)
  - Description (required for audit trail)
- **Validation:** Debits = Credits (enforced by database constraint)

### 4.3 Split Transactions

Some transactions span multiple categories (e.g., single invoice covering electricity + water + cleaning).

**UI Workflow:**
1. Enter total payment amount
2. Add line items:
   - Category 1: $200 (Utilities - Electricity)
   - Category 2: $150 (Utilities - Water)
   - Category 3: $100 (Maintenance - Cleaning)
3. System validates: Sum of line items = Total amount
4. Creates multiple ledger entries with same transaction reference

**MVP Scope:** Support split transactions for payments (common use case). Receipts are rarely split, can add in Phase 2 if needed.

### 4.4 Recurring Transactions

Common recurring transactions (e.g., monthly management fee, quarterly insurance instalment) can be templated.

**Fields:**
- Template name (e.g., "Strata Edge Monthly Fee")
- Transaction type (Receipt or Payment)
- Fund (Admin or Capital Works)
- Category
- Amount (can be variable)
- Payment method
- Payee/Payer
- Recurrence (Monthly, Quarterly, Annually)
- Start date, End date (optional)

**Workflow:**
- User creates template once
- On due date, system **prompts** user to create transaction from template (pre-fills fields)
- User confirms/edits amount, then saves
- **No auto-posting** (too risky for trust accounting, manual review required)

**MVP Scope:** Template library with manual creation. Phase 2: automatic reminders via email/notification.

---

## 5. Bank Reconciliation

### 5.1 Purpose

Bank reconciliation matches **trust account ledger entries** (what should have happened) with **bank statement lines** (what actually happened) to identify:
- Unrecorded transactions (bank shows payment, ledger doesn't)
- Errors (wrong amount entered)
- Outstanding transactions (cheque issued but not yet cleared)
- Fraudulent transactions

### 5.2 Reconciliation Workflow

#### Step 1: Upload Bank Statement
- User downloads CSV from bank (most WA banks support: CBA, Westpac, Bankwest, BOQ)
- Upload to LevyLite
- System parses CSV, extracts:
  - Date
  - Description
  - Debit amount
  - Credit amount
  - Balance
  - Reference (if available)

**Supported formats (MVP):**
- Commonwealth Bank (CBA)
- Westpac
- Bankwest
- Generic CSV (user maps columns: Date → Column A, Description → Column B, etc.)

#### Step 2: Auto-Matching Algorithm

System attempts to match bank statement lines to ledger entries based on:

| Match Criterion | Weight | Threshold |
|----------------|--------|-----------|
| Amount exact match | 40% | Required |
| Date exact match | 30% | Within ±3 days |
| Date within 3 days | 20% | Within ±3 days |
| Description/reference keyword match | 30% | >50% similarity |

**Matching rules:**
1. **Exact match:** Amount + Date + Reference all match → Auto-match (95% confidence)
2. **Probable match:** Amount + Date within 3 days → Suggest match (70% confidence)
3. **Possible match:** Amount matches, date off by 4-7 days → Flag for review (40% confidence)
4. **No match:** Show as unmatched

#### Step 3: Manual Review
User reviews:
- **Matched items** (green): Accept or override
- **Suggested matches** (yellow): Accept, reject, or manually link to different ledger entry
- **Unmatched bank items** (red): Create new ledger entry or mark as "not applicable" (e.g., bank fee, interest)
- **Unmatched ledger items** (red): Outstanding cheques/EFT, or error (delete/edit ledger entry)

#### Step 4: Reconciliation Report
Once all items matched or resolved:
- **Reconciled balance** = Bank statement balance
- **Outstanding transactions** (ledger entries not yet on bank statement, e.g., cheques issued yesterday)
- **Adjusted ledger balance** = Reconciled balance + Outstanding deposits - Outstanding withdrawals
- **Status:** Reconciled ✅ or Unreconciled ❌

### 5.3 Data Model

```sql
-- Bank statements uploaded
CREATE TABLE bank_statements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheme_id UUID NOT NULL REFERENCES schemes(id),
    fund_type VARCHAR(20) NOT NULL CHECK (fund_type IN ('admin', 'capital_works')),
    statement_date DATE NOT NULL,
    opening_balance DECIMAL(12, 2) NOT NULL,
    closing_balance DECIMAL(12, 2) NOT NULL,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    uploaded_by UUID NOT NULL REFERENCES users(id),
    file_path TEXT, -- S3 path to original CSV
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Individual bank statement lines
CREATE TABLE bank_statement_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_statement_id UUID NOT NULL REFERENCES bank_statements(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    transaction_date DATE NOT NULL,
    description TEXT NOT NULL,
    reference VARCHAR(255),
    debit_amount DECIMAL(12, 2),
    credit_amount DECIMAL(12, 2),
    balance DECIMAL(12, 2),
    matched BOOLEAN NOT NULL DEFAULT FALSE,
    matched_transaction_id UUID REFERENCES transactions(id), -- Link to ledger entry
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Reconciliation records (one per statement)
CREATE TABLE bank_reconciliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bank_statement_id UUID NOT NULL REFERENCES bank_statements(id) ON DELETE CASCADE,
    scheme_id UUID NOT NULL REFERENCES schemes(id),
    fund_type VARCHAR(20) NOT NULL CHECK (fund_type IN ('admin', 'capital_works')),
    reconciliation_date DATE NOT NULL,
    bank_balance DECIMAL(12, 2) NOT NULL,
    ledger_balance DECIMAL(12, 2) NOT NULL,
    outstanding_deposits DECIMAL(12, 2) NOT NULL DEFAULT 0,
    outstanding_withdrawals DECIMAL(12, 2) NOT NULL DEFAULT 0,
    adjusted_balance DECIMAL(12, 2) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('draft', 'reconciled', 'discrepancy')),
    reconciled_by UUID REFERENCES users(id),
    reconciled_at TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**MVP Scope:** Manual CSV upload, semi-automated matching, manual review. Phase 2: Bank feed integration (Yodlee/Basiq), fully automated matching.

---

## 6. Trust Account Rules (WA Legislation)

### 6.1 WA Strata Titles Act 1985 Requirements

#### Key Provisions:
1. **Separate Trust Account Required** (Section 102)
   - Strata manager must maintain trust account with ADI (Authorised Deposit-Taking Institution: bank, credit union, building society)
   - Can be pooled (all schemes in one account) or individual per scheme
   - Must be in scheme's name if using scheme's own account

2. **Fund Separation** (Schedule 1, By-law 9)
   - Admin fund and capital works fund must be separately accounted
   - Cannot intermingle funds without proper transfer documentation
   - Inter-fund loans require committee resolution

3. **Accounting Records** (Section 103)
   - Must maintain proper accounting records showing:
     - All receipts and payments
     - Fund balances
     - Individual lot levy accounts (who paid, who owes)
   - Records must be available for inspection by owners

4. **7-Year Retention** (Implied by general administrative requirements)
   - Financial records must be kept for minimum 7 years
   - Required for audit, dispute resolution, legal proceedings

5. **Annual Return** (Section 104)
   - Manager must provide annual financial statement to scheme
   - Due within 4 weeks of financial year end
   - Must include: Income/expense statement, fund balances, levy roll

6. **Audit Rights** (Consumer Protection WA)
   - Consumer Protection can audit trust accounts
   - Must produce complete transaction history, bank statements, reconciliations
   - Breaches can result in license suspension, fines

#### What Constitutes a Trust Account Breach?

- **Mixing personal/business funds with trust funds** → Criminal offense
- **Using one scheme's funds to cover another scheme's expenses** (in pooled account) → Breach
- **Failing to reconcile within 30 days of month end** → Compliance risk
- **No audit trail** (can't prove who authorized transaction) → Breach
- **Deleting or altering historical transactions** without audit trail → Serious breach

### 6.2 LevyLite Compliance Features

| Requirement | LevyLite Implementation | Compliance Level |
|-------------|------------------------|------------------|
| Separate trust account | Each scheme has own ledger (admin + capital works funds) | ✅ Full |
| Fund separation | Transactions tagged to fund, inter-fund transfers require resolution ref | ✅ Full |
| Accounting records | Double-entry ledger, all transactions stored with metadata | ✅ Full |
| 7-year retention | Soft delete only, audit trail preserved indefinitely | ✅ Full |
| Annual return | EOFY report generator (trial balance, income/expense, fund balances) | ✅ Full |
| Audit trail | Immutable transaction log, every edit tracked (see Section 7) | ✅ Full |
| Bank reconciliation | Monthly reconciliation workflow with unmatched item resolution | ✅ Full |

**Legal Disclaimer (Required in T&Cs):**
> LevyLite provides tools to assist with WA Strata Titles Act compliance, but ultimate responsibility for trust account management rests with the licensed strata manager. Users should consult their accountant and/or legal advisor to ensure compliance. LevyLite is not a substitute for professional advice.

---

## 7. Audit Trail

### 7.1 Immutability Requirements

Trust accounting records must be **immutable**: once created, transactions cannot be silently edited or deleted. Every change must be tracked with:
- **Who** (user ID + name)
- **When** (timestamp)
- **What** (old value → new value)
- **Why** (optional notes)

### 7.2 Audit Events

The following events are logged:

| Event | Data Captured |
|-------|---------------|
| Transaction created | User, timestamp, transaction ID, all field values |
| Transaction edited | User, timestamp, transaction ID, fields changed (old → new) |
| Transaction deleted | User, timestamp, transaction ID, soft delete flag set, reason |
| Bank reconciliation completed | User, timestamp, reconciliation ID, matched count, status |
| EOFY rollover | User, timestamp, scheme ID, old FY closing balances, new FY opening balances |
| User access | User, timestamp, scheme accessed, action (view ledger, run report, etc.) |

### 7.3 Database Implementation

```sql
-- Audit trail table
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheme_id UUID REFERENCES schemes(id), -- Null for global events
    user_id UUID NOT NULL REFERENCES users(id),
    event_type VARCHAR(50) NOT NULL, -- 'transaction_created', 'transaction_edited', etc.
    entity_type VARCHAR(50), -- 'transaction', 'reconciliation', etc.
    entity_id UUID, -- Reference to affected record
    old_values JSONB, -- Before state
    new_values JSONB, -- After state
    notes TEXT, -- User-provided reason for change
    ip_address INET,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_scheme ON audit_logs(scheme_id, created_at DESC);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
```

### 7.4 Trigger Example (Transaction Edit)

```sql
CREATE OR REPLACE FUNCTION log_transaction_edit()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO audit_logs (
        scheme_id, user_id, event_type, entity_type, entity_id, 
        old_values, new_values, ip_address
    ) VALUES (
        NEW.scheme_id,
        current_setting('app.current_user_id')::UUID, -- Set by application context
        'transaction_edited',
        'transaction',
        NEW.id,
        row_to_json(OLD),
        row_to_json(NEW),
        current_setting('app.ip_address', TRUE)::INET
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER transaction_edit_audit
AFTER UPDATE ON transactions
FOR EACH ROW
EXECUTE FUNCTION log_transaction_edit();
```

### 7.5 Soft Delete

Transactions are **never hard deleted**. Instead:
```sql
ALTER TABLE transactions ADD COLUMN deleted_at TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN deleted_by UUID REFERENCES users(id);
ALTER TABLE transactions ADD COLUMN deletion_reason TEXT;

-- Filter deleted transactions in queries
CREATE VIEW active_transactions AS
SELECT * FROM transactions WHERE deleted_at IS NULL;
```

**UI Behavior:**
- Deleted transactions show as strikethrough in ledger with "DELETED" badge
- Cannot be edited further
- Still appear in audit reports (to show full history)
- Can be "undeleted" by authorized users (sets deleted_at to NULL, logs in audit trail)

---

## 8. EOFY Processing

### 8.1 Financial Year Definition

**WA Strata:** Most schemes use **1 July – 30 June** financial year (aligns with Australian FY). Some use AGM date as FY end.

**LevyLite Default:** 1 July – 30 June. Allow schemes to set custom FY end date (stored in `schemes.financial_year_end_month_day`, e.g., "06-30").

### 8.2 EOFY Workflow

#### Step 1: Pre-EOFY Checklist (Presented in UI)
- [ ] All transactions entered up to FY end date
- [ ] Bank reconciliation completed for June (or final month)
- [ ] Outstanding invoices recorded (accounts payable)
- [ ] Prepaid expenses allocated (if applicable)
- [ ] Inter-fund transfers balanced
- [ ] Committee has approved budget for next FY

#### Step 2: Generate EOFY Reports
System automatically generates:
1. **Trial Balance** (as at 30 June YYYY)
2. **Income & Expense Statement** (Admin Fund + Capital Works Fund, budget vs. actual)
3. **Fund Balance Summary** (Opening balance + Receipts - Payments = Closing balance)
4. **Levy Roll** (Per lot: Levy owing, Paid, Arrears)
5. **Bank Reconciliation Report** (Final reconciliation for FY)

#### Step 3: EOFY Rollover (One-Click Process)
User clicks "Finalize FY2025 and Start FY2026". System:
1. **Locks FY2025 transactions** (no further edits, only audit-logged corrections)
2. **Carries forward fund balances:**
   - Admin Fund Closing Balance FY2025 → Opening Balance FY2026
   - Capital Works Fund Closing Balance FY2025 → Opening Balance FY2026
3. **Resets income/expense accounts to zero** (these are FY-specific)
4. **Creates opening balance journal entries** for FY2026
5. **Logs EOFY rollover in audit trail** (user, timestamp, balances)

#### Step 4: Export for Accountant
Package EOFY reports as PDF + CSV:
- Trial balance (CSV)
- Income/expense statement (PDF + CSV)
- Full transaction ledger FY2025 (CSV)
- Levy roll (CSV)
- Bank reconciliation (PDF)

ZIP file downloadable, or email directly to accountant.

### 8.3 Database Schema

```sql
-- Store FY-specific metadata
CREATE TABLE financial_years (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheme_id UUID NOT NULL REFERENCES schemes(id),
    year_label VARCHAR(20) NOT NULL, -- e.g., "FY2025"
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    admin_opening_balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
    admin_closing_balance DECIMAL(12, 2),
    capital_opening_balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
    capital_closing_balance DECIMAL(12, 2),
    status VARCHAR(20) NOT NULL CHECK (status IN ('active', 'finalized', 'archived')),
    finalized_at TIMESTAMPTZ,
    finalized_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Link transactions to financial year
ALTER TABLE transactions ADD COLUMN financial_year_id UUID REFERENCES financial_years(id);
```

**MVP Scope:** Single FY rollover workflow. Phase 2: Multi-year comparison reports, budget forecasting.

---

## 9. Reports

### 9.1 Trial Balance

**Purpose:** Verify ledger accuracy (debits = credits), standard accounting report.

**Format:**
| Account Code | Account Name | Fund | Debit | Credit | Balance |
|--------------|--------------|------|-------|--------|---------|
| 1000 | Bank Account - Admin | Admin | $25,430.00 | $0.00 | $25,430.00 Dr |
| 1010 | Bank Account - Capital Works | Capital Works | $68,200.00 | $0.00 | $68,200.00 Dr |
| 4000 | Levies - Admin Fund | Admin | $0.00 | $48,000.00 | $48,000.00 Cr |
| 4010 | Levies - Capital Works | Capital Works | $0.00 | $72,000.00 | $72,000.00 Cr |
| ... | ... | ... | ... | ... | ... |
| **TOTAL** | | | **$XXX,XXX.XX** | **$XXX,XXX.XX** | |

**Filters:**
- Date range (default: current FY)
- Fund (Admin, Capital Works, or Both)
- Export: PDF, CSV, Excel

### 9.2 Income & Expense Statement

**Purpose:** Show financial performance for a period (monthly, quarterly, annual).

**Format:**
```
Acme Apartments Strata Scheme
Income & Expense Statement - Admin Fund
For the period 1 July 2025 - 30 June 2026

INCOME
  Levies - Admin Fund                 $48,000.00
  Interest Income                        $235.00
  Other Income                           $500.00
  ----------------------------------------
  Total Income                        $48,735.00

EXPENSES
  Insurance                            $8,500.00
  Utilities                            $3,200.00
  Maintenance                          $5,680.00
  Management Fees                      $6,000.00
  Administration                       $1,200.00
  ----------------------------------------
  Total Expenses                      $24,580.00

NET INCOME (SURPLUS)                  $24,155.00

Opening Balance (1 July 2025)         $12,430.00
Closing Balance (30 June 2026)        $36,585.00
```

Repeat for Capital Works Fund.

**Budget vs. Actual Column (Optional):**
| Category | Budget | Actual | Variance | % |
|----------|--------|--------|----------|---|
| Insurance | $9,000 | $8,500 | +$500 | 94% |

### 9.3 Fund Balance Report

**Purpose:** Quick snapshot of fund health.

**Format:**
```
Acme Apartments Strata Scheme
Fund Balance Summary
As at 31 January 2026

ADMIN FUND
  Opening Balance (1 July 2025)       $12,430.00
  Receipts (FY to date)               $32,500.00
  Payments (FY to date)               $18,340.00
  Current Balance                     $26,590.00

CAPITAL WORKS FUND
  Opening Balance (1 July 2025)       $58,200.00
  Receipts (FY to date)               $48,000.00
  Payments (FY to date)               $12,500.00
  Current Balance                     $93,700.00

TOTAL FUNDS                          $120,290.00
```

### 9.4 Budget vs. Actual

**Purpose:** Track spending against approved budget (presented at AGM).

**Format:**
| Category | Annual Budget | Spent (YTD) | Remaining | % Used | Status |
|----------|---------------|-------------|-----------|--------|--------|
| Insurance - Building | $9,000 | $8,500 | $500 | 94% | ✅ On track |
| Utilities - Electricity | $2,400 | $1,800 | $600 | 75% | ✅ On track |
| Maintenance - Pool | $3,000 | $3,450 | -$450 | 115% | ⚠️ Over budget |

**Alerts:**
- Red flag categories >110% of budget
- Email manager + committee treasurer monthly

### 9.5 Bank Reconciliation Report

**Purpose:** Prove bank balance = ledger balance (required for audits).

**Format:**
```
Acme Apartments Strata Scheme
Bank Reconciliation - Admin Fund
For the month ended 31 January 2026

Bank Statement Balance (31 Jan 2026)    $26,840.00

Add: Outstanding Deposits
  - Levy payment (Owner 12) - 30/01      $450.00
  ----------------------------------------
  Total Outstanding Deposits              $450.00

Less: Outstanding Withdrawals
  - Cheque #1234 (Insurance) - 28/01     -$700.00
  ----------------------------------------
  Total Outstanding Withdrawals          -$700.00

Adjusted Bank Balance                    $26,590.00

Ledger Balance (31 Jan 2026)             $26,590.00

Difference                                   $0.00 ✅
```

### 9.6 Levy Roll

**Purpose:** Show per-lot levy status (used for arrears tracking, AGM reporting).

**Format:**
| Lot | Owner | Levy Due (Current FY) | Paid | Outstanding | Status |
|-----|-------|----------------------|------|-------------|--------|
| 1 | John Smith | $4,800 | $4,800 | $0 | ✅ Paid |
| 2 | Jane Doe | $4,800 | $3,200 | $1,600 | ⚠️ Overdue 45 days |
| 3 | Acme Corp | $4,800 | $0 | $4,800 | 🚨 Overdue 120 days |

**Export:** CSV (for mail merge in arrears letters), PDF (for committee meetings).

---

## 10. Database Schema

### 10.1 Core Tables

```sql
-- Accounts (Chart of Accounts)
CREATE TABLE accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    account_type VARCHAR(20) NOT NULL CHECK (account_type IN ('asset', 'liability', 'income', 'expense', 'equity')),
    fund_type VARCHAR(20) CHECK (fund_type IN ('admin', 'capital_works', 'both')),
    parent_id UUID REFERENCES accounts(id), -- For sub-accounts
    is_system BOOLEAN NOT NULL DEFAULT FALSE, -- System accounts can't be deleted
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Transactions (General Ledger)
CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheme_id UUID NOT NULL REFERENCES schemes(id),
    financial_year_id UUID REFERENCES financial_years(id),
    transaction_date DATE NOT NULL,
    transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('receipt', 'payment', 'journal')),
    fund_type VARCHAR(20) NOT NULL CHECK (fund_type IN ('admin', 'capital_works', 'both')),
    reference VARCHAR(255), -- Invoice #, cheque #, bank ref, etc.
    description TEXT NOT NULL,
    total_amount DECIMAL(12, 2) NOT NULL,
    payment_method VARCHAR(50), -- 'Cash', 'EFT', 'Cheque', etc.
    payee_payer VARCHAR(255), -- Who received/paid
    lot_id UUID REFERENCES lots(id), -- If levy payment, link to lot
    attachment_url TEXT, -- S3 path to invoice/receipt PDF
    reconciled BOOLEAN NOT NULL DEFAULT FALSE,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID REFERENCES users(id),
    deletion_reason TEXT
);

-- Transaction Lines (Double-Entry Ledger Entries)
CREATE TABLE transaction_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    account_id UUID NOT NULL REFERENCES accounts(id),
    line_type VARCHAR(10) NOT NULL CHECK (line_type IN ('debit', 'credit')),
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Budgets
CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scheme_id UUID NOT NULL REFERENCES schemes(id),
    financial_year_id UUID NOT NULL REFERENCES financial_years(id),
    account_id UUID NOT NULL REFERENCES accounts(id),
    fund_type VARCHAR(20) NOT NULL CHECK (fund_type IN ('admin', 'capital_works')),
    budgeted_amount DECIMAL(12, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 10.2 Constraints & Indexes

```sql
-- Ensure double-entry balance
CREATE OR REPLACE FUNCTION check_transaction_balance()
RETURNS TRIGGER AS $$
DECLARE
    debit_total DECIMAL(12, 2);
    credit_total DECIMAL(12, 2);
BEGIN
    SELECT COALESCE(SUM(amount), 0) INTO debit_total
    FROM transaction_lines
    WHERE transaction_id = NEW.transaction_id AND line_type = 'debit';
    
    SELECT COALESCE(SUM(amount), 0) INTO credit_total
    FROM transaction_lines
    WHERE transaction_id = NEW.transaction_id AND line_type = 'credit';
    
    IF debit_total != credit_total THEN
        RAISE EXCEPTION 'Transaction % debits (%) must equal credits (%)', 
            NEW.transaction_id, debit_total, credit_total;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER transaction_balance_check
AFTER INSERT OR UPDATE ON transaction_lines
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_transaction_balance();

-- Indexes for performance
CREATE INDEX idx_transactions_scheme_date ON transactions(scheme_id, transaction_date DESC);
CREATE INDEX idx_transactions_fy ON transactions(financial_year_id, transaction_date);
CREATE INDEX idx_transaction_lines_account ON transaction_lines(account_id, created_at DESC);
CREATE INDEX idx_budgets_scheme_fy ON budgets(scheme_id, financial_year_id);
```

### 10.3 Views for Reporting

```sql
-- Fund balances (current)
CREATE VIEW current_fund_balances AS
SELECT 
    s.id AS scheme_id,
    s.name AS scheme_name,
    'admin' AS fund_type,
    COALESCE(SUM(CASE WHEN tl.line_type = 'debit' THEN tl.amount ELSE -tl.amount END), 0) AS balance
FROM schemes s
LEFT JOIN transactions t ON t.scheme_id = s.id AND t.fund_type = 'admin' AND t.deleted_at IS NULL
LEFT JOIN transaction_lines tl ON tl.transaction_id = t.id
LEFT JOIN accounts a ON a.id = tl.account_id
WHERE a.account_type = 'asset' AND a.code LIKE '1%' -- Bank accounts
GROUP BY s.id, s.name

UNION ALL

SELECT 
    s.id AS scheme_id,
    s.name AS scheme_name,
    'capital_works' AS fund_type,
    COALESCE(SUM(CASE WHEN tl.line_type = 'debit' THEN tl.amount ELSE -tl.amount END), 0) AS balance
FROM schemes s
LEFT JOIN transactions t ON t.scheme_id = s.id AND t.fund_type = 'capital_works' AND t.deleted_at IS NULL
LEFT JOIN transaction_lines tl ON tl.transaction_id = t.id
LEFT JOIN accounts a ON a.id = tl.account_id
WHERE a.account_type = 'asset' AND a.code LIKE '1%'
GROUP BY s.id, s.name;
```

---

## 11. Security

### 11.1 Encryption

**At Rest:**
- Supabase encrypts all PostgreSQL data at rest (AES-256)
- No additional application-level encryption needed for MVP
- Phase 2: Consider field-level encryption for sensitive fields (bank account numbers)

**In Transit:**
- All API calls over HTTPS/TLS 1.3
- Supabase enforces SSL for database connections

### 11.2 Role-Based Access Control (RBAC)

**Roles:**

| Role | Permissions |
|------|-------------|
| **Manager** | Full CRUD on all transactions, reconciliations, budgets, reports |
| **Admin** | Read + create transactions, cannot delete or edit reconciled transactions |
| **Accountant** | Read-only access to all financial data, can export reports |
| **Auditor** | Read-only access to ledger, audit trail, cannot see owner PII |
| **Committee Member** | Read-only access to reports, fund balances, budgets (no transaction detail) |

**Implementation (Supabase RLS):**
```sql
-- Managers can see/edit all transactions for their schemes
CREATE POLICY manager_transactions ON transactions
FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM schemes s 
        WHERE s.id = transactions.scheme_id 
        AND s.organisation_id = auth.user_organisation_id()
    )
);

-- Accountants can only SELECT (via role-based filtering in application layer)
CREATE POLICY accountant_transactions ON transactions
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM schemes s 
        WHERE s.id = transactions.scheme_id 
        AND s.organisation_id = auth.user_organisation_id()
    )
);
```

### 11.3 Audit Log Access

**Who can view audit logs:**
- Managers (for their schemes)
- Auditors (for compliance review)
- System admins (for troubleshooting)

**UI:**
- Audit trail available in dedicated "Audit Log" page
- Filter by: Date range, user, event type, scheme
- Export as PDF or CSV (for regulatory submission)

### 11.4 No Hard Deletes

**Enforced at application + database level:**
- Application hides "Delete" button for transactions older than 7 days (soft delete only)
- Database triggers prevent `DELETE` on transactions, only `UPDATE` to set `deleted_at`
- Even "deleted" transactions remain in database indefinitely (hidden in UI, visible in audit reports)

### 11.5 Backup & Disaster Recovery

**Supabase Automated Backups:**
- Daily backups (retained 7 days on Pro plan, 30 days on Team plan)
- Point-in-time recovery (PITR) available on Team plan ($599/month—may defer to Phase 2)

**MVP Backup Strategy:**
- Weekly manual export of full database to S3 (via scheduled job)
- Retain weekly exports for 12 months, monthly exports for 7 years
- Total cost: ~$5-10/month S3 storage

---

## 12. API Endpoints (Next.js App Router)

### 12.1 Transactions

```typescript
// Create transaction
POST /api/schemes/[schemeId]/transactions
Body: {
  transaction_date: "2026-01-15",
  transaction_type: "payment",
  fund_type: "admin",
  description: "Insurance premium Q1",
  total_amount: 2250.00,
  payment_method: "EFT",
  payee_payer: "ACME Insurance Co",
  lines: [
    { account_id: "...", line_type: "debit", amount: 2250.00 },
    { account_id: "...", line_type: "credit", amount: 2250.00 }
  ],
  attachment?: File
}
Response: { transaction_id, status: "created" }

// List transactions
GET /api/schemes/[schemeId]/transactions
Query: ?fund_type=admin&start_date=2025-07-01&end_date=2026-06-30&limit=50&offset=0
Response: { transactions: [...], total: 234 }

// Update transaction (restricted if reconciled or >7 days old)
PATCH /api/schemes/[schemeId]/transactions/[transactionId]
Body: { description: "Updated description", notes: "Reason for change" }
Response: { transaction_id, updated_at, audit_log_id }

// Soft delete transaction
DELETE /api/schemes/[schemeId]/transactions/[transactionId]
Body: { reason: "Duplicate entry, corrected in TXN-456" }
Response: { transaction_id, deleted_at, audit_log_id }
```

### 12.2 Bank Reconciliation

```typescript
// Upload bank statement
POST /api/schemes/[schemeId]/bank-statements
Body: FormData { file: CSV, fund_type: "admin", statement_date: "2026-01-31" }
Response: { bank_statement_id, lines_imported: 87, auto_matched: 72, unmatched: 15 }

// Get reconciliation status
GET /api/schemes/[schemeId]/bank-statements/[statementId]
Response: { 
  statement_id, 
  status: "draft",
  bank_balance: 26840.00,
  ledger_balance: 26590.00,
  matched_count: 72,
  unmatched_bank_lines: [...],
  unmatched_ledger_lines: [...]
}

// Match bank line to transaction
POST /api/schemes/[schemeId]/bank-statements/[statementId]/match
Body: { bank_line_id: "...", transaction_id: "..." }
Response: { matched: true, remaining_unmatched: 14 }

// Finalize reconciliation
POST /api/schemes/[schemeId]/bank-statements/[statementId]/finalize
Response: { reconciliation_id, status: "reconciled", reconciled_at }
```

### 12.3 Reports

```typescript
// Generate trial balance
GET /api/schemes/[schemeId]/reports/trial-balance
Query: ?start_date=2025-07-01&end_date=2026-06-30&fund_type=both&format=pdf
Response: PDF download or { accounts: [...], totals: { debit, credit } }

// Generate income/expense statement
GET /api/schemes/[schemeId]/reports/income-expense
Query: ?start_date=2025-07-01&end_date=2026-06-30&fund_type=admin&format=pdf
Response: PDF or { income: [...], expenses: [...], net_income }

// Fund balance summary
GET /api/schemes/[schemeId]/reports/fund-balances
Query: ?as_at=2026-01-31
Response: { admin: {...}, capital_works: {...}, total }
```

---

## 13. Dependencies on Other Features

### 13.1 Schemes & Lots (Feature 01)
- **Trust accounting requires:** Scheme ID, lot register for levy allocation
- **Data flow:** Levies calculated per lot → posted to transactions table

### 13.2 Levy Management (Feature 03)
- **Trust accounting requires:** Levy notices generate receipt transactions
- **Data flow:** Levy payment recorded → Creates `receipt` transaction → Updates levy balance

**Levy Payment Integration:**

When levy payments are recorded via the Levy Management module, they create transactions in this ledger automatically:

- `transaction_type = 'receipt'`
- `category_id` references the 'Levy Payment' category in chart of accounts
- `lot_id` links to the specific lot
- `payment_allocations` table links each transaction to specific `levy_items`

The Trust Accounting module is the **single source of truth** for all financial transactions. The Levy Management module provides the UI for payment recording but does not maintain a separate `payments` table.

### 13.3 Maintenance Invoice Integration

When a maintenance invoice is paid:

1. Manager clicks "Pay Invoice" on maintenance request detail view
2. System creates `transactions` record:
   - `transaction_type = 'payment'`
   - `fund_type = 'admin'` or `'capital_works'` (manager selects)
   - `category_id` = maintenance category from chart of accounts (e.g., 'Plumbing', 'Electrical', 'General Maintenance')
   - `description` = references maintenance request number
   - `linked_entity_type = 'maintenance_request'`, `linked_entity_id = request.id`
3. Maintenance request invoice is marked as paid with `payment_reference = transaction.id`

### 13.4 Financial Reporting (Feature 07)
- **Trust accounting provides:** Data for AGM financial statements
- **Data flow:** Trial balance, income/expense statement feed into AGM pack generator

### 13.5 Document Storage (Feature 06)
- **Trust accounting requires:** Store invoices, bank statements, EOFY reports
- **Data flow:** Transaction attachment uploaded → Stored in Supabase Storage → Linked to transaction record

### 13.6 Owner Portal (Feature 08)
- **Trust accounting provides:** Levy balance for owner dashboard
- **Data flow:** Owner views levy balance → Queries transactions table for their lot

---

## 14. MVP Scope vs. Phase 2

### ✅ MVP (Launch - Month 3)

- Double-entry ledger with standard chart of accounts
- Manual transaction entry (receipts, payments, journals)
- Split transactions
- Recurring transaction templates (manual creation)
- Bank reconciliation (CSV upload, semi-automated matching)
- Trial balance, income/expense, fund balance reports
- EOFY rollover (one financial year)
- Audit trail (immutable, logged edits)
- Soft delete only
- RBAC (Manager, Admin, Accountant, Auditor roles)
- Export reports (PDF, CSV)

### 🚀 Phase 2 (Months 4-9)

- **Automated bank feeds** (Yodlee/Basiq integration, real-time transaction sync)
- **Budget vs. actual alerts** (email manager when category >90% spent)
- **Multi-year financial comparison** (FY2024 vs. FY2025 side-by-side reports)
- **Accounts payable tracking** (invoice due dates, payment reminders)
- **Accounts receivable aging** (levy arrears >30, >60, >90 days reports)
- **Custom chart of accounts** (CSV import, bulk edit)
- **Transaction approval workflow** (committee approves payments >$5,000 before posting)
- **Cash flow forecasting** (predict fund balances 3-6 months ahead)

---

## 15. Open Questions for Stakeholder Review

1. **Pooled vs. Individual Trust Accounts:**
   - Should LevyLite support pooled trust accounts (all schemes in one bank account) or only individual?
   - **Recommendation:** MVP supports individual only (simpler). Phase 2 add pooled with allocation tracking.

2. **Bank Feed Providers:**
   - Yodlee ($500-2,000/month) vs. Basiq ($200-500/month) vs. Akahu (NZ/AU, $300-800/month)?
   - **Recommendation:** Defer to Phase 2, validate with customers which banks they use.

3. **EOFY Lockdown Period:**
   - Should managers be allowed to edit prior FY transactions after rollover (with audit log) or hard lock?
   - **Recommendation:** Allow edits with prominent audit log + warning ("Editing finalized FY, requires accountant approval").

4. **Transaction Approval Workflow:**
   - Should MVP include committee approval for large payments (>$X) or defer to Phase 2?
   - **Recommendation:** Defer to Phase 2 (adds complexity, not essential for sole practitioners).

5. **GST Handling:**
   - Should transactions track GST separately (e.g., $2,200 payment = $2,000 + $200 GST)?
   - **Recommendation:** MVP stores total amount only. Phase 2 add GST split for BAS reporting.

6. **Multi-Currency:**
   - Any need for foreign currency (e.g., overseas owners paying in USD)?
   - **Recommendation:** Not for WA MVP (all AUD). Consider for national expansion if needed.

7. **Bank Statement Formats:**
   - Which WA banks are most common (CBA, Westpac, Bankwest, BOQ)?
   - **Action:** Survey design partners, prioritize top 3 CSV parsers.

---

## 16. Success Metrics

### Adoption
- **80%+ of paying customers** use trust accounting feature within 30 days of signup
- **50%+ of customers** complete at least one bank reconciliation per month

### Time Savings
- **Average 3-5 hours/month saved** on manual reconciliation (measured via user survey)
- **EOFY report generation takes <30 minutes** (vs. 4-8 hours manually)

### Accuracy
- **Zero critical bugs** in double-entry balancing logic (debits ≠ credits)
- **<5 support tickets/month** related to reconciliation errors (indicates UX clarity)

### Compliance
- **100% of schemes** have complete audit trail for trust account transactions
- **Zero regulatory breaches** reported by customers (trust account compliance)

### Customer Satisfaction
- **8+/10 rating** for trust accounting feature (NPS survey)
- **Top 3 most-used feature** (measured by monthly active usage)

---

## 17. Technical Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Double-entry logic bug** (debits ≠ credits) | High (data integrity) | Medium | Database constraint, extensive unit tests, design partner testing |
| **Bank CSV parsing errors** (unsupported formats) | Medium (reconciliation fails) | High | Support top 3 WA banks, provide generic CSV mapper, user can manually match |
| **Performance degradation** (10K+ transactions) | Medium (slow reports) | Medium | Database indexes on scheme_id + transaction_date, paginate transaction list |
| **Audit trail data bloat** (millions of log entries) | Low (storage cost) | Medium | Partition audit_logs table by year, archive >7 years to cold storage |
| **User error** (deletes wrong transaction) | Medium (customer complaint) | High | Soft delete with undo, confirmation dialog before delete, audit log shows who deleted |

---

## Appendix A: Glossary

- **Admin Fund:** Operating fund covering day-to-day expenses (insurance, maintenance, utilities)
- **Capital Works Fund:** Long-term reserve fund for major capital projects (roof, painting, structural)
- **Double-Entry Bookkeeping:** Accounting method where every transaction has equal debits and credits
- **Chart of Accounts:** Structured list of all financial accounts (assets, liabilities, income, expense, equity)
- **Trial Balance:** Report showing all account balances; debits must equal credits
- **Bank Reconciliation:** Matching bank statement to ledger to identify discrepancies
- **EOFY:** End of Financial Year (typically 30 June in Australia)
- **Audit Trail:** Immutable log of all financial transactions and edits
- **Soft Delete:** Marking record as deleted without removing from database (preserves history)

---

## Appendix B: Example Workflow (Sarah's Monthly Routine)

**Day 1-5 of Month:**
1. Collect levy payments (bank transfers, cheques)
2. Enter receipts in LevyLite: Date, Lot, Amount, Reference (bank ref #)
3. Enter expense payments: Insurance invoice, gardening invoice, pool service

**Day 6-10:**
4. Download bank statement CSV (covering previous month)
5. Upload to LevyLite reconciliation tool
6. Review auto-matched transactions (green ✅)
7. Manually match suggested items (yellow ⚠️)
8. Investigate unmatched items (red ❌): Create missing entries or mark as N/A
9. Finalize reconciliation (status: Reconciled ✅)

**Day 11-15:**
10. Run fund balance report (check admin/capital works balances)
11. Generate budget vs. actual report (flag overspent categories to committee)
12. Email monthly summary to committee treasurer

**Every Quarter:**
13. Generate levy notices (automated from Levy Management feature)
14. Email levy statements to owners (shows balance, arrears if any)

**EOFY (July 1-15):**
15. Complete final reconciliation for June
16. Run EOFY checklist
17. Generate EOFY reports (trial balance, income/expense, fund balance, levy roll)
18. Export package for accountant
19. Finalize FY2025, rollover to FY2026 (one-click)
20. Submit EOFY pack to committee for AGM

**Time Saved:**
- **Before LevyLite:** 12-15 hours/month on reconciliation, EOFY = 2-3 days
- **After LevyLite:** 4-6 hours/month, EOFY = 4-6 hours
- **Savings:** 60-70 hours/year (~1.5 weeks of work)

---

**End of Document**

**Next Steps:**
1. Review with Chris + Donna (design partner)
2. Validate WA compliance requirements with strata lawyer
3. Prioritize MVP vs. Phase 2 features
4. Begin database schema implementation
5. Build transaction entry UI prototype
6. Test bank CSV parsers with real statements from CBA, Westpac, Bankwest

**Questions?** Contact Chris Johnstone | chris@kokorosoftware.com
