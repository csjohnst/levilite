# Feature Specification: Maintenance Request Tracking

**Feature ID:** 06  
**Feature Name:** Maintenance Request Tracking  
**Priority:** High (MVP Core Feature)  
**Version:** 1.0  
**Date:** 16 February 2026  
**Author:** Kai (AI Agent), Kokoro Software  
**Dependencies:** Schemes (01), Owner Portal (08), Document Storage (06), Trust Accounting (03), Notifications (System)

---

## 1. Executive Summary

Maintenance request tracking is the operational heartbeat of strata management. Owners report issues (broken gates, pool equipment failures, common area damage, lot-specific repairs), and the strata manager must log, prioritize, assign tradespeople, obtain quotes, seek approval, track work completion, and maintain an audit trail for committee oversight and compliance.

Currently, small operators like Sarah manage this via email threads, text messages, and spreadsheet lists—leading to lost requests, unclear accountability, forgotten follow-ups, and disputes over "who approved this $3,000 quote?"

**LevyLite's Maintenance Request Tracking** provides:
- **Owner self-service submission** via portal (reduces manager workload)
- **Clear workflow states** (New → Acknowledged → Assigned → In Progress → Quoted → Approved → Completed → Closed)
- **Tradesperson directory** with assignment and preferred vendor lists per scheme
- **Quote approval workflow** with threshold-based routing (manager vs. committee approval)
- **Photo attachments** (before/after documentation)
- **Email notifications** to all stakeholders
- **SLA tracking** with priority-based response time targets
- **Audit trail** for compliance and dispute resolution

This feature directly addresses **time savings** (automate status updates, reduce phone calls), **compliance** (documented approval trails for expenditure), and **owner satisfaction** (transparency, self-service visibility).

**Estimated time savings:** 3-5 hours per week for a manager handling 15 schemes (reducing manual email triage, status updates, and follow-up calls).

---

## 2. User Stories & Personas

### 2.1 Primary User Stories

**US-MR-01: Owner Submits Common Area Maintenance Request**  
**As an** owner in a strata scheme,  
**I want to** submit a maintenance request for a broken common area light fixture via the owner portal,  
**So that** the issue is logged, tracked, and I receive status updates without needing to call or email the manager.

**Acceptance Criteria:**
- Owner can submit request with subject, description, photos (up to 5), location/area, and priority suggestion
- Owner receives email confirmation with request ID
- Request appears in owner portal with status (New)
- Manager receives notification of new request

---

**US-MR-02: Manager Creates Request on Behalf of Owner**  
**As a** strata manager,  
**I want to** create maintenance requests on behalf of owners who report issues via phone or email,  
**So that** all requests are centrally tracked regardless of submission channel.

**Acceptance Criteria:**
- Manager can create request and specify lot/owner OR mark as anonymous/common area
- All request fields available (subject, description, photos, priority, location)
- Owner is notified via email that request was created on their behalf

---

**US-MR-03: Manager Assigns Tradesperson to Request**  
**As a** strata manager,  
**I want to** assign a request to a tradesperson from the directory,  
**So that** the tradesperson is notified and I can track who is responsible for the work.

**Acceptance Criteria:**
- Manager selects tradesperson from directory (filtered by trade type if specified)
- Status changes to "Assigned"
- Email sent to tradesperson with request details, photos, and manager contact
- Owner is notified that request has been assigned

---

**US-MR-04: Tradesperson Provides Quote**  
**As a** strata manager,  
**I want to** attach a quote PDF to a request and route it for approval based on amount,  
**So that** expenditure approval is documented and compliant with scheme by-laws.

**Acceptance Criteria:**
- Manager uploads quote PDF (max 10MB)
- Manager enters quote amount (AUD)
- If quote < approval threshold (e.g., $1,000), manager can approve directly
- If quote ≥ threshold, request flagged for committee approval
- Notification sent to approver (manager or committee email list)

---

**US-MR-05: Owner Tracks Request Status**  
**As an** owner,  
**I want to** view the status of my maintenance request in the owner portal,  
**So that** I know if work is in progress, quoted, or completed without needing to call the manager.

**Acceptance Criteria:**
- Owner portal shows all requests submitted by owner (or for their lot)
- Status displayed with timestamp of last update
- Owner can view attached photos, quotes (if approved), and manager comments
- Owner can add comments/replies to request thread

---

**US-MR-06: Manager Completes and Closes Request**  
**As a** strata manager,  
**I want to** mark a request as completed, attach before/after photos and invoices, and close it,  
**So that** the request is archived with full documentation for future reference and compliance audits.

**Acceptance Criteria:**
- Manager marks request as "Completed" with completion notes
- Manager uploads invoice PDF and before/after photos
- Invoice amount recorded for trust accounting integration (future: auto-create payment entry)
- Request can be closed (no further edits except reopening)
- Owner notified via email that request is completed

---

### 2.2 Secondary User Stories

**US-MR-07: Committee Reviews Overdue Requests**  
**As a** strata committee member,  
**I want to** view a dashboard of overdue maintenance requests,  
**So that** I can hold the manager accountable for timely resolution.

---

**US-MR-08: Manager Generates Maintenance Cost Report**  
**As a** strata manager,  
**I want to** generate a report of maintenance costs by category (plumbing, electrical, landscaping, etc.) for AGM presentation,  
**So that** owners can see how funds are being spent.

---

**US-MR-09: Anonymous Common Area Request**  
**As an** owner,  
**I want to** submit a maintenance request for a common area issue without associating it with my lot,  
**So that** the issue is addressed without me being identified (e.g., neighbor dispute or sensitive issue).

---

## 3. Workflow States & State Machine

### 3.1 State Definitions

| State | Description | Who Can Transition | Next States |
|-------|-------------|---------------------|-------------|
| **New** | Request submitted, awaiting manager review | System (on creation) | Acknowledged, Assigned, Closed (spam/duplicate) |
| **Acknowledged** | Manager has reviewed request | Manager | Assigned, Closed (no action needed) |
| **Assigned** | Tradesperson assigned to assess/quote | Manager | In Progress, Quoted, Closed (tradesperson declined) |
| **In Progress** | Work is actively underway (no quote needed for emergency) | Manager or Tradesperson | Completed, Quoted (quote needed mid-work) |
| **Quoted** | Quote received, awaiting approval | Manager | Approved, Closed (quote rejected) |
| **Approved** | Quote approved, work authorized | Manager or Committee | In Progress, Closed (tradesperson unavailable) |
| **Completed** | Work finished, invoice attached | Manager or Tradesperson | Closed |
| **Closed** | Request archived, no further action | Manager | (Terminal state, can reopen to New if needed) |

### 3.2 State Machine Diagram (Text-Based)

```
          [Owner/Manager Creates Request]
                      |
                      v
                   [NEW] ────────────────────────┐
                      |                          |
          ┌───────────┴──────────┐               |
          |                      |               |
          v                      v               |
    [ACKNOWLEDGED]          [ASSIGNED]           |
          |                      |               |
          |         ┌────────────┴────┐          |
          |         |                 |          |
          |         v                 v          |
          |   [IN PROGRESS]       [QUOTED]       |
          |         |                 |          |
          |         |         ┌───────┴─────┐    |
          |         |         |             |    |
          |         |         v             v    |
          |         |    [APPROVED]    [CLOSED]  |
          |         |         |             ^    |
          |         |         v             |    |
          |         └────>[COMPLETED]───────┘    |
          |                                      |
          └──────────────────────────────────────┘
```

### 3.3 State Transition Rules

**Business Rules:**
1. **Emergency bypass:** High-priority (emergency) requests can skip Quoted/Approved and go directly to In Progress (document post-facto approval in notes)
2. **Threshold-based approval:** Quotes ≥ $1,000 (configurable per scheme) require committee approval (flag in UI)
3. **SLA tracking:** Each state transition logs timestamp for SLA reporting (e.g., New → Acknowledged within 24h target)
4. **Audit trail:** All state changes logged with user ID, timestamp, and optional reason/comment

---

## 4. Tradesperson Management

### 4.1 Tradesperson Directory

**Purpose:** Centralized database of tradespeople (plumbers, electricians, gardeners, etc.) used by strata managers across schemes.

**Data Model:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | UUID | Yes | Primary key |
| `name` | Text | Yes | Business name or individual name |
| `trade_type` | Enum/Text | Yes | e.g., Plumber, Electrician, Landscaper, Handyman, Locksmith, Painter, Pool Technician (custom tags) |
| `contact_name` | Text | No | Primary contact person (if different from business name) |
| `email` | Email | No | For automated notifications |
| `phone` | Text | Yes | Primary phone number |
| `abn` | Text (11 digits) | No | Australian Business Number (validate format) |
| `insurance_expiry` | Date | No | Public liability insurance expiry date |
| `insurance_cert_url` | Text | No | Link to uploaded insurance certificate in document storage |
| `notes` | Text | No | Internal notes (e.g., "preferred for emergency work", "slow to respond") |
| `created_at` | Timestamp | Yes | Record creation time |
| `created_by` | UUID | Yes | Manager user ID who added tradesperson |
| `is_active` | Boolean | Yes | Default true, set false to soft-delete |

### 4.2 Preferred Tradespeople Per Scheme

**Requirement:** Schemes may have preferred vendors (e.g., committee-approved plumber, long-standing relationship with landscaper).

**Implementation:**
- Many-to-many join table: `scheme_preferred_tradespeople`
  - `scheme_id` (FK to schemes)
  - `tradesperson_id` (FK to tradespeople)
  - `trade_type` (optional: "preferred plumber for this scheme")
  - `added_by` (manager user ID)
  - `added_at` (timestamp)

**UI Behavior:**
- When assigning tradesperson to a request, show preferred vendors first (highlighted)
- Manager can still select any tradesperson from global directory
- Preferred list editable from scheme settings page

### 4.3 Tradesperson Assignment Workflow

1. Manager reviews request (New or Acknowledged state)
2. Manager clicks "Assign Tradesperson"
3. UI shows:
   - Preferred tradespeople for this scheme (if any) at top
   - Full directory filtered by trade type (if request has category tag)
   - Search bar (name, trade type, phone)
4. Manager selects tradesperson
5. Optional: Add assignment notes (e.g., "assess and quote, no work until approved")
6. System:
   - Updates request status to Assigned
   - Logs state change with tradesperson ID
   - Sends email to tradesperson (template below)
   - Sends email to owner (status update)

---

## 5. Quotes & Invoices

### 5.1 Quote Workflow

**Scenario:** Tradesperson provides quote for work (PDF or verbal amount entered by manager).

**Data Model (quotes table):**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | UUID | Yes | Primary key |
| `request_id` | UUID | Yes | FK to maintenance_requests |
| `tradesperson_id` | UUID | No | FK to tradespeople (null if quote from unknown source) |
| `quote_amount` | Decimal(10,2) | Yes | Amount in AUD |
| `quote_file_url` | Text | No | Link to PDF in Supabase Storage |
| `quote_date` | Date | Yes | Date quote was received |
| `valid_until` | Date | No | Quote expiry date (optional) |
| `description` | Text | No | Summary of quoted work |
| `approval_status` | Enum | Yes | 'pending', 'approved', 'rejected' |
| `approved_by` | UUID | No | Manager or committee member user ID |
| `approved_at` | Timestamp | No | Timestamp of approval |
| `rejection_reason` | Text | No | If rejected, why? (e.g., "too expensive", "sourcing alternative quote") |
| `created_at` | Timestamp | Yes | Record creation |

**Approval Threshold Logic:**

Per-scheme setting: `approval_threshold_amount` (default $1,000).

```
IF quote_amount < scheme.approval_threshold_amount THEN
  approval_required_by = 'manager'
ELSE
  approval_required_by = 'committee'
END IF
```

**Manager Approval:**
- Manager clicks "Approve Quote" in request view
- System records approved_by (manager user ID), approved_at (now)
- Status → Approved
- Notification to tradesperson: "Work approved, please proceed"

**Committee Approval:**
- Quote flagged in UI as "Pending Committee Approval"
- Manager sends email to committee with quote PDF and request details
- Committee replies via email or manager manually marks as approved/rejected
- Future enhancement: Committee members have read-only portal access to review and approve via UI

### 5.2 Invoice Attachment

**Data Model (invoices table):**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | UUID | Yes | Primary key |
| `request_id` | UUID | Yes | FK to maintenance_requests |
| `quote_id` | UUID | No | FK to quotes (if invoice matches a quote) |
| `invoice_number` | Text | No | Tradesperson's invoice number |
| `invoice_amount` | Decimal(10,2) | Yes | Amount in AUD |
| `invoice_file_url` | Text | No | Link to PDF in Supabase Storage |
| `invoice_date` | Date | Yes | Invoice date |
| `due_date` | Date | No | Payment due date |
| `paid_at` | Timestamp | No | Timestamp when payment recorded (integration with trust accounting) |
| `payment_reference` | Text | No | Link to trust accounting transaction ID (future integration) |
| `created_at` | Timestamp | Yes | Record creation |

**Workflow:**
1. Work completed → Manager marks request as Completed
2. Tradesperson provides invoice (PDF or email)
3. Manager uploads invoice to request
4. Invoice amount auto-populated if matches quote (validation: warn if >10% variance from quote)
5. Manager creates payment entry in trust accounting (manual in MVP, auto-link in Phase 2)
6. Payment marked as paid, invoice.paid_at updated

### Invoice Payment Integration (Trust Accounting)

When a maintenance invoice is approved and paid:

1. Manager navigates to the maintenance request detail view
2. Clicks "Pay Invoice" on an approved invoice
3. Payment modal opens (pre-filled from invoice):
   - Amount (from invoice total)
   - Fund allocation (admin fund or capital works fund)
   - Expense category (auto-selected based on trade type, editable)
   - Reference/notes
4. On confirmation, the system:
   - Creates a `transactions` record in trust accounting (type='payment', category from chart of accounts)
   - Updates `invoices.paid_at = NOW()`
   - Sets `invoices.transaction_id` to link to the trust accounting transaction
   - Updates maintenance request status if all invoices are paid
5. The payment appears in both:
   - Maintenance request view (invoice marked "Paid")
   - Trust accounting ledger (as an expense transaction)

**Note:** The `transactions` table (Feature 04 - Trust Accounting) is the single source of truth for all financial records. The maintenance module links to it via `invoices.transaction_id`.

---

## 6. Photo & Document Attachments

### 6.1 File Upload Requirements

**Supported File Types:**
- Images: JPEG, PNG, HEIC (mobile), WebP, GIF (max 10MB per file)
- Documents: PDF (max 10MB per file)

**Storage Limits:**
- **Per request:** Up to 20 attachments total (photos + PDFs)
- **Total storage per scheme:** Fair use 2GB per scheme (monitored, not enforced in MVP)

**Supabase Storage Integration:**

**Bucket Structure:**
```
maintenance-requests/
  {scheme_id}/
    {request_id}/
      photos/
        {timestamp}_{filename}.jpg
      quotes/
        {timestamp}_{filename}.pdf
      invoices/
        {timestamp}_{filename}.pdf
```

**Upload Flow:**
1. User selects file(s) from device (react-dropzone or native file picker)
2. Client-side validation (file type, size)
3. Upload to Supabase Storage via client library (presigned URL or direct upload with RLS)
4. Backend creates record in `request_attachments` table with file URL, type, metadata
5. Real-time update to request view (if other users viewing)

### 6.2 Photo Categories

**Before/After Photos:**
- When uploading, user tags photo as "before" or "after"
- UI displays before/after side-by-side in request detail view
- Useful for completion verification and dispute resolution

**Submission Photos (Initial Issue):**
- Owner uploads when creating request (e.g., photo of broken gate latch)
- Displayed in chronological order in request timeline

**Work Progress Photos:**
- Tradesperson or manager can upload mid-work photos
- Tagged with timestamp, displayed in timeline

### 6.3 Image Optimization (Future Enhancement)

**MVP:** Store original files as-is (rely on browser/device rendering).

**Phase 2:**
- Auto-generate thumbnails (200x200px) on upload for faster loading
- Use Next.js Image Optimization API (Vercel Edge Network)
- Compress images >2MB to reduce storage costs (ImageMagick or Sharp library)

---

## 7. Notifications

### 7.1 Email Notification Triggers

| Event | Recipient(s) | Template |
|-------|--------------|----------|
| **New request created** | Manager, Owner (confirmation) | `new_request_created` |
| **Request acknowledged** | Owner | `request_acknowledged` |
| **Tradesperson assigned** | Tradesperson, Owner | `tradesperson_assigned` |
| **Status changed to In Progress** | Owner | `work_in_progress` |
| **Quote received** | Manager, Committee (if >threshold) | `quote_received` |
| **Quote approved** | Tradesperson, Owner | `quote_approved` |
| **Work completed** | Owner | `work_completed` |
| **Request closed** | Owner | `request_closed` |
| **Request overdue (SLA breach)** | Manager | `request_overdue` |
| **Comment added** | Request participants (owner, manager, tradesperson) | `new_comment` |

### 7.2 Email Templates (Resend or SendGrid)

**Template: new_request_created (Owner Confirmation)**

```
Subject: Your maintenance request has been received (#{{request_id}})

Hi {{owner_name}},

Thank you for submitting a maintenance request for {{scheme_name}}.

Request Details:
- Subject: {{subject}}
- Location: {{location}}
- Priority: {{priority}}
- Status: New

We will review your request and provide an update shortly. You can track the status at any time via your owner portal:
{{portal_link}}

If you have any questions, please contact us at {{manager_email}}.

Regards,
{{manager_name}}
{{company_name}}
```

---

**Template: tradesperson_assigned (Tradesperson)**

```
Subject: New maintenance job assigned - {{scheme_name}}

Hi {{tradesperson_name}},

You have been assigned to a maintenance request for {{scheme_name}}.

Request Details:
- Request ID: #{{request_id}}
- Issue: {{subject}}
- Description: {{description}}
- Location: {{location}}
- Priority: {{priority}}

{{#if photos}}
Photos attached (see portal link below for full view):
{{portal_link}}
{{/if}}

Please review and provide a quote or commence work as discussed with the manager.

Manager Contact: {{manager_name}} | {{manager_email}} | {{manager_phone}}

Regards,
{{company_name}}
```

---

**Template: request_overdue (Manager)**

```
Subject: ⚠️ Overdue Maintenance Request - {{scheme_name}}

Hi {{manager_name}},

The following maintenance request has exceeded its SLA target:

Request Details:
- Request ID: #{{request_id}}
- Subject: {{subject}}
- Priority: {{priority}}
- Created: {{created_at}} ({{days_old}} days ago)
- Current Status: {{status}}
- SLA Target: {{sla_target}} hours

Please review and take action:
{{admin_link}}

This is an automated reminder.

LevyLite System
```

### 7.3 Notification Preferences (Future)

**MVP:** All notifications sent to email by default.

**Phase 2:**
- User preferences: Email, SMS, push notifications (if mobile app)
- Digest mode: Daily summary instead of per-event emails
- Mute specific requests (owner no longer interested in updates)

---

## 8. Priority Levels & SLA Tracking

### 8.1 Priority Definitions

| Priority | Description | Example Issues | SLA Target (Acknowledgment) | SLA Target (Resolution) |
|----------|-------------|----------------|----------------------------|------------------------|
| **Emergency** | Immediate safety risk or major service disruption | Gas leak, flooding, fire damage, lift breakdown, security breach | 2 hours | 24 hours |
| **Urgent** | Significant inconvenience, requires prompt attention | Broken gate (security risk), pool pump failure (summer), blocked drains | 24 hours | 7 days |
| **Routine** | Standard maintenance, no immediate impact | Light bulb replacement, garden maintenance, minor repairs | 3 days | 30 days |
| **Cosmetic** | Aesthetic issues, no functional impact | Paint touch-up, signage replacement, cleaning requests | 7 days | 90 days |

**SLA Target Definition:**
- **Acknowledgment:** Time from request creation (New) to first status change (Acknowledged or Assigned)
- **Resolution:** Time from request creation to Completed status

### 8.2 SLA Tracking Implementation

**Database Fields (in maintenance_requests table):**
- `priority` (enum: emergency, urgent, routine, cosmetic)
- `created_at` (timestamp)
- `acknowledged_at` (timestamp, nullable)
- `completed_at` (timestamp, nullable)
- `sla_acknowledgment_target_hours` (integer, calculated on creation based on priority)
- `sla_resolution_target_hours` (integer, calculated on creation)

**Calculated Fields (runtime or materialized view):**
```sql
-- Hours since creation
EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 AS hours_since_creation

-- Hours to acknowledgment
EXTRACT(EPOCH FROM (acknowledged_at - created_at)) / 3600 AS hours_to_acknowledgment

-- SLA status
CASE
  WHEN acknowledged_at IS NULL AND EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 > sla_acknowledgment_target_hours THEN 'overdue_acknowledgment'
  WHEN completed_at IS NULL AND EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600 > sla_resolution_target_hours THEN 'overdue_resolution'
  WHEN completed_at IS NOT NULL AND EXTRACT(EPOCH FROM (completed_at - created_at)) / 3600 <= sla_resolution_target_hours THEN 'met'
  WHEN completed_at IS NOT NULL AND EXTRACT(EPOCH FROM (completed_at - created_at)) / 3600 > sla_resolution_target_hours THEN 'breached'
  ELSE 'on_track'
END AS sla_status
```

### 8.3 SLA Dashboard (Manager View)

**Metrics Displayed:**
- **Open Requests by Priority:** Count of requests in each priority level (not closed)
- **Overdue Acknowledgments:** Count of requests past acknowledgment SLA
- **Overdue Resolutions:** Count of requests past resolution SLA
- **Average Resolution Time by Priority:** (last 30 days)
- **SLA Compliance Rate:** % of completed requests that met SLA target (last 90 days)

**Visual Indicators:**
- 🔴 Red badge: Overdue (breached SLA)
- 🟡 Yellow badge: Approaching SLA (within 20% of target)
- 🟢 Green badge: On track

**Filters:**
- By scheme
- By priority
- By status
- By date range

---

## 9. Reporting

### 9.1 Standard Reports

**Report 1: Open Requests Summary**

**Purpose:** Show all open requests across schemes for manager daily review.

**Columns:**
- Request ID
- Scheme name
- Subject
- Priority
- Status
- Days open
- Assigned to (tradesperson name)
- SLA status (on track / overdue)

**Filters:** Scheme, Priority, Status, Assigned Tradesperson

**Export:** CSV, PDF

---

**Report 2: Maintenance Cost Analysis**

**Purpose:** AGM reporting and budget planning.

**Grouping:** By scheme, by category (trade type), by month/quarter

**Metrics:**
- Total invoiced amount
- Average cost per request
- Count of requests by category
- Top 5 most expensive requests

**Filters:** Date range, Scheme, Category

**Export:** CSV, PDF

**UI:** Bar chart (cost by category), line chart (cost over time)

---

**Report 3: Average Resolution Time**

**Purpose:** Performance tracking for manager and committee.

**Metrics:**
- Average days to completion (by priority level)
- Median resolution time (to account for outliers)
- Distribution histogram (e.g., 50% resolved within 5 days, 90% within 20 days)

**Filters:** Date range, Scheme, Priority

---

**Report 4: Tradesperson Performance**

**Purpose:** Identify reliable vs. problematic vendors.

**Metrics (per tradesperson):**
- Number of requests assigned
- Average resolution time
- Customer satisfaction rating (future: owner can rate completed work)
- On-time completion rate (met SLA vs. breached)

**Filters:** Date range, Trade type

---

### 9.2 Export Functionality

**CSV Export:**
- Standard format: request_id, scheme_name, subject, priority, status, created_at, completed_at, cost
- Use Papa Parse library (client-side) or server-side CSV generation

**PDF Export:**
- Use react-pdf or Puppeteer (server-side headless Chrome)
- Branded header (LevyLite logo, company name, report date)
- Include filters used (e.g., "Report generated for Scheme ABC, 2025-01-01 to 2025-12-31")

---

## 10. Common Area vs. Lot-Specific Maintenance

### 10.1 Responsibility Assignment

**Business Rule:**
- **Common property maintenance:** Paid from scheme funds (admin or capital works fund depending on nature of work)
- **Lot-specific maintenance:** Owner's responsibility (owner pays directly, not through strata)

**Ambiguous Cases:**
- Pipe leak inside lot but affects common property (e.g., water damage to apartment below)
- Air conditioning unit (lot owner's asset but attached to common property wall)
- Balcony repair (exclusive use area but often common property under strata plan)

**Implementation:**

**Database Field:** `responsibility` (enum: common_property, lot_owner, disputed)

**UI:**
- When manager reviews request, must assign responsibility before proceeding
- If "lot_owner", status changes to "Closed - Owner Responsibility" with notification to owner ("This issue is your lot's responsibility, please arrange repair directly")
- If "disputed", manager adds notes and may escalate to committee for decision

**Owner Portal:**
- Owner can see if request is marked as "lot responsibility" with explanation
- Owner can reply/dispute if they believe it's common property issue (adds comment to request)

---

## 11. Database Schema (Full SQL DDL)

```sql
-- =============================================
-- MAINTENANCE REQUEST TRACKING SCHEMA
-- Version: 1.0 MVP
-- Database: PostgreSQL 15+ (Supabase)
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- ENUMS
-- =============================================

CREATE TYPE request_status AS ENUM (
  'new',
  'acknowledged',
  'assigned',
  'in_progress',
  'quoted',
  'approved',
  'completed',
  'closed'
);

CREATE TYPE request_priority AS ENUM (
  'emergency',
  'urgent',
  'routine',
  'cosmetic'
);

CREATE TYPE responsibility_type AS ENUM (
  'common_property',
  'lot_owner',
  'disputed'
);

CREATE TYPE approval_status AS ENUM (
  'pending',
  'approved',
  'rejected'
);

CREATE TYPE attachment_type AS ENUM (
  'photo_before',
  'photo_after',
  'photo_progress',
  'quote',
  'invoice',
  'other'
);

-- =============================================
-- TRADESPEOPLE DIRECTORY
-- =============================================

CREATE TABLE tradespeople (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  name TEXT NOT NULL,
  trade_type TEXT NOT NULL, -- e.g., "Plumber", "Electrician", "Landscaper"
  contact_name TEXT,
  email TEXT,
  phone TEXT NOT NULL,
  abn TEXT, -- 11-digit ABN, validation in app layer
  insurance_expiry DATE,
  insurance_cert_url TEXT, -- Link to Supabase Storage
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tradespeople_trade_type ON tradespeople(trade_type);
CREATE INDEX idx_tradespeople_is_active ON tradespeople(is_active);

-- =============================================
-- SCHEME PREFERRED TRADESPEOPLE (Many-to-Many)
-- =============================================

CREATE TABLE scheme_preferred_tradespeople (
  scheme_id UUID NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  tradesperson_id UUID NOT NULL REFERENCES tradespeople(id) ON DELETE CASCADE,
  trade_type TEXT, -- Optional: specific trade for this scheme (e.g., "preferred plumber")
  added_by UUID NOT NULL REFERENCES auth.users(id),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scheme_id, tradesperson_id)
);

-- =============================================
-- MAINTENANCE REQUESTS
-- =============================================

CREATE TABLE maintenance_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organisation_id UUID NOT NULL REFERENCES organisations(id),
  scheme_id UUID NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  lot_id UUID REFERENCES lots(id) ON DELETE SET NULL, -- Null if common area or anonymous
  
  -- Request Details
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT, -- e.g., "Pool area", "Lot 5 balcony", "Main gate"
  priority request_priority NOT NULL DEFAULT 'routine',
  responsibility responsibility_type,
  
  -- Workflow
  status request_status NOT NULL DEFAULT 'new',
  assigned_to UUID REFERENCES tradespeople(id) ON DELETE SET NULL,
  
  -- SLA Tracking
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  acknowledged_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  sla_acknowledgment_target_hours INTEGER NOT NULL, -- Calculated on creation based on priority
  sla_resolution_target_hours INTEGER NOT NULL,
  
  -- Metadata
  created_by UUID NOT NULL REFERENCES auth.users(id), -- Manager or owner
  submitted_by_owner BOOLEAN NOT NULL DEFAULT false, -- True if owner submitted via portal
  is_anonymous BOOLEAN NOT NULL DEFAULT false, -- True if owner requested anonymity
  
  -- Timestamps
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_requests_scheme_id ON maintenance_requests(scheme_id);
CREATE INDEX idx_requests_lot_id ON maintenance_requests(lot_id);
CREATE INDEX idx_requests_status ON maintenance_requests(status);
CREATE INDEX idx_requests_priority ON maintenance_requests(priority);
CREATE INDEX idx_requests_assigned_to ON maintenance_requests(assigned_to);
CREATE INDEX idx_requests_created_at ON maintenance_requests(created_at);

-- =============================================
-- REQUEST STATUS HISTORY (Audit Trail)
-- =============================================

CREATE TABLE request_status_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  from_status request_status,
  to_status request_status NOT NULL,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT -- Optional: reason for change (e.g., "Quote rejected - too expensive")
);

CREATE INDEX idx_status_history_request_id ON request_status_history(request_id);

-- =============================================
-- QUOTES
-- =============================================

CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  tradesperson_id UUID REFERENCES tradespeople(id) ON DELETE SET NULL,
  
  -- Quote Details
  quote_amount DECIMAL(10, 2) NOT NULL,
  quote_file_url TEXT, -- PDF in Supabase Storage
  quote_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valid_until DATE,
  description TEXT,
  
  -- Approval
  approval_status approval_status NOT NULL DEFAULT 'pending',
  approved_by UUID REFERENCES auth.users(id),
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

CREATE INDEX idx_quotes_request_id ON quotes(request_id);
CREATE INDEX idx_quotes_approval_status ON quotes(approval_status);

-- =============================================
-- INVOICES
-- =============================================

CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  
  -- Invoice Details
  invoice_number TEXT,
  invoice_amount DECIMAL(10, 2) NOT NULL,
  invoice_file_url TEXT, -- PDF in Supabase Storage
  invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  
  -- Payment Tracking
  paid_at TIMESTAMPTZ,
  transaction_id UUID REFERENCES transactions(id), -- Link to trust accounting transaction
  
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES auth.users(id)
);

CREATE INDEX idx_invoices_request_id ON invoices(request_id);
CREATE INDEX idx_invoices_paid_at ON invoices(paid_at);

-- =============================================
-- REQUEST ATTACHMENTS (Photos & Documents)
-- =============================================

CREATE TABLE request_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  
  -- File Details
  file_url TEXT NOT NULL, -- Supabase Storage URL
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL, -- MIME type (e.g., "image/jpeg", "application/pdf")
  file_size INTEGER NOT NULL, -- Bytes
  attachment_type attachment_type NOT NULL DEFAULT 'other',
  
  -- Metadata
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  caption TEXT -- Optional: user-provided description
);

CREATE INDEX idx_attachments_request_id ON request_attachments(request_id);
CREATE INDEX idx_attachments_type ON request_attachments(attachment_type);

-- =============================================
-- REQUEST COMMENTS (Internal Notes & Owner Replies)
-- =============================================

CREATE TABLE request_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  
  -- Comment Details
  comment_text TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT false, -- True = manager/committee only, false = visible to owner
  
  -- Metadata
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_request_id ON request_comments(request_id);

-- =============================================
-- TRIGGER: Update updated_at on row change
-- =============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_maintenance_requests_updated_at
  BEFORE UPDATE ON maintenance_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tradespeople_updated_at
  BEFORE UPDATE ON tradespeople
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_request_comments_updated_at
  BEFORE UPDATE ON request_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- TRIGGER: Auto-log status changes to history
-- =============================================

CREATE OR REPLACE FUNCTION log_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO request_status_history (request_id, from_status, to_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, NEW.updated_by);
    
    -- Update timestamp fields based on status
    IF NEW.status = 'acknowledged' AND NEW.acknowledged_at IS NULL THEN
      NEW.acknowledged_at = NOW();
    ELSIF NEW.status = 'completed' AND NEW.completed_at IS NULL THEN
      NEW.completed_at = NOW();
    ELSIF NEW.status = 'closed' AND NEW.closed_at IS NULL THEN
      NEW.closed_at = NOW();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: This trigger requires adding updated_by to maintenance_requests or using auth context
-- For MVP, simplify by tracking changed_by via application layer

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE tradespeople ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE request_comments ENABLE ROW LEVEL SECURITY;

-- Managers can see all requests for their organisation
CREATE POLICY manager_view_requests ON maintenance_requests
  FOR SELECT
  USING (organisation_id = auth.user_organisation_id());

-- Owners can see requests for their lots
CREATE POLICY owner_view_requests ON maintenance_requests
  FOR SELECT
  USING (
    lot_id IN (
      SELECT id FROM lots WHERE owner_id = auth.uid()
    )
    OR (submitted_by_owner = true AND submitted_by = auth.uid())
  );

-- (Full RLS policies depend on auth schema design - implement in app setup phase)

-- =============================================
-- VIEWS (for reporting and performance)
-- =============================================

-- View: Open Requests with SLA Status
CREATE OR REPLACE VIEW open_requests_with_sla AS
SELECT
  r.id,
  r.scheme_id,
  s.name AS scheme_name,
  r.subject,
  r.priority,
  r.status,
  r.assigned_to,
  t.name AS tradesperson_name,
  r.created_at,
  EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 3600 AS hours_since_creation,
  r.sla_acknowledgment_target_hours,
  r.sla_resolution_target_hours,
  CASE
    WHEN r.acknowledged_at IS NULL 
         AND EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 3600 > r.sla_acknowledgment_target_hours 
         THEN 'overdue_acknowledgment'
    WHEN r.completed_at IS NULL 
         AND EXTRACT(EPOCH FROM (NOW() - r.created_at)) / 3600 > r.sla_resolution_target_hours 
         THEN 'overdue_resolution'
    ELSE 'on_track'
  END AS sla_status
FROM maintenance_requests r
JOIN schemes s ON r.scheme_id = s.id
LEFT JOIN tradespeople t ON r.assigned_to = t.id
WHERE r.status != 'closed';

-- View: Completed Requests with Resolution Time
CREATE OR REPLACE VIEW completed_requests_metrics AS
SELECT
  r.id,
  r.scheme_id,
  r.priority,
  r.created_at,
  r.completed_at,
  EXTRACT(EPOCH FROM (r.completed_at - r.created_at)) / 3600 AS hours_to_completion,
  r.sla_resolution_target_hours,
  CASE
    WHEN EXTRACT(EPOCH FROM (r.completed_at - r.created_at)) / 3600 <= r.sla_resolution_target_hours 
         THEN 'met'
    ELSE 'breached'
  END AS sla_result
FROM maintenance_requests r
WHERE r.status = 'completed' OR r.status = 'closed';

-- =============================================
-- SEED DATA (for development/testing)
-- =============================================

-- Example tradesperson
-- INSERT INTO tradespeople (name, trade_type, phone, email, abn, created_by)
-- VALUES (
--   'Perth Plumbing Pros',
--   'Plumber',
--   '0412345678',
--   'admin@perthplumbing.com.au',
--   '12345678901',
--   (SELECT id FROM auth.users WHERE email = 'manager@levylite.com.au')
-- );
```

---

## 12. API Endpoints (Next.js App Router)

### 12.1 Request Management

**POST /api/requests**  
**Create new maintenance request**

**Body:**
```json
{
  "scheme_id": "uuid",
  "lot_id": "uuid|null",
  "subject": "Broken pool gate latch",
  "description": "The self-closing latch on the pool gate is broken...",
  "location": "Pool area",
  "priority": "urgent",
  "is_anonymous": false
}
```

**Response:**
```json
{
  "id": "uuid",
  "status": "new",
  "created_at": "2026-02-16T08:30:00Z",
  "sla_acknowledgment_target_hours": 24,
  "sla_resolution_target_hours": 168
}
```

---

**GET /api/requests?scheme_id=uuid&status=open**  
**List maintenance requests**

**Query Params:**
- `scheme_id` (optional): Filter by scheme
- `status` (optional): Filter by status (open = not closed)
- `priority` (optional): Filter by priority
- `assigned_to` (optional): Filter by tradesperson ID
- `limit` (default 50)
- `offset` (default 0)

**Response:**
```json
{
  "requests": [
    {
      "id": "uuid",
      "scheme_name": "Sunset Gardens Strata",
      "subject": "Broken pool gate latch",
      "priority": "urgent",
      "status": "assigned",
      "assigned_to": {
        "id": "uuid",
        "name": "Perth Plumbing Pros",
        "trade_type": "Plumber"
      },
      "created_at": "2026-02-16T08:30:00Z",
      "sla_status": "on_track"
    }
  ],
  "total": 12,
  "limit": 50,
  "offset": 0
}
```

---

**PATCH /api/requests/:id**  
**Update request (status change, assignment, etc.)**

**Body:**
```json
{
  "status": "assigned",
  "assigned_to": "uuid",
  "responsibility": "common_property"
}
```

---

**POST /api/requests/:id/comments**  
**Add comment to request**

**Body:**
```json
{
  "comment_text": "Tradesperson confirmed, will attend tomorrow at 10am",
  "is_internal": false
}
```

---

### 12.2 Quotes & Invoices

**POST /api/requests/:id/quotes**  
**Attach quote to request**

**Body (multipart/form-data):**
```
quote_amount: 850.00
quote_date: 2026-02-17
tradesperson_id: uuid
description: Replace pool gate latch and hinges
file: [PDF upload]
```

---

**PATCH /api/quotes/:id/approve**  
**Approve or reject quote**

**Body:**
```json
{
  "approval_status": "approved",
  "approved_by": "uuid"
}
```

---

**POST /api/requests/:id/invoices**  
**Attach invoice to request**

**Body (multipart/form-data):**
```
invoice_amount: 875.00
invoice_date: 2026-02-20
invoice_number: INV-2024-1234
file: [PDF upload]
```

---

### 12.3 Attachments

**POST /api/requests/:id/attachments**  
**Upload photo or document**

**Body (multipart/form-data):**
```
file: [JPEG/PNG/PDF upload]
attachment_type: photo_before
caption: Broken latch close-up
```

**Response:**
```json
{
  "id": "uuid",
  "file_url": "https://storage.supabase.co/.../photo.jpg",
  "file_name": "broken_latch.jpg",
  "file_size": 245678,
  "uploaded_at": "2026-02-16T09:00:00Z"
}
```

---

### 12.4 Tradespeople

**GET /api/tradespeople?trade_type=Plumber**  
**List tradespeople (with optional filter)**

**POST /api/tradespeople**  
**Add new tradesperson to directory**

**Body:**
```json
{
  "name": "Sparky Electrical Services",
  "trade_type": "Electrician",
  "phone": "0498765432",
  "email": "info@sparkyelectrical.com.au",
  "abn": "98765432109"
}
```

---

### 12.5 Reporting

**GET /api/reports/open-requests?scheme_id=uuid**  
**Generate open requests report (CSV export)**

**GET /api/reports/maintenance-costs?scheme_id=uuid&from=2025-01-01&to=2025-12-31**  
**Generate cost analysis report**

**Response:**
```json
{
  "total_cost": 45670.50,
  "request_count": 42,
  "by_category": {
    "Plumber": 12500.00,
    "Electrician": 8900.00,
    "Landscaper": 15200.00,
    "Handyman": 9070.50
  },
  "average_cost_per_request": 1087.63
}
```

---

## 13. Mobile UX Considerations

### 13.1 Owner Portal (Mobile-First)

**Key Workflows:**
1. **Submit request with photo from phone camera**
   - Simple form: Subject (text input), Description (textarea), Location (dropdown or text), Priority (radio buttons), Photos (camera/upload button)
   - React Hook Form + Zod validation
   - Compress images client-side before upload (reduce mobile data usage)

2. **Track request status**
   - Timeline view (vertical, mobile-friendly)
   - Status badges (color-coded: green = on track, yellow = in progress, red = overdue)
   - Tap request to expand details (photos, comments, tradesperson contact)

3. **Add comment or reply**
   - Simple textarea, submit button
   - Real-time updates (Supabase Realtime subscription to request_comments)

### 13.2 Manager Mobile View

**On-Site Workflows:**
1. **Quick status update from job site**
   - Tap request, tap status dropdown, select "In Progress", add optional note, save
   - Optimistic UI update (instant feedback, sync in background)

2. **Upload progress photos**
   - Camera icon → snap photo → auto-upload → tagged as "photo_progress"
   - Thumbnail preview in request timeline

3. **Review and approve quotes on mobile**
   - Display quote PDF (inline PDF viewer or download link)
   - Approve/Reject buttons with confirmation dialog

### 13.3 Responsive Design (Tailwind CSS)

**Breakpoints:**
- `sm`: 640px (mobile)
- `md`: 768px (tablet)
- `lg`: 1024px (desktop)

**Design Patterns:**
- Mobile: Single-column layout, card-based UI, bottom navigation
- Desktop: Multi-column (sidebar + main content), table views, top navigation

**Components (shadcn/ui):**
- `Drawer` (mobile) vs. `Dialog` (desktop) for forms
- `Sheet` (mobile side panel) for filters
- `Accordion` for collapsible sections on small screens

---

## 14. Dependencies on Other Features

### 14.1 Schemes & Lots (Feature 01)

**Dependency:** Maintenance requests must belong to a scheme, optionally linked to a lot.

**Integration:**
- Request form pre-populated with scheme context (if accessed from scheme detail page)
- Lot dropdown filtered to lots within selected scheme
- RLS policies check user's access to scheme before showing requests

---

### 14.2 Owner Portal (Feature 08)

**Dependency:** Owners submit requests and track status via portal.

**Integration:**
- Owner portal dashboard shows "My Maintenance Requests" widget (open count, latest update)
- Owner can only see requests for their lots (RLS enforcement)
- Magic link authentication (no password required, low friction)

---

### 14.3 Document Storage (Feature 06)

**Dependency:** Quote PDFs, invoices, and photos stored in Supabase Storage.

**Integration:**
- Shared storage bucket structure: `/documents/{scheme_id}/maintenance/{request_id}/`
- 7-year retention policy applied to all maintenance-related documents
- Metadata stored in `request_attachments` table with link to file URL

---

### 14.4 Trust Accounting (Feature 03)

**Dependency:** Invoice payments tracked in trust accounting ledger.

**Integration (Phase 2):**
- When manager marks invoice as paid, prompt to create trust accounting transaction
- Auto-populate transaction details (amount, description, date) from invoice
- Link invoice to transaction via `payment_reference` field
- Future: Two-way sync (payment in trust accounting auto-updates invoice status)

---

### 14.5 Notifications (System-Wide)

**Dependency:** Email notifications for all state changes and comments.

**Integration:**
- Event-driven architecture (trigger email on INSERT/UPDATE to `maintenance_requests` or `request_comments`)
- Email queue (Supabase Edge Functions or Next.js API route with Resend)
- Template engine (Handlebars or React Email)

---

## 15. Open Questions & Future Enhancements

### 15.1 Open Questions (for validation with beta users)

1. **Quote approval threshold:** Should this be configurable per scheme, or global (e.g., $1,000 default)?  
   → **Recommendation:** Per-scheme setting in `schemes` table (some schemes may have $500 limit, others $2,000).

2. **Tradesperson portal:** Do tradespeople need their own login to update status, upload invoices, etc., or is email-based workflow sufficient for MVP?  
   → **Recommendation:** Email-based for MVP (reduce complexity). Phase 2: Invite-only tradesperson portal.

3. **Owner satisfaction rating:** Should owners be able to rate completed work (1-5 stars) for tradesperson performance tracking?  
   → **Recommendation:** Yes, but Phase 2 (adds complexity to workflow).

4. **Recurring maintenance:** How to handle scheduled recurring work (e.g., quarterly pool cleaning, annual fire safety inspection)?  
   → **Recommendation:** Phase 3 feature (separate "Scheduled Maintenance" module with calendar integration).

5. **Warranty tracking:** If work has a warranty (e.g., 12 months on repairs), how to track expiry and trigger reminder?  
   → **Recommendation:** Phase 2 feature (add `warranty_expiry_date` field to invoices, cron job for reminders).

### 15.2 Phase 2 Enhancements

- **Tradesperson portal:** Limited access for tradespeople to view assigned requests, upload invoices, update status
- **SMS notifications:** Alternative to email for urgent/emergency requests (Twilio integration)
- **Geo-tagging:** Automatically tag request location using phone GPS (useful for large schemes with multiple buildings)
- **Voice-to-text:** Owner records description verbally, app transcribes (accessibility + convenience)
- **Integration with trust accounting:** Auto-create payment transaction when invoice marked as paid

### 15.3 Phase 3 Enhancements

- **Scheduled maintenance calendar:** Recurring tasks with auto-generated requests (e.g., "Quarterly pool service due")
- **Warranty tracking & reminders:** Alert manager when warranty on completed work is expiring
- **Owner satisfaction surveys:** Auto-send 1-week after request closed, collect rating + feedback
- **Contractor performance dashboards:** Public-facing ratings for tradespeople (with their consent)
- **Multi-language support:** Translate UI for non-English speaking owners (CALD communities)

---

## 16. Success Metrics (Feature-Specific)

### 16.1 Adoption Metrics

- **Requests submitted per scheme per month:** Target 2-5 for small schemes (10-20 lots)
- **% of requests submitted by owners vs. manager:** Target 60-70% owner-submitted (indicates portal adoption)
- **Tradesperson directory size:** Target 10-20 tradespeople per manager (indicates setup completion)

### 16.2 Efficiency Metrics

- **Average time to acknowledgment:** Target <50% of SLA target (e.g., urgent requests acknowledged within 12h vs. 24h target)
- **Average time to resolution:** Target 80% of requests meet SLA
- **Manager time saved:** Baseline 5h/week on maintenance coordination → Target 2-3h/week (via self-service owner portal and automated notifications)

### 16.3 Quality Metrics

- **% of requests with photos attached:** Target 70%+ (indicates thorough documentation)
- **% of quotes approved within 7 days:** Target 90%+ (fast decision-making)
- **Reopened request rate:** Target <5% (indicates work completed satisfactorily first time)

### 16.4 Financial Metrics

- **Average maintenance cost per lot per year:** Industry benchmark $200-$500 (use for budgeting)
- **Cost variance vs. budget:** Target ±10% (accurate forecasting)
- **Invoice processing time:** Baseline 10 days (manual spreadsheet) → Target 3 days (tracked in system)

---

## 17. Implementation Roadmap

### 17.1 MVP Phase (Months 1-3)

**Week 1-2: Database & API Setup**
- Implement full schema (SQL DDL above)
- Create Supabase RLS policies
- Build core API endpoints (create request, list requests, update status)
- Unit tests for business logic (SLA calculation, state transitions)

**Week 3-4: Manager UI**
- Request list view (table with filters)
- Request detail view (status timeline, attachments, comments)
- Create request form (manager creates on behalf of owner)
- Assign tradesperson workflow
- Tradesperson directory CRUD

**Week 5-6: Owner Portal UI**
- Owner request submission form
- Owner dashboard (my requests widget)
- Request detail view (read-only for owner, can add comments)
- Photo upload component (mobile-optimized)

**Week 7-8: Quotes, Invoices, Notifications**
- Quote upload and approval workflow
- Invoice attachment
- Email notification templates (Resend integration)
- Event triggers for notifications (on status change, on comment)

**Week 9-10: Reporting & SLA Dashboard**
- Open requests report
- Maintenance cost analysis report
- SLA dashboard (manager view)
- CSV export functionality

**Week 11-12: Testing, Refinement, Beta Launch**
- Integration testing (end-to-end workflows)
- Beta testing with 3-5 design partners
- Bug fixes and UX polish
- Documentation (user guide, manager training video)

### 17.2 Post-MVP Iteration (Months 4-6)

- Tradesperson portal (limited access)
- SMS notifications for emergency requests
- Trust accounting integration (auto-create payment on invoice)
- Owner satisfaction rating (post-completion survey)
- Recurring maintenance scheduling

---

## 18. Compliance & Risk Mitigation

### 18.1 Compliance Requirements

**WA Strata Titles Act:**
- **Document retention:** All quotes, invoices, photos, and approval records retained for 7 years (enforced via Supabase Storage lifecycle policies)
- **Expenditure approval:** Quote approval workflow ensures committee approval for amounts over threshold (configurable per scheme by-laws)
- **Audit trail:** `request_status_history` table logs all state changes with user ID and timestamp (immutable log)

**Privacy Act 1988:**
- **Owner consent:** Owner portal T&Cs require consent to store personal data (name, email, phone) and maintenance request details
- **Data minimization:** Only collect necessary data (no sensitive data like medical conditions unless explicitly provided in request description)
- **Right to access:** Owner can export all their requests via portal (JSON or PDF download)
- **Right to erasure:** Soft-delete functionality (mark request as deleted, retain for 7 years per strata law, purge after)

### 18.2 Security Risks

**Risk 1: Unauthorized access to requests (privacy breach)**

**Mitigation:**
- Supabase RLS policies enforce scheme-level and lot-level access control
- Owners can only see requests for their lots or requests they submitted
- Managers can only see requests for schemes they manage (via `scheme_managers` junction table)
- All API endpoints validate user permissions server-side (never trust client)

**Risk 2: Malicious file uploads (malware, phishing PDFs)**

**Mitigation:**
- File type validation (MIME type whitelist: JPEG, PNG, PDF only)
- File size limits (10MB max per file)
- Virus scanning (Phase 2: integrate ClamAV or VirusTotal API)
- Supabase Storage serves files via CDN (isolated from application server)

**Risk 3: Email spoofing (fake tradesperson assignment notifications)**

**Mitigation:**
- All emails sent via verified domain (SPF, DKIM, DMARC configured)
- Email templates include LevyLite branding and "this is an automated message" disclaimer
- Tradesperson emails include manager contact details for verification

---

## 19. Conclusion

The Maintenance Request Tracking feature is a **core value driver** for LevyLite, addressing one of the most time-consuming and frustration-inducing aspects of strata management. By providing:

- **Owner self-service** (reduce manager phone calls and emails by 50%)
- **Clear accountability** (state machine workflow, assignment tracking)
- **Automated notifications** (stakeholders always informed)
- **Compliance-ready audit trails** (7-year retention, approval workflows)
- **SLA tracking** (performance visibility for managers and committees)

...this feature will save small operators 3-5 hours per week, reduce owner complaints, and provide peace of mind that nothing falls through the cracks.

**Next Steps:**
1. Validate priority levels and SLA targets with Donna (WA operator feedback)
2. Confirm quote approval threshold defaults (per-scheme vs. global)
3. Build MVP (12-week roadmap above)
4. Beta test with 3-5 design partners
5. Iterate based on real-world usage patterns

**Estimated Development Effort:** 120-150 hours (database, API, UI, testing) for MVP.

**ROI for Customer:** 3-5h/week × $50-$80/hour manager time = $600-$1,600/month value for ~$600/month software cost (100-lot scheme). **Pays for itself immediately.**

---

**End of Feature Specification**

**Document Version:** 1.0  
**Last Updated:** 16 February 2026  
**Review Cycle:** Quarterly or post-MVP beta feedback
