# Feature Specification: Scheme & Lot Register

**Feature ID:** F-02  
**Version:** 1.0  
**Date:** 16 February 2026  
**Status:** Draft  
**Dependencies:** F-01 (Authentication & User Management)  
**Related Features:** F-03 (Levy Management), F-07 (Owner Portal), F-06 (Document Storage)

---

## 1. Overview

The Scheme & Lot Register is the **foundational data layer** for LevyLite. It provides the core entity management for strata schemes, lots, owners, and tenants. Every other feature in the platform (levies, trust accounting, meetings, documents, maintenance) depends on accurate scheme and lot data.

### Design Philosophy

1. **Single Source of Truth**: One canonical record for each scheme, lot, owner, and tenant
2. **Temporal Accuracy**: Track ownership history without losing historical data
3. **WA Compliance First**: Built around Strata Titles Act 1985 requirements (SP number format, entitlements, common property)
4. **Migration-Friendly**: CSV import to reduce friction moving from spreadsheets
5. **Audit Everything**: Every change to core records is logged with who/when/what

### User Stories

**As Sarah (Strata Manager)**, I need to:
- Create a new scheme record when I take on a new client
- Add/edit/remove lots with correct entitlements
- Link owners to lots (including joint ownership)
- Track tenant details for emergency contact
- Search across all schemes to find an owner or lot quickly
- Import 100+ lot records from a spreadsheet without manual data entry
- See who changed an owner's email address and when

**As Jenny (Self-Managed Treasurer)**, I need to:
- Set up my 10-lot scheme with minimal effort
- Update owner details when someone sells their unit
- Know which lots are owner-occupied vs. tenanted

**As an Owner (via Portal)**, I need to:
- See my lot number and entitlement
- Update my contact details (with manager approval)
- View other lot owners' names for community purposes (if scheme allows)

---

## 2. Data Model

### 2.1 Entity-Relationship Overview

```
schemes (1) ──< (many) lots
lots (1) ──< (many) lot_owners (junction table)
lot_owners >── (many) owners (1)
lots (1) ──< (many) tenants (optional)
```

**Key Principles:**
- A **scheme** has many **lots**
- A **lot** can have multiple **owners** (joint ownership)
- An **owner** can own multiple **lots** across multiple **schemes**
- A **lot** can have zero or more **tenants** (current tenant only, history tracked separately)
- **Entitlements** are stored at lot level (unit entitlement, voting entitlement)

### 2.2 Database Schema (PostgreSQL)

#### Table: `schemes`

```sql
-- Strata schemes (strata plans, community title schemes)
CREATE TABLE schemes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  
  -- Basic identification
  scheme_number VARCHAR(20) NOT NULL UNIQUE, -- e.g., SP 12345 (WA format)
  scheme_name VARCHAR(255) NOT NULL, -- e.g., "The Palms Strata"
  scheme_type VARCHAR(50) NOT NULL DEFAULT 'strata', -- strata, survey-strata, community
  
  -- Address
  street_address VARCHAR(255) NOT NULL,
  suburb VARCHAR(100) NOT NULL,
  state VARCHAR(3) NOT NULL DEFAULT 'WA', -- WA, NSW, VIC, QLD, SA, TAS, NT, ACT
  postcode VARCHAR(4) NOT NULL,
  
  -- Legal & financial
  abn VARCHAR(11), -- Australian Business Number (11 digits, no spaces)
  acn VARCHAR(9), -- Australian Company Number (if strata company)
  registered_name VARCHAR(255), -- Legal entity name
  
  -- Financial year
  financial_year_end_month SMALLINT NOT NULL DEFAULT 6, -- 1-12 (6 = June)
  financial_year_end_day SMALLINT NOT NULL DEFAULT 30, -- 1-31
  
  -- Levy schedule
  levy_frequency VARCHAR(20) NOT NULL DEFAULT 'quarterly', -- quarterly, annual, monthly, custom
  levy_due_day SMALLINT NOT NULL DEFAULT 1, -- Day of month levies are due (1-28)
  
  -- Common property details
  total_lot_entitlement INTEGER NOT NULL DEFAULT 0, -- Sum of all lot entitlements
  common_property_area_sqm DECIMAL(10,2), -- Total common property area
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, inactive, archived
  notes TEXT, -- Manager notes
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Constraints
  CONSTRAINT valid_scheme_number CHECK (scheme_number ~ '^SP\s?\d{4,6}$'), -- WA format
  CONSTRAINT valid_state CHECK (state IN ('WA','NSW','VIC','QLD','SA','TAS','NT','ACT')),
  CONSTRAINT valid_fy_month CHECK (financial_year_end_month BETWEEN 1 AND 12),
  CONSTRAINT valid_fy_day CHECK (financial_year_end_day BETWEEN 1 AND 31),
  CONSTRAINT valid_levy_frequency CHECK (levy_frequency IN ('monthly','quarterly','annual','custom')),
  CONSTRAINT valid_status CHECK (status IN ('active','inactive','archived'))
);

-- Indexes
CREATE INDEX idx_schemes_organisation ON schemes(organisation_id);
CREATE INDEX idx_schemes_status ON schemes(status);
CREATE INDEX idx_schemes_state ON schemes(state);
CREATE INDEX idx_schemes_search ON schemes USING gin(
  to_tsvector('english', 
    coalesce(scheme_name, '') || ' ' || 
    coalesce(scheme_number, '') || ' ' || 
    coalesce(street_address, '') || ' ' || 
    coalesce(suburb, '')
  )
);

-- Row-level security
ALTER TABLE schemes ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view schemes in their organisation
CREATE POLICY "tenant_isolation" ON schemes
  FOR ALL USING (organisation_id = auth.user_organisation_id());

-- Trigger: Update updated_at timestamp
CREATE TRIGGER set_schemes_updated_at
  BEFORE UPDATE ON schemes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger: Audit log
CREATE TRIGGER schemes_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON schemes
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_trigger();
```

#### Table: `lots`

```sql
-- Lots within a strata scheme
CREATE TABLE lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  
  -- Lot identification
  lot_number VARCHAR(20) NOT NULL, -- e.g., "1", "12A", "G01" (parking)
  unit_number VARCHAR(20), -- Street unit number if different from lot number
  
  -- Address (if different from scheme address)
  street_address VARCHAR(255), -- For multi-building schemes
  
  -- Lot type
  lot_type VARCHAR(50) NOT NULL DEFAULT 'residential', -- residential, commercial, parking, storage
  
  -- Entitlements (for levy calculation and voting)
  unit_entitlement INTEGER NOT NULL, -- Proportional share for levies
  voting_entitlement INTEGER, -- Voting power (often = unit entitlement)
  
  -- Physical details
  floor_area_sqm DECIMAL(8,2), -- Internal floor area
  balcony_area_sqm DECIMAL(8,2),
  total_area_sqm DECIMAL(8,2), -- Total area including balcony
  bedrooms SMALLINT,
  bathrooms DECIMAL(2,1), -- 1.5 for half bath
  car_bays SMALLINT,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, inactive, sold (pending settlement)
  occupancy_status VARCHAR(20) DEFAULT 'owner-occupied', -- owner-occupied, tenanted, vacant
  
  -- Manager notes
  notes TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Constraints
  CONSTRAINT unique_lot_per_scheme UNIQUE(scheme_id, lot_number),
  CONSTRAINT valid_lot_type CHECK (lot_type IN ('residential','commercial','parking','storage','other')),
  CONSTRAINT valid_lot_status CHECK (status IN ('active','inactive','sold')),
  CONSTRAINT valid_occupancy CHECK (occupancy_status IN ('owner-occupied','tenanted','vacant','unknown')),
  CONSTRAINT positive_entitlement CHECK (unit_entitlement > 0)
);

-- Indexes
CREATE INDEX idx_lots_scheme ON lots(scheme_id);
CREATE INDEX idx_lots_status ON lots(status);
CREATE INDEX idx_lots_type ON lots(lot_type);
CREATE INDEX idx_lots_lot_number ON lots(lot_number); -- For quick lookups

-- Row-level security
ALTER TABLE lots ENABLE ROW LEVEL SECURITY;

-- Policy: Users can access lots in their organisation's schemes
CREATE POLICY "tenant_isolation" ON lots
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM schemes
      WHERE schemes.id = lots.scheme_id
      AND schemes.organisation_id = auth.user_organisation_id()
    )
  );

-- Triggers
CREATE TRIGGER set_lots_updated_at
  BEFORE UPDATE ON lots
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER lots_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON lots
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_trigger();

-- Trigger: Update scheme total_lot_entitlement when lot entitlement changes
CREATE OR REPLACE FUNCTION update_scheme_total_entitlement()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE schemes
  SET total_lot_entitlement = (
    SELECT COALESCE(SUM(unit_entitlement), 0)
    FROM lots
    WHERE scheme_id = COALESCE(NEW.scheme_id, OLD.scheme_id)
    AND status = 'active'
  )
  WHERE id = COALESCE(NEW.scheme_id, OLD.scheme_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_total_entitlement
  AFTER INSERT OR UPDATE OR DELETE ON lots
  FOR EACH ROW
  EXECUTE FUNCTION update_scheme_total_entitlement();
```

#### Table: `owners`

```sql
-- Owner/proprietor records (shared across schemes)
CREATE TABLE owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Personal details
  title VARCHAR(10), -- Mr, Ms, Mrs, Dr, Prof
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  middle_name VARCHAR(100),
  preferred_name VARCHAR(100), -- Nickname if different
  
  -- Contact details
  email VARCHAR(255), -- Primary email
  email_secondary VARCHAR(255),
  phone_mobile VARCHAR(20),
  phone_home VARCHAR(20),
  phone_work VARCHAR(20),
  
  -- Postal address (if different from lot address)
  postal_address_line1 VARCHAR(255),
  postal_address_line2 VARCHAR(255),
  postal_suburb VARCHAR(100),
  postal_state VARCHAR(3),
  postal_postcode VARCHAR(4),
  postal_country VARCHAR(100) DEFAULT 'Australia',
  
  -- Legal/tax
  abn VARCHAR(11), -- If owner is a company/trust
  company_name VARCHAR(255), -- If corporate owner
  
  -- Correspondence preferences
  correspondence_method VARCHAR(20) DEFAULT 'email', -- email, postal, both
  correspondence_language VARCHAR(10) DEFAULT 'en', -- en, zh, vi, ar, etc.
  
  -- Portal access
  portal_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  portal_invite_sent_at TIMESTAMPTZ,
  portal_invite_accepted_at TIMESTAMPTZ,
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active, inactive, deceased
  notes TEXT, -- Manager notes
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  -- Constraints
  CONSTRAINT valid_correspondence_method CHECK (correspondence_method IN ('email','postal','both')),
  CONSTRAINT valid_owner_status CHECK (status IN ('active','inactive','deceased')),
  CONSTRAINT email_or_postal_required CHECK (
    email IS NOT NULL OR postal_address_line1 IS NOT NULL
  )
);

-- Indexes
CREATE INDEX idx_owners_email ON owners(email) WHERE email IS NOT NULL;
CREATE INDEX idx_owners_status ON owners(status);
CREATE INDEX idx_owners_name ON owners(last_name, first_name);
CREATE INDEX idx_owners_search ON owners USING gin(
  to_tsvector('english',
    coalesce(first_name, '') || ' ' ||
    coalesce(last_name, '') || ' ' ||
    coalesce(email, '') || ' ' ||
    coalesce(company_name, '')
  )
);

-- Row-level security
ALTER TABLE owners ENABLE ROW LEVEL SECURITY;

-- Policy: Managers can see owners in their organisation
CREATE POLICY "tenant_isolation" ON owners
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM lot_ownerships
      JOIN lots ON lots.id = lot_ownerships.lot_id
      JOIN schemes ON schemes.id = lots.scheme_id
      WHERE lot_ownerships.owner_id = owners.id
      AND schemes.organisation_id = auth.user_organisation_id()
    ) OR
    auth_user_id = auth.uid() -- Owners can see their own record
  );

-- Triggers
CREATE TRIGGER set_owners_updated_at
  BEFORE UPDATE ON owners
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER owners_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON owners
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_trigger();
```

#### Table: `lot_ownerships` (Junction Table)

```sql
-- Junction table for many-to-many relationship between lots and owners
CREATE TABLE lot_ownerships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  
  -- Ownership details
  ownership_type VARCHAR(50) NOT NULL DEFAULT 'sole', -- sole, joint-tenants, tenants-in-common
  ownership_percentage DECIMAL(5,2) DEFAULT 100.00, -- For tenants-in-common (e.g., 50.00)
  
  -- Dates
  ownership_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  ownership_end_date DATE, -- NULL = current owner
  
  -- Primary contact for this lot (for joint ownership)
  is_primary_contact BOOLEAN DEFAULT TRUE,
  
  -- Correspondence for this lot
  receive_levy_notices BOOLEAN DEFAULT TRUE,
  receive_meeting_notices BOOLEAN DEFAULT TRUE,
  receive_maintenance_updates BOOLEAN DEFAULT FALSE,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT unique_current_lot_owner UNIQUE(lot_id, owner_id, ownership_end_date) 
    DEFERRABLE INITIALLY DEFERRED, -- Allow updates during ownership transfer
  CONSTRAINT valid_ownership_type CHECK (ownership_type IN ('sole','joint-tenants','tenants-in-common')),
  CONSTRAINT valid_ownership_percentage CHECK (ownership_percentage > 0 AND ownership_percentage <= 100),
  CONSTRAINT valid_date_range CHECK (
    ownership_end_date IS NULL OR ownership_end_date >= ownership_start_date
  )
);

-- Indexes
CREATE INDEX idx_lot_ownerships_lot ON lot_ownerships(lot_id);
CREATE INDEX idx_lot_ownerships_owner ON lot_ownerships(owner_id);
CREATE INDEX idx_lot_ownerships_current ON lot_ownerships(lot_id, owner_id) 
  WHERE ownership_end_date IS NULL; -- Current owners

-- Row-level security
ALTER TABLE lot_ownerships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view lot_ownerships for their schemes" ON lot_ownerships
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lots
      JOIN schemes ON schemes.id = lots.scheme_id
      WHERE lots.id = lot_ownerships.lot_id
      AND (organisation_id = auth.user_organisation_id() OR EXISTS (
        SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'super_admin')
      ))
    ) OR
    EXISTS (
      SELECT 1 FROM owners WHERE owners.id = lot_ownerships.owner_id AND owners.auth_user_id = auth.uid()
    )
  );

-- Triggers
CREATE TRIGGER set_lot_ownerships_updated_at
  BEFORE UPDATE ON lot_ownerships
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER lot_ownerships_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON lot_ownerships
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_trigger();
```

#### Table: `tenants`

```sql
-- Tenant records (optional, for maintenance/emergency contact)
CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  
  -- Personal details
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  
  -- Contact details
  email VARCHAR(255),
  phone_mobile VARCHAR(20),
  phone_work VARCHAR(20),
  
  -- Lease details
  lease_start_date DATE,
  lease_end_date DATE,
  lease_type VARCHAR(50), -- fixed-term, periodic, short-term
  
  -- Emergency contact
  emergency_contact_name VARCHAR(200),
  emergency_contact_phone VARCHAR(20),
  emergency_contact_relationship VARCHAR(100), -- parent, partner, friend
  
  -- Pets (for strata by-law compliance)
  has_pets BOOLEAN DEFAULT FALSE,
  pet_details TEXT, -- e.g., "1 small dog (Maltese)"
  
  -- Vehicle (for parking management)
  vehicle_make VARCHAR(100),
  vehicle_model VARCHAR(100),
  vehicle_rego VARCHAR(20),
  vehicle_color VARCHAR(50),
  
  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'current', -- current, past, pending
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_tenant_status CHECK (status IN ('current','past','pending')),
  CONSTRAINT valid_lease_dates CHECK (
    lease_end_date IS NULL OR lease_end_date >= lease_start_date
  )
);

-- Indexes
CREATE INDEX idx_tenants_lot ON tenants(lot_id);
CREATE INDEX idx_tenants_status ON tenants(status);
CREATE INDEX idx_tenants_current ON tenants(lot_id) WHERE status = 'current';

-- Row-level security
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view tenants for their schemes" ON tenants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM lots
      JOIN schemes ON schemes.id = lots.scheme_id
      WHERE lots.id = tenants.lot_id
      AND schemes.manager_id = auth.uid()
    )
  );

-- Triggers
CREATE TRIGGER set_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER tenants_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON tenants
  FOR EACH ROW
  EXECUTE FUNCTION audit_log_trigger();
```

#### Supporting Functions

```sql
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  NEW.updated_by = auth.uid();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Audit log table
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  operation VARCHAR(10) NOT NULL, -- INSERT, UPDATE, DELETE
  old_data JSONB,
  new_data JSONB,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_changed_at ON audit_log(changed_at);

-- Audit log trigger function
CREATE OR REPLACE FUNCTION audit_log_trigger()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, record_id, operation, old_data, changed_by)
    VALUES (TG_TABLE_NAME, OLD.id, 'DELETE', row_to_json(OLD)::jsonb, auth.uid());
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, record_id, operation, old_data, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'UPDATE', row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb, auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, record_id, operation, new_data, changed_by)
    VALUES (TG_TABLE_NAME, NEW.id, 'INSERT', row_to_json(NEW)::jsonb, auth.uid());
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;
```

---

## 3. Scheme Setup Flow

### 3.1 User Journey: Creating a New Scheme

**Step 1: Basic Details**
- Scheme number (validated: SP XXXXX format)
- Scheme name
- Street address, suburb, state, postcode
- Scheme type (strata, survey-strata, community)

**Step 2: Legal & Financial**
- ABN (optional, validated: 11 digits)
- ACN (optional, validated: 9 digits)
- Registered legal name (optional)
- Financial year end date (month + day)
- Levy frequency (quarterly, annual, monthly, custom)
- Levy due day (1-28, e.g., 1st of each quarter)

**Step 3: Lot Configuration**
- "How many lots are in this scheme?" (number input)
- Option A: "Add lots manually" (skip to lot entry form)
- Option B: "Import from CSV" (jump to CSV import flow)
- Option C: "I'll add lots later" (create scheme with 0 lots)

**Step 4: Review & Create**
- Summary of entered details
- "Create Scheme" button
- Redirect to scheme detail page

### 3.2 Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| `scheme_number` | Must match `^SP\s?\d{4,6}$` | "Scheme number must be in format 'SP 12345'" |
| `scheme_number` | Must be unique | "This scheme number already exists" |
| `scheme_name` | Required, 3-255 chars | "Scheme name is required" |
| `street_address` | Required | "Street address is required" |
| `suburb` | Required | "Suburb is required" |
| `state` | Must be valid AU state code | "Please select a valid state" |
| `postcode` | Must be 4 digits | "Postcode must be 4 digits" |
| `abn` | If provided, must be 11 digits | "ABN must be 11 digits (no spaces)" |
| `acn` | If provided, must be 9 digits | "ACN must be 9 digits" |
| `financial_year_end_month` | 1-12 | "Invalid month" |
| `financial_year_end_day` | 1-31 | "Invalid day" |
| `levy_frequency` | One of: monthly, quarterly, annual, custom | "Invalid levy frequency" |
| `levy_due_day` | 1-28 (avoid month-end edge cases) | "Levy due day must be between 1-28" |

### 3.3 Server Action: `createScheme`

```typescript
// app/actions/schemes.ts
'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const schemeSchema = z.object({
  scheme_number: z.string().regex(/^SP\s?\d{4,6}$/, 'Invalid scheme number format'),
  scheme_name: z.string().min(3).max(255),
  scheme_type: z.enum(['strata', 'survey-strata', 'community']),
  street_address: z.string().min(1),
  suburb: z.string().min(1),
  state: z.enum(['WA', 'NSW', 'VIC', 'QLD', 'SA', 'TAS', 'NT', 'ACT']),
  postcode: z.string().regex(/^\d{4}$/, 'Postcode must be 4 digits'),
  abn: z.string().regex(/^\d{11}$/).optional().nullable(),
  acn: z.string().regex(/^\d{9}$/).optional().nullable(),
  registered_name: z.string().max(255).optional().nullable(),
  financial_year_end_month: z.number().min(1).max(12),
  financial_year_end_day: z.number().min(1).max(31),
  levy_frequency: z.enum(['monthly', 'quarterly', 'annual', 'custom']),
  levy_due_day: z.number().min(1).max(28),
  notes: z.string().optional().nullable()
})

export async function createScheme(data: z.infer<typeof schemeSchema>) {
  const supabase = createClient()
  
  // Validate input
  const validated = schemeSchema.parse(data)
  
  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return { error: 'Unauthorized' }
  }
  
  // Check for duplicate scheme number
  const { data: existing } = await supabase
    .from('schemes')
    .select('id')
    .eq('scheme_number', validated.scheme_number)
    .single()
  
  if (existing) {
    return { error: 'Scheme number already exists' }
  }
  
  // Create scheme
  const { data: scheme, error } = await supabase
    .from('schemes')
    .insert({
      ...validated,
      manager_id: user.id,
      management_start_date: new Date().toISOString().split('T')[0],
      created_by: user.id
    })
    .select()
    .single()
  
  if (error) {
    console.error('Error creating scheme:', error)
    return { error: 'Failed to create scheme' }
  }
  
  revalidatePath('/dashboard/schemes')
  return { data: scheme }
}
```

---

## 4. Lot Management

### 4.1 Add/Edit Lot Form

**Required Fields:**
- Lot number (e.g., "1", "12A", "G01")
- Unit entitlement (positive integer)
- Lot type (residential, commercial, parking, storage, other)

**Optional Fields:**
- Unit number (if different from lot number)
- Street address (for multi-building schemes)
- Voting entitlement (defaults to unit entitlement if blank)
- Floor area (sqm)
- Balcony area (sqm)
- Bedrooms
- Bathrooms
- Car bays
- Notes

**Bulk Actions:**
- "Add Multiple Lots" → Quick form: enter lot numbers 1-20, auto-calculate equal entitlements
- "Import from CSV" → Upload spreadsheet

### 4.2 Validation Rules

| Field | Rule | Error Message |
|-------|------|---------------|
| `lot_number` | Required, unique per scheme | "Lot number must be unique within this scheme" |
| `unit_entitlement` | Required, integer > 0 | "Unit entitlement must be a positive number" |
| `voting_entitlement` | If provided, integer > 0 | "Voting entitlement must be positive" |
| `floor_area_sqm` | If provided, > 0 | "Floor area must be positive" |
| `bedrooms` | If provided, integer ≥ 0 | "Bedrooms must be a whole number" |
| `bathrooms` | If provided, ≥ 0 | "Bathrooms must be a positive number" |

### 4.3 Entitlement Calculation Helper

**Feature:** Auto-calculate equal entitlements when creating multiple lots

Example: Create 20 lots with equal entitlements
- User enters: "Lots 1-20, equal entitlements"
- System calculates: Each lot gets unit_entitlement = 1, total = 20
- Alternative: Each lot gets 1/20 (as fraction) → store as integers (e.g., 5% = entitlement 5, total 100)

**WA Note:** Unit entitlements must sum to total_lot_entitlement (stored on scheme record). System recalculates total whenever lot entitlement changes.

---

## 5. Owner Management

### 5.1 Add/Edit Owner Form

**Required Fields:**
- First name
- Last name
- At least one contact method (email OR postal address)

**Optional Fields:**
- Title (Mr, Ms, Mrs, Dr)
- Middle name
- Preferred name
- Secondary email
- Phone (mobile, home, work)
- Postal address (if different from lot)
- ABN (for corporate owners)
- Company name (for corporate owners)
- Correspondence preferences (email, postal, both)
- Language preference

**Link to Lot:**
- After creating owner, "Link to Lot" button
- Select lot(s) from dropdown
- For each lot, specify (stored in `lot_ownerships` table):
  - Ownership type (sole, joint-tenants, tenants-in-common)
  - Ownership percentage (if tenants-in-common)
  - Ownership start date
  - Is primary contact? (for joint ownership)
  - Correspondence preferences (receive levy notices, meeting notices, maintenance updates)

### 5.2 Joint Ownership Workflow

**Scenario:** Lot 5 is owned jointly by John Smith and Jane Doe (50/50 tenants-in-common)

**Step 1:** Create owner records for both John and Jane

**Step 2:** Link both to Lot 5 via `lot_owners` table
- John: ownership_type = 'tenants-in-common', ownership_percentage = 50.00, is_primary_contact = true
- Jane: ownership_type = 'tenants-in-common', ownership_percentage = 50.00, is_primary_contact = false

**Step 3:** Levy notices are sent to:
- John (primary contact) by default
- Jane if her `receive_levy_notices` = true

### 5.3 Owner History (Temporal Records)

**Feature:** Track previous owners without deleting records

**Workflow: Lot 3 is sold from Alice to Bob**

1. Manager creates new owner record for Bob
2. Manager links Bob to Lot 3:
   - Set `ownership_start_date` = settlement date
3. System automatically sets Alice's `ownership_end_date` = settlement date
4. Alice's record remains in database (historical record)
5. Query for "current owners" filters `WHERE ownership_end_date IS NULL`

**Benefit:** Can generate historical reports ("Who owned Lot 3 in 2022?") and maintain audit trail for 7+ years.

---

## 6. Tenant Management

### 6.1 Add/Edit Tenant Form

**Required Fields:**
- First name
- Last name
- Link to lot

**Optional Fields:**
- Email
- Phone (mobile, work)
- Lease start/end dates
- Lease type (fixed-term, periodic, short-term)
- Emergency contact details
- Pets (yes/no + description)
- Vehicle details (make, model, rego, color)

**Use Case:** Manager stores tenant details for:
- Maintenance requests (tenant reports broken tap)
- Emergency contact (fire alarm goes off, contact tenant)
- Parking enforcement (check vehicle rego against lot)
- Pet by-law compliance (scheme allows 1 small dog per lot)

**Not in Scope:** Rent collection, bond management (this is property management, not strata management)

---

## 7. CSV Import

### 7.1 Import Flow

**Step 1: Download Template**
- Button: "Download CSV Template"
- Generates `scheme-lots-template.csv` with headers and example row

**Step 2: Upload CSV**
- Drag-and-drop zone or file picker
- Client-side validation (file size < 5MB, correct columns)

**Step 3: Preview & Validate**
- Show first 10 rows in table
- Highlight errors:
  - Missing required fields (lot_number, unit_entitlement)
  - Duplicate lot numbers
  - Invalid data types (entitlement is not a number)
- Show warnings:
  - Unusual values (entitlement > 1000, floor area > 500sqm)

**Step 4: Confirm Import**
- "Import X lots" button
- Progress bar (for large imports)

**Step 5: Result Summary**
- "Successfully imported 48 lots"
- "Skipped 2 lots due to errors" (show error details)
- Option to download error log CSV

### 7.2 CSV Template Format

**File:** `scheme-lots-template.csv`

```csv
lot_number,unit_number,lot_type,unit_entitlement,voting_entitlement,floor_area_sqm,bedrooms,bathrooms,car_bays,owner_first_name,owner_last_name,owner_email,owner_phone,owner_postal_address,notes
1,1,residential,5,5,85.5,2,1,1,John,Smith,john.smith@example.com,0412345678,"123 Main St, Perth WA 6000",
2,2,residential,5,5,85.5,2,1,1,Jane,Doe,jane.doe@example.com,0498765432,"456 Other St, Perth WA 6000",
G01,,parking,1,1,,,,,John,Smith,john.smith@example.com,0412345678,,Parking bay for Lot 1
```

**Headers (Required):**
- `lot_number` (required)
- `unit_entitlement` (required)

**Headers (Optional):**
- `unit_number`
- `lot_type` (defaults to 'residential')
- `voting_entitlement` (defaults to unit_entitlement)
- `floor_area_sqm`
- `bedrooms`
- `bathrooms`
- `car_bays`
- `owner_first_name` (if provided, creates owner record and links to lot)
- `owner_last_name`
- `owner_email`
- `owner_phone`
- `owner_postal_address`
- `notes`

### 7.3 Import Validation Rules

**Row-level validation:**
- `lot_number`: Required, must be unique within this import + existing lots
- `unit_entitlement`: Required, must be positive integer
- `lot_type`: If provided, must be one of: residential, commercial, parking, storage, other
- `floor_area_sqm`: If provided, must be positive number
- `bedrooms`, `bathrooms`, `car_bays`: If provided, must be non-negative numbers
- `owner_email`: If provided, must be valid email format
- `owner_phone`: If provided, must be valid phone format

**Owner de-duplication:**
- If owner with same first_name + last_name + email already exists → link to existing owner
- Otherwise, create new owner record

**Error Handling:**
- **Hard errors** (skip row): Missing lot_number, duplicate lot_number, invalid data type
- **Warnings** (import anyway): Missing owner details, unusual values

### 7.4 Server Action: `importLotsFromCSV`

```typescript
// app/actions/import.ts
'use server'

import { createClient } from '@/utils/supabase/server'
import { parse } from 'csv-parse/sync'

export async function importLotsFromCSV(schemeId: string, csvData: string) {
  const supabase = createClient()
  
  // Parse CSV
  const rows = parse(csvData, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  })
  
  const results = {
    success: 0,
    skipped: 0,
    errors: [] as { row: number; message: string }[]
  }
  
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    
    try {
      // Validate required fields
      if (!row.lot_number || !row.unit_entitlement) {
        results.errors.push({ row: i + 2, message: 'Missing lot_number or unit_entitlement' })
        results.skipped++
        continue
      }
      
      // Check for duplicate lot number
      const { data: existing } = await supabase
        .from('lots')
        .select('id')
        .eq('scheme_id', schemeId)
        .eq('lot_number', row.lot_number)
        .single()
      
      if (existing) {
        results.errors.push({ row: i + 2, message: `Lot ${row.lot_number} already exists` })
        results.skipped++
        continue
      }
      
      // Create lot
      const { error: lotError } = await supabase.from('lots').insert({
        scheme_id: schemeId,
        lot_number: row.lot_number,
        unit_number: row.unit_number || null,
        lot_type: row.lot_type || 'residential',
        unit_entitlement: parseInt(row.unit_entitlement),
        voting_entitlement: row.voting_entitlement ? parseInt(row.voting_entitlement) : parseInt(row.unit_entitlement),
        floor_area_sqm: row.floor_area_sqm ? parseFloat(row.floor_area_sqm) : null,
        bedrooms: row.bedrooms ? parseInt(row.bedrooms) : null,
        bathrooms: row.bathrooms ? parseFloat(row.bathrooms) : null,
        car_bays: row.car_bays ? parseInt(row.car_bays) : null,
        notes: row.notes || null
      })
      
      if (lotError) {
        results.errors.push({ row: i + 2, message: lotError.message })
        results.skipped++
        continue
      }
      
      // TODO: Handle owner creation/linking if owner_* fields provided
      
      results.success++
    } catch (err) {
      results.errors.push({ row: i + 2, message: String(err) })
      results.skipped++
    }
  }
  
  return results
}
```

---

## 8. Search & Filtering

### 8.1 Global Search

**Search Box** (top of dashboard):
- Searches across schemes, lots, owners
- Uses PostgreSQL full-text search (GIN index on `tsvector` columns)
- Autocomplete suggestions (top 5 results)

**Example Queries:**
- "SP 12345" → finds scheme
- "John Smith" → finds owner and their lots
- "Lot 7" → finds all lots numbered 7 across all schemes
- "The Palms" → finds scheme by name
- "Perth" → finds all schemes in Perth

### 8.2 Scheme List Filters

**Filter Options:**
- State (dropdown: All, WA, NSW, VIC, etc.)
- Status (active, inactive, archived)
- Manager (if admin viewing all schemes)

**Sort Options:**
- Scheme name (A-Z, Z-A)
- Scheme number
- Created date (newest, oldest)
- Number of lots (most, fewest)

### 8.3 Lot List Filters (within scheme)

**Filter Options:**
- Lot type (all, residential, commercial, parking, storage)
- Occupancy status (all, owner-occupied, tenanted, vacant)
- Arrears status (all, current, overdue) — requires join with levy data

**Sort Options:**
- Lot number (numeric sort: 1, 2, 10, not 1, 10, 2)
- Unit entitlement (high to low, low to high)
- Owner name (A-Z)

---

## 9. WA-Specific Requirements

### 9.1 Strata Titles Act 1985 Compliance

**Scheme Plan Number Format:**
- Must be "SP" followed by 4-6 digits (e.g., SP 12345, SP 123456)
- Validated via regex: `^SP\s?\d{4,6}$`
- Database constraint enforces format

**Unit Entitlements:**
- Required for every lot
- Used to calculate levy liability proportionally
- Sum of all lot entitlements = `total_lot_entitlement` (stored on scheme)
- Cannot be zero or negative

**Common Property:**
- Not a separate "lot" in database
- Area stored as `common_property_area_sqm` on scheme record
- Maintenance costs allocated across all lots based on unit entitlement

### 9.2 WA vs. Other States (Future Expansion)

| Requirement | WA | NSW | VIC | Implementation |
|-------------|-------|-----|-----|----------------|
| Plan number format | SP XXXXX | SP XXXXX, DP XXXXX | PS XXXXX | Regex varies by state (stored in `schemes.state` field) |
| Entitlements | Unit entitlement | Unit entitlement + lot liability | Lot entitlement + lot liability | MVP: single `unit_entitlement` field (expand later) |
| Voting | 1 lot = 1 vote (or unit entitlement) | Unit entitlement | Lot entitlement | `voting_entitlement` field (defaults to unit_entitlement) |
| AGM notice period | 14 days | 7 days | Not specified | Not enforced in database (handled by meeting module) |

**MVP Decision:** Build for WA first. Add multi-state validation in Phase 3.

---

## 10. Audit Trail

### 10.1 Audit Log Table

All changes to `schemes`, `lots`, `owners`, `lot_owners`, and `tenants` are logged via trigger (see SQL above).

**Logged Data:**
- Table name
- Record ID
- Operation (INSERT, UPDATE, DELETE)
- Old data (JSON snapshot before change)
- New data (JSON snapshot after change)
- Changed by (user ID)
- Changed at (timestamp)

**Retention:** 7 years minimum (regulatory requirement)

### 10.2 Audit Log UI

**Location:** Scheme detail page → "Activity Log" tab

**Display:**
- Reverse chronological list (newest first)
- Filter by date range, user, operation type
- Each entry shows:
  - Timestamp
  - User name (e.g., "Sarah Thompson")
  - Action (e.g., "Updated lot 5", "Added owner John Smith")
  - Changed fields (e.g., "Email: old@example.com → new@example.com")

**Example:**
```
2026-02-15 14:32 - Sarah Thompson updated Lot 5
  Changed: unit_entitlement 5 → 6, floor_area_sqm 85.5 → 87.2

2026-02-15 10:15 - Sarah Thompson added owner John Smith
  Email: john.smith@example.com, Phone: 0412345678

2026-02-14 16:45 - Sarah Thompson deleted Lot 999
  (Lot created by mistake)
```

---

## 11. UI Components

### 11.1 Scheme List Page

**URL:** `/dashboard/schemes`

**Layout:**
- Header: "Schemes" + "Create Scheme" button
- Search box (global search)
- Filters: State, Status, Sort by
- Scheme cards/table:
  - Scheme name + number
  - Address (suburb, state)
  - Lot count
  - Status badge (active/inactive)
  - Quick actions: View, Edit, Archive

**Mobile:** Card view (stacked). Desktop: Table view (sortable columns).

### 11.2 Scheme Detail Page

**URL:** `/dashboard/schemes/[id]`

**Tabs:**
- **Overview:** Scheme details, address, manager, financial year, levy schedule
- **Lots:** Lot table with search/filter (lot number, owner, entitlement, type)
- **Owners:** Owner directory (name, contact, lot numbers)
- **Activity Log:** Audit trail

**Overview Tab:**
- Editable fields (inline edit or "Edit Scheme" button)
- Key stats: Total lots, Total unit entitlement, Active owners, Tenanted lots

**Lots Tab:**
- Table columns: Lot #, Unit #, Type, Entitlement, Owner(s), Occupancy, Actions
- "Add Lot" button
- "Import CSV" button
- Bulk select + bulk actions (e.g., mark multiple lots as tenanted)

**Owners Tab:**
- Table columns: Name, Email, Phone, Lot(s), Portal Access, Actions
- "Add Owner" button
- Click owner name → Owner detail modal

### 11.3 Lot Detail Modal

**Triggered by:** Clicking lot number in table

**Sections:**
- **Lot Details:** Lot number, unit number, type, entitlements, floor area, bedrooms, bathrooms, car bays
- **Current Owner(s):** Name, ownership type, percentage, contact details, "Edit" button
- **Tenant:** Name, contact, lease dates, "Edit Tenant" button
- **History:** Previous owners (ownership_end_date is not null)
- **Actions:** Edit Lot, Delete Lot

### 11.4 Owner Profile Page

**URL:** `/dashboard/owners/[id]`

**Sections:**
- **Personal Details:** Name, email, phone, postal address, "Edit" button
- **Lots Owned:** Table of lots across all schemes (Scheme, Lot #, Entitlement, Ownership %)
- **Portal Access:** Status (invited, active, never invited), "Send Portal Invite" button
- **Correspondence Preferences:** Email, postal, language, "Update Preferences"
- **Activity Log:** Changes to this owner record

---

## 12. API Endpoints / Server Actions

All data operations use **Next.js Server Actions** (not REST API) for simplicity and type safety.

| Action | File | Purpose |
|--------|------|---------|
| `createScheme` | `app/actions/schemes.ts` | Create new scheme |
| `updateScheme` | `app/actions/schemes.ts` | Update scheme details |
| `deleteScheme` | `app/actions/schemes.ts` | Soft delete (set status = 'archived') |
| `getSchemes` | `app/actions/schemes.ts` | List schemes (with filters) |
| `getSchemeById` | `app/actions/schemes.ts` | Get single scheme + lots + owners |
| `createLot` | `app/actions/lots.ts` | Create new lot |
| `updateLot` | `app/actions/lots.ts` | Update lot details |
| `deleteLot` | `app/actions/lots.ts` | Delete lot (cascades to lot_owners) |
| `importLotsFromCSV` | `app/actions/import.ts` | Bulk import lots |
| `createOwner` | `app/actions/owners.ts` | Create owner record |
| `updateOwner` | `app/actions/owners.ts` | Update owner details |
| `linkOwnerToLot` | `app/actions/owners.ts` | Create lot_owners record |
| `transferOwnership` | `app/actions/owners.ts` | End old ownership, start new (atomic transaction) |
| `createTenant` | `app/actions/tenants.ts` | Add tenant to lot |
| `updateTenant` | `app/actions/tenants.ts` | Update tenant details |
| `deleteTenant` | `app/actions/tenants.ts` | Mark tenant as 'past' |
| `searchAll` | `app/actions/search.ts` | Global search (schemes, lots, owners) |
| `getAuditLog` | `app/actions/audit.ts` | Retrieve audit log for a record |

**Example Server Action: transferOwnership**

```typescript
// app/actions/owners.ts
'use server'

import { createClient } from '@/utils/supabase/server'

export async function transferOwnership(
  lotId: string,
  oldOwnerId: string,
  newOwnerId: string,
  transferDate: string
) {
  const supabase = createClient()
  
  // Begin transaction (Supabase uses implicit transactions for batched operations)
  
  // Step 1: End old ownership
  const { error: endError } = await supabase
    .from('lot_ownerships')
    .update({ ownership_end_date: transferDate })
    .eq('lot_id', lotId)
    .eq('owner_id', oldOwnerId)
    .is('ownership_end_date', null)
  
  if (endError) {
    return { error: 'Failed to end old ownership' }
  }
  
  // Step 2: Start new ownership
  const { error: startError } = await supabase
    .from('lot_ownerships')
    .insert({
      lot_id: lotId,
      owner_id: newOwnerId,
      ownership_start_date: transferDate,
      ownership_type: 'sole', // Default, can be changed later
      ownership_percentage: 100,
      is_primary_contact: true
    })
  
  if (startError) {
    return { error: 'Failed to create new ownership' }
  }
  
  return { success: true }
}
```

---

## 13. Dependencies on Other Features

| Feature | Dependency | Description |
|---------|------------|-------------|
| **Levy Management** (F-03) | Scheme & Lot Register | Requires lot entitlements to calculate levy amounts |
| **Trust Accounting** (F-04) | Scheme & Lot Register | Ledger accounts created per scheme, transactions linked to lots |
| **Owner Portal** (F-07) | Scheme & Lot Register | Owners log in to see their lots, balances, documents |
| **Document Storage** (F-06) | Scheme & Lot Register | Documents tagged to schemes, lots, owners |
| **Maintenance Requests** (F-08) | Scheme & Lot Register | Requests linked to lots and tenants |
| **Meeting Administration** (F-05) | Scheme & Lot Register | AGM notices sent to all current owners |

**Critical Path:** Scheme & Lot Register must be built first. Other features build on top.

---

## 14. Validation & Business Rules

### 14.1 Data Integrity Rules

1. **Scheme must exist before lots:** Lots cannot be created without a valid scheme_id (enforced by foreign key)
2. **Owner must exist before linking to lot:** lot_ownerships requires valid owner_id (enforced by foreign key)
3. **Total entitlements must match:** Sum of lot unit_entitlements = scheme total_lot_entitlement (enforced by trigger)
4. **Ownership dates must be valid:** ownership_end_date >= ownership_start_date (enforced by constraint)
5. **At least one contact method:** Owner must have email OR postal address (enforced by constraint)

### 14.2 Business Logic Rules

1. **Cannot delete scheme with lots:** Must delete/archive all lots first (enforced by application logic, not DB)
2. **Cannot delete owner with active ownership:** Must end ownership first (enforced by foreign key ON DELETE RESTRICT)
3. **One primary contact per lot:** If multiple owners, exactly one must have is_primary_contact = true (enforced by application)
4. **Ownership percentages sum to 100:** For tenants-in-common, sum of ownership_percentage = 100.00 (validated on save)

---

## 15. Open Questions & Decisions Needed

### 15.1 Technical Decisions

**Q1: Should we support multi-tenancy at the database level?**
- Current design: RLS policies filter by manager_id
- Alternative: Separate database per customer (expensive, complex)
- **Recommendation:** Stick with RLS for MVP. Scales to 100+ customers easily.

**Q2: How to handle scheme mergers/splits?**
- Example: Two schemes merge into one (common in stratas)
- **MVP Decision:** Not supported. Manual data migration if needed. Add in Phase 3.

**Q3: Should we soft-delete or hard-delete lots?**
- Soft delete: Set status = 'deleted', keep in database
- Hard delete: Remove from database (loses audit trail)
- **Recommendation:** Soft delete (set status = 'inactive'). Audit log captures deletion event.

### 15.2 UX Decisions

**Q4: How to handle owner de-duplication?**
- User creates "John Smith" but "John Smith" already exists (typo, different person?)
- **Option A:** Show warning, let user merge or create new
- **Option B:** Auto-merge based on email match only
- **Recommendation:** Option A (safer, avoids merging wrong people)

**Q5: Should owners see other owners' contact details in portal?**
- Privacy concern vs. community building
- **Recommendation:** Make it scheme-level setting (default: show names only, hide contact details)

**Q6: How many lots is "too many" for CSV import?**
- Limit: 500 lots per CSV? 1000? No limit?
- **Recommendation:** 500-lot limit for MVP (covers 99% of small operators). Show progress bar.

### Scheme Transfer (Phase 2)
When a manager sells their business to another operator, schemes need to be transferred. This includes:
- Transfer of scheme ownership to new organisation
- Historical data preserved (levy notices, meetings, documents)
- Owner portal access maintained (owners re-linked to new organisation)
- Defined as Phase 2 feature — not required for MVP.

---

## 16. Success Metrics

### 16.1 Adoption Metrics

- **Time to create first scheme:** <5 minutes from signup to scheme created
- **CSV import success rate:** >90% of rows imported without errors
- **Schemes with complete data:** >80% have all lots, owners, and entitlements filled in

### 16.2 Performance Metrics

- **Scheme list page load:** <500ms for 50 schemes
- **Lot table render:** <1s for 200 lots (client-side pagination)
- **Search response time:** <300ms for global search

### 16.3 Quality Metrics

- **Data accuracy:** Zero duplicate lot numbers per scheme
- **Audit coverage:** 100% of changes to schemes/lots/owners logged
- **User errors:** <5% of scheme creations abandoned due to validation errors

---

## 17. Phase 2 Enhancements (Post-MVP)

**Not included in MVP but important for future:**

1. **Multi-scheme operations:**
   - Clone scheme (duplicate structure for new client)
   - Bulk edit lots (e.g., increase all entitlements by 10%)
   - Scheme templates (pre-fill common structures like "10-lot townhouse complex")

2. **Advanced owner features:**
   - Owner merge tool (combine duplicate records)
   - Owner tagging (e.g., "committee member", "investor", "arrears")
   - Owner groups (e.g., "Building A", "Ground floor")

3. **Lot linking:**
   - Link multiple lots to same owner (e.g., owner buys unit + parking bay)
   - Auto-update ownership across linked lots

4. **Compliance reports:**
   - Lot entitlement certificate (PDF export for settlement)
   - Owner list for AGM (sorted by entitlement)
   - Tenant register (for by-law enforcement)

5. **Integration:**
   - Export to Xero/MYOB (owner/lot list)
   - Import from StrataMax/MRI (customer switching)

---

## 18. Summary

The Scheme & Lot Register is the **foundational feature** of LevyLite. It provides:

- **Single source of truth** for schemes, lots, owners, and tenants
- **WA compliance** (SP number format, unit entitlements, common property)
- **Temporal accuracy** (ownership history without losing data)
- **Migration path** (CSV import from spreadsheets)
- **Audit trail** (every change logged for 7+ years)

**Next Steps:**
1. Build database schema in Supabase (run SQL DDL)
2. Create server actions for CRUD operations
3. Build UI components (scheme list, lot table, owner directory)
4. Implement CSV import flow
5. Write E2E tests (create scheme → add lots → link owners)
6. User acceptance testing with Donna Henneberry (design partner)

**Estimated Build Time:** 3-4 weeks (assuming 15 hours/week)

---

**End of Feature Specification**
