# LevyLite Glossary

**Document Version:** 1.0  
**Last Updated:** 16 February 2026  
**Status:** Canonical Reference — Use These Terms Consistently  
**Purpose:** Standard terminology for all LevyLite documentation, code, and UI

---

## Introduction

This glossary defines the **canonical terms** used throughout the LevyLite platform. All documentation, code, database schemas, API endpoints, and user interfaces must use these exact terms to maintain consistency and clarity.

### How to Use This Glossary

- **Term:** The canonical name (use exactly this)
- **Definition:** What it means in the context of strata management
- **Avoid:** Incorrect or ambiguous alternatives (anti-patterns)
- **Example:** Usage in context

### Conventions

- **Singular vs Plural:** Database tables use plural (`schemes`, `lots`), but domain language uses singular ("the scheme", "lot 12")
- **Capitalization:** Domain terms are lowercase in normal text, capitalized in headings/titles
- **Code:** Database/code uses `snake_case`, API JSON uses `camelCase`

---

## Core Domain Terms

### Scheme

**Definition:** A legally registered strata property (collection of lots with common property). Identified by a strata plan number (e.g., "SP 12345"). One scheme = one body corporate.

**Avoid:**
- ❌ Strata plan (use "scheme" instead)
- ❌ Complex (too generic, not legally accurate)
- ❌ Property (too generic)
- ❌ Building (may have multiple buildings)

**Example:**
> "Sunset Gardens scheme (SP 12345) has 24 lots and common facilities including a pool and gym."

**Database:** `schemes` table  
**Code:** `scheme`, `scheme_id`  
**API:** `scheme`, `schemeId`

---

### Lot

**Definition:** An individual unit or apartment within a strata scheme. Each lot has a unique lot number and unit entitlement. Can be owned by one or more owners.

**Avoid:**
- ❌ Unit (use "lot" in technical contexts)
- ❌ Apartment (use "lot" in technical contexts)
- ❌ Property (too generic)
- ⚠️ Unit is acceptable in UI display (e.g., "Unit 12") but backend should use "lot"

**Example:**
> "Lot 12 has a unit entitlement of 100 and is jointly owned by John and Mary Smith."

**Database:** `lots` table  
**Code:** `lot`, `lot_id`, `lot_number`  
**API:** `lot`, `lotId`, `lotNumber`

---

### Owner

**Definition:** A person or entity who legally owns a lot (appears on the certificate of title). Owners may also be portal users if they activate their account.

**Avoid:**
- ❌ Proprietor (correct legally, but not used in AU strata)
- ❌ Member (confusing, implies membership organization)
- ❌ Resident (they may not live there—could be investor)
- ❌ Portal user (that's a different concept—not all owners have portal access)

**Example:**
> "John Smith (owner of Lot 12) has not yet activated his owner portal account."

**Database:** `owners` table  
**Code:** `owner`, `owner_id`  
**API:** `owner`, `ownerId`

---

### Organisation

**Definition:** A strata management business (tenant in multi-tenant system). One organisation manages multiple schemes. Example: "Sarah's Strata Management".

**Avoid:**
- ❌ Company (implies legal structure)
- ❌ Business (too generic)
- ❌ Firm (too generic)
- ❌ Tenant (correct for multi-tenancy but confusing with strata "tenant")

**Example:**
> "Sarah's Strata Management (organisation) manages 15 schemes across Perth metro."

**Database:** `organisations` table  
**Code:** `organisation`, `organisation_id`  
**API:** `organisation`, `organisationId`

---

### Manager

**Definition:** A person who manages strata schemes (strata manager role). Has full access to all features within their organisation.

**Avoid:**
- ❌ Admin (that's a different role—staff with limited permissions)
- ❌ Operator (too generic)
- ❌ User (too generic)

**Example:**
> "Sarah (manager) can delete transactions and approve budgets. Jane (admin) can enter transactions but not delete them."

**Database:** `organisation_users.role = 'manager'`  
**Code:** `role: 'manager'`  
**API:** `role: "manager"`

---

### Admin

**Definition:** A staff member working for the strata management organisation. Can create/edit data but cannot delete (limited permissions compared to manager).

**Avoid:**
- ❌ Assistant (implies secondary role)
- ❌ Staff (too generic)
- ❌ Manager (that's a different role with more permissions)

**Example:**
> "Jane (admin) can enter levy payments and create maintenance requests, but only Sarah (manager) can delete financial transactions."

**Database:** `organisation_users.role = 'admin'`  
**Code:** `role: 'admin'`  
**API:** `role: "admin"`

---

### Auditor

**Definition:** A financial auditor with read-only access to financial documents and trust accounting. Cannot edit or delete anything. Typically external accountant or auditor.

**Avoid:**
- ❌ Accountant (broader term)
- ❌ Viewer (too generic)

**Example:**
> "The external auditor has read-only access to trust accounting ledgers and AGM financial statements."

**Database:** `organisation_users.role = 'auditor'`  
**Code:** `role: 'auditor'`  
**API:** `role: "auditor"`

---

### Committee Member

**Definition:** An owner elected to the strata committee (council of owners). Has extra permissions to view committee-only documents and meeting materials. Positions include chair, treasurer, secretary, and general members.

**Avoid:**
- ❌ Council member (not standard AU strata term)
- ❌ Board member (implies corporate board)
- ❌ Executive (too corporate)

**Example:**
> "John Smith (owner of Lot 12) is the committee chair. He can view committee meeting documents not available to other owners."

**Database:** `committee_members` table  
**Code:** `committee_member`, `position` ('chair', 'treasurer', 'secretary', 'member')  
**API:** `committeeMember`, `position`

---

### Tenant

**Definition:** A person renting/leasing a lot from an owner. Not an owner themselves. Tracked for emergency contact purposes only (no portal access in MVP).

**Avoid:**
- ❌ Renter (use "tenant" in strata context)
- ❌ Lessee (legally correct but not commonly used)
- ❌ Occupant (could be owner or tenant)

**Example:**
> "Lot 12 is owner-occupied. Lot 14 is tenanted—the tenant's emergency contact details are on file."

**Database:** `tenants` table  
**Code:** `tenant`, `tenant_id`, `is_current`  
**API:** `tenant`, `tenantId`, `isCurrent`

---

## Financial Terms

### Levy

**Definition:** A periodic fee charged to lot owners to fund scheme expenses (admin and capital works). Calculated based on unit entitlement. Typically quarterly in WA.

**Avoid:**
- ❌ Fee (too generic)
- ❌ Assessment (not AU terminology)
- ❌ Contribution (implies voluntary—levies are mandatory)
- ❌ Strata fee (colloquial but not technically correct)

**Example:**
> "The Q1 2026 levy for Lot 12 is $1,200 ($800 admin fund + $400 capital works fund), due 15 January 2026."

**Database:** `levy_items` table (individual obligations), `levy_schedules`, `levy_periods`  
**Code:** `levy`, `levy_item`, `admin_levy_amount`, `capital_levy_amount`  
**API:** `levy`, `levyItem`, `adminLevyAmount`, `capitalLevyAmount`

---

### Levy Period

**Definition:** A specific billing cycle within a levy schedule (e.g., "Q1 2026" for quarterly levies, "January 2026" for monthly levies).

**Avoid:**
- ❌ Billing period (use "levy period" in strata context)
- ❌ Quarter (only applies to quarterly levies—use "levy period" for flexibility)
- ❌ Cycle (too generic)

**Example:**
> "The levy period Q1 2026 covers 1 Jan to 31 Mar 2026, with levies due by 15 Jan 2026."

**Database:** `levy_periods` table  
**Code:** `levy_period`, `levy_period_id`, `period_label`  
**API:** `levyPeriod`, `levyPeriodId`, `periodLabel`

---

### Transaction

**Definition:** Any financial entry in trust accounting (receipt, payment, or journal entry). The source of truth for all money movements.

**Avoid:**
- ❌ Payment (that's a specific type of transaction—outgoing money)
- ❌ Entry (too generic)
- ❌ Record (too generic)

**Example:**
> "Transaction #1234: Receipt of $1,200 levy payment from John Smith (Lot 12) into admin fund."

**Database:** `transactions` table  
**Code:** `transaction`, `transaction_id`, `transaction_type` ('receipt', 'payment', 'journal')  
**API:** `transaction`, `transactionId`, `transactionType`

---

### Fund

**Definition:** One of two mandatory trust accounts for strata schemes: **admin fund** (day-to-day expenses) or **capital works fund** (major repairs, long-term maintenance).

**Avoid:**
- ❌ Account (use "fund" in strata context)
- ❌ Pool (not standard terminology)
- ❌ Reserve (only applies to capital works fund colloquially)

**Example:**
> "Insurance premiums are paid from the admin fund. Roof replacement is paid from the capital works fund."

**Database:** `fund_type` column ('admin', 'capital_works')  
**Code:** `fund_type: 'admin'` or `'capital_works'`  
**API:** `fundType: "admin"` or `"capitalWorks"`

---

### Financial Year

**Definition:** The 12-month accounting period for a scheme (typically 1 July to 30 June in Australia, but configurable per scheme).

**Avoid:**
- ❌ FY (abbreviation—use full term in documentation)
- ❌ Fiscal year (US terminology)
- ❌ Year (too generic—could be calendar year)

**Example:**
> "The 2025/26 financial year runs from 1 July 2025 to 30 June 2026."

**Database:** `financial_years` table  
**Code:** `financial_year`, `financial_year_id`, `year_label` ('2025/26')  
**API:** `financialYear`, `financialYearId`, `yearLabel`

---

### Chart of Accounts

**Definition:** The complete list of income, expense, asset, liability, and equity categories used in trust accounting. Defines how transactions are categorized.

**Avoid:**
- ❌ Categories (too generic)
- ❌ GL codes (jargon)
- ❌ Accounts (ambiguous—could mean bank accounts)

**Example:**
> "Transaction category 6100 (Maintenance - General) is in the chart of accounts under expense type."

**Database:** `chart_of_accounts` table  
**Code:** `chart_of_accounts`, `account_type` ('income', 'expense', 'asset', 'liability')  
**API:** `chartOfAccounts`, `accountType`

---

### Budget

**Definition:** The approved financial plan for a financial year, showing estimated income and expenses. Separate budgets for admin and capital works funds. Typically approved at AGM.

**Avoid:**
- ❌ Financial plan (use "budget" in strata context)
- ❌ Forecast (implies prediction—budget is approved plan)

**Example:**
> "The 2025/26 admin fund budget was approved at the AGM with $120,000 in expenses."

**Database:** `budgets` table, `budget_line_items` table  
**Code:** `budget`, `budget_id`, `budget_type` ('admin', 'capital_works')  
**API:** `budget`, `budgetId`, `budgetType`

---

### Arrears

**Definition:** Outstanding levy payments that are overdue. Amount an owner owes beyond the due date.

**Avoid:**
- ❌ Debt (legally problematic term)
- ❌ Overdue amount (use "arrears" in strata context)
- ❌ Outstanding balance (too generic—could include future levies)

**Example:**
> "Lot 12 has $2,400 in arrears (2 quarters unpaid)."

**Database:** Computed from `levy_items.amount_outstanding` WHERE `due_date < NOW()`  
**Code:** `arrears`, `arrears_amount`  
**API:** `arrears`, `arrearsAmount`

---

### Reconciliation

**Definition:** The process of matching bank statement transactions with trust accounting transactions to ensure accuracy and identify discrepancies.

**Avoid:**
- ❌ Bank rec (abbreviation—use full term in documentation)
- ❌ Matching (too generic)

**Example:**
> "The January 2026 reconciliation shows all transactions matched except one $50 bank charge."

**Database:** `bank_statements`, `reconciliations` tables  
**Code:** `reconciliation`, `is_reconciled`  
**API:** `reconciliation`, `isReconciled`

---

## Property & Governance Terms

### Unit Entitlement

**Definition:** The proportional share assigned to each lot, used to calculate levy amounts and voting rights. Example: Lot 12 has UE of 100 out of 2,400 total = 4.17% share.

**Avoid:**
- ❌ Lot entitlement (use "unit entitlement")
- ❌ Share (too generic)
- ❌ UE (abbreviation—use full term in UI)

**Example:**
> "Lot 12 has a unit entitlement of 100. The total scheme unit entitlement is 2,400, so Lot 12 pays 4.17% of total levies."

**Database:** `lots.unit_entitlement` (integer)  
**Code:** `unit_entitlement`  
**API:** `unitEntitlement`

---

### Common Property

**Definition:** Areas of the strata scheme owned collectively by all owners (hallways, driveways, gardens, pools, gym, etc.). Not owned by individual lot owners.

**Avoid:**
- ❌ Shared areas (use "common property" in legal/strata context)
- ❌ Common areas (colloquially acceptable but "common property" is legally correct)
- ❌ Communal space (not standard terminology)

**Example:**
> "The pool and gym are common property, maintained by the strata scheme using admin fund levies."

**Database:** Referenced in `maintenance_requests.lot_id IS NULL` (common property maintenance)  
**Code:** `is_common_property`, `lot_id: null`  
**API:** `isCommonProperty`

---

### By-Law

**Definition:** Rules and regulations specific to a scheme (e.g., "No pets", "No short-term rentals"). Registered on the certificate of title. Owners must comply.

**Avoid:**
- ❌ Rule (too generic)
- ❌ Regulation (implies government law)
- ❌ House rule (informal)
- ⚠️ By-law (hyphenated) is correct AU spelling (not "bylaw")

**Example:**
> "The scheme has a by-law prohibiting pets over 10kg and restricting balcony modifications."

**Database:** `documents.category = 'bylaw'`  
**Code:** `bylaw` (singular), `bylaws` (plural)  
**API:** `bylaw`, `bylaws`

---

### Proxy

**Definition:** Authorization for one owner to vote on behalf of another owner at a meeting. Can be directed (specific votes) or undirected (proxy decides).

**Avoid:**
- ❌ Vote delegation (use "proxy" in strata context)
- ❌ Voting authority (too formal)

**Example:**
> "John Smith granted a directed proxy to Mary Jones to vote 'yes' on the budget motion at the AGM."

**Database:** `proxies` table  
**Code:** `proxy`, `proxy_type` ('directed', 'undirected'), `proxy_holder_id`  
**API:** `proxy`, `proxyType`, `proxyHolderId`

---

### Quorum

**Definition:** Minimum number of owners (or unit entitlement represented) required to be present or by proxy for a meeting to be valid. Typically 50% of unit entitlement for AGM, 25% for committee meetings (varies by state).

**Avoid:**
- ❌ Minimum attendance (use "quorum")
- ❌ Required attendance (use "quorum")

**Example:**
> "The AGM quorum is 1,200 unit entitlement (50% of total 2,400). With 15 owners present representing 1,400 UE, quorum was met."

**Database:** `meetings.quorum_required` (integer), `meetings.quorum_met` (boolean)  
**Code:** `quorum_required`, `quorum_met`  
**API:** `quorumRequired`, `quorumMet`

---

## Meeting Terms

### Meeting

**Definition:** A formal gathering of owners or committee members. Types: AGM (annual general meeting), SGM (special general meeting), committee meeting.

**Avoid:**
- ❌ Session (too generic)
- ❌ Assembly (too formal)
- ❌ Gathering (too informal)

**Example:**
> "The 2025 AGM (meeting) is scheduled for 15 October 2025 at 6:00 PM."

**Database:** `meetings` table  
**Code:** `meeting`, `meeting_id`, `meeting_type` ('agm', 'sgm', 'committee')  
**API:** `meeting`, `meetingId`, `meetingType`

---

### AGM (Annual General Meeting)

**Definition:** A mandatory annual meeting of all owners to approve budgets, elect committee members, and review financial statements. Required by strata law.

**Avoid:**
- ❌ Annual meeting (use "AGM" in strata context)
- ❌ General meeting (too generic—could be SGM)

**Example:**
> "The AGM must be held within 3 months of the financial year end (by 30 September for a 30 June year end)."

**Database:** `meetings.meeting_type = 'agm'`  
**Code:** `meeting_type: 'agm'`  
**API:** `meetingType: "agm"`

---

### SGM (Special General Meeting)

**Definition:** A non-annual general meeting of all owners, called to vote on urgent or specific matters (e.g., special levy, major capital works, by-law changes).

**Avoid:**
- ❌ Emergency meeting (implies unplanned—SGMs are formally noticed)
- ❌ Extraordinary meeting (correct term in some jurisdictions but not AU)

**Example:**
> "An SGM was called to vote on a special levy to fund roof repairs not covered by the capital works fund."

**Database:** `meetings.meeting_type = 'sgm'`  
**Code:** `meeting_type: 'sgm'`  
**API:** `meetingType: "sgm"`

---

### Committee Meeting

**Definition:** A meeting of elected committee members (not all owners) to manage day-to-day scheme operations. More frequent than AGMs (typically monthly or quarterly).

**Avoid:**
- ❌ Council meeting (not standard AU strata term)
- ❌ Board meeting (too corporate)
- ❌ Executive meeting (too corporate)

**Example:**
> "The committee meeting on 15 January 2026 approved three maintenance quotes and reviewed the Q4 financial report."

**Database:** `meetings.meeting_type = 'committee'`  
**Code:** `meeting_type: 'committee'`  
**API:** `meetingType: "committee"`

---

### Agenda

**Definition:** A list of topics (agenda items) to be discussed and voted on at a meeting. Sent to owners with meeting notice.

**Avoid:**
- ❌ Topics (use "agenda" in meeting context)
- ❌ Schedule (implies timing, not topics)

**Example:**
> "The AGM agenda includes: (1) Approval of minutes, (2) Financial report, (3) Budget approval, (4) Committee elections."

**Database:** `agenda_items` table  
**Code:** `agenda_item`, `item_number`, `title`  
**API:** `agendaItem`, `itemNumber`, `title`

---

### Resolution

**Definition:** A formal motion voted on at a meeting. Types: **ordinary resolution** (>50% vote), **special resolution** (75% vote), **unanimous resolution** (100% vote).

**Avoid:**
- ❌ Motion (use "motion" when proposed, "resolution" when voted on)
- ❌ Vote (too generic—"resolution" includes the outcome)

**Example:**
> "Resolution: To approve the 2025/26 budget. Type: Ordinary resolution. Result: Passed (18 votes for, 3 against)."

**Database:** `resolutions` table  
**Code:** `resolution`, `resolution_type` ('ordinary', 'special', 'unanimous'), `result` ('passed', 'failed')  
**API:** `resolution`, `resolutionType`, `result`

---

### Minutes

**Definition:** The official written record of a meeting, including attendees, resolutions, and decisions. Must be approved at the next meeting.

**Avoid:**
- ❌ Meeting notes (too informal)
- ❌ Summary (implies abbreviated—minutes are comprehensive)
- ❌ Record (too generic)

**Example:**
> "The AGM minutes were approved at the next committee meeting and uploaded to the document library."

**Database:** `minutes` table  
**Code:** `minutes`, `approved_at`, `approved_by`  
**API:** `minutes`, `approvedAt`, `approvedBy`

---

## Maintenance Terms

### Maintenance Request

**Definition:** A request to repair or maintain common property or (in some cases) lot-specific issues. Submitted by owners, managers, or committee members.

**Avoid:**
- ❌ Work order (too industrial)
- ❌ Repair request (use "maintenance request" to cover all types)
- ❌ Job (too informal)
- ❌ Ticket (IT terminology)

**Example:**
> "Owner of Lot 12 submitted a maintenance request: 'Leaking pipe in common hallway ceiling near Lot 12 entry.'"

**Database:** `maintenance_requests` table  
**Code:** `maintenance_request`, `status` ('new', 'acknowledged', 'assigned', 'in_progress', 'completed', 'closed')  
**API:** `maintenanceRequest`, `status`

---

### Tradesperson

**Definition:** A contractor or service provider (plumber, electrician, painter, etc.) who performs maintenance work for the scheme.

**Avoid:**
- ❌ Contractor (use "tradesperson" in maintenance context)
- ❌ Vendor (too generic—could be supplier)
- ❌ Service provider (too generic)

**Example:**
> "ABC Plumbing (tradesperson) is a preferred tradesperson for plumbing emergencies."

**Database:** `tradespeople` table  
**Code:** `tradesperson`, `trade_type` ('plumber', 'electrician', etc.)  
**API:** `tradesperson`, `tradeType`

---

### Quote

**Definition:** A written estimate of cost for maintenance work, provided by a tradesperson before work begins.

**Avoid:**
- ❌ Estimate (colloquially acceptable but "quote" is more formal)
- ❌ Proposal (too corporate)

**Example:**
> "The scheme received three quotes for roof repairs: $15,000, $18,000, and $22,000. The committee approved the $15,000 quote."

**Database:** `quotes` table  
**Code:** `quote`, `quote_amount`, `is_accepted`  
**API:** `quote`, `quoteAmount`, `isAccepted`

---

### Invoice

**Definition:** A bill for completed work, issued by a tradesperson after maintenance is finished.

**Avoid:**
- ❌ Bill (use "invoice" in professional context)
- ❌ Receipt (that's proof of payment, not request for payment)

**Example:**
> "ABC Plumbing issued invoice #1234 for $1,500 for roof leak repair. Manager paid the invoice from the capital works fund."

**Database:** `invoices` table  
**Code:** `invoice`, `invoice_number`, `payment_reference`  
**API:** `invoice`, `invoiceNumber`, `paymentReference`

---

## Document Terms

### Document

**Definition:** Any file stored in the system (AGM minutes, levy notices, insurance certificates, by-laws, meeting agendas, etc.).

**Avoid:**
- ❌ File (use "document" in user-facing context)
- ❌ Attachment (implies linked to something—documents can be standalone)

**Example:**
> "The 2025 AGM minutes document was uploaded on 20 October 2025 and is visible to all owners."

**Database:** `documents` table  
**Code:** `document`, `category` ('agm', 'levy', 'insurance', 'bylaw', 'maintenance', 'financial')  
**API:** `document`, `category`

---

### Document Category

**Definition:** Classification of documents by type: AGM, levy, insurance, by-law, maintenance, financial, etc.

**Avoid:**
- ❌ Document type (use "category" to match database schema)
- ❌ Folder (implies file system structure)

**Example:**
> "All AGM minutes are stored in the 'agm' category and are visible to all owners."

**Database:** `documents.category`  
**Code:** `category`  
**API:** `category`

---

### Document Visibility

**Definition:** Access control for documents. Levels: **owners** (all owners can view), **committee** (committee members only), **manager_only** (managers/admins only).

**Avoid:**
- ❌ Permissions (too technical)
- ❌ Access level (use "visibility" to match schema)

**Example:**
> "The insurance renewal quote has visibility 'manager_only' because it contains commercially sensitive pricing."

**Database:** `documents.visibility` ('owners', 'committee', 'manager_only')  
**Code:** `visibility`  
**API:** `visibility`

---

## Status Terms

### Levy Status

**Definition:** The state of a levy item. Values: **pending** (not sent), **sent** (notice sent), **paid** (fully paid), **partial** (partially paid), **overdue** (past due date, unpaid).

**Avoid:**
- ❌ Payment status (use "levy status")
- ❌ UPPERCASE values (use lowercase: 'pending', not 'PENDING')

**Example:**
> "Lot 12 levy status is 'paid'. Lot 14 levy status is 'overdue' ($1,200 outstanding, 30 days past due)."

**Database:** `levy_items.status`  
**Code:** `status: 'pending' | 'sent' | 'paid' | 'partial' | 'overdue'`  
**API:** `status: "pending" | "sent" | "paid" | "partial" | "overdue"`

---

### Maintenance Request Status

**Definition:** The workflow state of a maintenance request. Values: **new**, **acknowledged**, **assigned**, **in_progress**, **quoted**, **approved**, **completed**, **closed**.

**Avoid:**
- ❌ UPPERCASE values (use lowercase)
- ❌ Custom statuses not in schema

**Example:**
> "Maintenance request #456 status is 'in_progress' (plumber is on-site repairing the leak)."

**Database:** `maintenance_requests.status`  
**Code:** `status: 'new' | 'acknowledged' | 'assigned' | 'in_progress' | 'quoted' | 'approved' | 'completed' | 'closed'`  
**API:** `status: "new" | "acknowledged" | "assigned" | "inProgress" | "quoted" | "approved" | "completed" | "closed"`

---

### Meeting Status

**Definition:** The workflow state of a meeting. Values: **draft**, **scheduled**, **notice_sent**, **in_progress**, **completed**, **adjourned**, **cancelled**.

**Avoid:**
- ❌ UPPERCASE values (use lowercase)
- ❌ Custom statuses not in schema

**Example:**
> "The AGM status is 'notice_sent' (notices were sent 21 days ago, meeting is scheduled for next week)."

**Database:** `meetings.status`  
**Code:** `status: 'draft' | 'scheduled' | 'notice_sent' | 'in_progress' | 'completed' | 'adjourned' | 'cancelled'`  
**API:** `status: "draft" | "scheduled" | "noticeSent" | "inProgress" | "completed" | "adjourned" | "cancelled"`

---

## Technical Terms

### Portal

**Definition:** The owner-facing web interface where owners can view documents, pay levies, submit maintenance requests, and RSVP to meetings.

**Avoid:**
- ❌ Owner app (implies mobile app—portal is web-based)
- ❌ Dashboard (that's part of the portal, not the portal itself)
- ❌ Website (too generic)

**Example:**
> "John Smith activated his owner portal account and can now view levy notices and submit maintenance requests."

**Database:** `owners.auth_user_id` (set when portal activated)  
**Code:** `portal_activated_at`  
**API:** `portalActivatedAt`

---

### Invitation

**Definition:** An email invitation sent to an owner to activate their portal account, or to a user to join an organisation.

**Avoid:**
- ❌ Invite (abbreviation—use full term in documentation)
- ❌ Access request (implies user-initiated)

**Example:**
> "Manager sent an invitation to john.smith@email.com to activate his owner portal account for Lot 12."

**Database:** `invitations` table  
**Code:** `invitation`, `token`, `expires_at`  
**API:** `invitation`, `token`, `expiresAt`

---

### Notification

**Definition:** A system message sent to a user (email, in-app, or future SMS). Types: levy notice, meeting notice, maintenance update, etc.

**Avoid:**
- ❌ Alert (implies urgency)
- ❌ Message (too generic)

**Example:**
> "Owner received a notification: 'Your Q1 2026 levy notice is now available in the portal.'"

**Database:** `notifications` table (future), `email_log` table (current)  
**Code:** `notification_type` ('levy_notice', 'meeting_notice', 'maintenance_update')  
**API:** `notificationType`

---

### Audit Log

**Definition:** A system record of all create/update/delete actions, including who did what and when. Used for security and compliance.

**Avoid:**
- ❌ Activity log (use "audit log" for compliance context)
- ❌ History (too generic)

**Example:**
> "The audit log shows Sarah (manager) deleted transaction #1234 on 15 Jan 2026 at 10:32 AM."

**Database:** `audit_log` table  
**Code:** `audit_log`, `action`, `old_values`, `new_values`  
**API:** `auditLog`, `action`, `oldValues`, `newValues`

---

## Anti-Patterns (Common Mistakes)

### ❌ Don't Mix Terms

**Wrong:**
> "The strata plan (SP 12345) has 24 units. Each unit pays quarterly fees."

**Correct:**
> "The scheme (SP 12345) has 24 lots. Each lot pays quarterly levies."

---

### ❌ Don't Use Generic Terms When Specific Ones Exist

**Wrong:**
> "The building's monthly assessment is $800."

**Correct:**
> "The lot's quarterly levy is $2,400 ($800/month equivalent)."

---

### ❌ Don't Capitalize Enum Values in Database

**Wrong:**
```sql
status TEXT CHECK (status IN ('PENDING', 'SENT', 'PAID'))
```

**Correct:**
```sql
status TEXT CHECK (status IN ('pending', 'sent', 'paid'))
```

---

### ❌ Don't Use Abbreviations in User-Facing Text

**Wrong:**
> "UE: 100, FY: 2025/26, AGM: 15 Oct"

**Correct:**
> "Unit entitlement: 100, Financial year: 2025/26, Annual general meeting: 15 October 2026"

(Abbreviations are OK in headings/labels where space is limited, but spell out in body text.)

---

## Usage in Code

### Database (SQL)

- Tables: `snake_case`, plural: `schemes`, `lots`, `levy_items`
- Columns: `snake_case`: `scheme_id`, `unit_entitlement`, `admin_levy_amount`
- Enums: lowercase strings: `'pending'`, `'admin'`, `'agm'`

**Example:**
```sql
SELECT lot_number, admin_levy_amount, status
FROM levy_items
WHERE status = 'overdue';
```

---

### TypeScript/JavaScript

- Types/Interfaces: PascalCase: `Scheme`, `LevyItem`, `MaintenanceRequest`
- Variables: camelCase: `schemeId`, `adminLevyAmount`, `levyStatus`
- Enums: lowercase strings (matching database): `'pending'`, `'admin'`, `'agm'`

**Example:**
```typescript
interface LevyItem {
  id: string;
  lotId: string;
  adminLevyAmount: number;
  capitalLevyAmount: number;
  status: 'pending' | 'sent' | 'paid' | 'partial' | 'overdue';
}
```

---

### API (JSON)

- Fields: camelCase: `schemeId`, `lotNumber`, `adminLevyAmount`
- Enum values: lowercase strings OR camelCase (for multi-word): `"pending"`, `"noticeSent"`, `"inProgress"`

**Example:**
```json
{
  "levyItem": {
    "id": "uuid",
    "lotId": "uuid",
    "adminLevyAmount": 800,
    "capitalLevyAmount": 400,
    "status": "overdue"
  }
}
```

---

### UI/Display

- Labels: Title Case: "Scheme Name", "Lot Number", "Admin Levy Amount"
- Status badges: Title Case: "Pending", "Sent", "Paid", "Overdue"
- User-facing text: Full terms, not abbreviations: "Annual General Meeting", not "AGM"

**Example (React component):**
```tsx
<Label>Levy Status</Label>
<Badge variant={status === 'overdue' ? 'destructive' : 'default'}>
  {status === 'pending' && 'Pending'}
  {status === 'sent' && 'Sent'}
  {status === 'paid' && 'Paid'}
  {status === 'overdue' && 'Overdue'}
</Badge>
```

---

## Glossary Maintenance

### When to Update This Glossary

- New domain concept introduced (new entity, workflow, or status)
- Existing term clarified (feedback from users/developers/legal)
- Anti-pattern identified (common mistake worth documenting)

### Update Process

1. Add new term to this document (alphabetical within section)
2. Update `00-unified-data-model.md` if database schema changes
3. Notify all developers via Slack/email
4. Update relevant feature specifications
5. Create GitHub issue to update codebase (if term changes)

---

## Quick Reference Table

| Domain Concept | Canonical Term | Database | Code | API |
|----------------|----------------|----------|------|-----|
| Strata property | scheme | `schemes` | `scheme` | `scheme` |
| Individual unit | lot | `lots` | `lot` | `lot` |
| Property owner | owner | `owners` | `owner` | `owner` |
| Management business | organisation | `organisations` | `organisation` | `organisation` |
| Strata manager person | manager | `role = 'manager'` | `role: 'manager'` | `role: "manager"` |
| Staff member | admin | `role = 'admin'` | `role: 'admin'` | `role: "admin"` |
| Financial auditor | auditor | `role = 'auditor'` | `role: 'auditor'` | `role: "auditor"` |
| Committee member | committee member | `committee_members` | `committee_member` | `committeeMember` |
| Renter | tenant | `tenants` | `tenant` | `tenant` |
| Periodic fee | levy | `levy_items` | `levy` | `levy` |
| Billing cycle | levy period | `levy_periods` | `levy_period` | `levyPeriod` |
| Money movement | transaction | `transactions` | `transaction` | `transaction` |
| Trust account type | fund | `fund_type` | `fund_type` | `fundType` |
| Accounting period | financial year | `financial_years` | `financial_year` | `financialYear` |
| Proportional share | unit entitlement | `unit_entitlement` | `unit_entitlement` | `unitEntitlement` |
| Shared areas | common property | — | `is_common_property` | `isCommonProperty` |
| Scheme rules | by-law | — | `bylaw` | `bylaw` |
| Vote delegation | proxy | `proxies` | `proxy` | `proxy` |
| Minimum attendance | quorum | `quorum_required` | `quorum_required` | `quorumRequired` |
| Annual owner meeting | AGM | `meeting_type = 'agm'` | `meeting_type: 'agm'` | `meetingType: "agm"` |
| Special owner meeting | SGM | `meeting_type = 'sgm'` | `meeting_type: 'sgm'` | `meetingType: "sgm"` |
| Committee meeting | committee meeting | `meeting_type = 'committee'` | `meeting_type: 'committee'` | `meetingType: "committee"` |
| Meeting topics | agenda | `agenda_items` | `agenda_item` | `agendaItem` |
| Voted motion | resolution | `resolutions` | `resolution` | `resolution` |
| Meeting record | minutes | `minutes` | `minutes` | `minutes` |
| Repair request | maintenance request | `maintenance_requests` | `maintenance_request` | `maintenanceRequest` |
| Service provider | tradesperson | `tradespeople` | `tradesperson` | `tradesperson` |
| Cost estimate | quote | `quotes` | `quote` | `quote` |
| Bill for work | invoice | `invoices` | `invoice` | `invoice` |
| Stored file | document | `documents` | `document` | `document` |
| Owner web interface | portal | — | `portal` | `portal` |

---

**END OF GLOSSARY**

*Last updated: 16 February 2026*  
*Questions or suggestions? Contact Chris Johnstone (chris@johnstone.id.au)*
