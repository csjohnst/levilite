# Feature Specification: Meeting Administration (AGM/SGM)

**Product:** LevyLite  
**Feature:** Meeting Administration  
**Version:** 1.0 MVP  
**Date:** 16 February 2026  
**Author:** Kai (AI Agent), Kokoro Software  

---

## 1. Executive Summary

Meeting Administration is a **compliance-critical** feature for LevyLite. Under Western Australian legislation (Strata Titles Act 1985 and Strata Titles General Regulations 2019), strata companies must hold an Annual General Meeting (AGM) within specified timeframes, provide proper notice to all owners, maintain quorum, record resolutions, and retain minutes for 7 years.

Small strata managers currently handle this process manually using Word documents, email, and paper files—leading to missed deadlines, lost documents, and compliance risks. This feature automates the entire meeting lifecycle from scheduling through document retention, saving 10-15 hours per AGM and ensuring WA legislative compliance.

**Key Capabilities:**
- **Meeting scheduling** with compliance calendar (AGM deadline tracking)
- **Automated notice generation** (21-day notice for AGM, 14-day for SGM)
- **Drag-and-drop agenda builder** with standard items and custom motions
- **Proxy form generation and registration** (WA proxy limits enforced)
- **Quorum tracking** (attendance + proxies vs. scheme requirements)
- **Resolution recording** (ordinary vs. special resolutions, vote counts)
- **Auto-generated minutes** from recorded data
- **Visual compliance timeline** with automated reminders
- **7-year document retention** (notices, agendas, minutes, resolutions)

**Dependencies:** Scheme & Lot Register, Owner Portal, Document Storage, Email Service (Resend/SendGrid)

---

## 2. WA Legislative Requirements

### Strata Titles Act 1985 & Strata Titles General Regulations 2019

#### AGM Requirements (Section 24, Regulation 22-25)

1. **Timing:** AGM must be held within **3 months** after the end of the strata company's financial year
   - Default financial year: July 1 – June 30
   - AGM deadline: September 30 (for schemes with June 30 FY end)
   - First AGM: Within 2 months of first settlement

2. **Notice Period:** Minimum **21 days** written notice to all owners
   - Notice must include: date, time, location (or virtual meeting details), agenda
   - Must be sent to owner's registered address (or email if consented)

3. **Quorum:** 
   - Default: Owners holding **30% of unit entitlements** (or number of units, depending on scheme rules)
   - If quorum not met, meeting adjourned to same time/place 7 days later (no quorum required for adjourned meeting)

4. **Required Agenda Items:**
   - Confirmation of previous AGM minutes
   - Consideration of financial statements and auditor's report (if applicable)
   - Election of council (committee) members
   - Setting administrative fund and capital works fund budgets for next financial year
   - Appointment of auditor (if required)
   - Any motions submitted by owners or council

5. **Resolutions:**
   - **Ordinary resolution:** Simple majority of votes cast (in person or by proxy)
   - **Special resolution:** 75% majority of votes cast
   - **Unanimous resolution:** 100% of owners agree (rare)

6. **Minutes:** Must be recorded and retained. Include:
   - Date, time, location
   - Attendees (owners present, proxies held)
   - All resolutions moved, seconded, and outcome (carried/defeated)
   - Vote counts for significant motions

7. **Document Retention:** 7 years (implied by administrative record-keeping requirements under Section 36)

#### SGM Requirements (Regulation 26-28)

1. **Timing:** Called as needed (no annual requirement)
   - Council can call SGM any time
   - Owners holding 25%+ unit entitlements can requisition SGM (council must call within 14 days)

2. **Notice Period:** Minimum **14 days** written notice

3. **Quorum:** Same as AGM (30% unit entitlements)

4. **Purpose:** Specific business only (stated in notice)—cannot transact business not on agenda

#### Committee (Council) Meeting Requirements (Regulation 14-16)

1. **Frequency:** No statutory minimum (best practice: quarterly)

2. **Notice:** "Reasonable notice" to council members (typically 7 days)
   - **Best Practice:** 7 days notice (industry standard, not legislated in WA)
   - Provides adequate time for council members to review agenda and prepare

3. **Quorum:** Majority of council members

4. **Minutes:** Not statutorily required but best practice (decisions should be documented)

5. **Scope:** Day-to-day management decisions (maintenance, contracts <$X, enforcement). Cannot make decisions requiring general meeting resolution.

---

## 3. Meeting Types

LevyLite supports three meeting types, each with different rules and workflows:

### 3.1 Annual General Meeting (AGM)

**Purpose:** Statutory annual meeting for financial reporting, elections, budgets, major decisions.

**Characteristics:**
- Must be held within 3 months of financial year end
- 21-day notice requirement (WA)
- Standard agenda items (financials, elections, budgets)
- Quorum: 30% unit entitlements (configurable per scheme)
- Ordinary and special resolutions
- Proxy voting allowed (subject to limits)

**Required Attachments:**
- Financial statements (admin fund, capital works fund, previous 12 months)
- Proposed budget for next financial year
- Auditor's report (if applicable)
- Nomination forms for council elections
- Proxy forms

### 3.2 Special General Meeting (SGM)

**Purpose:** Ad-hoc meeting for specific business that can't wait until next AGM.

**Characteristics:**
- Called by council or requisitioned by 25%+ owners
- 14-day notice requirement (WA)
- Single-purpose agenda (e.g., approve major capital works, amend by-laws, remove council member)
- Quorum: 30% unit entitlements (same as AGM)
- Can pass ordinary or special resolutions (depending on motion type)
- Proxy voting allowed

**Triggers for SGM:**
- Owner requisition (25%+ entitlements demand meeting)
- Council decision (urgent matter)
- Manager recommendation (e.g., emergency building repair exceeding budget threshold)

### 3.3 Committee (Council) Meeting

**Purpose:** Working meeting of elected council members for day-to-day management decisions.

**Characteristics:**
- No statutory frequency (best practice: quarterly)
- 7-day notice to council members (not all owners)
- Quorum: Majority of council members (e.g., 3 of 5)
- Decisions by simple majority
- No proxy voting (must attend in person/virtually)
- Minutes not statutory but best practice (document decisions for liability protection)

**Typical Agenda Items:**
- Review maintenance requests
- Approve tradesperson quotes <$X (above $X requires general meeting)
- Enforce by-laws (parking, noise complaints)
- Review arrears and collection actions
- Prepare recommendations for next AGM

**MVP Scope:** Committee meetings are **lower priority** than AGM/SGM. Include basic scheduling and minutes recording, but defer advanced features (e.g., decision approval workflows) to Phase 2.

---

## 4. Meeting Scheduling & Compliance Calendar

### 4.1 Create Meeting

**User Story:** Sarah needs to schedule an AGM for a scheme with financial year ending June 30. She must hold it by September 30 (3-month deadline).

**UI Workflow:**
1. Navigate to Scheme → Meetings → Create Meeting
2. Select meeting type: AGM / SGM / Committee Meeting
3. Auto-populate defaults based on meeting type:
   - **AGM:** 
     - Suggested date: 2.5 months after FY end (mid-September for June 30 FY)
     - Notice period: 21 days
     - Standard agenda items pre-loaded (financials, elections, budgets)
   - **SGM:**
     - Notice period: 14 days
     - Blank agenda (single-purpose, manager adds specific motion)
   - **Committee:**
     - Notice period: 7 days
     - Basic agenda template (maintenance review, arrears review, etc.)

4. Set meeting details:
   - Date & time (date picker + time selector)
   - Location: Physical address OR virtual meeting link (Zoom/Teams URL)
   - Hybrid option: Both physical + virtual (checkbox)

5. Set notice deadline (auto-calculated):
   - AGM: Meeting date minus 21 days
   - SGM: Meeting date minus 14 days
   - Committee: Meeting date minus 7 days
   - Manager can override (e.g., extend notice period to 28 days)

6. Save as draft or proceed to agenda builder

**Validation Rules:**
- AGM date must be ≤3 months after FY end (warning if outside compliance window)
- Notice deadline must be ≥21/14/7 days before meeting (error if too short)
- Location OR virtual link required (cannot be blank)

**Database Fields:** `meetings` table (see Section 11)

### 4.2 Compliance Calendar

**User Story:** Sarah manages 15 schemes with different FY end dates. She needs a dashboard showing all upcoming AGM deadlines to avoid compliance breaches.

**UI: Compliance Dashboard**

| Scheme Name | FY End Date | AGM Deadline | Status | Days Until Deadline | Action |
|-------------|-------------|--------------|--------|---------------------|--------|
| Sunset Gardens | 30 Jun 2026 | 30 Sep 2026 | ⚠️ Not Scheduled | 45 days | Schedule AGM |
| Marina Vista | 31 Mar 2026 | 30 Jun 2026 | ✅ Scheduled (15 May) | N/A | View Meeting |
| Parkside Villas | 30 Jun 2026 | 30 Sep 2026 | 🔴 Overdue | -5 days | Schedule Urgent |

**Status Logic:**
- ✅ **Scheduled:** AGM created and scheduled within deadline
- ⚠️ **Not Scheduled:** Within 60 days of deadline, no AGM scheduled yet (yellow alert)
- 🔴 **Overdue:** Past deadline, no AGM held (red alert)
- 📅 **Completed:** AGM held, minutes approved

**Automated Reminders:**
- 90 days before deadline: "AGM due in 3 months for [Scheme]"
- 60 days before: "AGM reminder: Schedule soon to meet notice requirements"
- 30 days before: "URGENT: AGM deadline in 30 days"
- 7 days before: "CRITICAL: AGM deadline in 7 days"

**Email Notifications:** Send to manager + council chairperson (if email on file)

**Calendar Integration (Phase 2):** Export to Google Calendar / Outlook (iCal feed)

---

## 5. Notice Generation

### 5.1 Notice Content Requirements (WA)

AGM notice must include:
1. **Header:** Scheme name, meeting type (AGM/SGM), strata plan number
2. **Date, time, location** (or virtual meeting instructions)
3. **Agenda** (ordered list of items)
4. **Quorum statement** (e.g., "Quorum is owners holding 30% of unit entitlements")
5. **Proxy information** ("Proxy forms must be received by [date/time]")
6. **Nomination information** (if elections occurring)
7. **Manager contact details** (for questions)

SGM notice must also include:
- **Requisition details** (if requisitioned by owners): "This meeting has been requisitioned by [Owner Names] holding [X]% of unit entitlements"
- **Purpose statement** (specific business to be transacted)

### 5.2 Notice Generation Workflow

**User Story:** Sarah has created an AGM, built the agenda, and is ready to send notices to all 12 owners.

**UI Workflow:**
1. From Meeting detail page → Generate Notice
2. System auto-populates PDF template:
   - Scheme details (from scheme register)
   - Meeting date/time/location
   - Agenda items (from agenda builder)
   - Proxy form (attached as separate page)
   - Nomination form (if elections on agenda, attached as separate page)
3. Preview PDF (in-browser)
4. Manager reviews and can:
   - Edit custom text (e.g., add special instructions)
   - Attach additional documents (financial statements PDF, proposed by-law amendments)
5. Manager clicks **Send Notices**
6. System:
   - Sends email to all owners with PDF attached
   - Logs delivery (owner name, email, timestamp, delivery status)
   - Records notice sent date (for compliance audit trail)
7. Manager can resend to individual owners (if email bounces)

**Email Template:**

```
Subject: [Scheme Name] - Annual General Meeting Notice - [Date]

Dear [Owner Name],

Please find attached the notice for the Annual General Meeting of [Scheme Name] to be held on [Date] at [Time].

Meeting Details:
- Date: [Date]
- Time: [Time]
- Location: [Address OR Virtual Meeting Link]

The notice includes:
- Meeting agenda
- Proxy form
- Nomination form for council elections
- Financial statements for [FY Period]

If you cannot attend, you may appoint a proxy to vote on your behalf. Proxy forms must be received by [Proxy Deadline Date/Time].

If you have any questions, please contact [Manager Name] at [Manager Email] or [Manager Phone].

Regards,
[Manager Name]
[Scheme Name] Strata Manager
```

**Attachments:**
1. Meeting notice PDF (agenda, quorum, instructions)
2. Proxy form PDF (pre-filled with owner details, blank proxy appointment section)
3. Nomination form PDF (if elections)
4. Financial statements PDF (from Document Storage)
5. Any additional documents (by-law amendments, building reports, etc.)

### 5.3 PDF Template Design

**Template Structure (A4, portrait):**

```
===========================================
       [SCHEME NAME]
       [STRATA PLAN NUMBER]
   NOTICE OF ANNUAL GENERAL MEETING
===========================================

Date:      [Meeting Date]
Time:      [Meeting Time]
Location:  [Physical Address OR Virtual Link]

-------------------------------------------
AGENDA
-------------------------------------------

1. Welcome and Apologies
2. Confirmation of Quorum
3. Confirmation of Minutes of Previous AGM
4. Correspondence
5. Financial Reports
   a) Administrative Fund Statement
   b) Capital Works Fund Statement
   c) Treasurer's Report
6. Auditor's Report (if applicable)
7. Setting the Budget for [Next FY]
   a) Administrative Fund Budget
   b) Capital Works Fund Budget
8. Election of Council Members
9. Appointment of Auditor (if applicable)
10. General Business
    a) [Custom Motion 1]
    b) [Custom Motion 2]

-------------------------------------------
QUORUM
-------------------------------------------
Quorum for this meeting is owners holding
30% of unit entitlements (or [X] owners).

If quorum is not met, the meeting will be
adjourned to [Same Time] on [Date + 7 days]
at the same location. No quorum is required
for the adjourned meeting.

-------------------------------------------
PROXIES
-------------------------------------------
If you cannot attend, you may appoint a
proxy to vote on your behalf. Proxy forms
must be received by [Date/Time].

A proxy form is attached to this notice.

-------------------------------------------
NOMINATIONS
-------------------------------------------
Nominations for council positions are
invited. A nomination form is attached.
Nominations close at the commencement of
the meeting.

-------------------------------------------
CONTACT
-------------------------------------------
[Manager Name]
[Manager Email]
[Manager Phone]

Issued: [Notice Date]
===========================================
```

**PDF Generation Library:** Use `@react-pdf/renderer` (React components). Store template as React component with dynamic fields.

**Storage:** Save generated PDF to Supabase Storage (`/schemes/{scheme_id}/meetings/{meeting_id}/notice.pdf`). Attach to email.

---

## 6. Agenda Builder

### 6.1 Standard Agenda Items (AGM)

LevyLite pre-loads standard items for AGM:

| Order | Item | Type | Required? | Notes |
|-------|------|------|-----------|-------|
| 1 | Welcome and Apologies | Procedural | Yes | Cannot remove |
| 2 | Confirmation of Quorum | Procedural | Yes | Cannot remove |
| 3 | Confirmation of Previous Minutes | Procedural | Yes | Cannot remove |
| 4 | Correspondence | Procedural | No | Optional |
| 5 | Financial Reports | Standard | Yes | Admin + Capital Works statements |
| 6 | Auditor's Report | Standard | Conditional | Only if scheme has auditor |
| 7 | Budget Setting | Standard | Yes | Next FY budget |
| 8 | Election of Council | Standard | Yes | Every AGM |
| 9 | Appointment of Auditor | Standard | Conditional | Only if required |
| 10 | General Business | Standard | No | Catch-all for misc items |

**Motion Items (Custom):**
- Manager or owners can add custom motions under "General Business"
- Each motion has: title, description (optional), motion type (ordinary/special/unanimous)

**Example Custom Motions:**
- "Approve installation of CCTV cameras (cost $8,500)"
- "Amend by-law 3 to permit electric vehicle charging"
- "Approve major capital works: roof replacement ($45,000)"

### 6.2 Agenda Builder UI

**Drag-and-Drop Interface:**

```
┌─────────────────────────────────────────────┐
│ Agenda Items                         [+ Add]│
├─────────────────────────────────────────────┤
│ ☰ 1. Welcome and Apologies        [Required]│
│ ☰ 2. Confirmation of Quorum        [Required]│
│ ☰ 3. Confirm Previous Minutes      [Required]│
│ ☰ 4. Financial Reports             [Required]│
│ ☰ 5. Budget Setting (FY 2026-27)   [Required]│
│ ☰ 6. Election of Council           [Required]│
│ ☰ 7. MOTION: Install CCTV          [✏️ Edit] │
│     └─ Type: Ordinary Resolution              │
│     └─ Est. cost: $8,500                      │
│ ☰ 8. General Business                     [x]│
└─────────────────────────────────────────────┘
```

**Interactions:**
- **Drag ☰ icon** to reorder items (except required items 1-3 which stay locked)
- **+ Add button:** Opens modal to add custom motion
- **✏️ Edit:** Edit motion text, type, description
- **[x] Remove:** Delete optional items (cannot delete required items)

**Add Motion Modal:**

```
┌──────────────────────────────────────────┐
│ Add Agenda Item                          │
├──────────────────────────────────────────┤
│ Title: ___________________________       │
│                                           │
│ Description (optional):                   │
│ ┌─────────────────────────────────────┐ │
│ │                                     │ │
│ └─────────────────────────────────────┘ │
│                                           │
│ Motion Type:                              │
│ ○ Ordinary Resolution (simple majority)  │
│ ● Special Resolution (75% majority)      │
│ ○ Unanimous Resolution (100% required)   │
│                                           │
│ Estimated Cost (optional): $______       │
│                                           │
│        [Cancel]  [Add Item]              │
└──────────────────────────────────────────┘
```

**Validation:**
- Title required (max 200 chars)
- Motion type required
- Warn if special resolution but description doesn't explain why (e.g., by-law amendments, major capital works require special resolution under WA law)

**Database:** `agenda_items` table (see Section 11)

---

## 7. Proxy Management

### 7.1 WA Proxy Rules (Strata Titles Regulations)

1. **Proxy limits:** 
   - One person cannot hold proxies for more than **5% of total lot entitlements** OR **one proxy** (whichever is greater)
   - Example: Scheme with 20 lots → max 1 proxy per person (5% of 20 = 1)
   - Example: Scheme with 100 lots → max 5 proxies per person (5% of 100 = 5)

2. **Proxy form requirements:**
   - Owner's name and lot number
   - Appointee's name (proxy holder)
   - Meeting date
   - Signature of owner
   - Duration (specific meeting only, or standing proxy for 12 months)

3. **Proxy submission deadline:**
   - Must be received **before meeting commencement** (or earlier deadline set by scheme rules, e.g., 24 hours before)

4. **Proxy voting:**
   - Proxy can vote on behalf of owner (unless owner attends in person—then proxy is void)
   - Proxy must vote according to owner's instructions (if specified on form), or at proxy's discretion (if open proxy)

### 7.2 Proxy Form Generation

**Auto-generated with meeting notice. Pre-fills:**
- Scheme name and meeting details
- Owner's name and lot number (from lot register)
- Blank fields: appointee name, signature, date

**PDF Template:**

```
===========================================
   PROXY FORM
   [SCHEME NAME] - [MEETING TYPE]
   Meeting Date: [Date]
===========================================

I, _________________________________ (name)

of Lot Number ______________________

hereby appoint:

_________________________________ (proxy name)

OR if that person is unable or unwilling:

_________________________________ (alternate proxy)

to vote on my behalf at the [Meeting Type] to
be held on [Date] at [Time].

Instructions (optional):
□ Vote at proxy's discretion
□ Vote as follows:
  - Agenda Item X: For / Against / Abstain
  - Agenda Item Y: For / Against / Abstain

Signature: _________________________

Date: ______________________________

-------------------------------------------
SUBMIT THIS FORM TO:
[Manager Name]
Email: [Manager Email]
Mail: [Manager Address]

DEADLINE: [Proxy Deadline Date/Time]
===========================================
```

**Distribution:** Attached to meeting notice email (one PDF per owner with pre-filled lot details).

### 7.3 Proxy Registration Workflow

**User Story:** Sarah receives proxy forms via email and mail. She needs to register them and track who holds proxies to enforce the 5% limit.

**UI Workflow:**
1. Navigate to Meeting → Proxies tab
2. Click **Register Proxy**
3. Enter:
   - Owner name (dropdown from lot register)
   - Lot number (auto-populated when owner selected)
   - Proxy holder name (free text)
   - Proxy type: Open (discretion) / Directed (specific votes)
   - If directed: capture voting instructions per agenda item
   - Received date/time
4. System validates:
   - ✅ Proxy received before deadline
   - ✅ Proxy holder does not exceed 5% limit
   - ❌ If limit exceeded: "ERROR: [Proxy Holder] already holds [X] proxies (max [Y])"
5. Save proxy registration

**Proxy Holder Limit Calculation:**
```sql
-- Example: Scheme with 40 lots, 5% = 2 proxies max per person
-- Query to count proxies held by a person:
SELECT proxy_holder_name, COUNT(*) as proxy_count
FROM proxies
WHERE meeting_id = {meeting_id}
GROUP BY proxy_holder_name
HAVING COUNT(*) > FLOOR((SELECT COUNT(*) FROM lots WHERE scheme_id = {scheme_id}) * 0.05)
```

**Proxy Summary Dashboard:**

```
┌────────────────────────────────────────────┐
│ Proxies Registered: 8 / 40 owners          │
├────────────────────────────────────────────┤
│ Proxy Holder         │ Lots  │ Limit Status│
├──────────────────────┼───────┼─────────────┤
│ John Smith           │ 2     │ ✅ OK (2/2) │
│ Mary Jones           │ 1     │ ✅ OK (1/2) │
│ Committee Chair      │ 5     │ ⚠️ AT LIMIT │
└────────────────────────────────────────────┘
```

**Email Reminder to Owners (7 days before meeting):**

```
Subject: Proxy Form Reminder - AGM [Date]

Dear [Owner],

The AGM for [Scheme] is in 7 days. If you
cannot attend, please submit your proxy form
by [Deadline].

[Download Proxy Form Button]

Regards,
[Manager]
```

**Database:** `proxies` table (see Section 11)

---

## 8. Quorum Tracking

### 8.1 Quorum Requirements

**Default WA Rule:** 30% of unit entitlements (or number of lots, depending on scheme type).

**Scheme-Specific Override:** LevyLite allows manager to set custom quorum per scheme (e.g., 25% or 40%).

**Quorum Calculation:**

```
Quorum Met = (Owners Present + Proxies Held) >= Quorum Threshold

Example:
- Scheme: 40 lots, quorum = 30% = 12 owners/proxies
- Owners present: 8
- Proxies registered: 5
- Total: 13 ✅ Quorum met
```

**If Quorum Not Met:**
- Meeting adjourned to same time 7 days later (WA default)
- No quorum required for adjourned meeting (can proceed with any attendance)

### 8.2 Attendance Tracking UI

**During Meeting (Manager UI):**

```
┌────────────────────────────────────────────┐
│ Attendance & Quorum                        │
├────────────────────────────────────────────┤
│ Quorum Requirement: 12 (30% of 40 lots)    │
│ Current Attendance: 13  ✅ QUORUM MET      │
├────────────────────────────────────────────┤
│ Owners Present: 8                [+ Add]   │
│ - Lot 1: John Smith                    [x] │
│ - Lot 5: Mary Jones                    [x] │
│ - Lot 7: Sarah Lee                     [x] │
│ ...                                         │
│                                             │
│ Proxies Held: 5                            │
│ - Lot 3 (proxy: John Smith)                │
│ - Lot 10 (proxy: Mary Jones)               │
│ ...                                         │
├────────────────────────────────────────────┤
│ □ Quorum not met - Adjourn meeting         │
│   Adjourned to: [Date] at [Time]           │
└────────────────────────────────────────────┘
```

**Workflow:**
1. Manager marks owners present as they arrive (checkbox or barcode scan in Phase 2)
2. System auto-includes proxy holders (already registered)
3. Live quorum counter updates
4. If quorum not met at meeting start time, manager checks "Adjourn meeting" and system:
   - Records adjournment in minutes
   - Sends email to all owners: "Meeting adjourned to [Date]"
   - Creates new meeting record for adjourned meeting (linked to original)

**Database:** `attendees` table (see Section 11)

---

## 9. Resolution Recording

### 9.1 Resolution Types

| Type | WA Requirement | Voting Threshold | Use Cases |
|------|----------------|------------------|-----------|
| **Ordinary Resolution** | Regulation 31 | Simple majority (>50% of votes cast) | Most decisions: approve minutes, elect council, approve budgets, routine maintenance |
| **Special Resolution** | Regulation 32 | 75% of votes cast | Major decisions: amend by-laws, major capital works, alter common property, remove council member |
| **Unanimous Resolution** | Regulation 33 | 100% of owners agree | Rare: change scheme rules fundamentally, sell common property |

**Note:** "Votes cast" = owners present + proxies. Abstentions not counted in denominator.

**Example:**
- 20 owners present/proxies, 2 abstain
- For: 12, Against: 6, Abstain: 2
- Ordinary: 12/18 = 66.7% ✅ CARRIED
- Special: 12/18 = 66.7% ❌ DEFEATED (need 75%)

### 9.2 Recording Resolutions During Meeting

**UI Workflow:**

```
┌────────────────────────────────────────────┐
│ Agenda Item 7: Install CCTV Cameras        │
├────────────────────────────────────────────┤
│ Motion Type: Special Resolution (75%)      │
│                                             │
│ Motion Text:                                │
│ "That the strata company approves the      │
│  installation of CCTV cameras at entrance  │
│  and garage at a cost of $8,500."          │
│                                             │
│ Moved by: ________________ (dropdown)      │
│ Seconded by: _____________ (dropdown)      │
│                                             │
│ Vote Count:                                 │
│ For: ___  Against: ___  Abstain: ___       │
│                                             │
│ Result:                                     │
│ ○ Carried  ○ Defeated  ○ Withdrawn         │
│                                             │
│        [Record Resolution]                  │
└────────────────────────────────────────────┘
```

**Auto-Calculation:**
- Manager enters vote counts (For / Against / Abstain)
- System calculates percentage: `For / (For + Against) * 100%`
- System determines result:
  - Ordinary: >50% → Carried
  - Special: ≥75% → Carried
  - Unanimous: 100% → Carried
- Display result with visual indicator: ✅ CARRIED (76%) or ❌ DEFEATED (68%)

**Validation:**
- Total votes (For + Against + Abstain) ≤ Total attendance (cannot have more votes than attendees)
- Moved by and Seconded by must be different people

**Database:** `resolutions` table (see Section 11)

### 9.3 Common Resolution Scenarios

**Standard AGM Resolutions:**

1. **Confirm Previous Minutes:** Ordinary resolution (auto-generated)
   - "That the minutes of the AGM held on [Date] be confirmed as a true record."

2. **Accept Financial Statements:** Ordinary resolution
   - "That the financial statements for [FY Period] be accepted."

3. **Approve Budget:** Ordinary resolution
   - "That the administrative fund budget of $[Amount] and capital works budget of $[Amount] for [Next FY] be approved."

4. **Elect Council:** Ordinary resolution (one per position)
   - "That [Name] be elected to the council for a term of [X] years."

5. **Amend By-Law:** Special resolution
   - "That by-law [X] be amended to read: [New Text]."

6. **Approve Major Capital Works:** Special resolution (if exceeds threshold, e.g., $10K or 10% of budget)
   - "That the strata company approves [Description] at a cost of $[Amount]."

**LevyLite Pre-Populates:** Standard resolutions for items 1-4 (manager just enters vote counts). Custom motions require manual entry.

---

## 10. Minutes Generation

### 10.1 Auto-Generated Minutes

**User Story:** After the meeting, Sarah clicks "Generate Minutes" and system produces a draft PDF from recorded data.

**Minutes Template Structure:**

```
===========================================
   [SCHEME NAME]
   MINUTES OF ANNUAL GENERAL MEETING
   Date: [Meeting Date]
   Time: [Meeting Time]
   Location: [Meeting Location]
===========================================

ATTENDANCE
----------
Owners Present: [X]
Proxies Held: [Y]
Total: [X+Y]
Quorum: [Z] required ✅ Quorum met

List of Attendees:
- Lot 1: John Smith (present)
- Lot 3: Mike Johnson (proxy held by John Smith)
- Lot 5: Mary Jones (present)
...

APOLOGIES
---------
- Lot 8: Sarah Lee

-------------------------------------------
1. WELCOME AND APOLOGIES
-------------------------------------------
The meeting was opened at [Time] by [Chairperson].
Apologies were noted from [Names].

-------------------------------------------
2. CONFIRMATION OF QUORUM
-------------------------------------------
Quorum of [Z] was confirmed with [X+Y] attendees.

-------------------------------------------
3. CONFIRMATION OF PREVIOUS MINUTES
-------------------------------------------
MOTION: That the minutes of the AGM held on
[Previous Date] be confirmed as a true record.

Moved: [Name]
Seconded: [Name]
Result: ✅ CARRIED (For: X, Against: Y, Abstain: Z)

-------------------------------------------
4. CORRESPONDENCE
-------------------------------------------
[Manager notes or "Nil"]

-------------------------------------------
5. FINANCIAL REPORTS
-------------------------------------------
The treasurer presented financial statements
for [FY Period]:
- Admin Fund Balance: $[Amount]
- Capital Works Fund Balance: $[Amount]
- Total Income: $[Amount]
- Total Expenses: $[Amount]

MOTION: That the financial statements be accepted.

Moved: [Name]
Seconded: [Name]
Result: ✅ CARRIED (For: X, Against: Y, Abstain: Z)

-------------------------------------------
6. BUDGET SETTING
-------------------------------------------
Proposed budgets for [Next FY] were presented:
- Admin Fund: $[Amount]
- Capital Works Fund: $[Amount]

MOTION: That the budgets be approved.

Moved: [Name]
Seconded: [Name]
Result: ✅ CARRIED (For: X, Against: Y, Abstain: Z)

-------------------------------------------
7. ELECTION OF COUNCIL
-------------------------------------------
Nominations received for [X] positions:
- [Name 1]
- [Name 2]
...

MOTION: That [Name] be elected to council.

Result: ✅ CARRIED

Elected Council Members:
- [Name 1]
- [Name 2]
...

-------------------------------------------
8. GENERAL BUSINESS
-------------------------------------------
MOTION: Install CCTV Cameras (Special Resolution)

That the strata company approves the installation
of CCTV cameras at entrance and garage at a cost
of $8,500.

Moved: [Name]
Seconded: [Name]
Discussion: [Manager notes or "Nil"]
Result: ✅ CARRIED (For: X, Against: Y, Abstain: Z - 76%)

-------------------------------------------
MEETING CLOSE
-------------------------------------------
Meeting closed at [Time].

Next AGM: [Estimated Date Next Year]

-------------------------------------------
Prepared by: [Manager Name]
Date: [Minutes Generation Date]

Approved by: ________________________
             (Chairperson Signature)

Date: ______________________________
===========================================
```

### 10.2 Minutes Review & Approval Workflow

**Status States:**
1. **draft:** Auto-generated, not yet reviewed by manager
2. **manager_reviewed:** Manager has edited and approved content
3. **pending_approval:** Sent to council chairperson for signature
4. **approved:** Chairperson signed (digital signature or uploaded signed PDF)
5. **published:** Available in owner portal

**Workflow:**

```
draft
  ↓ Manager clicks "Review & Edit"
  ↓ Manager edits custom sections (correspondence, discussion notes)
  ↓ Manager clicks "Approve Draft"
manager_reviewed
  ↓ System emails chairperson: "Please review and approve minutes"
  ↓ Chairperson logs in, reviews, clicks "Approve"
pending_approval
  ↓ Chairperson approves (digital signature or uploads signed PDF)
approved
  ↓ Manager clicks "Publish"
published (visible in owner portal)
```

**Edit Capabilities (Manager):**
- Edit custom text sections (correspondence, discussion notes)
- Cannot edit attendance, vote counts, resolutions (audit trail)
- Add notes (e.g., "Owner raised concern about X, council to investigate")

**Digital Signature (Phase 2):** Integrate with DocuSign or HelloSign. MVP: Upload signed PDF.

**Database:** `minutes` table with status field (see Section 11)

---

## 11. Compliance Timeline & Reminders

### 11.1 Visual Timeline

**UI: Meeting Detail Page → Timeline Tab**

```
┌────────────────────────────────────────────────────────────┐
│  Meeting Timeline: AGM - 15 May 2026                       │
├────────────────────────────────────────────────────────────┤
│                                                             │
│  📅 30 Jun 2026      ✅ COMPLETE                           │
│  Financial Year End                                         │
│  └─ Scheme FY ended, AGM deadline: 30 Sep 2026            │
│                                                             │
│  ✉️  24 Apr 2026      ✅ COMPLETE                          │
│  Notice Deadline (21 days)                                 │
│  └─ Notices sent to 40 owners via email                   │
│                                                             │
│  📝 12 May 2026      ⏳ UPCOMING (3 days)                  │
│  Proxy Deadline                                             │
│  └─ 8 proxies received so far                             │
│                                                             │
│  🏛️  15 May 2026      ⏳ UPCOMING                          │
│  Meeting Date                                               │
│  └─ Location: 123 Sunset Blvd, Community Room             │
│                                                             │
│  📄 22 May 2026      ⏳ PENDING                            │
│  Minutes Due (7 days after meeting)                        │
│  └─ Best practice: circulate within 7 days                │
│                                                             │
│  📂 15 May 2033      ⏳ FUTURE                             │
│  Document Retention Expiry (7 years)                       │
│  └─ All meeting docs must be kept until this date         │
│                                                             │
└────────────────────────────────────────────────────────────┘
```

**Status Indicators:**
- ✅ **Complete:** Task done (e.g., notices sent)
- ⏳ **Upcoming:** Within 7 days (yellow)
- ⏰ **Overdue:** Past deadline, not done (red)
- ⏳ **Pending:** Future task (gray)

### 11.2 Automated Reminders

**Reminder Schedule:**

| Event | Timing | Recipient | Action |
|-------|--------|-----------|--------|
| AGM Due Soon | 90 days before deadline | Manager + Chairperson | "AGM due within 3 months. Schedule now." |
| AGM Urgent | 30 days before deadline | Manager + Chairperson | "URGENT: AGM deadline in 30 days." |
| Notice Deadline | 7 days before notice deadline | Manager | "Send AGM notices by [Date] to meet 21-day requirement." |
| Proxy Reminder | 7 days before meeting | All owners | "AGM in 7 days. Submit proxy if you cannot attend." |
| Proxy Deadline | 1 day before meeting | Manager | "Proxy deadline tomorrow. [X] proxies received." |
| Minutes Due | 7 days after meeting | Manager | "Circulate draft minutes for review." |
| Minutes Overdue | 14 days after meeting (if not done) | Manager + Chairperson | "Minutes not yet published. Complete ASAP." |

**Email Reminder Template (AGM Due Soon):**

```
Subject: AGM Reminder - [Scheme Name]

Hi [Manager],

The AGM for [Scheme Name] is due by [Deadline Date]
(within 3 months of financial year end on [FY End Date]).

Please schedule the AGM now to allow time for:
- 21-day notice period
- Financial statement preparation
- Agenda item collection

[Schedule AGM Button]

Regards,
LevyLite
```

**In-App Notifications:**
- Dashboard badge: "🔔 3 upcoming AGM deadlines"
- Scheme list: Red flag icon next to schemes with overdue AGMs

---

## 12. Document Retention (7 Years)

### 12.1 Meeting Document Package

**All documents related to a meeting are stored as a package:**

1. **Notice PDF** (generated + sent)
2. **Agenda** (structured data + PDF)
3. **Proxy forms** (received, scanned/uploaded)
4. **Nomination forms** (if applicable)
5. **Financial statements** (attached to notice)
6. **Resolutions** (structured data + PDF summary)
7. **Minutes** (draft + approved versions)
8. **Attendee list** (structured data + PDF)
9. **Supporting documents** (by-law amendments, building reports, quotes, etc.)

**Storage Location:** Supabase Storage bucket: `/schemes/{scheme_id}/meetings/{meeting_id}/`

**Folder Structure:**

```
/schemes/abc123/meetings/meeting_uuid/
  ├── notice.pdf
  ├── agenda.pdf
  ├── proxies/
  │   ├── lot1_proxy.pdf
  │   ├── lot3_proxy.pdf
  ├── financials/
  │   ├── admin_fund_statement.pdf
  │   ├── capital_works_statement.pdf
  ├── minutes_draft.pdf
  ├── minutes_approved.pdf
  ├── resolutions_summary.pdf
  └── supporting_docs/
      ├── bylaw_amendment_v2.pdf
      ├── roof_quote.pdf
```

### 12.2 7-Year Retention Policy

**WA Requirement:** Implied by administrative record-keeping standards (Section 36). Industry best practice: 7 years.

**Implementation:**
- Each meeting has a `retention_expiry_date` field = `meeting_date + 7 years`
- System auto-calculates on meeting creation
- Documents marked for deletion after expiry (but not auto-deleted—manager must review)

**Retention Dashboard (Manager):**

```
┌───────────────────────────────────────────────────────────┐
│ Document Retention Status                                 │
├───────────────────────────────────────────────────────────┤
│ Total Meetings: 45                                         │
│ Active Retention: 42 (expires 2028-2033)                  │
│ Expiring Soon: 3 (expires within 90 days)                 │
├───────────────────────────────────────────────────────────┤
│ Meeting                │ Date       │ Expiry     │ Action  │
├────────────────────────┼────────────┼────────────┼─────────┤
│ AGM 2019               │ 15 May 2019│ 15 May 2026│ ⏰ 90 d │
│ SGM 2020 (Roof Repair) │ 10 Mar 2020│ 10 Mar 2027│ ✅ 365d │
│ ...                    │            │            │         │
└───────────────────────────────────────────────────────────┘
```

**Manager Actions:**
- Extend retention (if legal hold, dispute ongoing)
- Archive to cold storage (Supabase → AWS Glacier for cost savings)
- Delete (after expiry + manager confirmation)

**Audit Log:** All retention actions logged (who extended/deleted, when, why).

---

## 13. Database Schema (Full SQL DDL)

### 13.1 Meetings Table

```sql
CREATE TABLE meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  
  -- Meeting details
  meeting_type VARCHAR(20) NOT NULL CHECK (meeting_type IN ('AGM', 'SGM', 'COMMITTEE')),
  meeting_date TIMESTAMPTZ NOT NULL,
  meeting_time TIME NOT NULL,
  location_physical TEXT, -- Physical address
  location_virtual TEXT,  -- Zoom/Teams link
  is_hybrid BOOLEAN DEFAULT false,
  
  -- Notice requirements
  notice_period_days INTEGER NOT NULL, -- 21 for AGM, 14 for SGM, 7 for Committee
  notice_deadline_date DATE NOT NULL,  -- meeting_date - notice_period_days
  notice_sent_date TIMESTAMPTZ,        -- When notices were actually sent
  
  -- Proxy management
  proxy_deadline TIMESTAMPTZ,          -- Default: meeting_date - 24 hours
  
  -- Quorum
  quorum_percentage DECIMAL(5,2) DEFAULT 30.00, -- e.g., 30.00 = 30%
  quorum_absolute INTEGER,             -- Alternative: absolute number (e.g., 5 owners)
  quorum_met BOOLEAN,                  -- Determined at meeting
  
  -- Adjournment (if quorum not met)
  is_adjourned BOOLEAN DEFAULT false,
  adjourned_to_meeting_id UUID REFERENCES meetings(id), -- Link to rescheduled meeting
  
  -- Meeting status
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
    'draft',           -- Created, not yet scheduled
    'scheduled',       -- Date set, notice not sent
    'notice_sent',     -- Notice sent to owners
    'in_progress',     -- Meeting currently happening
    'completed',       -- Meeting held, resolutions recorded
    'adjourned',       -- Quorum not met, adjourned
    'cancelled'        -- Meeting cancelled
  )),
  
  -- Document retention
  retention_expiry_date DATE NOT NULL, -- meeting_date + 7 years
  
  -- Audit trail
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

-- Note: Meeting documents (notices, agendas, minutes) are stored in the documents table 
-- (Feature 07) with linked_entity_type = 'meeting' and linked_entity_id = meeting.id.
-- No foreign keys on the meetings table for document references.
-- Query documents for a meeting via:
-- SELECT * FROM documents WHERE linked_entity_type = 'meeting' AND linked_entity_id = :meeting_id;

CREATE INDEX idx_meetings_scheme ON meetings(scheme_id);
CREATE INDEX idx_meetings_date ON meetings(meeting_date);
CREATE INDEX idx_meetings_status ON meetings(status);
CREATE INDEX idx_meetings_retention ON meetings(retention_expiry_date);
```

### 13.2 Agenda Items Table

```sql
CREATE TABLE agenda_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  
  -- Item details
  item_order INTEGER NOT NULL,         -- Display order (1, 2, 3...)
  item_type VARCHAR(20) NOT NULL CHECK (item_type IN (
    'procedural',      -- Welcome, quorum, confirm minutes
    'standard',        -- Financials, budgets, elections
    'motion',          -- Custom motion (requires resolution)
    'discussion'       -- General business, no vote
  )),
  
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Motion-specific fields
  motion_type VARCHAR(20) CHECK (motion_type IN (
    'ordinary',        -- >50% required
    'special',         -- 75% required
    'unanimous'        -- 100% required
  )),
  estimated_cost DECIMAL(12,2),        -- For capital works motions
  
  -- Required items cannot be deleted
  is_required BOOLEAN DEFAULT false,
  
  -- Audit trail
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_agenda_items_meeting ON agenda_items(meeting_id);
CREATE INDEX idx_agenda_items_order ON agenda_items(meeting_id, item_order);
```

### 13.3 Proxies Table

```sql
CREATE TABLE proxies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  
  -- Owner details
  lot_id UUID NOT NULL REFERENCES lots(id),
  owner_name VARCHAR(255) NOT NULL,    -- From lot register
  
  -- Proxy holder
  proxy_holder_name VARCHAR(255) NOT NULL,
  proxy_holder_type VARCHAR(20) DEFAULT 'open' CHECK (proxy_holder_type IN (
    'open',            -- Proxy votes at discretion
    'directed'         -- Specific instructions on how to vote
  )),
  
  -- Voting instructions (if directed)
  voting_instructions JSONB,           -- { "agenda_item_1": "FOR", "agenda_item_7": "AGAINST" }
  
  -- Submission tracking
  received_date TIMESTAMPTZ NOT NULL,
  received_method VARCHAR(20) CHECK (received_method IN ('email', 'mail', 'in_person')),
  
  -- Validation
  is_valid BOOLEAN DEFAULT true,       -- False if owner attends in person (proxy void)
  validation_notes TEXT,
  
  -- Audit trail
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_proxies_meeting ON proxies(meeting_id);
CREATE INDEX idx_proxies_lot ON proxies(lot_id);
CREATE INDEX idx_proxies_holder ON proxies(meeting_id, proxy_holder_name);

-- Constraint: One proxy per lot per meeting
CREATE UNIQUE INDEX idx_proxies_unique_lot ON proxies(meeting_id, lot_id) WHERE is_valid = true;
```

### 13.4 Attendees Table

```sql
CREATE TABLE attendees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  
  -- Attendee details
  lot_id UUID NOT NULL REFERENCES lots(id),
  owner_name VARCHAR(255) NOT NULL,
  attendance_type VARCHAR(20) NOT NULL CHECK (attendance_type IN (
    'present',         -- Physically present
    'virtual',         -- Attending via Zoom/Teams
    'proxy',           -- Represented by proxy
    'apology'          -- Sent apologies
  )),
  
  -- For proxy attendance
  represented_by VARCHAR(255),         -- Name of proxy holder (if attendance_type = 'PROXY')
  
  -- Check-in tracking
  checked_in_at TIMESTAMPTZ,
  
  -- Audit trail
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_attendees_meeting ON attendees(meeting_id);
CREATE INDEX idx_attendees_lot ON attendees(lot_id);
CREATE UNIQUE INDEX idx_attendees_unique ON attendees(meeting_id, lot_id);
```

### 13.5 Resolutions Table

```sql
CREATE TABLE resolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  agenda_item_id UUID REFERENCES agenda_items(id) ON DELETE SET NULL,
  
  -- Resolution details
  resolution_number VARCHAR(20),       -- e.g., "AGM-2026-01"
  motion_text TEXT NOT NULL,
  motion_type VARCHAR(20) NOT NULL CHECK (motion_type IN ('ORDINARY', 'SPECIAL', 'UNANIMOUS')),
  
  -- Voting
  moved_by VARCHAR(255),               -- Owner name
  seconded_by VARCHAR(255),            -- Owner name
  votes_for INTEGER NOT NULL DEFAULT 0,
  votes_against INTEGER NOT NULL DEFAULT 0,
  votes_abstain INTEGER NOT NULL DEFAULT 0,
  
  -- Result
  result VARCHAR(20) NOT NULL CHECK (result IN (
    'carried',
    'defeated',
    'withdrawn',       -- Motion withdrawn before vote
    'lapsed'           -- No quorum, motion lapsed
  )),
  result_percentage DECIMAL(5,2),      -- votes_for / (votes_for + votes_against) * 100
  
  -- Notes
  discussion_notes TEXT,
  
  -- Audit trail
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_resolutions_meeting ON resolutions(meeting_id);
CREATE INDEX idx_resolutions_agenda_item ON resolutions(agenda_item_id);
CREATE INDEX idx_resolutions_result ON resolutions(result);
```

### 13.6 Minutes Table

```sql
CREATE TABLE minutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  
  -- Version control
  version INTEGER DEFAULT 1,
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
    'draft',                 -- Auto-generated, not reviewed
    'manager_reviewed',      -- Manager approved content
    'pending_approval',      -- Sent to chairperson
    'approved',              -- Chairperson signed
    'published'              -- Visible in owner portal
  )),
  
  -- Content
  content_json JSONB,              -- Structured data for template rendering
  content_html TEXT,               -- Rich text editor content (custom sections)
  
  -- Generated documents
  pdf_draft_url TEXT,              -- Supabase Storage URL
  pdf_approved_url TEXT,           -- Final signed PDF
  
  -- Approval workflow
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  
  -- Audit trail
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id)
);

CREATE INDEX idx_minutes_meeting ON minutes(meeting_id);
CREATE INDEX idx_minutes_status ON minutes(status);
CREATE UNIQUE INDEX idx_minutes_latest ON minutes(meeting_id, version);
```

### 13.7 Supporting Tables (Existing)

**Assumed to exist from other features:**

```sql
-- From Scheme & Lot Register feature
CREATE TABLE schemes (
  id UUID PRIMARY KEY,
  name VARCHAR(255),
  financial_year_end DATE,  -- e.g., '2026-06-30'
  -- ... other fields
);

CREATE TABLE lots (
  id UUID PRIMARY KEY,
  scheme_id UUID REFERENCES schemes(id),
  lot_number VARCHAR(50),
  unit_entitlement DECIMAL(10,4),
  owner_name VARCHAR(255),
  owner_email VARCHAR(255),
  -- ... other fields
);

-- From User Management feature
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR(255),
  role VARCHAR(20),
  -- ... other fields
);
```

---

## 14. API Endpoints (REST)

### 14.1 Meeting Endpoints

```
POST   /api/schemes/{scheme_id}/meetings
  Create new meeting
  Body: { meeting_type, meeting_date, meeting_time, location_physical, location_virtual, is_hybrid }
  Returns: { meeting_id, status, notice_deadline_date, retention_expiry_date }

GET    /api/schemes/{scheme_id}/meetings
  List all meetings for scheme
  Query: ?status=SCHEDULED&type=AGM
  Returns: [{ id, meeting_type, meeting_date, status, quorum_met }]

GET    /api/meetings/{meeting_id}
  Get meeting details
  Returns: { meeting, agenda_items, proxies_count, attendees_count, quorum_status }

PATCH  /api/meetings/{meeting_id}
  Update meeting (date, location, status)
  Body: { meeting_date?, location_physical?, status? }

DELETE /api/meetings/{meeting_id}
  Cancel meeting (soft delete, sets status='CANCELLED')

POST   /api/meetings/{meeting_id}/send-notice
  Generate and email meeting notice to all owners
  Returns: { notice_sent_date, recipients_count, delivery_log }

GET    /api/meetings/{meeting_id}/compliance-timeline
  Get timeline with key dates
  Returns: [{ event, date, status, description }]
```

### 14.2 Agenda Endpoints

```
POST   /api/meetings/{meeting_id}/agenda-items
  Add agenda item
  Body: { item_order, item_type, title, description?, motion_type?, estimated_cost? }

GET    /api/meetings/{meeting_id}/agenda-items
  List agenda items (sorted by item_order)
  Returns: [{ id, item_order, title, motion_type }]

PATCH  /api/agenda-items/{item_id}
  Update agenda item
  Body: { title?, description?, item_order? }

DELETE /api/agenda-items/{item_id}
  Delete agenda item (only if is_required=false)

POST   /api/meetings/{meeting_id}/agenda-items/reorder
  Bulk reorder items
  Body: { items: [{ id, new_order }] }
```

### 14.3 Proxy Endpoints

```
POST   /api/meetings/{meeting_id}/proxies
  Register proxy
  Body: { lot_id, proxy_holder_name, proxy_holder_type, voting_instructions? }
  Validates: proxy deadline, 5% limit
  Returns: { proxy_id, is_valid, validation_notes }

GET    /api/meetings/{meeting_id}/proxies
  List all proxies for meeting
  Returns: [{ lot_number, owner_name, proxy_holder_name, is_valid }]

GET    /api/meetings/{meeting_id}/proxies/summary
  Proxy holder summary (for 5% limit tracking)
  Returns: [{ proxy_holder_name, proxy_count, limit_status }]

PATCH  /api/proxies/{proxy_id}
  Update proxy (mark invalid if owner attends)
  Body: { is_valid?, validation_notes? }

DELETE /api/proxies/{proxy_id}
  Delete proxy registration
```

### 14.4 Attendance & Quorum Endpoints

```
POST   /api/meetings/{meeting_id}/attendees
  Check in attendee
  Body: { lot_id, attendance_type }
  Returns: { attendee_id, quorum_status }

GET    /api/meetings/{meeting_id}/attendees
  List all attendees
  Returns: [{ lot_number, owner_name, attendance_type, checked_in_at }]

GET    /api/meetings/{meeting_id}/quorum
  Check quorum status
  Returns: { 
    quorum_required, 
    owners_present, 
    proxies_held, 
    total_attendance, 
    quorum_met: true/false 
  }

POST   /api/meetings/{meeting_id}/adjourn
  Adjourn meeting (quorum not met)
  Body: { adjourned_to_date, adjourned_to_time }
  Creates new meeting record, links to original
  Returns: { adjourned_meeting_id }
```

### 14.5 Resolution Endpoints

```
POST   /api/meetings/{meeting_id}/resolutions
  Record resolution
  Body: { 
    agenda_item_id?, 
    motion_text, 
    motion_type, 
    moved_by, 
    seconded_by, 
    votes_for, 
    votes_against, 
    votes_abstain 
  }
  Auto-calculates: result, result_percentage
  Returns: { resolution_id, result, result_percentage }

GET    /api/meetings/{meeting_id}/resolutions
  List all resolutions
  Returns: [{ motion_text, motion_type, result, votes_for, votes_against }]

PATCH  /api/resolutions/{resolution_id}
  Update resolution (vote counts, notes)
  Body: { votes_for?, votes_against?, discussion_notes? }
```

### 14.6 Minutes Endpoints

```
POST   /api/meetings/{meeting_id}/minutes/generate
  Auto-generate draft minutes from meeting data
  Pulls: attendees, resolutions, agenda items
  Renders template to HTML + PDF
  Returns: { minutes_id, version, pdf_draft_url }

GET    /api/meetings/{meeting_id}/minutes
  Get minutes (latest version)
  Returns: { minutes_id, version, status, content_html, pdf_draft_url, pdf_approved_url }

PATCH  /api/minutes/{minutes_id}
  Update minutes content (manager edits)
  Body: { content_html?, status? }

POST   /api/minutes/{minutes_id}/approve
  Approve minutes (manager → chairperson → published)
  Body: { approved_by_user_id }
  Transitions: DRAFT → MANAGER_REVIEWED → PENDING_APPROVAL → APPROVED → PUBLISHED

POST   /api/minutes/{minutes_id}/upload-signed
  Upload signed PDF (from chairperson)
  Body: { signed_pdf_file }
  Stores in Supabase Storage, updates pdf_approved_url
```

---

## 15. Dependencies on Other Features

### 15.1 Scheme & Lot Register

**Required Data:**
- Scheme financial year end (for AGM deadline calculation)
- Lot register (owners, unit entitlements)
- Owner contact details (email for notices)

**API Integration:**
- `GET /api/schemes/{scheme_id}` → Financial year end, quorum percentage
- `GET /api/schemes/{scheme_id}/lots` → Owner list for notice distribution, quorum calculation

### 15.2 Document Storage

**Required Functionality:**
- Store meeting documents (notices, minutes, proxies) in scheme folders
- 7-year retention policy enforcement
- Document access control (managers + scheme owners only)

**API Integration:**
- `POST /api/documents/upload` → Upload proxy forms, supporting docs
- `GET /api/documents?scheme_id={scheme_id}&folder=meetings` → List meeting docs
- `PUT /api/documents/{doc_id}/retention-expiry` → Set 7-year expiry

### 15.3 Owner Portal

**Required Functionality:**
- Owners can view upcoming meetings
- Download meeting notices, agendas, minutes
- View resolutions from past meetings
- Submit proxy forms online (Phase 2)

**API Integration:**
- `GET /api/owner/meetings?lot_id={lot_id}` → List meetings for owner's scheme
- `GET /api/owner/meetings/{meeting_id}` → View meeting details
- `GET /api/owner/meetings/{meeting_id}/documents` → Download notice, minutes

### 15.4 Email Service (Resend/SendGrid)

**Required Functionality:**
- Send meeting notices with PDF attachments
- Send proxy reminders
- Send minutes to council for approval
- Delivery tracking (bounces, opens)

**API Integration:**
- `POST /api/email/send` → Send notice emails with attachments
- `POST /api/email/send-bulk` → Send to all owners (with unsubscribe link)

### 15.5 Financial Reporting (Optional Link)

**Optional Integration:**
- Attach financial statements to AGM notice (pull from Financial Reports feature)
- Link budget approval resolution to next year's budget (update Levy Management budget)

**API Integration (if implemented):**
- `GET /api/schemes/{scheme_id}/financial-statements?period={fy}` → Get PDF
- `POST /api/schemes/{scheme_id}/budgets` → Create budget from AGM resolution

---

## 16. PDF Templates & Design

### 16.1 Template Library

LevyLite includes pre-designed PDF templates for:

1. **AGM Notice** (includes agenda, quorum, proxy instructions)
2. **SGM Notice** (includes purpose, requisition details if applicable)
3. **Committee Meeting Notice** (simplified agenda)
4. **Proxy Form** (pre-filled with owner details)
5. **Nomination Form** (for council elections)
6. **Meeting Minutes** (structured template, auto-populated)
7. **Resolutions Summary** (list of all resolutions, votes, outcomes)

**Design Principles:**
- Professional, clean layout (inspired by legal documents)
- Clear headings (large, bold)
- Readable body text (12pt sans-serif, 1.5 line spacing)
- Scheme branding (logo upload in Phase 2)
- Accessibility: High contrast, screen-reader friendly

**Tech Stack:**
- `react-pdf` for component-based PDF generation
- Templates stored as React components with props for dynamic fields
- Rendered server-side (Next.js API route) → returned as binary PDF

**Example Code Snippet (Minutes Template):**

```tsx
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40 },
  header: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  section: { marginBottom: 15 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', marginBottom: 5 },
  body: { fontSize: 12, lineHeight: 1.5 }
});

export function MinutesPDF({ meeting, attendees, resolutions }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text>{meeting.scheme_name}</Text>
          <Text>Minutes of {meeting.meeting_type}</Text>
          <Text>{formatDate(meeting.meeting_date)}</Text>
        </View>
        
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ATTENDANCE</Text>
          <Text style={styles.body}>Owners Present: {attendees.present}</Text>
          <Text style={styles.body}>Proxies: {attendees.proxies}</Text>
          <Text style={styles.body}>Quorum: {meeting.quorum_met ? '✓ Met' : '✗ Not Met'}</Text>
        </View>
        
        {resolutions.map(res => (
          <View style={styles.section} key={res.id}>
            <Text style={styles.sectionTitle}>{res.motion_text}</Text>
            <Text style={styles.body}>Moved: {res.moved_by}</Text>
            <Text style={styles.body}>Seconded: {res.seconded_by}</Text>
            <Text style={styles.body}>
              Result: {res.result} (For: {res.votes_for}, Against: {res.votes_against})
            </Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}
```

---

## 17. Open Questions & Decisions Needed

### 17.1 MVP Scope Clarifications

**Question 1:** Should MVP include Committee meetings, or only AGM/SGM?
- **Recommendation:** Include basic Committee meeting support (scheduling, minutes) but defer advanced features (approval workflows, maintenance request linking) to Phase 2. Many small schemes don't have active committees, but those that do need basic tracking.

**Question 2:** Digital signatures for minutes approval, or just upload signed PDF?
- **Recommendation:** Upload signed PDF for MVP. DocuSign integration is $15-$30/month + per-signature fees—too expensive for early customers. Phase 2 can add e-signature.

**Question 3:** Online proxy submission (owners submit via portal), or manager enters manually?
- **Recommendation:** Manager enters manually for MVP. Online submission requires form validation, spam prevention, owner authentication—adds complexity. Most small schemes receive 5-10 proxies per AGM (manageable manual entry).

### 17.2 WA Legislation Clarifications

**Question 4:** Is quorum always 30%, or can schemes set custom percentages?
- **Research Needed:** Check WA Strata Titles General Regulations. Assumption: 30% is default but scheme rules can override. LevyLite should allow manager to set custom quorum per scheme (stored in `schemes.quorum_percentage`).

**Question 5:** Unanimous resolutions—when are they actually required in WA?
- **Research Needed:** Confirm specific scenarios requiring unanimous votes (vs. special resolutions). Assumption: Very rare (e.g., sell common property, change scheme structure). MVP supports recording them but doesn't enforce when required.

**Question 6:** Notice period for adjourned meetings—7 days or none?
- **Research Needed:** Regulation 24(5) states adjourned meeting held 7 days later at same time/place. Do owners need new notice, or is original notice sufficient? Assumption: No new notice required (original notice states adjournment rules). LevyLite will send courtesy email reminder.

### 17.3 UX & Workflow

**Question 7:** During-meeting workflow—does manager record resolutions live, or after meeting?
- **Recommendation:** Support both. Some managers prefer recording votes as they happen (iPad at meeting). Others prefer taking notes and entering data afterward. UI should have quick-entry mode (minimal fields, fast) and detailed mode (full notes, discussion).

**Question 8:** Owner portal access to draft minutes—allowed or only approved minutes?
- **Recommendation:** Only published (approved) minutes visible to owners. Draft/manager-reviewed minutes visible only to manager + council. Avoids confusion and disputes over draft wording.

### 17.4 Multi-State Expansion (Future)

**Question 9:** How different are meeting rules in NSW/VIC/QLD?
- **Research Needed:** Before Phase 3 (multi-state), audit all state legislation for variations:
  - Notice periods (WA: 21 days AGM; NSW: 14 days; VIC: TBD)
  - Quorum rules
  - Special resolution thresholds (WA: 75%; NSW: TBD)
  - Proxy limits (WA: 5%; NSW: different?)
- **Recommendation:** Design database schema to support state-specific overrides (e.g., `meeting_notice_period` as configurable field, not hardcoded 21 days).

---

## 18. Success Metrics

### 18.1 Feature Adoption (6 Months Post-Launch)

- **60%+ of customers** have scheduled at least one meeting (AGM or SGM)
- **40%+ of AGMs** use auto-generated notices (vs. manual Word docs)
- **30%+ of meetings** have recorded resolutions and published minutes
- **10+ hours saved per AGM** (measured via customer survey)

### 18.2 Compliance Impact

- **Zero AGM deadline breaches** for active customers (compliance calendar prevents)
- **100% of meeting documents** retained in system for 7 years (vs. <50% in spreadsheets)
- **90%+ of notices** sent within required timeframes (21-day compliance)

### 18.3 Customer Feedback

- **8+/10 satisfaction** with meeting administration feature (NPS question)
- **Top 3 time-saving feature** (ranked by customers)
- **Zero complaints** about lost meeting documents (vs. common complaint pre-LevyLite)

---

## 19. Conclusion

Meeting Administration is a **compliance-critical, high-value feature** for LevyLite. It directly addresses one of the top pain points for small strata managers: manually creating AGM notices, tracking proxies, recording resolutions, and retaining documents. By automating the entire meeting lifecycle—from compliance calendar to 7-year document retention—LevyLite saves 10-15 hours per AGM and eliminates compliance risk.

**MVP Feature Set** (Must-Have):
- ✅ AGM/SGM scheduling with compliance calendar
- ✅ Automated notice generation (PDF + email)
- ✅ Drag-and-drop agenda builder with standard items
- ✅ Proxy registration with WA 5% limit enforcement
- ✅ Quorum tracking (live attendance + proxies)
- ✅ Resolution recording (ordinary/special/unanimous)
- ✅ Auto-generated minutes with review/approval workflow
- ✅ Visual compliance timeline with automated reminders
- ✅ 7-year document retention (all meeting docs)

**Phase 2 Enhancements** (Post-MVP):
- Online proxy submission (owner portal)
- Digital signatures (DocuSign integration)
- Committee meeting advanced features (approval workflows)
- Online voting (for virtual AGMs)
- Multi-state compliance variations (NSW/VIC/QLD)

**Dependencies:**
- Scheme & Lot Register (owner list, financial year)
- Document Storage (7-year retention)
- Owner Portal (view meetings, download docs)
- Email Service (notice distribution, reminders)

This feature specification provides **everything needed** for the development team to build Meeting Administration from scratch: database schema, API endpoints, UI workflows, PDF templates, WA legislative requirements, and compliance logic. Next steps: Validate WA quorum rules and notice period edge cases with a strata lawyer, then proceed to implementation.

---

**Document Version:** 1.0  
**Word Count:** ~3,950 words  
**Last Updated:** 16 February 2026  
**Author:** Kai (AI Agent), Kokoro Software
