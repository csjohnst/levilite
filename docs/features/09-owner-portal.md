# Feature Specification: Owner Portal (Self-Service)

**Product:** LevyLite  
**Feature:** Owner Portal (Self-Service)  
**Version:** 1.0 MVP  
**Last Updated:** 16 February 2026  
**Author:** Kai (Kokoro Software)  
**Dependencies:** Authentication System, Schemes & Lots, Levy Management, Document Storage, Maintenance Requests, Meeting Administration  

---

## 1. Overview

### 1.1 Purpose

The Owner Portal is a self-service web application that allows strata scheme owners to access their levy information, view documents, submit maintenance requests, and manage their contact details without requiring assistance from the strata manager. The primary goal is to reduce administrative overhead for managers by deflecting 50%+ of routine owner inquiries ("What's my balance?", "When's the AGM?", "Where are the by-laws?") to self-service.

### 1.2 Business Value

- **Manager time savings:** 5-10 hours/week per manager (fewer phone calls, emails)
- **Owner satisfaction:** 24/7 access to information, modern user experience
- **Compliance:** Transparent record-keeping, audit trail of owner access to documents
- **Competitive differentiator:** Enterprise platforms have portals, spreadsheets don't—this bridges the gap

### 1.3 Target Users

**Primary:**
- **Strata scheme owners** (residential unit owners in schemes managed by LevyLite customers)
- Typical user: 45-65 years old, moderate tech literacy, uses email daily, accesses primarily via mobile phone

**Secondary:**
- **Multi-lot owners** (investors, developers owning 2+ lots across same or different schemes)
- **Committee members** (owners who also serve on strata committee, need access to additional scheme-wide information)

### 1.4 Success Metrics

- **Adoption:** 60%+ of owners activate portal account within 90 days of invitation
- **Engagement:** 40%+ of owners log in at least once per quarter
- **Deflection:** 50%+ reduction in routine owner inquiries to manager
- **Mobile usage:** 70%+ of sessions occur on mobile devices
- **Time-to-value:** Average user finds what they need in <2 minutes

---

## 2. Portal Authentication

### 2.1 Authentication Method: Magic Link Only

**Decision:** Passwordless authentication via email magic link. No password creation or management.

**Rationale:**
- **User experience:** Owners don't want another password to remember
- **Security:** Email-based one-time links reduce credential stuffing, phishing risks
- **Support burden:** Zero password reset requests
- **Mobile-friendly:** Email app → tap link → authenticated (seamless on phones)

**Technical Implementation:**
- **Supabase Auth** with magic link provider
- Token expiry: 1 hour (link valid for 60 minutes)
- Session duration: 30 days (remember me enabled by default)
- PKCE flow for enhanced security

### 2.2 Account Creation Flow

**Owner accounts are invitation-only.** Owners cannot self-register. Managers create and invite owners from the Manager Portal.

**Step-by-step flow:**

1. **Manager creates owner record** (Scheme Register)
   - Manager navigates to Scheme → Lot Register
   - Creates owner record with contact details
   - Clicks "Invite to Portal" on owner record
   - System validates: email format, owner not already linked to auth account
   - System updates `owners` record (sets `portal_invite_sent_at`)

2. **System sends invitation email**
   - Template: "Welcome to [Scheme Name] Owner Portal"
   - Content: "[Manager Name] has invited you to access your strata information online. Click below to activate your account."
   - CTA button: "Activate My Account"
   - Link format: `https://portal.levylite.com.au/auth/activate?token={jwt_token}`
   - JWT payload: `{user_id, email, scheme_id, lot_id, expires_at}`

3. **Owner clicks activation link**
   - Browser opens activation page
   - System validates token (not expired, not already used)
   - Page displays: "Welcome, [First Name]! Confirm your email: [email]"
   - Owner clicks "Confirm and Continue"
   - System creates Supabase Auth user (magic link provider)
   - System links auth user to owner: sets `owners.auth_user_id = [auth.users.id]`
   - System marks `owners.portal_invite_accepted_at = now()`
   - System sends magic link email automatically

4. **Owner receives magic link email**
   - Template: "Your LevyLite Portal Login Link"
   - Content: "Click below to log in (link expires in 1 hour)"
   - CTA button: "Log In to Owner Portal"
   - Link format: `https://portal.levylite.com.au/auth/callback?token={magic_link_token}`

5. **Owner clicks magic link**
   - Browser redirects to portal dashboard
   - Session created (30-day expiry)
   - Cookie set: `supabase-auth-token`

**Database schema note:**

Owners are stored in the `owners` table (defined in Feature 02: Scheme & Lot Register).
The `owners` table includes:
- `auth_user_id` (links to Supabase Auth for portal access)
- Contact details (email, phone, postal address)
- Portal invitation tracking (`portal_invite_sent_at`, `portal_invite_accepted_at`)

Lot ownership is tracked via the `lot_ownerships` junction table (many-to-many relationship):
- Links `owner_id` to `lot_id`
- Supports multi-lot owners
- Tracks ownership dates, ownership type, and permissions

### 2.3 Login Flow (Returning Users)

**Step-by-step flow:**

1. **Owner visits portal login page**
   - URL: `https://portal.levylite.com.au/login`
   - Page displays: Email input field + "Send Login Link" button
   - No password field visible

2. **Owner enters email and submits**
   - System validates email format
   - System checks if email exists in `owners` table with `auth_user_id` set
   - If exists: Supabase sends magic link email
   - If not exists: Generic message ("If your email is registered, you'll receive a login link")—prevents email enumeration

3. **Owner receives magic link email**
   - Same template as activation flow
   - Link expires in 1 hour

4. **Owner clicks magic link**
   - Redirects to portal dashboard
   - Session created (30-day expiry)

**Security considerations:**

- **Rate limiting:** Max 5 magic link requests per email per hour (prevents spam)
- **Device fingerprinting:** Optional—log device info for suspicious activity detection (future)
- **Email verification required:** Cannot change email without re-verifying new address

### 2.4 Session Management

**Session characteristics:**

- **Duration:** 30 days idle timeout (configurable via environment variable)
- **Refresh:** Automatic token refresh every 24 hours (Supabase handles this)
- **Multi-device:** Users can be logged in on multiple devices simultaneously
- **Logout:** Explicit logout button destroys session token

**Security controls:**

- **Inactivity timeout:** After 30 days of no activity, session expires (user must re-authenticate)
- **Suspicious activity:** Manager can suspend owner account (sets `owners.status = 'inactive'`, blocks all access)
- **Audit logging:** All login events logged to `audit_log` table (timestamp, IP address, user agent)

**Database schema (audit logging):**

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- 'login', 'logout', 'document_view', 'maintenance_request', etc.
  user_type TEXT NOT NULL, -- 'portal_user', 'manager_user'
  user_id UUID NOT NULL,
  scheme_id UUID,
  lot_id UUID,
  resource_type TEXT, -- 'document', 'levy_statement', 'maintenance_request'
  resource_id UUID,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_log_scheme ON audit_log(scheme_id, created_at DESC);
```

### 2.5 API Endpoints (Authentication)

**POST /api/portal/auth/invite**
- **Access:** Manager only
- **Payload:** `{owner_id, lot_id}`
- **Returns:** `{success: true, owner_id, invitation_sent: true}`
- **Side effects:** Updates `owners.portal_invite_sent_at`, sends invitation email

**POST /api/portal/auth/magic-link**
- **Access:** Public (rate-limited)
- **Payload:** `{email}`
- **Returns:** `{success: true, message: "If your email is registered, you'll receive a login link"}`
- **Side effects:** Triggers Supabase magic link email if email exists

**GET /api/portal/auth/session**
- **Access:** Authenticated portal user
- **Returns:** `{owner_id, email, first_name, last_name, lots: [{scheme_id, lot_id, lot_number, scheme_name}]}`
- **Purpose:** Client-side session check, populate user context from `owners` and `lot_ownerships` tables

**POST /api/portal/auth/logout**
- **Access:** Authenticated portal user
- **Returns:** `{success: true}`
- **Side effects:** Destroys session token

---

## 3. Dashboard

### 3.1 Dashboard Purpose

The dashboard is the first screen owners see after login. It provides:
- **At-a-glance summary** of key information (levy balance, next due date, upcoming AGM)
- **Quick access** to common actions (pay levy, submit maintenance request, view documents)
- **Context switching** for multi-lot owners (if owner has multiple lots)

### 3.2 Dashboard Layout (Single-Lot Owner)

**Header:**
- Logo (LevyLite or white-label scheme logo)
- Scheme name: "Sunset Apartments"
- Lot identifier: "Unit 12"
- User menu: [First Name] ▼ → Profile, Logout

**Hero Card: Levy Balance**
- **Title:** "Your Levy Balance"
- **Current Balance:** $1,234.56 (green if paid up, red if arrears)
- **Status badge:** "Up to Date" or "Overdue by 14 days"
- **Next Levy Due:** $450.00 on 31 March 2026
- **CTA button:** "View Payment Details"

**Payment History Graph:**
- **Chart type:** Bar chart (last 12 months)
- **X-axis:** Month (Mar 25, Apr 25, May 25, ...)
- **Y-axis:** Amount ($)
- **Bars:** Green (paid on time), Orange (paid late), Red (unpaid)
- **Hover tooltip:** "April 2025: $450 paid on 5 April (due 1 April)"

**Quick Actions Grid (4 cards):**

1. **View Levy Statement**
   - Icon: Document/Invoice icon
   - Description: "Download your levy history"
   - CTA: "View Statement"

2. **Submit Maintenance Request**
   - Icon: Wrench/Tools icon
   - Description: "Report an issue"
   - CTA: "New Request"

3. **View Documents**
   - Icon: Folder icon
   - Description: "AGM minutes, by-laws, insurance"
   - CTA: "Browse Documents"

4. **Upcoming Meetings**
   - Icon: Calendar icon
   - Description: "Next AGM: 15 May 2026 at 6:00 PM"
   - CTA: "View Details"

**Recent Activity Feed (optional for MVP, add later):**
- "New document uploaded: 2025 AGM Minutes (2 days ago)"
- "Maintenance request #123 updated: In Progress (5 days ago)"
- "Levy notice sent for Q2 2026 (1 week ago)"

### 3.3 Dashboard Layout (Multi-Lot Owner)

**Lot Selector (Top of Page):**
- Dropdown: "Sunset Apartments - Unit 12 ▼"
- Menu shows all lots:
  - Sunset Apartments - Unit 12 (selected)
  - Sunset Apartments - Unit 5
  - Ocean View Towers - Unit 401
- Selecting a lot refreshes dashboard with that lot's data

**Alternative: Tabbed Interface**
- Tab 1: "Unit 12 (Sunset Apts)"
- Tab 2: "Unit 5 (Sunset Apts)"
- Tab 3: "Unit 401 (Ocean View)"

**Dashboard Content:**
- Same layout as single-lot owner, but data scoped to selected lot
- Levy balance, payment history, quick actions all specific to selected lot

**Multi-Lot Summary View (Optional Enhancement):**
- Dashboard defaults to "All Lots" view
- Shows aggregated data:
  - **Total Balance Across All Lots:** $3,456.78
  - **Lots with Arrears:** 1 of 3
  - **Upcoming Levies:** $1,350.00 (combined)
- Table: List of all lots with individual balances
- Click row to drill into lot-specific view

### 3.4 Mobile Dashboard Optimisations

**Layout changes for mobile (viewport <768px):**

- **Header:** Burger menu (☰) replaces horizontal nav
- **Scheme/Lot selector:** Sticky at top, tap to open dropdown
- **Levy Balance card:** Full-width, larger font size
- **Payment History graph:** Simplified (6 months instead of 12, vertical bars)
- **Quick Actions:** 2×2 grid instead of 4×1
- **Typography:** Larger touch targets (min 44×44px), increased line height

**Performance optimisations:**
- Lazy-load payment history graph (defer rendering until user scrolls)
- Reduce image sizes (scheme logo max 200px wide)
- Cache dashboard data for 5 minutes (reduce API calls)

### 3.5 API Endpoints (Dashboard)

**GET /api/portal/dashboard**
- **Access:** Authenticated portal user
- **Query params:** `?lot_id={uuid}` (optional, defaults to user's first lot if multi-lot owner)
- **Returns:**
  ```json
  {
    "scheme": {
      "id": "uuid",
      "name": "Sunset Apartments",
      "logo_url": "https://...",
      "address": "123 Beach Road, Perth WA 6000"
    },
    "lot": {
      "id": "uuid",
      "lot_number": "12",
      "unit_address": "Unit 12, 123 Beach Road"
    },
    "levy_balance": {
      "current_balance": 0.00,
      "arrears_amount": 0.00,
      "arrears_days": 0,
      "next_levy": {
        "amount": 450.00,
        "due_date": "2026-03-31",
        "description": "Q2 2026 Admin Fund Levy"
      }
    },
    "payment_history": [
      {"month": "2025-03", "amount_due": 450.00, "amount_paid": 450.00, "paid_date": "2025-03-05", "status": "paid_late"},
      {"month": "2025-06", "amount_due": 450.00, "amount_paid": 450.00, "paid_date": "2025-05-28", "status": "paid_on_time"},
      ...
    ],
    "upcoming_meeting": {
      "id": "uuid",
      "type": "AGM",
      "date": "2026-05-15",
      "time": "18:00",
      "location": "Community Hall, 123 Beach Road"
    },
    "maintenance_requests": {
      "open_count": 2,
      "recent": [
        {"id": "uuid", "subject": "Broken pool gate", "status": "in_progress", "created_at": "2026-02-10"}
      ]
    }
  }
  ```

**GET /api/portal/lots**
- **Access:** Authenticated portal user
- **Returns:** Array of all lots the user can access (via `lot_ownerships` join)
  ```json
  [
    {"scheme_id": "uuid", "scheme_name": "Sunset Apartments", "lot_id": "uuid", "lot_number": "12", "unit_address": "Unit 12"},
    {"scheme_id": "uuid", "scheme_name": "Sunset Apartments", "lot_id": "uuid", "lot_number": "5", "unit_address": "Unit 5"},
    {"scheme_id": "uuid2", "scheme_name": "Ocean View Towers", "lot_id": "uuid3", "lot_number": "401", "unit_address": "Unit 401"}
  ]
  ```

---

## 4. Levy Information

### 4.1 Levy Statement Page

**Purpose:** Show detailed levy balance, payment history, and payment instructions.

**Page Layout:**

**Section 1: Current Balance Summary**
- **Card title:** "Levy Account Summary"
- **Current Balance:** $0.00 (or $-450.00 if in credit, $1,234.56 if in arrears)
- **Last Payment:** $450.00 on 5 February 2026
- **Next Levy Due:** $450.00 on 31 March 2026 (Admin Fund $300, Capital Works $150)
- **Download Statement:** [Button] "Download PDF Statement"

**Section 2: Payment Instructions**
- **Card title:** "How to Pay Your Levy"
- **Bank Transfer Details:**
  - Account Name: Sunset Apartments Strata Company
  - BSB: 016-234
  - Account Number: 123456789
  - Reference: Unit 12 (IMPORTANT: Include your unit number)
- **Payment Deadline:** Levies are due on the 1st of each quarter. Late fees apply after 30 days.
- **Contact:** Questions? Email [manager email] or call [manager phone]

**Section 3: Payment History Table**
- **Columns:** Date Due | Description | Amount Due | Amount Paid | Date Paid | Status
- **Rows:** Last 24 months of levy transactions
- **Status badges:**
  - ✅ Paid (green)
  - ⚠️ Paid Late (orange)
  - ❌ Unpaid/Overdue (red)
- **Pagination:** 10 rows per page, with next/prev buttons
- **Export:** [Button] "Export to CSV"

**Section 4: Levy Notices (Optional for MVP)**
- **Card title:** "Levy Notices"
- **List:** All levy notices sent to this lot
- **Columns:** Issue Date | Period | Amount | Download
- **Download:** PDF file of original levy notice email

### 4.2 Downloadable Levy Statement (PDF)

**Template:** A4 page, professional layout

**Header:**
- Scheme logo (if configured)
- Scheme name and address
- "Levy Statement" title
- Statement date: 16 February 2026
- Lot: Unit 12

**Section 1: Account Summary**
- Opening balance (start of financial year): $0.00
- Total levies raised (current FY): $1,800.00
- Total payments received: $1,800.00
- Current balance: $0.00

**Section 2: Transaction History**
- Table: Date | Description | Debit | Credit | Balance
- Example rows:
  - 1 Jul 2025 | Q1 2026 Admin Fund Levy | $300.00 | | $300.00
  - 1 Jul 2025 | Q1 2026 Capital Works Levy | $150.00 | | $450.00
  - 5 Jul 2025 | Payment Received - EFT | | $450.00 | $0.00
  - ...

**Section 3: Payment Instructions**
- Bank details (as per web page)
- Manager contact details

**Footer:**
- Page number
- Generated date/time: "Generated 16 Feb 2026 at 10:34 AM"
- Disclaimer: "This statement is for information only. Please contact your strata manager if you have questions."

**Technical Implementation:**
- **Library:** react-pdf or PDFKit (server-side generation)
- **Endpoint:** GET /api/portal/levy/statement/pdf?lot_id={uuid}
- **Caching:** Cache PDF for 24 hours (reduce generation load)
- **Filename:** `LevyStatement_Unit12_20260216.pdf`

### 4.3 API Endpoints (Levy Information)

**GET /api/portal/levy/balance**
- **Access:** Authenticated portal user
- **Query params:** `?lot_id={uuid}`
- **Returns:**
  ```json
  {
    "current_balance": 0.00,
    "arrears_amount": 0.00,
    "credit_balance": 0.00,
    "last_payment": {
      "amount": 450.00,
      "date": "2026-02-05",
      "method": "EFT"
    },
    "next_levy": {
      "amount": 450.00,
      "due_date": "2026-03-31",
      "admin_fund": 300.00,
      "capital_works_fund": 150.00
    }
  }
  ```

**GET /api/portal/levy/history**
- **Access:** Authenticated portal user
- **Query params:** `?lot_id={uuid}&limit=10&offset=0`
- **Returns:**
  ```json
  {
    "transactions": [
      {
        "id": "uuid",
        "date": "2025-07-01",
        "description": "Q1 2026 Admin Fund Levy",
        "type": "levy",
        "amount_due": 300.00,
        "amount_paid": 300.00,
        "paid_date": "2025-07-05",
        "status": "paid"
      },
      ...
    ],
    "total_count": 48,
    "limit": 10,
    "offset": 0
  }
  ```

**GET /api/portal/levy/statement/pdf**
- **Access:** Authenticated portal user
- **Query params:** `?lot_id={uuid}`
- **Returns:** PDF file (Content-Type: application/pdf)
- **Filename header:** `Content-Disposition: attachment; filename="LevyStatement_Unit12_20260216.pdf"`

**GET /api/portal/levy/payment-instructions**
- **Access:** Authenticated portal user
- **Query params:** `?scheme_id={uuid}`
- **Returns:**
  ```json
  {
    "account_name": "Sunset Apartments Strata Company",
    "bsb": "016-234",
    "account_number": "123456789",
    "reference": "Unit 12",
    "notes": "Levies are due on the 1st of each quarter. Late fees apply after 30 days.",
    "manager_contact": {
      "name": "Sarah Smith Strata Management",
      "email": "sarah@example.com",
      "phone": "08 9123 4567"
    }
  }
  ```

---

## 5. Document Access

### 5.1 Document Categories & Visibility

**Document categories visible to owners:**

1. **AGM Documents**
   - Meeting notices
   - Agendas
   - Minutes
   - Financial statements presented at AGM
   - Auditor's reports

2. **Meeting Notices & Minutes**
   - SGM notices and minutes
   - Committee meeting minutes (if scheme allows owner access—configurable per scheme)

3. **By-Laws**
   - Current by-laws
   - By-law amendments (with effective date)

4. **Insurance**
   - Building insurance certificates
   - Public liability certificates
   - Office bearer insurance

5. **Building Reports & Inspections**
   - Building inspection reports
   - Defect reports
   - Maintenance schedules

6. **Financial Reports**
   - Annual financial statements
   - Budget documents
   - Levy schedules

7. **Scheme Information**
   - Strata plan
   - Body corporate rules
   - Scheme constitution

**Document categories NOT visible to owners (manager-only):**

- Manager contracts
- Tradesperson quotes (unless approved by committee and relevant to common property work)
- Legal correspondence
- Owner arrears notices (privacy—owners only see their own)
- Committee confidential documents (marked by manager)

**Visibility controlled by:** `documents.visibility` field: `'owners'`, `'committee'`, `'manager_only'`

### 5.2 Document Browser Page

**Page Layout:**

**Header:**
- Page title: "Documents"
- Search bar: "Search by filename or keyword..."
- Filter dropdown: "All Categories ▼" (filters to AGM, By-Laws, Insurance, etc.)

**Document List:**
- **View:** Table (desktop) or Card list (mobile)
- **Columns (desktop):** Name | Category | Date Uploaded | Size | Actions
- **Actions:** [Download] [Preview (if PDF)]
- **Sorting:** Sort by Name (A-Z), Date (newest first), Category
- **Pagination:** 20 documents per page

**Example rows:**
- "2025 AGM Minutes.pdf" | AGM Documents | 12 Jan 2026 | 1.2 MB | [Download] [Preview]
- "Building Insurance Certificate 2026.pdf" | Insurance | 5 Feb 2026 | 450 KB | [Download] [Preview]
- "By-Laws (Amended 2024).pdf" | By-Laws | 20 Nov 2024 | 680 KB | [Download] [Preview]

**Mobile optimisations:**
- **Card view:** Each document is a card with icon, name, category tag, date
- **Tap to preview:** Opens PDF viewer or downloads file
- **Filter drawer:** Slide-in from bottom with category checkboxes

### 5.3 Document Preview (PDF Viewer)

**In-browser PDF viewer for quick viewing without download:**

- **Library:** react-pdf or browser native PDF viewer (iframe)
- **UI:** Full-screen modal with close button, download button, print button
- **Navigation:** Page up/down, zoom in/out
- **Audit logging:** Log document view event (user, document, timestamp)

**Fallback:** If browser doesn't support PDF preview, auto-download instead

### 5.4 Search & Filter

**Search functionality:**
- **Full-text search:** Search document filename and any metadata tags
- **Search scope:** Only documents visible to owner (respects RLS)
- **Results:** Highlight matching terms in filename

**Filter functionality:**
- **By category:** Multi-select checkboxes (AGM, By-Laws, Insurance, etc.)
- **By date range:** "Uploaded in last 30 days", "Last 6 months", "Last year", "Custom range"
- **Combined filters:** Search + category + date range

### 5.5 Document Upload (Owner-Initiated, Future Feature)

**Scenario:** Owner wants to share a document with the manager (e.g., proof of payment, renovation approval)

**Flow:**
1. Owner clicks "Upload Document" button
2. Modal: "Share a document with your strata manager"
3. File picker: Select file (PDF, JPG, PNG, max 10 MB)
4. Category: Dropdown (e.g., "Proof of Payment", "Renovation Plans", "Other")
5. Message: Text field for optional note to manager
6. Submit: Document uploaded to `owner_uploads` folder, manager notified via email

**Manager review:**
- Manager sees uploaded documents in Manager Portal
- Manager can approve (move to main document library) or reject (delete)
- Owner notified of decision

**MVP decision:** Defer this feature. MVP = read-only document access. Add upload in Phase 2 if customers request it.

### 5.6 Database Schema (Documents)

```sql
-- Table: documents
-- Stores all scheme documents
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  category TEXT NOT NULL, -- 'agm', 'bylaws', 'insurance', 'building_reports', 'financial', 'scheme_info'
  visibility TEXT NOT NULL DEFAULT 'owners', -- 'owners', 'committee', 'manager_only'
  file_path TEXT NOT NULL, -- Supabase Storage path: 'schemes/{scheme_id}/documents/{uuid}/{filename}'
  file_size INTEGER NOT NULL, -- bytes
  mime_type TEXT NOT NULL,
  uploaded_by UUID REFERENCES manager_users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata JSONB, -- {tags: [], description: '', document_date: ''}
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_documents_scheme ON documents(scheme_id);
CREATE INDEX idx_documents_category ON documents(category);
CREATE INDEX idx_documents_visibility ON documents(visibility);

-- RLS Policy: Owners can only see documents where visibility = 'owners'
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view owner-visible documents"
ON documents FOR SELECT
USING (
  visibility = 'owners'
  AND scheme_id IN (
    SELECT DISTINCT lots.scheme_id
    FROM lot_ownerships
    JOIN lots ON lots.id = lot_ownerships.lot_id
    WHERE lot_ownerships.owner_id = (
      SELECT id FROM owners WHERE auth_user_id = auth.uid()
    )
    AND lot_ownerships.ownership_end_date IS NULL
  )
);

CREATE POLICY "Managers can view all documents in their schemes"
ON documents FOR SELECT
USING (
  scheme_id IN (
    SELECT id FROM schemes WHERE organisation_id = auth.user_organisation_id()
  )
);
```

### 5.7 API Endpoints (Documents)

**GET /api/portal/documents**
- **Access:** Authenticated portal user
- **Query params:** `?scheme_id={uuid}&category={category}&search={query}&limit=20&offset=0`
- **Returns:**
  ```json
  {
    "documents": [
      {
        "id": "uuid",
        "filename": "2025 AGM Minutes.pdf",
        "category": "agm",
        "uploaded_at": "2026-01-12T10:30:00Z",
        "file_size": 1234567,
        "download_url": "https://storage.levylite.com.au/..."
      },
      ...
    ],
    "total_count": 45,
    "limit": 20,
    "offset": 0
  }
  ```

**GET /api/portal/documents/{id}/download**
- **Access:** Authenticated portal user (RLS enforced)
- **Returns:** Redirect to signed Supabase Storage URL (1-hour expiry)
- **Audit log:** Record document view event

**GET /api/portal/documents/{id}/preview**
- **Access:** Authenticated portal user (RLS enforced)
- **Returns:** PDF file streamed to browser (Content-Type: application/pdf, Content-Disposition: inline)
- **Audit log:** Record document view event

---

## 6. Maintenance Requests

### 6.1 Maintenance Request Submission

**Purpose:** Allow owners to report issues (broken gate, pool cleaner not working, garden overgrown, etc.) without emailing or calling the manager.

**Submission Form:**

**Page title:** "Submit Maintenance Request"

**Form fields:**

1. **Subject** (required)
   - Text input, max 100 characters
   - Placeholder: "Brief description (e.g., Broken pool gate)"

2. **Description** (required)
   - Textarea, max 1000 characters
   - Placeholder: "Provide detailed information about the issue..."
   - Character counter: "850 / 1000"

3. **Location** (required)
   - Dropdown: Common property areas configured per scheme
   - Examples: "Swimming Pool", "Entrance Gate", "Common Gardens", "Car Park", "Roof/Gutters", "Building Exterior", "Other"
   - If "Other" selected: Text input for custom location

4. **Priority** (required)
   - Radio buttons:
     - 🔴 **High** (Safety hazard, urgent repair needed)
     - 🟡 **Medium** (Issue affecting amenity, needs attention soon)
     - 🟢 **Low** (Cosmetic or non-urgent issue)
   - Default: Medium

5. **Photos** (optional)
   - File upload: Multiple files, max 5 photos
   - Max size per photo: 5 MB
   - Accepted formats: JPG, PNG, HEIC (convert HEIC to JPG server-side)
   - Mobile camera integration: "Take Photo" button (opens camera on mobile)
   - Preview thumbnails with remove button

6. **Your Contact Preference** (optional)
   - Checkbox: "Manager can call me about this issue"
   - Phone number field (pre-filled from owner profile, editable)

**Submit button:** "Submit Request"

**Confirmation:**
- Success message: "Your maintenance request has been submitted. You'll receive email updates as the status changes."
- Request ID displayed: "Request #1234"
- Redirect to request detail page

### 6.2 View Maintenance Requests

**Page title:** "My Maintenance Requests"

**List view:**
- **Columns:** Request # | Subject | Status | Submitted | Last Updated
- **Status badges:**
  - 🆕 New (grey)
  - 🔵 Assigned (blue)
  - 🟡 In Progress (yellow)
  - ✅ Completed (green)
  - ❌ Closed (red)
- **Click row:** Navigate to request detail page
- **Filter:** "Show: All | Open | Completed"
- **Sort:** Newest first (default), Oldest first, Status

**Empty state:** "You haven't submitted any maintenance requests yet. [Submit a Request]"

### 6.3 Maintenance Request Detail Page

**Page title:** "Request #1234: Broken pool gate"

**Section 1: Request Details**
- **Subject:** Broken pool gate
- **Description:** "The automatic pool gate is not closing properly. It stays open about 6 inches, which is a safety hazard for children."
- **Location:** Swimming Pool
- **Priority:** 🔴 High
- **Submitted by:** You
- **Submitted on:** 10 February 2026 at 2:34 PM
- **Status:** 🟡 In Progress

**Section 2: Photos**
- Thumbnail gallery (if photos uploaded)
- Click to open full-size image in modal

**Section 3: Updates/Activity Timeline**
- **10 Feb 2026, 2:34 PM:** You submitted this request
- **10 Feb 2026, 3:15 PM:** Manager assigned to "ABC Pool Maintenance"
- **11 Feb 2026, 9:00 AM:** Manager added note: "Pool technician scheduled for 13 Feb"
- **13 Feb 2026, 2:00 PM:** Manager marked as "In Progress"
- **14 Feb 2026, 4:00 PM:** You added comment: "Thanks, gate is working perfectly now!"

**Section 4: Add Comment**
- Textarea: "Add a comment or update..."
- Attach photos button: "Attach Photo" (e.g., photo of completed repair)
- Submit button: "Post Comment"

**Section 5: Close Request (Owner-Initiated, Optional)**
- If status is "Completed", show button: "Confirm and Close Request"
- Owner clicks → Request marked as "Closed", manager notified

### 6.4 Notifications (Maintenance Requests)

**Owner receives email when:**
1. Request is assigned to tradesperson (notification: "Your request has been assigned")
2. Manager adds note or updates status (notification: "Update on your request #1234")
3. Request is marked as completed (notification: "Your request has been completed")

**Email template example:**

**Subject:** Update on Your Maintenance Request #1234

**Body:**
> Hi [First Name],
>
> There's an update on your maintenance request:
>
> **Request #1234:** Broken pool gate  
> **Status:** In Progress
>
> **Manager's note:** Pool technician scheduled for 13 Feb
>
> [View Request Details]
>
> Thanks,  
> [Manager Name]  
> [Scheme Name] Strata Management

### 6.5 Database Schema (Maintenance Requests)

```sql
-- Table: maintenance_requests
CREATE TABLE maintenance_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES owners(id),
  request_number SERIAL, -- Auto-incrementing display number (per scheme)
  subject TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT NOT NULL, -- Common area or custom location
  priority TEXT NOT NULL, -- 'low', 'medium', 'high'
  status TEXT NOT NULL DEFAULT 'new', -- 'new', 'assigned', 'in_progress', 'completed', 'closed'
  assigned_to UUID REFERENCES tradespeople(id), -- Optional: tradesperson assignment
  contact_phone TEXT, -- Owner's phone if they want callback
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_maintenance_requests_scheme ON maintenance_requests(scheme_id);
CREATE INDEX idx_maintenance_requests_lot ON maintenance_requests(lot_id);
CREATE INDEX idx_maintenance_requests_submitted_by ON maintenance_requests(submitted_by);
CREATE INDEX idx_maintenance_requests_status ON maintenance_requests(status);

-- Table: maintenance_request_photos
CREATE TABLE maintenance_request_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL, -- Supabase Storage path
  uploaded_by UUID NOT NULL REFERENCES owners(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: maintenance_request_comments
CREATE TABLE maintenance_request_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  posted_by_user_type TEXT NOT NULL, -- 'owner', 'manager'
  posted_by_user_id UUID NOT NULL,
  posted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_maintenance_comments_request ON maintenance_request_comments(request_id, posted_at);

-- RLS Policy: Owners can only see requests they submitted
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view own maintenance requests"
ON maintenance_requests FOR SELECT
USING (
  submitted_by = (
    SELECT id FROM owners WHERE auth_user_id = auth.uid()
  )
);

CREATE POLICY "Owners can insert own maintenance requests"
ON maintenance_requests FOR INSERT
WITH CHECK (
  submitted_by = (
    SELECT id FROM owners WHERE auth_user_id = auth.uid()
  )
);
```

### 6.6 API Endpoints (Maintenance Requests)

**POST /api/portal/maintenance/submit**
- **Access:** Authenticated portal user
- **Payload:**
  ```json
  {
    "lot_id": "uuid",
    "subject": "Broken pool gate",
    "description": "The automatic pool gate is not closing...",
    "location": "Swimming Pool",
    "priority": "high",
    "contact_phone": "0412 345 678",
    "photos": ["base64_data_1", "base64_data_2"] // Or file upload via multipart/form-data
  }
  ```
- **Returns:** `{success: true, request_id: "uuid", request_number: 1234}`
- **Side effects:** Creates request record, uploads photos to Supabase Storage, sends email to manager

**GET /api/portal/maintenance/list**
- **Access:** Authenticated portal user
- **Query params:** `?lot_id={uuid}&status={status}&limit=10&offset=0`
- **Returns:**
  ```json
  {
    "requests": [
      {
        "id": "uuid",
        "request_number": 1234,
        "subject": "Broken pool gate",
        "status": "in_progress",
        "priority": "high",
        "submitted_at": "2026-02-10T14:34:00Z",
        "updated_at": "2026-02-13T14:00:00Z"
      },
      ...
    ],
    "total_count": 5
  }
  ```

**GET /api/portal/maintenance/{id}**
- **Access:** Authenticated portal user (RLS enforced: only own requests)
- **Returns:**
  ```json
  {
    "id": "uuid",
    "request_number": 1234,
    "subject": "Broken pool gate",
    "description": "...",
    "location": "Swimming Pool",
    "priority": "high",
    "status": "in_progress",
    "submitted_at": "2026-02-10T14:34:00Z",
    "photos": [
      {"id": "uuid", "url": "https://storage.levylite.com.au/..."}
    ],
    "comments": [
      {"id": "uuid", "text": "Pool technician scheduled for 13 Feb", "posted_by": "Manager", "posted_at": "2026-02-11T09:00:00Z"},
      {"id": "uuid", "text": "Thanks, gate is working perfectly now!", "posted_by": "You", "posted_at": "2026-02-14T16:00:00Z"}
    ]
  }
  ```

**POST /api/portal/maintenance/{id}/comment**
- **Access:** Authenticated portal user
- **Payload:** `{comment_text: "...", photos: [...]}`
- **Returns:** `{success: true, comment_id: "uuid"}`
- **Side effects:** Creates comment record, notifies manager

---

## 7. Contact Details

### 7.1 View & Update Contact Details

**Purpose:** Allow owners to update their email, phone, postal address, and correspondence preferences without emailing the manager.

**Page title:** "My Contact Details"

**Form fields:**

**Section 1: Personal Information**
- **First Name** (read-only, cannot change via portal—requires manager approval)
- **Last Name** (read-only)
- **Email Address** (editable, requires verification if changed)
- **Mobile Phone** (editable)
- **Home Phone** (editable, optional)

**Section 2: Postal Address**
- **Street Address** (editable)
- **Suburb** (editable)
- **State** (dropdown: WA, NSW, VIC, etc.)
- **Postcode** (editable)

**Section 3: Correspondence Preferences**
- **Preferred method for receiving levy notices:**
  - Radio buttons: Email | Post | Both
  - Default: Email
- **Preferred method for AGM notices:**
  - Radio buttons: Email | Post | Both
  - Default: Email

**Section 4: Emergency Contact (Optional)**
- **Emergency contact name** (text input)
- **Emergency contact phone** (text input)
- **Relationship** (text input, e.g., "Spouse", "Son", "Friend")

**Save button:** "Save Changes"

**Confirmation:**
- Success message: "Your contact details have been updated. Your strata manager has been notified."
- Email sent to manager: "[Owner Name] updated their contact details"

### 7.2 Email Change Verification Flow

**Security requirement:** If owner changes email address, verify new email before updating.

**Flow:**
1. Owner changes email from `old@example.com` to `new@example.com`
2. Owner clicks "Save Changes"
3. System sends verification email to `new@example.com`:
   - Subject: "Verify Your New Email Address"
   - Body: "You requested to change your email. Click below to confirm."
   - CTA: "Verify Email"
   - Link: `https://portal.levylite.com.au/auth/verify-email?token={jwt_token}`
4. Owner clicks link
5. System updates `owners.email = 'new@example.com'`, marks as verified
6. System sends confirmation email to `old@example.com`: "Your email address has been changed"
7. Manager receives notification: "[Owner Name] changed email from old@example.com to new@example.com"

**Reason:** Prevents account takeover via email change

### 7.3 Manager Approval (Optional for High-Security Schemes)

**Scenario:** Some schemes may require manager approval for contact detail changes (e.g., preventing fraudulent address changes).

**Flow (if enabled):**
1. Owner updates details and clicks "Save Changes"
2. System creates `contact_change_request` record (status: `pending`)
3. Manager receives email: "[Owner Name] requested to update contact details. Review and approve."
4. Manager reviews in Manager Portal, clicks "Approve" or "Reject"
5. If approved: System updates `owners` record, owner notified via email
6. If rejected: Owner notified via email with reason

**MVP decision:** Skip manager approval for MVP. Auto-approve all contact changes (with email verification for email changes). Add approval workflow in Phase 2 if customers request it.

### 7.4 Database Schema (Contact Details)

Contact details are stored in the `owners` table (defined in Feature 02: Scheme & Lot Register).
The `owners` table already includes all necessary fields:
- Personal details (first_name, last_name, title, preferred_name)
- Contact methods (email, email_secondary, phone_mobile, phone_home, phone_work)
- Postal address (postal_address_line1, postal_address_line2, postal_suburb, postal_state, postal_postcode, postal_country)
- Correspondence preferences (correspondence_method, correspondence_language)

### 7.5 API Endpoints (Contact Details)

**GET /api/portal/profile**
- **Access:** Authenticated portal user
- **Returns:**
  ```json
  {
    "first_name": "John",
    "last_name": "Smith",
    "email": "john@example.com",
    "phone": "0412 345 678",
    "postal_address": "123 Beach Road",
    "postal_suburb": "Perth",
    "postal_state": "WA",
    "postal_postcode": "6000",
    "levy_notice_method": "email",
    "agm_notice_method": "email",
    "emergency_contact_name": "Jane Smith",
    "emergency_contact_phone": "0498 765 432",
    "emergency_contact_relationship": "Spouse"
  }
  ```

**PATCH /api/portal/profile**
- **Access:** Authenticated portal user
- **Payload:** Partial update (only fields being changed)
  ```json
  {
    "phone": "0412 999 888",
    "postal_address": "456 New Street",
    "levy_notice_method": "both"
  }
  ```
- **Returns:** `{success: true}`
- **Side effects:** Updates `owners` record, sends notification email to manager

**POST /api/portal/profile/change-email**
- **Access:** Authenticated portal user
- **Payload:** `{new_email: "newemail@example.com"}`
- **Returns:** `{success: true, message: "Verification email sent to newemail@example.com"}`
- **Side effects:** Sends verification email with token

**POST /api/portal/profile/verify-email**
- **Access:** Public (token-based)
- **Payload:** `{token: "jwt_token"}`
- **Returns:** `{success: true, message: "Email verified and updated"}`
- **Side effects:** Updates email, sends confirmation to old email, notifies manager

---

## 8. Meeting Information

### 8.1 View Upcoming Meetings

**Page title:** "Meetings"

**Section 1: Upcoming Meetings**
- **Card per meeting:**
  - **Meeting type:** "Annual General Meeting" (badge: AGM)
  - **Date:** 15 May 2026
  - **Time:** 6:00 PM
  - **Location:** Community Hall, 123 Beach Road, Perth WA 6000
  - **Or:** Zoom link (if online meeting)
  - **Meeting notice:** [Download PDF]
  - **Agenda:** [Download PDF]
  - **Supporting documents:** [View 3 Documents] (e.g., financial statements, budget, proposed by-laws)
  - **Add to calendar:** [Google Calendar] [Apple Calendar] [Outlook] (generate .ics file)

**Section 2: Past Meetings**
- **List of past meetings:**
  - 2025 AGM - 20 May 2025 - [Minutes] [Resolutions] [Financial Report]
  - 2024 AGM - 18 May 2024 - [Minutes] [Resolutions]
  - SGM - 10 October 2024 - [Minutes]
- **Pagination:** 10 meetings per page

**Empty state:** "No upcoming meetings scheduled."

### 8.2 Download Meeting Notice

**Meeting notice is a PDF generated by manager, uploaded to document library, linked to meeting record.**

**Technical implementation:**
- Meeting notice is stored as a `documents` record (category: `'meeting_notice'`)
- Link: `documents.id` referenced in `meetings.notice_document_id`
- Owner clicks "Download PDF" → API call → redirect to signed Supabase Storage URL

### 8.3 Submit Proxy (Future Feature Placeholder)

**Scenario:** Owner cannot attend AGM, wants to appoint a proxy voter.

**Future implementation (Phase 3):**
1. Owner clicks "Submit Proxy" button on meeting card
2. Form:
   - **Appoint proxy to:** Dropdown (other owners in scheme) or "Type name"
   - **Type:** General proxy (votes on all matters) or Limited proxy (specific agenda items)
   - **Digital signature:** Owner signs via touchscreen or uploads signed form
3. Submit proxy form
4. Manager receives notification, includes proxy in AGM attendance list

**MVP decision:** Placeholder only. Show "Proxy voting will be available soon" message. Add in Phase 3 based on customer demand.

### 8.4 Database Schema (Meetings)

```sql
-- Table: meetings
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  meeting_type TEXT NOT NULL, -- 'agm', 'sgm', 'committee'
  meeting_date DATE NOT NULL,
  meeting_time TIME,
  location TEXT, -- Physical location or Zoom link
  notice_document_id UUID REFERENCES documents(id), -- Meeting notice PDF
  agenda_document_id UUID REFERENCES documents(id), -- Agenda PDF
  minutes_document_id UUID REFERENCES documents(id), -- Minutes PDF (added after meeting)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_meetings_scheme ON meetings(scheme_id);
CREATE INDEX idx_meetings_date ON meetings(meeting_date DESC);

-- RLS Policy: Owners can view meetings for their scheme
ALTER TABLE meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view meetings in their scheme"
ON meetings FOR SELECT
USING (
  scheme_id IN (
    SELECT DISTINCT lots.scheme_id
    FROM lot_ownerships
    JOIN lots ON lots.id = lot_ownerships.lot_id
    WHERE lot_ownerships.owner_id = (
      SELECT id FROM owners WHERE auth_user_id = auth.uid()
    )
    AND lot_ownerships.ownership_end_date IS NULL
  )
);
```

### 8.5 API Endpoints (Meetings)

**GET /api/portal/meetings**
- **Access:** Authenticated portal user
- **Query params:** `?scheme_id={uuid}&upcoming=true`
- **Returns:**
  ```json
  {
    "meetings": [
      {
        "id": "uuid",
        "meeting_type": "agm",
        "meeting_date": "2026-05-15",
        "meeting_time": "18:00",
        "location": "Community Hall, 123 Beach Road",
        "notice_url": "https://storage.levylite.com.au/...",
        "agenda_url": "https://storage.levylite.com.au/...",
        "supporting_documents": [
          {"id": "uuid", "filename": "2026 Budget.pdf", "url": "..."}
        ]
      }
    ]
  }
  ```

**GET /api/portal/meetings/{id}/calendar**
- **Access:** Authenticated portal user
- **Returns:** .ics file (iCalendar format) for adding to calendar apps
- **Filename:** `AGM_15May2026.ics`

---

## 9. Notifications

### 9.1 Email Notification Types

**Owners receive email notifications for:**

1. **Account Activation**
   - Sent when: Manager invites owner to portal
   - Template: "Welcome to [Scheme Name] Owner Portal"
   - CTA: "Activate My Account"

2. **Magic Link Login**
   - Sent when: Owner requests login link
   - Template: "Your Login Link"
   - CTA: "Log In to Owner Portal"

3. **Levy Notice**
   - Sent when: Manager sends levy notice
   - Template: "Your Levy Notice for [Period]"
   - Content: Levy amount, due date, payment instructions
   - Attachment: Levy notice PDF
   - CTA: "View in Portal"

4. **Maintenance Request Updates**
   - Sent when: Manager updates status, assigns tradesperson, adds note, marks completed
   - Template: "Update on Your Maintenance Request #[Number]"
   - Content: Status change, manager's note
   - CTA: "View Request Details"

5. **New Document Uploaded**
   - Sent when: Manager uploads owner-visible document (AGM minutes, by-laws, insurance certificate)
   - Template: "New Document Available: [Filename]"
   - Content: Document name, category, upload date
   - CTA: "View Document"

6. **Meeting Notices**
   - Sent when: Manager sends AGM/SGM notice
   - Template: "Notice of [Meeting Type] - [Date]"
   - Content: Meeting date, time, location
   - Attachment: Meeting notice PDF, agenda PDF
   - CTA: "View Meeting Details"

7. **Contact Details Changed**
   - Sent when: Owner updates contact details (confirmation email)
   - Template: "Your Contact Details Have Been Updated"
   - Content: Summary of changes

8. **Email Address Changed**
   - Sent when: Owner changes email (confirmation to old email)
   - Template: "Your Email Address Has Been Changed"
   - Content: Old email → new email, timestamp
   - Security warning: "If you didn't make this change, contact your strata manager immediately"

### 9.2 Notification Preferences

**Page title:** "Notification Settings"

**Section 1: Email Notifications**

**Table:**

| Notification Type | Email | SMS (Future) |
|-------------------|-------|--------------|
| Levy notices | ✅ (required) | ☐ |
| Maintenance request updates | ☑️ (enabled) | ☐ |
| New documents uploaded | ☑️ (enabled) | ☐ |
| Meeting notices | ✅ (required) | ☐ |
| Account security alerts | ✅ (required) | ☐ |

**Legend:**
- ✅ = Always enabled (cannot disable)
- ☑️ = Enabled by default (can disable)
- ☐ = Disabled by default (can enable)

**Section 2: Notification Frequency (Future)**
- Radio buttons: "Real-time (as they happen)" | "Daily digest (once per day)" | "Weekly digest"
- MVP: Real-time only

**Save button:** "Save Preferences"

### 9.3 Email Delivery Infrastructure

**Service:** Resend or SendGrid

**Configuration:**
- **From address:** `noreply@levylite.com.au` (or white-label domain)
- **From name:** "[Scheme Name] Strata Management"
- **Reply-to:** Manager's email address
- **Tracking:** Open tracking enabled (to measure engagement)
- **Unsubscribe link:** Only for non-essential emails (maintenance updates, document uploads)—NOT for levy notices or meeting notices (legally required)

**Database tracking:**

```sql
-- Table: email_notifications
CREATE TABLE email_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES owners(id),
  email_type TEXT NOT NULL, -- 'levy_notice', 'maintenance_update', 'document_upload', etc.
  subject TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'delivered', 'opened', 'bounced', 'failed'
  external_id TEXT -- Resend/SendGrid message ID
);

CREATE INDEX idx_email_notifications_user ON email_notifications(owner_id, sent_at DESC);
```

### 9.4 API Endpoints (Notifications)

**GET /api/portal/notifications/preferences**
- **Access:** Authenticated portal user
- **Returns:**
  ```json
  {
    "levy_notices": {"email": true, "sms": false},
    "maintenance_updates": {"email": true, "sms": false},
    "document_uploads": {"email": true, "sms": false},
    "meeting_notices": {"email": true, "sms": false}
  }
  ```

**PATCH /api/portal/notifications/preferences**
- **Access:** Authenticated portal user
- **Payload:**
  ```json
  {
    "maintenance_updates": {"email": false},
    "document_uploads": {"email": false}
  }
  ```
- **Returns:** `{success: true}`

---

## 10. Multi-Lot Owners

### 10.1 Use Cases

**Scenario 1: Investor owning multiple lots in same scheme**
- Example: Sarah owns Units 5, 12, and 18 in Sunset Apartments
- Needs: View combined levy balance, switch between units to see individual details

**Scenario 2: Investor owning lots in different schemes**
- Example: John owns Unit 12 in Sunset Apartments and Unit 401 in Ocean View Towers
- Needs: Switch between schemes, view all levies across portfolio

**Scenario 3: Family with multiple properties**
- Example: Parents own Unit 5, adult daughter owns Unit 12 (different lots, same scheme)
- Needs: Separate portal accounts (privacy)

### 10.2 Dashboard for Multi-Lot Owners

**Default view: "All Lots" Summary**

**Header:**
- Dropdown: "All Lots ▼" (or scheme selector if lots span multiple schemes)

**Summary Cards:**

**Card 1: Total Balance Across All Lots**
- **Total Balance:** $1,234.56 (sum of all lots)
- **Lots in Arrears:** 1 of 3
- **Next Levy Due:** $1,350.00 (combined)

**Card 2: Lot Breakdown Table**
- **Columns:** Scheme | Lot | Balance | Next Due | Status
- **Rows:**
  - Sunset Apartments | Unit 5 | $0.00 | $450 on 31 Mar | ✅ Up to Date
  - Sunset Apartments | Unit 12 | $1,234.56 | $450 on 31 Mar | ❌ 45 days overdue
  - Sunset Apartments | Unit 18 | $0.00 | $450 on 31 Mar | ✅ Up to Date
- **Click row:** Drill into lot-specific view

**Alternative: Lot Selector (Dropdown or Tabs)**

**Header:**
- Dropdown: "Select Lot: Sunset Apts - Unit 12 ▼"
- Menu options:
  - All Lots (Summary)
  - Sunset Apartments - Unit 5
  - Sunset Apartments - Unit 12
  - Sunset Apartments - Unit 18
  - Ocean View Towers - Unit 401

**Selecting a lot:**
- Dashboard, levy info, documents, maintenance requests all scoped to selected lot
- Breadcrumb: "Home > Sunset Apartments > Unit 12"

### 10.3 Lot Context Switching

**Technical implementation:**

**Client-side state management:**
- **Context provider:** React Context API or Zustand store
- **State:** `selectedLotId` (UUID)
- **Persistence:** localStorage (remember last selected lot across sessions)

**API calls:**
- All API endpoints accept `?lot_id={uuid}` query parameter
- If not provided, default to first lot in user's access list

**UI pattern:**
- Sticky lot selector (always visible at top of page)
- When user switches lot, page re-fetches data for new lot
- Loading indicator while switching

### 10.4 Navigation Scoping

**Question:** Should navigation menu items be scoped per lot or global?

**Decision (MVP):**
- **Global navigation:** Dashboard, Levy Info, Documents, Maintenance, Meetings, Profile
- **Lot-scoped content:** All content (except Profile) filtered by selected lot
- **Documents exception:** Documents are scheme-level (visible across all lots in same scheme)

**Example:**
- Owner selects "Sunset Apartments - Unit 12"
- Dashboard shows levy balance for Unit 12
- Levy Info shows transactions for Unit 12
- Documents show all Sunset Apartments documents (not lot-specific)
- Maintenance shows requests submitted for Unit 12

### 10.5 Data Scoping via RLS

**RLS ensures owners only see data for lots they have access to:**

```sql
-- Example: levy_transactions RLS policy
CREATE POLICY "Owners can view levy transactions for their lots"
ON levy_transactions FOR SELECT
USING (
  lot_id IN (
    SELECT lot_id FROM owner_lot_access
    WHERE portal_user_id = (
      SELECT id FROM portal_users WHERE auth_user_id = auth.uid()
    )
  )
);
```

**Same pattern applies to:**
- `levy_transactions`
- `maintenance_requests`
- `documents` (scheme-level, not lot-level)
- `meetings` (scheme-level)

### 10.6 API Endpoints (Multi-Lot)

**GET /api/portal/lots/summary**
- **Access:** Authenticated portal user
- **Returns:** Summary of all lots user has access to
  ```json
  {
    "total_balance": 1234.56,
    "total_arrears": 1234.56,
    "lots_in_arrears": 1,
    "total_lots": 3,
    "next_levy_total": 1350.00,
    "lots": [
      {
        "scheme_id": "uuid",
        "scheme_name": "Sunset Apartments",
        "lot_id": "uuid",
        "lot_number": "5",
        "balance": 0.00,
        "status": "up_to_date",
        "next_levy": {"amount": 450.00, "due_date": "2026-03-31"}
      },
      ...
    ]
  }
  ```

---

## 11. Mobile-First Design

### 11.1 Responsive Breakpoints

**Tailwind CSS breakpoints:**
- **Mobile:** < 640px (default)
- **Tablet:** 640px - 1024px (sm/md)
- **Desktop:** ≥ 1024px (lg/xl)

**Design philosophy:** Mobile-first CSS (default styles for mobile, override with `md:` and `lg:` modifiers)

### 11.2 Mobile UI Patterns

**Navigation:**
- **Mobile:** Hamburger menu (☰) → slide-in drawer
- **Desktop:** Horizontal nav bar or sidebar

**Lot selector (multi-lot owners):**
- **Mobile:** Sticky dropdown at top of screen
- **Desktop:** Sidebar or header dropdown

**Dashboard cards:**
- **Mobile:** Stacked vertically (1 column)
- **Desktop:** Grid (2 or 3 columns)

**Tables:**
- **Mobile:** Card-based layout (each row is a card)
- **Desktop:** Traditional table with columns

**Forms:**
- **Mobile:** Full-width inputs, large touch targets (min 44×44px)
- **Desktop:** Standard form layout

### 11.3 Photo Upload from Phone Camera

**Maintenance request photo upload:**

**Desktop:**
- Click "Add Photo" → file picker → select from hard drive

**Mobile:**
- Click "Add Photo" → modal with options:
  - "Take Photo" (opens camera)
  - "Choose from Gallery" (opens photo library)
- After capture: Preview → Crop/Rotate (optional) → Add to request

**Technical implementation:**
- **HTML5 input:** `<input type="file" accept="image/*" capture="environment">`
  - `capture="environment"` opens rear camera on phones
- **Library:** react-webcam or native `<input>` (simpler for MVP)
- **Image compression:** Compress before upload (reduce 5MB photo to <1MB using browser-image-compression library)

### 11.4 Touch Gestures

**Swipe gestures (future enhancement):**
- Swipe left/right on dashboard to switch between lots (multi-lot owners)
- Swipe to delete maintenance request comment

**MVP:** Standard tap/click interactions only

### 11.5 Performance Optimisations (Mobile)

**Reduce bundle size:**
- Code-splitting: Lazy-load routes (Dashboard, Levy Info, Documents, etc.)
- Tree-shaking: Remove unused shadcn/ui components

**Optimise images:**
- Use WebP format with JPEG fallback
- Lazy-load images below fold
- Scheme logos: max 200px wide, compressed

**API response caching:**
- Cache dashboard data for 5 minutes (reduce API calls)
- Use stale-while-revalidate pattern (show cached data, fetch fresh in background)

**Offline support (future):**
- Service worker to cache static assets
- IndexedDB to cache API responses
- Show "You're offline" banner when no connection

### 11.6 Testing Checklist

**Test on real devices:**
- iPhone SE (small screen)
- iPhone 14 Pro (modern iOS)
- Samsung Galaxy S21 (Android)
- iPad (tablet)

**Test scenarios:**
- Login via magic link (tap email link → opens portal)
- Navigate dashboard (tap cards, scroll)
- Submit maintenance request (type, take photo, submit)
- View documents (download PDF, preview in browser)
- Switch lots (multi-lot owner)

---

## 12. Data Scoping & Security (RLS Policies)

### 12.1 Row-Level Security (RLS) Overview

**Supabase RLS** ensures data isolation at the database level. Even if the client-side code has a bug, owners cannot access other owners' data.

**Key principle:** Every table with owner-specific data has RLS policies that filter rows based on `auth.uid()` (Supabase Auth user ID).

### 12.2 RLS Policy Patterns

**Pattern 1: Owner can only see their own lots**

Used for: `levy_transactions`, `maintenance_requests`, `owner_lot_access`

```sql
CREATE POLICY "Owners can view own lot data"
ON {table_name} FOR SELECT
USING (
  lot_id IN (
    SELECT lot_id FROM owner_lot_access
    WHERE portal_user_id = (
      SELECT id FROM portal_users WHERE auth_user_id = auth.uid()
    )
  )
);
```

**Pattern 2: Owner can see scheme-level data for schemes they belong to**

Used for: `documents`, `meetings`

```sql
CREATE POLICY "Owners can view scheme data"
ON {table_name} FOR SELECT
USING (
  scheme_id IN (
    SELECT scheme_id FROM owner_lot_access
    WHERE portal_user_id = (
      SELECT id FROM portal_users WHERE auth_user_id = auth.uid()
    )
  )
  AND visibility = 'owners' -- Additional filter for documents
);
```

**Pattern 3: Owner can insert their own data**

Used for: `maintenance_requests`, `maintenance_request_comments`

```sql
CREATE POLICY "Owners can insert own data"
ON {table_name} FOR INSERT
WITH CHECK (
  submitted_by = (
    SELECT id FROM portal_users WHERE auth_user_id = auth.uid()
  )
);
```

**Pattern 4: Owner can update their own profile**

Used for: `portal_users`

```sql
CREATE POLICY "Owners can update own profile"
ON portal_users FOR UPDATE
USING (auth_user_id = auth.uid())
WITH CHECK (auth_user_id = auth.uid());
```

### 12.3 Cross-Scheme Isolation

**Requirement:** Owners in Scheme A cannot see data from Scheme B (even if both schemes are managed by the same manager).

**Implementation:**
- All RLS policies filter by `scheme_id` (either directly or via `owner_lot_access.scheme_id`)
- Documents: Only visible if `scheme_id` matches owner's scheme AND `visibility = 'owners'`
- Meetings: Only visible if `scheme_id` matches owner's scheme

**Example:**
- Owner A has access to Lot 5 in Sunset Apartments (scheme_id = `abc123`)
- Owner B has access to Lot 12 in Ocean View Towers (scheme_id = `def456`)
- When Owner A queries documents, RLS filters to `scheme_id = 'abc123'`
- Owner A cannot see Ocean View Towers documents

### 12.4 Manager vs Owner Access

**Manager Portal:** Separate auth context (manager users in `manager_users` table)

**RLS policies distinguish:**
- **Portal users:** Access via `auth.uid()` → `portal_users` → `owner_lot_access`
- **Manager users:** Access via `auth.uid()` → `manager_users` → `schemes` (managers see all schemes they manage)

**Example: Documents RLS**

```sql
-- Policy 1: Owners see owner-visible documents in their schemes
CREATE POLICY "Owners can view owner-visible documents"
ON documents FOR SELECT
USING (
  visibility = 'owners'
  AND scheme_id IN (
    SELECT scheme_id FROM owner_lot_access
    WHERE portal_user_id = (SELECT id FROM portal_users WHERE auth_user_id = auth.uid())
  )
);

-- Policy 2: Managers see all documents in their schemes
CREATE POLICY "Managers can view all documents in managed schemes"
ON documents FOR SELECT
USING (
  scheme_id IN (
    SELECT id FROM schemes WHERE manager_id = auth.uid()
  )
);
```

### 12.5 Audit Logging (Security & Compliance)

**All owner actions logged:**
- Login events
- Document views/downloads
- Levy statement downloads
- Maintenance request submissions
- Profile updates

**Database schema:** See Section 2.4 (`audit_log` table)

**Retention:** 7 years (compliance with strata record-keeping requirements)

**Manager access:** Managers can view audit log for their schemes (e.g., "Which owners downloaded the 2025 AGM minutes?")

### 12.6 SQL Injection Prevention

**Supabase Postgres + RLS:** All queries use parameterised prepared statements (no risk of SQL injection)

**Client-side:** Never construct SQL queries in client code (use Supabase JS client, which parameterises all queries)

### 12.7 XSS Prevention

**User-generated content sanitised:**
- Maintenance request descriptions, comments: HTML-escaped before rendering
- Library: DOMPurify (client-side sanitisation)

**Rich text editing:** If adding rich text editor in future, use sanitisation library to strip malicious tags

---

## 13. Database Schema (Complete Portal Tables)

### 13.1 Portal-Specific Tables

```sql
-- ============================================
-- PORTAL USERS & ACCESS
-- ============================================

-- Table: portal_users
-- Owner accounts for portal login
CREATE TABLE portal_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  phone TEXT,
  postal_address TEXT,
  postal_suburb TEXT,
  postal_state TEXT,
  postal_postcode TEXT,
  levy_notice_method TEXT DEFAULT 'email', -- 'email', 'post', 'both'
  agm_notice_method TEXT DEFAULT 'email',
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  emergency_contact_relationship TEXT,
  status TEXT NOT NULL DEFAULT 'invited', -- 'invited', 'active', 'suspended'
  invited_by UUID REFERENCES manager_users(id),
  invited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_portal_users_email ON portal_users(email);
CREATE INDEX idx_portal_users_auth_user_id ON portal_users(auth_user_id);

-- Table: owner_lot_access
-- Defines which lots each portal user can access (supports multi-lot owners)
CREATE TABLE owner_lot_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_user_id UUID NOT NULL REFERENCES portal_users(id) ON DELETE CASCADE,
  scheme_id UUID NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  lot_id UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL DEFAULT 'owner', -- 'owner', 'tenant', 'read_only'
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by UUID REFERENCES manager_users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(portal_user_id, lot_id)
);

CREATE INDEX idx_owner_lot_access_portal_user ON owner_lot_access(portal_user_id);
CREATE INDEX idx_owner_lot_access_lot ON owner_lot_access(lot_id);
CREATE INDEX idx_owner_lot_access_scheme ON owner_lot_access(scheme_id);

-- ============================================
-- NOTIFICATIONS
-- ============================================

-- Table: notification_preferences
-- Per-user notification settings
CREATE TABLE notification_preferences (
  portal_user_id UUID PRIMARY KEY REFERENCES portal_users(id) ON DELETE CASCADE,
  levy_notices_email BOOLEAN DEFAULT true,
  levy_notices_sms BOOLEAN DEFAULT false,
  maintenance_updates_email BOOLEAN DEFAULT true,
  maintenance_updates_sms BOOLEAN DEFAULT false,
  document_uploads_email BOOLEAN DEFAULT true,
  document_uploads_sms BOOLEAN DEFAULT false,
  meeting_notices_email BOOLEAN DEFAULT true,
  meeting_notices_sms BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Table: email_notifications
-- Tracks sent emails for deliverability monitoring
CREATE TABLE email_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_user_id UUID NOT NULL REFERENCES portal_users(id),
  email_type TEXT NOT NULL, -- 'levy_notice', 'maintenance_update', 'document_upload', etc.
  subject TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'delivered', 'opened', 'bounced', 'failed'
  external_id TEXT -- Resend/SendGrid message ID
);

CREATE INDEX idx_email_notifications_user ON email_notifications(portal_user_id, sent_at DESC);

-- ============================================
-- AUDIT LOG
-- ============================================

-- Table: audit_log
-- Comprehensive audit trail for compliance & security
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL, -- 'login', 'logout', 'document_view', 'levy_download', etc.
  user_type TEXT NOT NULL, -- 'portal_user', 'manager_user'
  user_id UUID NOT NULL,
  scheme_id UUID,
  lot_id UUID,
  resource_type TEXT, -- 'document', 'levy_statement', 'maintenance_request'
  resource_id UUID,
  ip_address INET,
  user_agent TEXT,
  metadata JSONB, -- Additional context (e.g., document filename, request status change)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_log_scheme ON audit_log(scheme_id, created_at DESC);
CREATE INDEX idx_audit_log_event_type ON audit_log(event_type, created_at DESC);

-- ============================================
-- PORTAL SETTINGS (PER SCHEME)
-- ============================================

-- Table: portal_settings
-- Configurable portal behaviour per scheme
CREATE TABLE portal_settings (
  scheme_id UUID PRIMARY KEY REFERENCES schemes(id) ON DELETE CASCADE,
  allow_owner_document_upload BOOLEAN DEFAULT false,
  allow_owner_contact_change BOOLEAN DEFAULT true,
  require_manager_approval_for_contact_change BOOLEAN DEFAULT false,
  show_committee_meeting_minutes BOOLEAN DEFAULT false, -- Committee minutes visible to all owners?
  maintenance_request_enabled BOOLEAN DEFAULT true,
  custom_welcome_message TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### 13.2 RLS Policies (Summary)

**All portal tables have RLS enabled. Policies ensure:**

1. **portal_users:** Owners can only view/update their own record
2. **owner_lot_access:** Owners can only see their own lot access records
3. **documents:** Owners can only see `visibility='owners'` documents in their schemes
4. **levy_transactions:** Owners can only see transactions for their lots
5. **maintenance_requests:** Owners can only see requests they submitted
6. **meetings:** Owners can only see meetings for their schemes
7. **notification_preferences:** Owners can only update their own preferences
8. **audit_log:** Read-only for managers (owners cannot see audit log)

---

## 14. Dependencies & Integration Points

### 14.1 Feature Dependencies

**Owner Portal depends on:**

1. **Authentication System (Supabase Auth)**
   - Magic link functionality
   - Session management
   - User creation/management

2. **Schemes & Lots Module**
   - Scheme data (name, address, logo)
   - Lot data (lot number, unit address, entitlement)
   - Owner data linked to lots

3. **Levy Management Module**
   - Levy balance calculations
   - Payment history
   - Levy notice PDF generation
   - Payment instructions (bank details)

4. **Document Storage Module**
   - Document upload/download
   - Category management
   - Visibility controls (owner vs manager-only)

5. **Maintenance Requests Module**
   - Request submission
   - Status workflow
   - Tradesperson assignment (manager-side)
   - Comment/photo attachments

6. **Meeting Administration Module**
   - Meeting creation (manager-side)
   - Meeting notice/agenda PDF generation
   - Minutes storage

7. **Email Notification System**
   - Transactional email service (Resend/SendGrid)
   - Email templates
   - Delivery tracking

### 14.2 Integration with Manager Portal

**Owner Portal is read-only for most data.** Managers create/edit data via Manager Portal:

- **Schemes & Lots:** Manager creates, owner views
- **Levy transactions:** Manager enters payments, owner views balance/history
- **Documents:** Manager uploads, owner downloads
- **Meetings:** Manager creates meeting, owner views details
- **Maintenance requests:** Owner submits, manager updates status, owner views updates

**Two-way interactions:**
- **Contact details:** Owner updates, manager receives notification (and can revert if needed)
- **Maintenance requests:** Owner submits, manager responds, owner adds comments

### 14.3 API Authentication Flow

**All Owner Portal API calls require authentication:**

1. **Client sends request** with Supabase session token (cookie or Authorization header)
2. **Next.js API route** validates token via Supabase middleware
3. **Extract `auth.uid()`** (Supabase user ID)
4. **Query database with RLS enabled** (RLS automatically filters rows based on `auth.uid()`)
5. **Return data** (only data the owner is authorised to see)

**Example API route (Next.js App Router):**

```typescript
// app/api/portal/dashboard/route.ts
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const supabase = createClient();

  // Verify authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  // Extract lot_id from query params
  const { searchParams } = new URL(request.url);
  const lotId = searchParams.get('lot_id');

  // Query with RLS (automatically filters to user's lots)
  const { data, error } = await supabase
    .from('levy_transactions')
    .select('*')
    .eq('lot_id', lotId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ transactions: data });
}
```

---

## 15. Open Questions & Future Enhancements

### 15.1 Open Questions

**Q1: Should owners be able to upload documents?**
- **Use case:** Upload proof of payment, renovation approval forms
- **Concern:** Moderation burden for managers (spam, inappropriate content)
- **MVP decision:** No. Defer to Phase 2. Owners can email documents to manager.

**Q2: Should owners be able to communicate with each other via portal?**
- **Use case:** Scheme forum/message board (e.g., "Does anyone have a good plumber recommendation?")
- **Concern:** Moderation burden, liability (defamatory comments), privacy
- **MVP decision:** No. Too risky. Use external platforms (Facebook groups, WhatsApp) if desired.

**Q3: Should committee members have elevated portal access?**
- **Use case:** Committee members need access to financial reports, tradesperson quotes, legal correspondence
- **Implementation:** Add `access_level = 'committee'` in `owner_lot_access`, show additional documents/features
- **MVP decision:** Defer to Phase 2. Committee members can access Manager Portal (give them read-only manager accounts).

**Q4: Should portal support tenants (renters)?**
- **Use case:** Tenants submit maintenance requests, view by-laws
- **Implementation:** Add `access_level = 'tenant'` in `owner_lot_access`, limited permissions (no levy info)
- **MVP decision:** Defer to Phase 2. Tenants contact owner, owner submits request on their behalf.

**Q5: How to handle owners who sell their lot?**
- **Process:** Manager marks lot as sold, transfers ownership to new owner
- **Portal access:** Old owner's access revoked, new owner invited
- **Data retention:** Old owner can export their historical data before access revoked
- **MVP decision:** Manual process. Manager updates lot ownership, revokes old portal access, invites new owner.

### 15.2 Phase 2 Enhancements

**Based on customer feedback, prioritise these for Phase 2:**

1. **Online levy payment** (Stripe integration, PayTo/bank debit)
2. **Automated bank feeds** (reconcile payments automatically)
3. **Committee member elevated access** (additional documents, reports)
4. **Tenant portal access** (limited permissions)
5. **Owner document upload** (with manager approval workflow)
6. **Proxy voting** (digital proxy submission for AGMs)
7. **SMS notifications** (for urgent maintenance updates)
8. **Multi-language support** (for schemes with non-English speakers)

### 15.3 Phase 3 Enhancements

**Longer-term, customer-driven features:**

1. **Mobile app (native iOS/Android)** with offline support
2. **Owner-to-owner messaging** (with moderation tools for managers)
3. **Online AGM voting** (ballot system, live results)
4. **Scheme forum/notice board** (moderated by manager)
5. **Integration with smart building systems** (e.g., parcel lockers, access control)

---

## 16. Success Criteria & Metrics

### 16.1 Feature Launch Readiness

**Owner Portal MVP is ready to launch when:**

✅ All authentication flows work (invite, activate, login, logout)  
✅ Dashboard displays levy balance, payment history, quick actions  
✅ Levy statement downloadable as PDF  
✅ Documents browseable and downloadable (with RLS enforced)  
✅ Maintenance requests submittable with photo upload  
✅ Owners can view and update contact details  
✅ Meeting information displayed (upcoming meetings, download notices)  
✅ Email notifications sent for key events (levy notice, maintenance updates, documents)  
✅ Multi-lot owners can switch between lots  
✅ Mobile-responsive (tested on iPhone and Android)  
✅ RLS policies tested and verified (no data leakage)  
✅ Audit logging functional (all key events logged)  

### 16.2 Post-Launch Metrics

**Monitor these metrics to measure success:**

**Adoption:**
- % of owners invited who activate account (target: 60% within 90 days)
- % of active owners who log in at least once per quarter (target: 40%)

**Engagement:**
- Average session duration (target: 3-5 minutes)
- Pages per session (target: 3-4 pages)
- Top-used features (levy balance, documents, maintenance requests)

**Deflection (manager time savings):**
- % reduction in owner inquiries to manager (target: 50%)
- Common inquiry types deflected (levy balance, payment instructions, document requests)

**Mobile usage:**
- % of sessions on mobile devices (target: 70%)
- Mobile-specific actions (photo upload for maintenance requests)

**Quality:**
- Error rate (target: <1% of API calls result in 5xx errors)
- Average page load time (target: <2 seconds)
- Email deliverability (target: >98% delivered, <2% bounce)

**Support burden:**
- Portal-related support tickets per 100 active users (target: <5/month)
- Top support issues (inform Phase 2 improvements)

---

## 17. Conclusion

The **Owner Portal (Self-Service)** is a cornerstone feature of LevyLite, delivering immediate value to both owners (24/7 access to information) and managers (50%+ reduction in routine inquiries). By focusing on the MVP feature set—authentication, levy information, document access, maintenance requests, contact management, and meeting information—we provide a modern, mobile-first experience that differentiates LevyLite from spreadsheet-based workflows and meets the expectations of tech-savvy owners.

The portal's architecture leverages **Supabase RLS** for robust data security, ensuring cross-scheme isolation and owner-level permissions without complex application-layer logic. **Passwordless authentication** via magic links reduces friction and support burden, while **email notifications** keep owners informed without requiring them to remember to log in.

With **multi-lot owner support** built in from day one, the portal scales seamlessly for investors managing portfolios. **Mobile-first design** ensures the majority of users (70%+) can access the portal from their phones, with optimised layouts, touch-friendly UI, and camera integration for maintenance request photos.

This specification provides a comprehensive blueprint for implementation, including database schemas, RLS policies, API endpoints, UI flows, notification templates, and mobile considerations. The MVP scope is deliberately focused on high-value, low-complexity features, with a clear roadmap for Phase 2 enhancements (online payment, tenant access, committee permissions) based on customer feedback.

**Next steps:**
1. Review this specification with design partners (validate feature priorities)
2. Create UI mockups (Figma) for key screens (dashboard, levy statement, maintenance submission)
3. Implement database schema and RLS policies
4. Build authentication flows (invite, activate, login)
5. Develop dashboard and core features (levy info, documents, maintenance)
6. Beta test with 3-5 schemes
7. Iterate based on feedback and launch publicly

**Estimated development time:** 4-6 weeks (full-time) or 8-12 weeks (part-time) for MVP implementation.

---

**Document Version:** 1.0  
**Last Updated:** 16 February 2026  
**Author:** Kai (Kokoro Software)  
**Prepared for:** LevyLite Product Development
