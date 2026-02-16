# LevyLite Unified Data Model

**Document Version:** 1.0  
**Last Updated:** 16 February 2026  
**Status:** Canonical Reference — Single Source of Truth  
**Purpose:** Comprehensive database schema for all LevyLite features

---

## 1. Overview

This document defines the **complete, unified database schema** for the LevyLite strata management platform. It serves as the single source of truth for all table structures, relationships, constraints, and policies across all features.

### 1.1 Purpose

- **Canonical Reference:** All feature implementations must use these exact table structures
- **Consistency Enforcement:** Prevents schema conflicts and integration issues
- **Developer Onboarding:** Single document for understanding the entire data model
- **Migration Foundation:** Source for all database migration scripts

### 1.2 Scope

This schema covers:
- Multi-tenant organisation management
- Scheme and lot registration
- Owner and committee member management
- Complete financial system (trust accounting, levies, payments, budgets)
- Meeting administration (AGM/SGM/committee)
- Maintenance request tracking
- Document storage and versioning
- System audit and security

---

## 2. Technical Conventions

### 2.1 Naming Rules

**Tables:**
- Use `snake_case` (lowercase with underscores)
- Plural nouns for entity tables: `schemes`, `lots`, `owners`, `transactions`
- Descriptive junction tables: `lot_ownerships`, `organisation_users`, `payment_allocations`

**Columns:**
- Use `snake_case` (lowercase with underscores)
- Boolean columns: `is_active`, `has_elevator`, `portal_activated`
- Temporal columns: `created_at`, `updated_at`, `deleted_at`, `ownership_start_date`

**Foreign Keys:**
- Always suffix with `_id`: `scheme_id`, `owner_id`, `transaction_id`

### 2.2 Data Types

**Primary Keys:**
- **Always UUID:** `id UUID PRIMARY KEY DEFAULT gen_random_uuid()`

**Timestamps:**
- **Always TIMESTAMPTZ:** `created_at TIMESTAMPTZ DEFAULT NOW()`
- Store all times in UTC, convert for display in application layer

**Money/Currency:**
- **DECIMAL(12,2)** for all financial amounts
- Store in cents if needed for precision, but prefer decimal for readability

**Text Fields:**
- `TEXT` for long/unbounded content (descriptions, addresses, notes)
- `VARCHAR(n)` only when strict length limit needed (scheme_number, codes)

**Enums:**
- Use `TEXT CHECK (column IN ('value1', 'value2'))` pattern
- **Always lowercase** values: `'admin'`, `'manager'`, `'pending'`, `'paid'`

### 2.3 API JSON Conventions

**Database → API Transformation:**
- Database: `snake_case` → API JSON: `camelCase`
- Example: `scheme_id` (database) → `schemeId` (API response)
- Example: `ownership_percentage` (database) → `ownershipPercentage` (API response)

**Dates:**
- Database: `TIMESTAMPTZ` → API: ISO 8601 string (`"2026-02-16T09:32:00.000Z"`)
- Date-only fields: `DATE` → API: `"YYYY-MM-DD"`

### 2.4 Row-Level Security (RLS)

**Pattern:**
- All tables have RLS enabled: `ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;`
- Policies use helper function: `auth.user_organisation_id()`
- Standard policy: `CREATE POLICY tenant_isolation ON table_name FOR ALL USING (organisation_id = auth.user_organisation_id());`

**Helper Function:**
```sql
CREATE OR REPLACE FUNCTION auth.user_organisation_id() 
RETURNS UUID AS $$
  SELECT organisation_id 
  FROM organisation_users 
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

---

## 3. Core Tables

### 3.1 organisations

Multi-tenant isolation. Each strata management business is one organisation.

```sql
CREATE TABLE organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  abn VARCHAR(11),  -- Australian Business Number
  address TEXT,
  phone VARCHAR(20),
  email VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE organisations IS 'Multi-tenant organisations (strata management businesses)';
COMMENT ON COLUMN organisations.abn IS 'Australian Business Number (11 digits, no spaces)';
```

**Indexes:**
```sql
CREATE INDEX idx_organisations_abn ON organisations(abn);
```

---

### 3.2 organisation_users

Junction table linking users to organisations with roles.

```sql
CREATE TABLE organisation_users (
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('manager', 'admin', 'auditor')),
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  joined_at TIMESTAMPTZ,
  PRIMARY KEY (organisation_id, user_id)
);

COMMENT ON TABLE organisation_users IS 'Users within organisations with assigned roles';
COMMENT ON COLUMN organisation_users.role IS 'manager (full access), admin (no delete), auditor (read-only financial)';
```

**Indexes:**
```sql
CREATE INDEX idx_organisation_users_user_id ON organisation_users(user_id);
CREATE INDEX idx_organisation_users_organisation_id ON organisation_users(organisation_id);
```

**RLS Policy:**
```sql
ALTER TABLE organisation_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON organisation_users
  FOR ALL USING (organisation_id = auth.user_organisation_id());
```

---

### 3.3 schemes

Strata schemes (properties managed by the organisation).

```sql
CREATE TABLE schemes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  scheme_number VARCHAR(20) NOT NULL UNIQUE,  -- e.g., "SP 12345"
  scheme_name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  suburb VARCHAR(100),
  state VARCHAR(3) DEFAULT 'WA',
  postcode VARCHAR(4),
  total_lots INTEGER NOT NULL DEFAULT 0,
  has_elevator BOOLEAN DEFAULT FALSE,
  has_pool BOOLEAN DEFAULT FALSE,
  has_gym BOOLEAN DEFAULT FALSE,
  financial_year_end_month SMALLINT DEFAULT 6 CHECK (financial_year_end_month BETWEEN 1 AND 12),
  financial_year_end_day SMALLINT DEFAULT 30 CHECK (financial_year_end_day BETWEEN 1 AND 31),
  levy_frequency TEXT DEFAULT 'quarterly' CHECK (levy_frequency IN ('monthly', 'quarterly', 'annual', 'custom')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE schemes IS 'Strata schemes (properties) managed by organisation';
COMMENT ON COLUMN schemes.scheme_number IS 'Official strata plan number (e.g., SP 12345)';
COMMENT ON COLUMN schemes.financial_year_end_month IS 'Month (1-12) when financial year ends (default June = 6)';
COMMENT ON COLUMN schemes.levy_frequency IS 'Default levy billing frequency for this scheme';
```

**Indexes:**
```sql
CREATE INDEX idx_schemes_organisation_id ON schemes(organisation_id);
CREATE INDEX idx_schemes_scheme_number ON schemes(scheme_number);
CREATE INDEX idx_schemes_deleted_at ON schemes(deleted_at) WHERE deleted_at IS NULL;
```

**RLS Policy:**
```sql
ALTER TABLE schemes ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON schemes
  FOR ALL USING (organisation_id = auth.user_organisation_id());
```

---

### 3.4 lots

Individual lots (units/apartments) within schemes.

```sql
CREATE TABLE lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  lot_number VARCHAR(20) NOT NULL,
  street_address TEXT,  -- e.g., "Unit 12, 45 Beach Street"
  unit_entitlement INTEGER NOT NULL,  -- Proportional share for levies
  is_owner_occupied BOOLEAN DEFAULT FALSE,
  is_strata_titled BOOLEAN DEFAULT TRUE,
  parking_bays INTEGER DEFAULT 0,
  storage_units INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(scheme_id, lot_number)
);

COMMENT ON TABLE lots IS 'Individual lots (units) within strata schemes';
COMMENT ON COLUMN lots.unit_entitlement IS 'Proportional share for levy calculations (e.g., 100 = 1/total share)';
COMMENT ON COLUMN lots.is_owner_occupied IS 'Is the lot currently occupied by the owner (vs tenant)?';
```

**Indexes:**
```sql
CREATE INDEX idx_lots_scheme_id ON lots(scheme_id);
CREATE INDEX idx_lots_lot_number ON lots(scheme_id, lot_number);
```

**RLS Policy:**
```sql
ALTER TABLE lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON lots
  FOR ALL USING (
    scheme_id IN (
      SELECT id FROM schemes WHERE organisation_id = auth.user_organisation_id()
    )
  );
```

---

### 3.5 owners

Property owners (also used for portal access).

```sql
CREATE TABLE owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  middle_name TEXT,
  preferred_name TEXT,
  email TEXT UNIQUE,
  phone_mobile VARCHAR(20),
  phone_work VARCHAR(20),
  phone_home VARCHAR(20),
  postal_address TEXT,
  auth_user_id UUID REFERENCES auth.users(id),  -- NULL until portal activated
  portal_activated_at TIMESTAMPTZ,
  portal_invitation_sent_at TIMESTAMPTZ,
  portal_invitation_accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE owners IS 'Property owners (also portal users when activated)';
COMMENT ON COLUMN owners.auth_user_id IS 'Links to Supabase auth user when portal is activated';
COMMENT ON COLUMN owners.portal_activated_at IS 'When owner first logged into portal';
```

**Indexes:**
```sql
CREATE INDEX idx_owners_email ON owners(email);
CREATE INDEX idx_owners_auth_user_id ON owners(auth_user_id);
CREATE INDEX idx_owners_last_name ON owners(last_name);
```

**RLS Policy:**
```sql
ALTER TABLE owners ENABLE ROW LEVEL SECURITY;

CREATE POLICY managers_full_access ON owners
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organisation_users 
      WHERE user_id = auth.uid() 
      AND role IN ('manager', 'admin')
    )
  );

CREATE POLICY owners_view_self ON owners
  FOR SELECT USING (auth_user_id = auth.uid());
```

---

### 3.6 lot_ownerships

Junction table for lot-owner relationships (many-to-many with history).

```sql
CREATE TABLE lot_ownerships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  ownership_percentage DECIMAL(5,2) NOT NULL DEFAULT 100.00,
  ownership_start_date DATE NOT NULL,
  ownership_end_date DATE,  -- NULL = current owner
  is_primary_contact BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lot_id, owner_id, ownership_start_date)
);

COMMENT ON TABLE lot_ownerships IS 'Lot-owner relationships with historical tracking';
COMMENT ON COLUMN lot_ownerships.ownership_percentage IS 'Percentage of ownership (e.g., 50.00 for joint ownership)';
COMMENT ON COLUMN lot_ownerships.ownership_end_date IS 'NULL for current owners';
COMMENT ON COLUMN lot_ownerships.is_primary_contact IS 'Primary contact for correspondence (for joint ownership)';
```

**Indexes:**
```sql
CREATE INDEX idx_lot_ownerships_lot_id ON lot_ownerships(lot_id);
CREATE INDEX idx_lot_ownerships_owner_id ON lot_ownerships(owner_id);
CREATE INDEX idx_lot_ownerships_current ON lot_ownerships(lot_id) WHERE ownership_end_date IS NULL;
```

**RLS Policy:**
```sql
ALTER TABLE lot_ownerships ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON lot_ownerships
  FOR ALL USING (
    lot_id IN (
      SELECT id FROM lots WHERE scheme_id IN (
        SELECT id FROM schemes WHERE organisation_id = auth.user_organisation_id()
      )
    )
  );
```

---

### 3.7 committee_members

Scheme committee members (owners with extra governance permissions).

```sql
CREATE TABLE committee_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  position TEXT CHECK (position IN ('chair', 'treasurer', 'secretary', 'member')),
  elected_at DATE NOT NULL,
  term_end_date DATE,  -- NULL = ongoing
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(scheme_id, owner_id, elected_at)
);

COMMENT ON TABLE committee_members IS 'Strata committee members (elected owners)';
COMMENT ON COLUMN committee_members.position IS 'Committee role (chair, treasurer, secretary, member)';
COMMENT ON COLUMN committee_members.term_end_date IS 'When term expires (NULL = ongoing)';
```

**Indexes:**
```sql
CREATE INDEX idx_committee_members_scheme_id ON committee_members(scheme_id);
CREATE INDEX idx_committee_members_owner_id ON committee_members(owner_id);
CREATE INDEX idx_committee_members_active ON committee_members(scheme_id) WHERE is_active = TRUE;
```

**RLS Policy:**
```sql
ALTER TABLE committee_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON committee_members
  FOR ALL USING (
    scheme_id IN (
      SELECT id FROM schemes WHERE organisation_id = auth.user_organisation_id()
    )
  );
```

---

### 3.8 tenants

Tenants occupying lots (not owners).

```sql
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone_mobile VARCHAR(20),
  lease_start_date DATE NOT NULL,
  lease_end_date DATE,
  is_current BOOLEAN DEFAULT TRUE,
  emergency_contact_name TEXT,
  emergency_contact_phone VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE tenants IS 'Tenants occupying lots (for contact/emergency purposes only)';
COMMENT ON COLUMN tenants.is_current IS 'Is this the current tenant?';
```

**Indexes:**
```sql
CREATE INDEX idx_tenants_lot_id ON tenants(lot_id);
CREATE INDEX idx_tenants_current ON tenants(lot_id) WHERE is_current = TRUE;
```

**RLS Policy:**
```sql
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON tenants
  FOR ALL USING (
    lot_id IN (
      SELECT id FROM lots WHERE scheme_id IN (
        SELECT id FROM schemes WHERE organisation_id = auth.user_organisation_id()
      )
    )
  );
```

---

## 4. Financial Tables

### 4.1 chart_of_accounts

All transaction categories (income, expenses, assets, liabilities).

```sql
CREATE TABLE chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(20) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  account_type TEXT NOT NULL CHECK (account_type IN ('asset', 'liability', 'income', 'expense', 'equity')),
  fund_type TEXT CHECK (fund_type IN ('admin', 'capital_works')),
  parent_id UUID REFERENCES chart_of_accounts(id),
  is_system BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE chart_of_accounts IS 'Chart of accounts for all financial transactions';
COMMENT ON COLUMN chart_of_accounts.code IS 'Account code (e.g., 4100 for Levy Income - Admin)';
COMMENT ON COLUMN chart_of_accounts.fund_type IS 'Which fund this category applies to (NULL = both)';
COMMENT ON COLUMN chart_of_accounts.is_system IS 'System default account (cannot be deleted)';
```

**Indexes:**
```sql
CREATE INDEX idx_chart_of_accounts_code ON chart_of_accounts(code);
CREATE INDEX idx_chart_of_accounts_type ON chart_of_accounts(account_type);
CREATE INDEX idx_chart_of_accounts_fund ON chart_of_accounts(fund_type);
```

**Seed Data:**
```sql
-- INCOME (4000-4999)
INSERT INTO chart_of_accounts (code, name, account_type, fund_type, is_system) VALUES
  ('4100', 'Levy Income - Admin Fund', 'income', 'admin', TRUE),
  ('4200', 'Levy Income - Capital Works Fund', 'income', 'capital_works', TRUE),
  ('4300', 'Interest Income', 'income', NULL, TRUE),
  ('4400', 'Other Income', 'income', NULL, TRUE),
  ('4500', 'Late Payment Fees', 'income', NULL, TRUE);

-- EXPENSES (6000-6999)
INSERT INTO chart_of_accounts (code, name, account_type, fund_type, is_system) VALUES
  ('6100', 'Maintenance - General', 'expense', 'admin', TRUE),
  ('6110', 'Maintenance - Plumbing', 'expense', 'admin', TRUE),
  ('6120', 'Maintenance - Electrical', 'expense', 'admin', TRUE),
  ('6130', 'Maintenance - Painting', 'expense', 'admin', TRUE),
  ('6140', 'Maintenance - Landscaping', 'expense', 'admin', TRUE),
  ('6150', 'Maintenance - Common Property', 'expense', 'capital_works', TRUE),
  ('6200', 'Insurance - Building', 'expense', 'admin', TRUE),
  ('6210', 'Insurance - Public Liability', 'expense', 'admin', TRUE),
  ('6220', 'Insurance - Office Bearers', 'expense', 'admin', TRUE),
  ('6300', 'Utilities - Water', 'expense', 'admin', TRUE),
  ('6310', 'Utilities - Electricity', 'expense', 'admin', TRUE),
  ('6320', 'Utilities - Gas', 'expense', 'admin', TRUE),
  ('6400', 'Management Fees', 'expense', 'admin', TRUE),
  ('6500', 'Legal Fees', 'expense', 'admin', TRUE),
  ('6600', 'Audit Fees', 'expense', 'admin', TRUE),
  ('6700', 'Bank Charges', 'expense', 'admin', TRUE),
  ('6800', 'Postage and Printing', 'expense', 'admin', TRUE),
  ('6900', 'Cleaning - Common Areas', 'expense', 'admin', TRUE),
  ('6910', 'Pest Control', 'expense', 'admin', TRUE),
  ('6920', 'Fire Safety - Testing/Maintenance', 'expense', 'admin', TRUE),
  ('6930', 'Lift Maintenance', 'expense', 'admin', TRUE),
  ('6940', 'Pool Maintenance', 'expense', 'admin', TRUE),
  ('6950', 'Security Services', 'expense', 'admin', TRUE),
  ('6990', 'Sundry Expenses', 'expense', 'admin', TRUE);

-- ASSETS (1000-1999)
INSERT INTO chart_of_accounts (code, name, account_type, fund_type, is_system) VALUES
  ('1100', 'Trust Account - Admin Fund', 'asset', 'admin', TRUE),
  ('1200', 'Trust Account - Capital Works Fund', 'asset', 'capital_works', TRUE),
  ('1300', 'Petty Cash', 'asset', NULL, TRUE),
  ('1400', 'Accounts Receivable - Levies', 'asset', NULL, TRUE);

-- LIABILITIES (2000-2999)
INSERT INTO chart_of_accounts (code, name, account_type, fund_type, is_system) VALUES
  ('2100', 'GST Collected', 'liability', NULL, TRUE),
  ('2200', 'GST Paid', 'liability', NULL, TRUE),
  ('2300', 'Prepaid Levies', 'liability', NULL, TRUE),
  ('2400', 'Accounts Payable', 'liability', NULL, TRUE);
```

---

### 4.2 financial_years

Financial year definitions for each scheme.

```sql
CREATE TABLE financial_years (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  year_label VARCHAR(20) NOT NULL,  -- e.g., "2025/26"
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  is_current BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(scheme_id, year_label)
);

COMMENT ON TABLE financial_years IS 'Financial year definitions per scheme';
COMMENT ON COLUMN financial_years.year_label IS 'Display label (e.g., 2025/26)';
COMMENT ON COLUMN financial_years.is_current IS 'Is this the current active financial year?';
```

**Indexes:**
```sql
CREATE INDEX idx_financial_years_scheme_id ON financial_years(scheme_id);
CREATE INDEX idx_financial_years_current ON financial_years(scheme_id) WHERE is_current = TRUE;
```

**RLS Policy:**
```sql
ALTER TABLE financial_years ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON financial_years
  FOR ALL USING (
    scheme_id IN (
      SELECT id FROM schemes WHERE organisation_id = auth.user_organisation_id()
    )
  );
```

---

### 4.3 transactions

All financial transactions (receipts, payments, journal entries). **Source of truth for trust accounting.**

```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  lot_id UUID REFERENCES lots(id),  -- NULL for scheme-level transactions
  transaction_date DATE NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('receipt', 'payment', 'journal')),
  fund_type TEXT NOT NULL CHECK (fund_type IN ('admin', 'capital_works')),
  category_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  amount DECIMAL(12,2) NOT NULL,
  gst_amount DECIMAL(12,2) DEFAULT 0,
  description TEXT NOT NULL,
  reference VARCHAR(100),  -- Invoice number, receipt number, etc.
  payment_method TEXT CHECK (payment_method IN ('eft', 'credit_card', 'cheque', 'cash', 'bpay')),
  bank_statement_id UUID REFERENCES bank_statements(id),  -- Links to reconciliation
  is_reconciled BOOLEAN DEFAULT FALSE,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

COMMENT ON TABLE transactions IS 'All financial transactions (trust accounting source of truth)';
COMMENT ON COLUMN transactions.transaction_type IS 'receipt (money in), payment (money out), journal (transfer)';
COMMENT ON COLUMN transactions.fund_type IS 'admin or capital_works fund';
COMMENT ON COLUMN transactions.lot_id IS 'NULL for scheme-level transactions (e.g., insurance)';
```

**Indexes:**
```sql
CREATE INDEX idx_transactions_scheme_id ON transactions(scheme_id);
CREATE INDEX idx_transactions_lot_id ON transactions(lot_id);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_fund ON transactions(fund_type);
CREATE INDEX idx_transactions_category ON transactions(category_id);
CREATE INDEX idx_transactions_deleted ON transactions(deleted_at) WHERE deleted_at IS NULL;
```

**RLS Policy:**
```sql
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON transactions
  FOR ALL USING (
    scheme_id IN (
      SELECT id FROM schemes WHERE organisation_id = auth.user_organisation_id()
    )
  );
```

---

### 4.4 transaction_lines

Double-entry accounting lines (debit/credit pairs for each transaction).

```sql
CREATE TABLE transaction_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  line_type TEXT NOT NULL CHECK (line_type IN ('debit', 'credit')),
  amount DECIMAL(12,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE transaction_lines IS 'Double-entry accounting lines (debits and credits)';
COMMENT ON COLUMN transaction_lines.line_type IS 'debit (left side) or credit (right side)';
```

**Indexes:**
```sql
CREATE INDEX idx_transaction_lines_transaction_id ON transaction_lines(transaction_id);
CREATE INDEX idx_transaction_lines_account_id ON transaction_lines(account_id);
```

**Trigger to Auto-Create Lines:**
```sql
CREATE OR REPLACE FUNCTION create_transaction_lines()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-create double-entry lines when transaction is inserted
  IF NEW.transaction_type = 'receipt' THEN
    -- Debit: Bank account
    INSERT INTO transaction_lines (transaction_id, account_id, line_type, amount, description)
    VALUES (
      NEW.id,
      (SELECT id FROM chart_of_accounts WHERE code = CASE WHEN NEW.fund_type = 'admin' THEN '1100' ELSE '1200' END),
      'debit',
      NEW.amount,
      'Receipt: ' || NEW.description
    );
    -- Credit: Income account
    INSERT INTO transaction_lines (transaction_id, account_id, line_type, amount, description)
    VALUES (
      NEW.id,
      NEW.category_id,
      'credit',
      NEW.amount,
      NEW.description
    );
  ELSIF NEW.transaction_type = 'payment' THEN
    -- Debit: Expense account
    INSERT INTO transaction_lines (transaction_id, account_id, line_type, amount, description)
    VALUES (
      NEW.id,
      NEW.category_id,
      'debit',
      NEW.amount,
      NEW.description
    );
    -- Credit: Bank account
    INSERT INTO transaction_lines (transaction_id, account_id, line_type, amount, description)
    VALUES (
      NEW.id,
      (SELECT id FROM chart_of_accounts WHERE code = CASE WHEN NEW.fund_type = 'admin' THEN '1100' ELSE '1200' END),
      'credit',
      NEW.amount,
      'Payment: ' || NEW.description
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_create_transaction_lines
  AFTER INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION create_transaction_lines();
```

---

### 4.5 levy_schedules

Levy schedules defining the levy structure for a scheme/period.

```sql
CREATE TABLE levy_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  financial_year_id UUID NOT NULL REFERENCES financial_years(id),
  frequency TEXT NOT NULL CHECK (frequency IN ('monthly', 'quarterly', 'annual', 'custom')),
  admin_fund_total DECIMAL(12,2) NOT NULL,
  capital_works_fund_total DECIMAL(12,2) NOT NULL,
  approved_at DATE,
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE levy_schedules IS 'Levy schedules approved for each financial year';
COMMENT ON COLUMN levy_schedules.approved_at IS 'When the schedule was approved (e.g., at AGM)';
```

**Indexes:**
```sql
CREATE INDEX idx_levy_schedules_scheme_id ON levy_schedules(scheme_id);
CREATE INDEX idx_levy_schedules_financial_year_id ON levy_schedules(financial_year_id);
```

**RLS Policy:**
```sql
ALTER TABLE levy_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON levy_schedules
  FOR ALL USING (
    scheme_id IN (
      SELECT id FROM schemes WHERE organisation_id = auth.user_organisation_id()
    )
  );
```

---

### 4.6 levy_periods

Individual billing periods within a levy schedule.

```sql
CREATE TABLE levy_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  levy_schedule_id UUID NOT NULL REFERENCES levy_schedules(id) ON DELETE CASCADE,
  period_label VARCHAR(50) NOT NULL,  -- "Q1 2026", "January 2026"
  period_start_date DATE NOT NULL,
  period_end_date DATE NOT NULL,
  due_date DATE NOT NULL,
  notice_sent_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE levy_periods IS 'Billing periods within levy schedules';
COMMENT ON COLUMN levy_periods.period_label IS 'Display label (e.g., Q1 2026)';
```

**Indexes:**
```sql
CREATE INDEX idx_levy_periods_schedule_id ON levy_periods(levy_schedule_id);
CREATE INDEX idx_levy_periods_due_date ON levy_periods(due_date);
```

**RLS Policy:**
```sql
ALTER TABLE levy_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON levy_periods
  FOR ALL USING (
    levy_schedule_id IN (
      SELECT id FROM levy_schedules WHERE scheme_id IN (
        SELECT id FROM schemes WHERE organisation_id = auth.user_organisation_id()
      )
    )
  );
```

---

### 4.7 levy_items

Individual levy obligations for each lot per period.

```sql
CREATE TABLE levy_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  levy_period_id UUID NOT NULL REFERENCES levy_periods(id) ON DELETE CASCADE,
  admin_levy_amount DECIMAL(10,2) NOT NULL,
  capital_levy_amount DECIMAL(10,2) NOT NULL,
  total_levy_amount DECIMAL(10,2) GENERATED ALWAYS AS (admin_levy_amount + capital_levy_amount) STORED,
  amount_paid DECIMAL(10,2) DEFAULT 0,
  amount_outstanding DECIMAL(10,2) GENERATED ALWAYS AS ((admin_levy_amount + capital_levy_amount) - amount_paid) STORED,
  due_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'paid', 'partial', 'overdue')),
  notice_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lot_id, levy_period_id)
);

COMMENT ON TABLE levy_items IS 'Levy obligations per lot per period';
COMMENT ON COLUMN levy_items.status IS 'pending (not sent), sent, paid, partial, overdue';
COMMENT ON COLUMN levy_items.amount_outstanding IS 'Computed: total - paid';
```

**Indexes:**
```sql
CREATE INDEX idx_levy_items_lot_id ON levy_items(lot_id);
CREATE INDEX idx_levy_items_period_id ON levy_items(levy_period_id);
CREATE INDEX idx_levy_items_status ON levy_items(status);
CREATE INDEX idx_levy_items_due_date ON levy_items(due_date);
```

**Trigger to Update Status:**
```sql
CREATE OR REPLACE FUNCTION update_levy_item_status()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.amount_paid >= NEW.total_levy_amount THEN
    NEW.status := 'paid';
  ELSIF NEW.amount_paid > 0 THEN
    NEW.status := 'partial';
  ELSIF NEW.due_date < CURRENT_DATE AND NEW.amount_paid = 0 THEN
    NEW.status := 'overdue';
  ELSIF NEW.notice_sent_at IS NOT NULL THEN
    NEW.status := 'sent';
  ELSE
    NEW.status := 'pending';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_update_levy_status
  BEFORE INSERT OR UPDATE ON levy_items
  FOR EACH ROW
  EXECUTE FUNCTION update_levy_item_status();
```

**RLS Policy:**
```sql
ALTER TABLE levy_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON levy_items
  FOR ALL USING (
    lot_id IN (
      SELECT id FROM lots WHERE scheme_id IN (
        SELECT id FROM schemes WHERE organisation_id = auth.user_organisation_id()
      )
    )
  );
```

---

### 4.8 payment_allocations

Links transactions (payments) to levy items.

```sql
CREATE TABLE payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  levy_item_id UUID NOT NULL REFERENCES levy_items(id) ON DELETE CASCADE,
  allocated_amount DECIMAL(10,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE payment_allocations IS 'Links payments to levy items (one payment can cover multiple levies)';
COMMENT ON COLUMN payment_allocations.allocated_amount IS 'Amount of this transaction applied to this levy item';
```

**Indexes:**
```sql
CREATE INDEX idx_payment_allocations_transaction_id ON payment_allocations(transaction_id);
CREATE INDEX idx_payment_allocations_levy_item_id ON payment_allocations(levy_item_id);
```

**Trigger to Update Levy Item Paid Amount:**
```sql
CREATE OR REPLACE FUNCTION update_levy_item_paid()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE levy_items
  SET amount_paid = (
    SELECT COALESCE(SUM(allocated_amount), 0)
    FROM payment_allocations
    WHERE levy_item_id = NEW.levy_item_id
  )
  WHERE id = NEW.levy_item_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER auto_update_levy_paid
  AFTER INSERT OR UPDATE OR DELETE ON payment_allocations
  FOR EACH ROW
  EXECUTE FUNCTION update_levy_item_paid();
```

**RLS Policy:**
```sql
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON payment_allocations
  FOR ALL USING (
    transaction_id IN (
      SELECT id FROM transactions WHERE scheme_id IN (
        SELECT id FROM schemes WHERE organisation_id = auth.user_organisation_id()
      )
    )
  );
```

---

### 4.9 budgets

Annual budgets for schemes.

```sql
CREATE TABLE budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  financial_year_id UUID NOT NULL REFERENCES financial_years(id),
  budget_type TEXT NOT NULL CHECK (budget_type IN ('admin', 'capital_works')),
  total_amount DECIMAL(12,2) NOT NULL,
  approved_at DATE,
  approved_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(scheme_id, financial_year_id, budget_type)
);

COMMENT ON TABLE budgets IS 'Annual budgets (admin and capital works)';
COMMENT ON COLUMN budgets.approved_at IS 'When budget was approved (usually at AGM)';
```

**Indexes:**
```sql
CREATE INDEX idx_budgets_scheme_id ON budgets(scheme_id);
CREATE INDEX idx_budgets_financial_year_id ON budgets(financial_year_id);
```

**RLS Policy:**
```sql
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON budgets
  FOR ALL USING (
    scheme_id IN (
      SELECT id FROM schemes WHERE organisation_id = auth.user_organisation_id()
    )
  );
```

---

### 4.10 budget_line_items

Budget breakdown by category.

```sql
CREATE TABLE budget_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES chart_of_accounts(id),
  budgeted_amount DECIMAL(10,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE budget_line_items IS 'Budget allocations by category';
```

**Indexes:**
```sql
CREATE INDEX idx_budget_line_items_budget_id ON budget_line_items(budget_id);
CREATE INDEX idx_budget_line_items_category_id ON budget_line_items(category_id);
```

**RLS Policy:**
```sql
ALTER TABLE budget_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON budget_line_items
  FOR ALL USING (
    budget_id IN (
      SELECT id FROM budgets WHERE scheme_id IN (
        SELECT id FROM schemes WHERE organisation_id = auth.user_organisation_id()
      )
    )
  );
```

---

### 4.11 bank_statements

Bank statement imports for reconciliation.

```sql
CREATE TABLE bank_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  fund_type TEXT NOT NULL CHECK (fund_type IN ('admin', 'capital_works')),
  statement_date DATE NOT NULL,
  opening_balance DECIMAL(12,2) NOT NULL,
  closing_balance DECIMAL(12,2) NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE bank_statements IS 'Bank statements uploaded for reconciliation';
```

**Indexes:**
```sql
CREATE INDEX idx_bank_statements_scheme_id ON bank_statements(scheme_id);
CREATE INDEX idx_bank_statements_date ON bank_statements(statement_date);
```

**RLS Policy:**
```sql
ALTER TABLE bank_statements ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON bank_statements
  FOR ALL USING (
    scheme_id IN (
      SELECT id FROM schemes WHERE organisation_id = auth.user_organisation_id()
    )
  );
```

---

### 4.12 reconciliations

Reconciliation records (matching transactions to bank statements).

```sql
CREATE TABLE reconciliations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_statement_id UUID NOT NULL REFERENCES bank_statements(id) ON DELETE CASCADE,
  reconciled_by UUID NOT NULL REFERENCES auth.users(id),
  reconciled_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

COMMENT ON TABLE reconciliations IS 'Reconciliation records linking transactions to bank statements';
```

**Indexes:**
```sql
CREATE INDEX idx_reconciliations_statement_id ON reconciliations(bank_statement_id);
```

**RLS Policy:**
```sql
ALTER TABLE reconciliations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON reconciliations
  FOR ALL USING (
    bank_statement_id IN (
      SELECT id FROM bank_statements WHERE scheme_id IN (
        SELECT id FROM schemes WHERE organisation_id = auth.user_organisation_id()
      )
    )
  );
```

---

## 5. Meeting Tables

### 5.1 meetings

AGMs, SGMs, and committee meetings.

```sql
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  meeting_type TEXT NOT NULL CHECK (meeting_type IN ('agm', 'sgm', 'committee')),
  meeting_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'notice_sent', 'in_progress', 'completed', 'adjourned', 'cancelled')),
  notice_sent_at TIMESTAMPTZ,
  quorum_required INTEGER,
  quorum_met BOOLEAN,
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE meetings IS 'All meetings (AGM, SGM, committee)';
COMMENT ON COLUMN meetings.status IS 'Workflow: draft → scheduled → notice_sent → in_progress → completed';
```

**Indexes:**
```sql
CREATE INDEX idx_meetings_scheme_id ON meetings(scheme_id);
CREATE INDEX idx_meetings_date ON meetings(meeting_date);
CREATE INDEX idx_meetings_type ON meetings(meeting_type);
CREATE INDEX idx_meetings_status ON meetings(status);
```

**RLS Policy:**
```sql
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON meetings
  FOR ALL USING (
    scheme_id IN (
      SELECT id FROM schemes WHERE organisation_id = auth.user_organisation_id()
    )
  );
```

---

### 5.2 agenda_items

Agenda items for meetings.

```sql
CREATE TABLE agenda_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  item_number INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  item_type TEXT CHECK (item_type IN ('presentation', 'discussion', 'motion', 'election')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(meeting_id, item_number)
);

COMMENT ON TABLE agenda_items IS 'Agenda items for meetings';
COMMENT ON COLUMN agenda_items.item_number IS 'Order of item on agenda (1, 2, 3...)';
```

**Indexes:**
```sql
CREATE INDEX idx_agenda_items_meeting_id ON agenda_items(meeting_id);
```

**RLS Policy:**
```sql
ALTER TABLE agenda_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON agenda_items
  FOR ALL USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE scheme_id IN (
        SELECT id FROM schemes WHERE organisation_id = auth.user_organisation_id()
      )
    )
  );
```

---

### 5.3 attendees

Meeting attendees (owners/committee/managers).

```sql
CREATE TABLE attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES owners(id),
  user_id UUID REFERENCES auth.users(id),  -- For managers/admins
  attendance_type TEXT NOT NULL CHECK (attendance_type IN ('in_person', 'proxy', 'online', 'absent')),
  rsvp_status TEXT CHECK (rsvp_status IN ('yes', 'no', 'maybe')),
  rsvp_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(meeting_id, owner_id)
);

COMMENT ON TABLE attendees IS 'Meeting attendees and RSVP tracking';
COMMENT ON COLUMN attendees.owner_id IS 'For lot owners';
COMMENT ON COLUMN attendees.user_id IS 'For managers/admins/auditors';
```

**Indexes:**
```sql
CREATE INDEX idx_attendees_meeting_id ON attendees(meeting_id);
CREATE INDEX idx_attendees_owner_id ON attendees(owner_id);
```

**RLS Policy:**
```sql
ALTER TABLE attendees ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON attendees
  FOR ALL USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE scheme_id IN (
        SELECT id FROM schemes WHERE organisation_id = auth.user_organisation_id()
      )
    )
  );
```

---

### 5.4 proxies

Proxy voting assignments.

```sql
CREATE TABLE proxies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES owners(id),  -- Owner granting proxy
  proxy_holder_id UUID NOT NULL REFERENCES owners(id),  -- Owner receiving proxy
  proxy_type TEXT NOT NULL CHECK (proxy_type IN ('directed', 'undirected')),
  lodged_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(meeting_id, owner_id)
);

COMMENT ON TABLE proxies IS 'Proxy voting assignments for meetings';
COMMENT ON COLUMN proxies.proxy_type IS 'directed (specific votes), undirected (proxy decides)';
```

**Indexes:**
```sql
CREATE INDEX idx_proxies_meeting_id ON proxies(meeting_id);
CREATE INDEX idx_proxies_owner_id ON proxies(owner_id);
CREATE INDEX idx_proxies_proxy_holder_id ON proxies(proxy_holder_id);
```

**RLS Policy:**
```sql
ALTER TABLE proxies ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON proxies
  FOR ALL USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE scheme_id IN (
        SELECT id FROM schemes WHERE organisation_id = auth.user_organisation_id()
      )
    )
  );
```

---

### 5.5 resolutions

Motions/resolutions voted on at meetings.

```sql
CREATE TABLE resolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  agenda_item_id UUID REFERENCES agenda_items(id),
  resolution_text TEXT NOT NULL,
  resolution_type TEXT NOT NULL CHECK (resolution_type IN ('ordinary', 'special', 'unanimous')),
  moved_by UUID REFERENCES owners(id),
  seconded_by UUID REFERENCES owners(id),
  votes_for INTEGER DEFAULT 0,
  votes_against INTEGER DEFAULT 0,
  votes_abstain INTEGER DEFAULT 0,
  result TEXT CHECK (result IN ('passed', 'failed', 'deferred')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE resolutions IS 'Resolutions voted on at meetings';
COMMENT ON COLUMN resolutions.resolution_type IS 'ordinary (>50%), special (75%), unanimous (100%)';
```

**Indexes:**
```sql
CREATE INDEX idx_resolutions_meeting_id ON resolutions(meeting_id);
CREATE INDEX idx_resolutions_agenda_item_id ON resolutions(agenda_item_id);
```

**RLS Policy:**
```sql
ALTER TABLE resolutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON resolutions
  FOR ALL USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE scheme_id IN (
        SELECT id FROM schemes WHERE organisation_id = auth.user_organisation_id()
      )
    )
  );
```

---

### 5.6 minutes

Meeting minutes (final record).

```sql
CREATE TABLE minutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  content TEXT NOT NULL,  -- Full minutes text
  approved_at DATE,
  approved_by UUID REFERENCES auth.users(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE minutes IS 'Meeting minutes (final record of proceedings)';
```

**Indexes:**
```sql
CREATE INDEX idx_minutes_meeting_id ON minutes(meeting_id);
```

**RLS Policy:**
```sql
ALTER TABLE minutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON minutes
  FOR ALL USING (
    meeting_id IN (
      SELECT id FROM meetings WHERE scheme_id IN (
        SELECT id FROM schemes WHERE organisation_id = auth.user_organisation_id()
      )
    )
  );
```

---

## 6. Maintenance Tables

### 6.1 maintenance_requests

Maintenance and repair requests.

```sql
CREATE TABLE maintenance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  lot_id UUID REFERENCES lots(id),  -- NULL for common property
  submitted_by UUID NOT NULL REFERENCES owners(id),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category TEXT NOT NULL,  -- 'plumbing', 'electrical', 'painting', etc.
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT,  -- "Common hallway", "Lot 12 bathroom"
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'acknowledged', 'assigned', 'in_progress', 'quoted', 'approved', 'completed', 'closed')),
  assigned_to UUID REFERENCES tradespeople(id),
  estimated_cost DECIMAL(10,2),
  actual_cost DECIMAL(10,2),
  scheduled_date DATE,
  completed_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE maintenance_requests IS 'Maintenance and repair requests';
COMMENT ON COLUMN maintenance_requests.lot_id IS 'NULL for common property maintenance';
COMMENT ON COLUMN maintenance_requests.status IS 'Workflow: new → acknowledged → assigned → in_progress → completed → closed';
```

**Indexes:**
```sql
CREATE INDEX idx_maintenance_requests_scheme_id ON maintenance_requests(scheme_id);
CREATE INDEX idx_maintenance_requests_lot_id ON maintenance_requests(lot_id);
CREATE INDEX idx_maintenance_requests_submitted_by ON maintenance_requests(submitted_by);
CREATE INDEX idx_maintenance_requests_status ON maintenance_requests(status);
CREATE INDEX idx_maintenance_requests_priority ON maintenance_requests(priority);
```

**RLS Policy:**
```sql
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON maintenance_requests
  FOR ALL USING (
    scheme_id IN (
      SELECT id FROM schemes WHERE organisation_id = auth.user_organisation_id()
    )
  );

CREATE POLICY owners_view_own ON maintenance_requests
  FOR SELECT USING (submitted_by IN (
    SELECT id FROM owners WHERE auth_user_id = auth.uid()
  ));
```

---

### 6.2 maintenance_comments

Comments/updates on maintenance requests.

```sql
CREATE TABLE maintenance_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_request_id UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  owner_id UUID REFERENCES owners(id),
  comment TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT FALSE,  -- Internal notes (not visible to owners)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE maintenance_comments IS 'Comments and updates on maintenance requests';
COMMENT ON COLUMN maintenance_comments.is_internal IS 'Internal manager notes (not visible to owners)';
```

**Indexes:**
```sql
CREATE INDEX idx_maintenance_comments_request_id ON maintenance_comments(maintenance_request_id);
```

**RLS Policy:**
```sql
ALTER TABLE maintenance_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON maintenance_comments
  FOR ALL USING (
    maintenance_request_id IN (
      SELECT id FROM maintenance_requests WHERE scheme_id IN (
        SELECT id FROM schemes WHERE organisation_id = auth.user_organisation_id()
      )
    )
  );
```

---

### 6.3 tradespeople

Registered tradespeople/contractors.

```sql
CREATE TABLE tradespeople (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone VARCHAR(20),
  abn VARCHAR(11),
  trade_type TEXT,  -- 'plumber', 'electrician', 'painter', etc.
  is_preferred BOOLEAN DEFAULT FALSE,
  insurance_expiry DATE,
  license_number VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE tradespeople IS 'Registered tradespeople and contractors';
COMMENT ON COLUMN tradespeople.is_preferred IS 'Preferred contractor for this organisation';
```

**Indexes:**
```sql
CREATE INDEX idx_tradespeople_organisation_id ON tradespeople(organisation_id);
CREATE INDEX idx_tradespeople_trade_type ON tradespeople(trade_type);
CREATE INDEX idx_tradespeople_preferred ON tradespeople(is_preferred) WHERE is_preferred = TRUE;
```

**RLS Policy:**
```sql
ALTER TABLE tradespeople ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON tradespeople
  FOR ALL USING (organisation_id = auth.user_organisation_id());
```

---

### 6.4 quotes

Quotes for maintenance work.

```sql
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_request_id UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  tradesperson_id UUID NOT NULL REFERENCES tradespeople(id),
  quote_amount DECIMAL(10,2) NOT NULL,
  quote_date DATE NOT NULL,
  quote_reference VARCHAR(100),
  is_accepted BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE quotes IS 'Quotes for maintenance work';
```

**Indexes:**
```sql
CREATE INDEX idx_quotes_request_id ON quotes(maintenance_request_id);
CREATE INDEX idx_quotes_tradesperson_id ON quotes(tradesperson_id);
```

**RLS Policy:**
```sql
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON quotes
  FOR ALL USING (
    maintenance_request_id IN (
      SELECT id FROM maintenance_requests WHERE scheme_id IN (
        SELECT id FROM schemes WHERE organisation_id = auth.user_organisation_id()
      )
    )
  );
```

---

### 6.5 invoices

Invoices for completed maintenance work.

```sql
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_request_id UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  tradesperson_id UUID NOT NULL REFERENCES tradespeople(id),
  invoice_number VARCHAR(100) NOT NULL,
  invoice_date DATE NOT NULL,
  invoice_amount DECIMAL(10,2) NOT NULL,
  gst_amount DECIMAL(10,2) DEFAULT 0,
  payment_reference UUID REFERENCES transactions(id),  -- Links to transaction
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE invoices IS 'Invoices for completed maintenance work';
COMMENT ON COLUMN invoices.payment_reference IS 'Links to transaction when paid';
```

**Indexes:**
```sql
CREATE INDEX idx_invoices_request_id ON invoices(maintenance_request_id);
CREATE INDEX idx_invoices_tradesperson_id ON invoices(tradesperson_id);
CREATE INDEX idx_invoices_payment_reference ON invoices(payment_reference);
```

**RLS Policy:**
```sql
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON invoices
  FOR ALL USING (
    maintenance_request_id IN (
      SELECT id FROM maintenance_requests WHERE scheme_id IN (
        SELECT id FROM schemes WHERE organisation_id = auth.user_organisation_id()
      )
    )
  );
```

---

### 6.6 maintenance_attachments

Photos/documents attached to maintenance requests.

```sql
CREATE TABLE maintenance_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  maintenance_request_id UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_type TEXT,  -- 'image', 'pdf', 'document'
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE maintenance_attachments IS 'Photos and documents attached to maintenance requests';
```

**Indexes:**
```sql
CREATE INDEX idx_maintenance_attachments_request_id ON maintenance_attachments(maintenance_request_id);
```

**RLS Policy:**
```sql
ALTER TABLE maintenance_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON maintenance_attachments
  FOR ALL USING (
    maintenance_request_id IN (
      SELECT id FROM maintenance_requests WHERE scheme_id IN (
        SELECT id FROM schemes WHERE organisation_id = auth.user_organisation_id()
      )
    )
  );
```

---

## 7. Document Tables

### 7.1 documents

All documents stored in the system.

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  category TEXT NOT NULL,  -- 'agm', 'levy', 'insurance', 'bylaw', 'maintenance', 'financial'
  visibility TEXT DEFAULT 'owners' CHECK (visibility IN ('owners', 'committee', 'manager_only')),
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type TEXT,
  linked_entity_type TEXT,  -- 'levy', 'meeting', 'maintenance_request', 'financial_report'
  linked_entity_id UUID,
  version_number INTEGER DEFAULT 1,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE documents IS 'All documents stored in the system';
COMMENT ON COLUMN documents.visibility IS 'Who can view: owners (all), committee (committee only), manager_only';
COMMENT ON COLUMN documents.linked_entity_type IS 'Type of linked entity (levy, meeting, etc.)';
COMMENT ON COLUMN documents.linked_entity_id IS 'ID of linked entity';
```

**Indexes:**
```sql
CREATE INDEX idx_documents_scheme_id ON documents(scheme_id);
CREATE INDEX idx_documents_category ON documents(category);
CREATE INDEX idx_documents_linked_entity ON documents(linked_entity_type, linked_entity_id);
CREATE INDEX idx_documents_uploaded_at ON documents(uploaded_at);
```

**RLS Policy:**
```sql
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON documents
  FOR ALL USING (
    scheme_id IN (
      SELECT id FROM schemes WHERE organisation_id = auth.user_organisation_id()
    )
  );

CREATE POLICY owners_view_allowed ON documents
  FOR SELECT USING (
    visibility IN ('owners', 'committee') AND
    scheme_id IN (
      SELECT lots.scheme_id FROM lots
      JOIN lot_ownerships ON lots.id = lot_ownerships.lot_id
      JOIN owners ON lot_ownerships.owner_id = owners.id
      WHERE owners.auth_user_id = auth.uid()
      AND lot_ownerships.ownership_end_date IS NULL
    )
  );
```

---

### 7.2 document_versions

Version history for documents.

```sql
CREATE TABLE document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  uploaded_by UUID REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(document_id, version_number)
);

COMMENT ON TABLE document_versions IS 'Version history for documents';
```

**Indexes:**
```sql
CREATE INDEX idx_document_versions_document_id ON document_versions(document_id);
```

**RLS Policy:**
```sql
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON document_versions
  FOR ALL USING (
    document_id IN (
      SELECT id FROM documents WHERE scheme_id IN (
        SELECT id FROM schemes WHERE organisation_id = auth.user_organisation_id()
      )
    )
  );
```

---

### 7.3 document_audit_log

Audit log for document access (view/download).

```sql
CREATE TABLE document_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL CHECK (action IN ('view', 'download', 'upload', 'delete')),
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE document_audit_log IS 'Audit log for document access';
```

**Indexes:**
```sql
CREATE INDEX idx_document_audit_log_document_id ON document_audit_log(document_id);
CREATE INDEX idx_document_audit_log_user_id ON document_audit_log(user_id);
CREATE INDEX idx_document_audit_log_created_at ON document_audit_log(created_at);
```

**RLS Policy:**
```sql
ALTER TABLE document_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY managers_only ON document_audit_log
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM organisation_users 
      WHERE user_id = auth.uid() 
      AND role IN ('manager', 'admin')
    )
  );
```

---

## 8. System Tables

### 8.1 audit_log

System-wide audit log for all critical actions.

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE audit_log IS 'System-wide audit log for critical actions';
COMMENT ON COLUMN audit_log.old_values IS 'Previous values (for updates/deletes)';
COMMENT ON COLUMN audit_log.new_values IS 'New values (for inserts/updates)';
```

**Indexes:**
```sql
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_table_name ON audit_log(table_name);
CREATE INDEX idx_audit_log_record_id ON audit_log(record_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at);
```

**Trigger Function (Example):**
```sql
CREATE OR REPLACE FUNCTION log_audit()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO audit_log (user_id, action, table_name, record_id, old_values, new_values)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply to critical tables:
CREATE TRIGGER audit_schemes AFTER INSERT OR UPDATE OR DELETE ON schemes
  FOR EACH ROW EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_transactions AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION log_audit();
```

**RLS Policy:**
```sql
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY managers_only ON audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organisation_users 
      WHERE user_id = auth.uid() 
      AND role IN ('manager', 'admin', 'auditor')
    )
  );
```

---

### 8.2 invitations

User and owner portal invitations.

```sql
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role TEXT,  -- 'manager', 'admin', 'auditor', 'owner'
  organisation_id UUID REFERENCES organisations(id),
  scheme_id UUID REFERENCES schemes(id),
  owner_id UUID REFERENCES owners(id),  -- For owner portal invitations
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE invitations IS 'Invitations for users and owner portal access';
COMMENT ON COLUMN invitations.role IS 'Role being invited to (manager/admin/auditor/owner)';
COMMENT ON COLUMN invitations.owner_id IS 'Set for owner portal invitations';
```

**Indexes:**
```sql
CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_email ON invitations(email);
CREATE INDEX idx_invitations_expires_at ON invitations(expires_at);
```

**RLS Policy:**
```sql
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation ON invitations
  FOR ALL USING (
    organisation_id = auth.user_organisation_id() OR
    organisation_id IS NULL  -- Allow unauthenticated access for token redemption
  );
```

---

### 8.3 notifications

Future: notification preferences and delivery log.

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  owner_id UUID REFERENCES owners(id),
  notification_type TEXT NOT NULL,  -- 'levy_notice', 'meeting_notice', 'maintenance_update'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE notifications IS 'In-app notifications (future feature)';
```

**Indexes:**
```sql
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_owner_id ON notifications(owner_id);
CREATE INDEX idx_notifications_read_at ON notifications(read_at) WHERE read_at IS NULL;
```

---

### 8.4 email_log

Email delivery tracking.

```sql
CREATE TABLE email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  email_type TEXT NOT NULL,  -- 'levy_notice', 'meeting_notice', 'invitation', 'maintenance_update'
  linked_entity_type TEXT,
  linked_entity_id UUID,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  bounced_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  external_id TEXT,  -- Resend/SendGrid message ID
  status TEXT CHECK (status IN ('queued', 'sent', 'delivered', 'bounced', 'failed'))
);

COMMENT ON TABLE email_log IS 'Email delivery tracking';
COMMENT ON COLUMN email_log.external_id IS 'Message ID from email service provider';
```

**Indexes:**
```sql
CREATE INDEX idx_email_log_recipient ON email_log(recipient_email);
CREATE INDEX idx_email_log_type ON email_log(email_type);
CREATE INDEX idx_email_log_linked_entity ON email_log(linked_entity_type, linked_entity_id);
CREATE INDEX idx_email_log_sent_at ON email_log(sent_at);
```

**RLS Policy:**
```sql
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY managers_only ON email_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM organisation_users 
      WHERE user_id = auth.uid() 
      AND role IN ('manager', 'admin')
    )
  );
```

---

## 9. RLS Policies

### 9.1 Helper Functions

```sql
-- Get current user's organisation ID
CREATE OR REPLACE FUNCTION auth.user_organisation_id() 
RETURNS UUID AS $$
  SELECT organisation_id 
  FROM organisation_users 
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get current user's role
CREATE OR REPLACE FUNCTION auth.user_role() 
RETURNS TEXT AS $$
  SELECT role 
  FROM organisation_users 
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user is a manager
CREATE OR REPLACE FUNCTION auth.is_manager() 
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM organisation_users 
    WHERE user_id = auth.uid() 
    AND role = 'manager'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Check if user is an owner
CREATE OR REPLACE FUNCTION auth.is_owner() 
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM owners 
    WHERE auth_user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Get owner's lot IDs
CREATE OR REPLACE FUNCTION auth.owner_lot_ids() 
RETURNS SETOF UUID AS $$
  SELECT lot_id 
  FROM lot_ownerships 
  WHERE owner_id IN (
    SELECT id FROM owners WHERE auth_user_id = auth.uid()
  )
  AND ownership_end_date IS NULL;
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

### 9.2 Standard Policy Pattern

```sql
-- Managers and admins: full access within their organisation
CREATE POLICY manager_access ON table_name
  FOR ALL USING (
    scheme_id IN (
      SELECT id FROM schemes WHERE organisation_id = auth.user_organisation_id()
    )
  );

-- Owners: read-only access to their own data
CREATE POLICY owner_access ON table_name
  FOR SELECT USING (
    lot_id IN (SELECT auth.owner_lot_ids())
  );

-- Auditors: read-only financial access
CREATE POLICY auditor_access ON table_name
  FOR SELECT USING (
    auth.user_role() = 'auditor' AND
    scheme_id IN (
      SELECT id FROM schemes WHERE organisation_id = auth.user_organisation_id()
    )
  );
```

---

## 10. Indexes

### 10.1 Performance Indexes

All critical foreign keys have indexes (listed in each table definition above).

### 10.2 Additional Composite Indexes

```sql
-- Levy management queries (frequently filtered together)
CREATE INDEX idx_levy_items_lot_status ON levy_items(lot_id, status);
CREATE INDEX idx_levy_items_period_status ON levy_items(levy_period_id, status);

-- Transaction reporting (date range + fund type)
CREATE INDEX idx_transactions_scheme_date_fund ON transactions(scheme_id, transaction_date, fund_type);

-- Maintenance request filtering
CREATE INDEX idx_maintenance_scheme_status ON maintenance_requests(scheme_id, status);

-- Meeting date lookups
CREATE INDEX idx_meetings_scheme_date ON meetings(scheme_id, meeting_date);

-- Document category filtering
CREATE INDEX idx_documents_scheme_category ON documents(scheme_id, category);
```

---

## 11. Triggers

### 11.1 Audit Triggers

See section 8.1 for `log_audit()` trigger function. Apply to all critical tables:

```sql
CREATE TRIGGER audit_schemes AFTER INSERT OR UPDATE OR DELETE ON schemes
  FOR EACH ROW EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_lots AFTER INSERT OR UPDATE OR DELETE ON lots
  FOR EACH ROW EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_owners AFTER INSERT OR UPDATE OR DELETE ON owners
  FOR EACH ROW EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_transactions AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_levy_items AFTER INSERT OR UPDATE OR DELETE ON levy_items
  FOR EACH ROW EXECUTE FUNCTION log_audit();

CREATE TRIGGER audit_meetings AFTER INSERT OR UPDATE OR DELETE ON meetings
  FOR EACH ROW EXECUTE FUNCTION log_audit();
```

### 11.2 Financial Triggers

```sql
-- Auto-create double-entry transaction lines (see section 4.4)
CREATE TRIGGER auto_create_transaction_lines
  AFTER INSERT ON transactions
  FOR EACH ROW EXECUTE FUNCTION create_transaction_lines();

-- Update levy item paid amount when payment allocated (see section 4.8)
CREATE TRIGGER auto_update_levy_paid
  AFTER INSERT OR UPDATE OR DELETE ON payment_allocations
  FOR EACH ROW EXECUTE FUNCTION update_levy_item_paid();

-- Update levy item status based on payment (see section 4.7)
CREATE TRIGGER auto_update_levy_status
  BEFORE INSERT OR UPDATE ON levy_items
  FOR EACH ROW EXECUTE FUNCTION update_levy_item_status();
```

### 11.3 Timestamp Triggers

```sql
-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at:
CREATE TRIGGER auto_update_schemes BEFORE UPDATE ON schemes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER auto_update_lots BEFORE UPDATE ON lots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER auto_update_owners BEFORE UPDATE ON owners
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- (Apply to all tables with updated_at column)
```

---

## 12. Entity Relationship Summary

### 12.1 Core Relationships

**Multi-Tenancy:**
- `organisations` ← one-to-many → `organisation_users` (via `user_id`)
- `organisations` ← one-to-many → `schemes`

**Schemes & Lots:**
- `schemes` ← one-to-many → `lots`
- `schemes` ← one-to-many → `financial_years`
- `schemes` ← one-to-many → `meetings`

**Ownership:**
- `lots` ← many-to-many → `owners` (via `lot_ownerships`)
- `owners` ← one-to-one (optional) → `auth.users` (via `auth_user_id`)

**Committee:**
- `schemes` + `owners` → many-to-many → `committee_members`

### 12.2 Financial Relationships

**Trust Accounting:**
- `schemes` ← one-to-many → `transactions`
- `transactions` ← one-to-many → `transaction_lines`
- `transactions` → many-to-one → `chart_of_accounts` (via `category_id`)

**Levies:**
- `schemes` → `levy_schedules` → `levy_periods` → `levy_items` (per lot)
- `levy_items` ← many-to-many → `transactions` (via `payment_allocations`)

**Budgets:**
- `schemes` + `financial_years` → `budgets` → `budget_line_items`
- `budget_line_items` → `chart_of_accounts`

**Bank Reconciliation:**
- `schemes` → `bank_statements` → `reconciliations`
- `transactions.bank_statement_id` → `bank_statements`

### 12.3 Meeting Relationships

**Meetings:**
- `schemes` ← one-to-many → `meetings`
- `meetings` ← one-to-many → `agenda_items`
- `meetings` ← one-to-many → `attendees`
- `meetings` ← one-to-many → `proxies`
- `meetings` ← one-to-many → `resolutions`
- `meetings` ← one-to-one → `minutes`

### 12.4 Maintenance Relationships

**Maintenance:**
- `schemes` + `lots` ← one-to-many → `maintenance_requests`
- `maintenance_requests` ← one-to-many → `maintenance_comments`
- `maintenance_requests` ← one-to-many → `quotes`
- `maintenance_requests` ← one-to-many → `invoices`
- `maintenance_requests` ← one-to-many → `maintenance_attachments`
- `quotes` + `invoices` → `tradespeople`
- `invoices.payment_reference` → `transactions`

### 12.5 Document Relationships

**Documents:**
- `schemes` ← one-to-many → `documents`
- `documents` ← one-to-many → `document_versions`
- `documents` ← one-to-many → `document_audit_log`
- `documents.linked_entity_type` + `linked_entity_id` → polymorphic links to:
  - `levy_items` (levy notices)
  - `meetings` (meeting documents)
  - `maintenance_requests` (photos, invoices)
  - Financial reports (generated PDFs)

### 12.6 System Relationships

**Audit & Security:**
- All tables → `audit_log` (via triggers)
- `documents` → `document_audit_log` (access tracking)
- `invitations` → `owners` or `auth.users` (when accepted)
- `email_log` → polymorphic links (levy notices, meeting notices)

---

## 13. Migration Strategy

### 13.1 Migration Order

1. **Core Structure:**
   - `organisations`
   - `organisation_users`
   - Helper functions (`auth.user_organisation_id()`, etc.)

2. **Schemes & Ownership:**
   - `schemes`
   - `lots`
   - `owners`
   - `lot_ownerships`
   - `committee_members`
   - `tenants`

3. **Financial Foundation:**
   - `chart_of_accounts` (with seed data)
   - `financial_years`
   - `transactions`
   - `transaction_lines`

4. **Levy System:**
   - `levy_schedules`
   - `levy_periods`
   - `levy_items`
   - `payment_allocations`

5. **Budgets & Reconciliation:**
   - `budgets`
   - `budget_line_items`
   - `bank_statements`
   - `reconciliations`

6. **Meetings:**
   - `meetings`
   - `agenda_items`
   - `attendees`
   - `proxies`
   - `resolutions`
   - `minutes`

7. **Maintenance:**
   - `tradespeople`
   - `maintenance_requests`
   - `maintenance_comments`
   - `quotes`
   - `invoices`
   - `maintenance_attachments`

8. **Documents:**
   - `documents`
   - `document_versions`
   - `document_audit_log`

9. **System:**
   - `audit_log`
   - `invitations`
   - `notifications`
   - `email_log`

10. **Triggers & Policies:**
    - Create all triggers
    - Enable RLS on all tables
    - Create all policies

### 13.2 Rollback Strategy

Each migration should have a corresponding rollback script:
- Drop tables in reverse order (respecting foreign key constraints)
- Drop triggers before dropping functions
- Drop policies before dropping helper functions

---

## 14. Maintenance & Updates

### 14.1 Schema Versioning

- All schema changes tracked in migration files: `migrations/YYYYMMDDHHMMSS_description.sql`
- Migration tool: Supabase Migrations CLI
- Version tracking: `schema_migrations` table (auto-created by Supabase)

### 14.2 Documentation Updates

This document must be updated when:
- New tables added
- New columns added to existing tables
- Relationships change
- RLS policies modified
- Triggers added/modified

**Update Process:**
1. Update this document
2. Create migration script
3. Test in development
4. Deploy to staging
5. Deploy to production

---

## Appendix A: Quick Reference

### Table Count by Category

- **Core:** 8 tables (organisations, organisation_users, schemes, lots, owners, lot_ownerships, committee_members, tenants)
- **Financial:** 12 tables (chart_of_accounts, financial_years, transactions, transaction_lines, levy_schedules, levy_periods, levy_items, payment_allocations, budgets, budget_line_items, bank_statements, reconciliations)
- **Meeting:** 6 tables (meetings, agenda_items, attendees, proxies, resolutions, minutes)
- **Maintenance:** 6 tables (maintenance_requests, maintenance_comments, tradespeople, quotes, invoices, maintenance_attachments)
- **Document:** 3 tables (documents, document_versions, document_audit_log)
- **System:** 4 tables (audit_log, invitations, notifications, email_log)

**Total:** 39 tables

### Key Foreign Key Patterns

- `scheme_id` → links to `schemes.id` (tenant isolation)
- `lot_id` → links to `lots.id` (lot-specific data)
- `owner_id` → links to `owners.id` (ownership)
- `user_id` → links to `auth.users.id` (user actions)
- `transaction_id` → links to `transactions.id` (financial)
- `meeting_id` → links to `meetings.id` (meeting data)

---

**END OF UNIFIED DATA MODEL**

*Last updated: 16 February 2026*
