# Strata Management MVP - Product Requirements Document

**Product Name:** LevyLite (working title)  
**Version:** 1.0 MVP  
**Date:** 15 February 2026  
**Prepared by:** Chris Johnstone, Founder, Kokoro Software  
**Target Launch:** Q3 2026 (WA market)

---

## 1. Executive Summary

The Australian strata management software market is broken. Enterprise platforms like StrataMax, MRI Strata Master, and Urbanise charge $5,000-$20,000+ per year and target agencies managing hundreds or thousands of lots. Intellistrata offers transparent pricing at $10-$55/lot/year but requires a 600-lot minimum. Meanwhile, 92% of Australia's 368,234 strata schemes have fewer than 20 lots, and hundreds of small operators managing 50-300 lots are stuck using spreadsheets because nothing affordable exists.

**LevyLite** is a cloud-based strata management platform built specifically for small operators: sole practitioners, small agencies (<50 schemes), and real estate agents managing strata as a side business. At **$6/lot/month**, a typical customer managing 100 lots pays $7,200/year—40-60% less than existing solutions. The platform delivers the essentials—levy management, owner portals, AGM administration, trust accounting, and document storage—without the complexity and cost of enterprise software.

This PRD defines the MVP feature set, go-to-market strategy, and success metrics for launching in Western Australia. With 32,200 small schemes in WA alone and an estimated 50-100 small operators currently using spreadsheets, there's a clear path to $300K+ ARR within 18 months.

---

## 2. Problem Statement

**The market gap is massive:**

368,234 strata schemes exist in Australia. 67% have just 1-5 lots; 92% have ≤20 lots. These small schemes represent 2.37 million lots and generate $10 billion in annual levies. Yet the software market serves only the top 8% of large schemes because that's where per-client revenue is highest.

**Small operators have three bad options:**

1. **Enterprise platforms** (StrataMax, MRI, Urbanise): Quote-based pricing typically $5K-$20K+/year, implementation projects costing $2K-$10K, complex workflows designed for large teams. A small operator managing 80 lots would spend 50-80% of their annual revenue on software.

2. **Mid-tier platforms** (Intellistrata, Strack, PropertyIQ): Intellistrata is the only one with transparent pricing ($10-$55/lot/year) but requires a 600-lot minimum—excluding operators with fewer lots. Strack and PropertyIQ don't publish pricing and focus on established agencies.

3. **Spreadsheets**: Excel + Word + Gmail. No trust accounting integration, manual levy notices, poor document retention, compliance risk, and 10-15 hours per week wasted on admin work that software could automate.

**The result?** An estimated 500-1,000 small operators nationally—managing collectively 150,000-300,000 lots—are underserved. They tolerate spreadsheet pain not because they prefer it, but because they have no affordable alternative.

**Real-world example:** A WA sole practitioner managing 12 schemes (72 lots, 6 lots average per scheme) generates ~$43,000/year in management fees at typical rates. Intellistrata's 600-lot minimum costs $6,000/year (14% of revenue). Enterprise platforms cost $3K-$6K+ (7-14% of revenue). Spreadsheets cost $0 but consume 10+ hours/week in manual admin. **There is no viable software solution for this customer today.**

---

## 3. Target Customer

### Primary Persona: **Sarah, Sole Practitioner Strata Manager**

- **Location:** Perth, WA
- **Business:** Licensed strata manager, operates alone or with 1 part-time admin
- **Portfolio:** 15 schemes, 110 lots total, average 7 lots per scheme
- **Annual revenue:** $60,000-$80,000 in management fees
- **Current tools:** Excel spreadsheets, Gmail, Word documents, manual banking
- **Pain points:**
  - Spends 12 hours/week on levy notices, arrears tracking, AGM admin
  - Compliance anxiety (7-year document retention, trust accounting audit trails)
  - Owners constantly call/email asking for balances, meeting dates, by-laws
  - Can't afford $6K+/year enterprise platforms (10%+ of revenue)
  - Tried Intellistrata but below 600-lot minimum
- **Buying criteria:**
  - Transparent pricing under $1,000/month
  - Self-serve onboarding (no implementation project)
  - Saves 8+ hours/week within 3 months
  - WA Strata Titles Act compliance built-in

### Secondary Persona: **Mark, Real Estate Agent with Strata Side Business**

- **Location:** Regional WA (e.g., Mandurah, Bunbury)
- **Business:** Real estate agency, manages 8 strata schemes (55 lots) as supplementary income
- **Annual strata revenue:** $30,000-$40,000
- **Current tools:** Property management software (not strata-specific) + Excel
- **Pain points:**
  - Strata trust accounting different from rental trust accounting
  - Missing AGM deadlines (not core business, easy to forget)
  - Owners complain about lack of online access
  - Compliance gaps create risk
- **Buying criteria:**
  - Simple interface (not a strata expert)
  - Owner portal to reduce phone calls
  - Cheap enough to justify for small side business ($3K-$5K/year max)

### Tertiary Persona: **Jenny, Committee Treasurer of Self-Managed Scheme**

- **Location:** Suburban Perth (10-lot scheme)
- **Role:** Volunteer treasurer, no professional strata management
- **Current tools:** Excel, paper files, personal bank account (risk!)
- **Pain points:**
  - Manual levy collection (emails owners 4× per year, chases payments)
  - No proper trust accounting
  - Lost AGM minutes from 5 years ago (compliance risk)
  - Spends 5-10 hours/quarter on treasurer duties
- **Buying criteria:**
  - Free for small scheme (≤5 lots), or affordable for 10-lot scheme
  - Easy enough for non-professional
  - Owners can pay levies online
  - Automatic record retention

### Target Customer Sizing

- **WA small operators:** 50-100 firms managing 50-300 lots each
- **WA real estate agents with strata:** 100-200 agencies managing 5-50 schemes
- **Self-managed schemes (future):** 32,000+ small schemes in WA (land-and-expand via free tier)

---

## 4. Market Analysis

### Market Size

- **National:** 368,234 strata schemes, 3.19M lots, $10B annual levies
- **WA:** ~35,000 schemes, ~200,000 lots, $112B insured value
- **Target segment (1-20 lot schemes):** 92% of schemes = 32,200 in WA alone
- **Small operators:** 500-1,000 nationally, 50-100 in WA

### Competitive Landscape

| Competitor | Target Market | Pricing | Strengths | Weaknesses |
|------------|---------------|---------|-----------|------------|
| **StrataMax** | Mid-large agencies | Quote-based, $10K-$20K+/year est. | Comprehensive, 25+ years, 650K lots managed | Enterprise pricing, complex, feature bloat |
| **MRI Strata Master** | Mid-large agencies | Quote-based, $5K-$20K+/year est. | 900K+ lots managed, Merlo AI, File Smart | Quote-based uncertainty, implementation projects |
| **Urbanise** | Mid-large agencies | Per-lot, quote required | Strong automation, NAB integration | Designed for scale, unclear pricing |
| **Intellistrata** ⚠️ | Agencies 600+ lots | **$10-$55/lot/year** (transparent) | AI features, ISO 27001, clear pricing | **600-lot minimum** excludes small operators |
| **Strack** | Small-mid agencies | "Cost-effective" (not published) | AWS, flexible, self-managed support | No pricing transparency |
| **PropertyIQ** | Professional managers | Subscription (not published) | Mobile-first, Macquarie integration | Pricing opacity |

**Key Finding:** Intellistrata is the closest competitor but their 600-lot minimum creates a massive gap. A small operator with 80 lots is 7.5× below their threshold. No credible affordable option exists for operators managing 10-500 lots.

### Pricing Landscape

- **Enterprise:** $50-$150/scheme/month or $10K-$20K+/year for mid-size portfolios
- **Intellistrata:** $10-$55/lot/year (600-lot minimum = $6K/year entry)
- **Market gap:** No offering between $0 (spreadsheets) and $3K-$6K/year

**Our Opportunity:** A 100-lot operator can't justify $6K-$12K/year when total revenue is $50K-$70K. But they'd pay $3K-$7K/year for software that saves 10 hours/week and eliminates compliance risk.

### Regulatory Environment (WA Focus)

**Strata Titles Act 1985 + Strata Titles (General) Regulations 2019:**
- Trust account required (separate ADI, pooled, or strata company's own)
- Professional indemnity insurance required for managers
- Accounting records must be maintained
- Annual return to strata company required
- 7-year document retention (implied by administrative standards)
- Criminal record statement in management contracts
- Disclosure of remuneration and conflicts

**Non-negotiable MVP features:** Trust accounting, levy automation, meeting records, 7-year document storage, financial reporting.

---

## 5. MVP Feature Set

The MVP must be **immediately useful** to a sole practitioner managing 10-20 schemes. Every feature must reduce admin time or compliance risk.

### 5.1 Scheme & Lot Register

**User Story:** Sarah needs a central database of all schemes and lots she manages, with owner/tenant details and contact information.

**Features:**
- Create/edit strata schemes (name, address, ABN, plan number, manager details)
- Lot register (lot number, unit address, entitlement, owner name, contact details)
- Owner contact management (email, phone, postal address)
- Tenant contact details (if applicable)
- Search/filter by scheme, owner name, lot number
- CSV import for bulk data migration from spreadsheets

**Compliance:** Meets WA requirement for maintaining accurate records.

### 5.2 Levy Management

**User Story:** Sarah currently sends levy notices manually via email 4 times per year and tracks payments in Excel. She needs automated levy generation, notices, and arrears tracking.

**Features:**
- Set levy schedule per scheme (quarterly, annual, custom)
- Define admin fund and capital works fund levies per lot
- Automatically generate levy notices (PDF) based on schedule
- Email levy notices to owners (with manual review/approval step)
- Track payments (manual entry: date, amount, payment method, reference)
- Arrears dashboard (red flag lots overdue >30 days)
- Owner levy statement (downloadable PDF showing levy history, payments, balance)

**Compliance:** Audit trail for all levy notices and payments.

**Out of scope for MVP:** Automated payment processing (credit card, bank feeds)—manual tracking is sufficient for v1.

### 5.3 Trust Accounting

**User Story:** Sarah must maintain WA-compliant trust account records with audit trails for Consumer Protection audits.

**Features:**
- General ledger for each scheme (admin fund, capital works fund)
- Transaction entry (receipts, payments, transfers)
- Bank reconciliation (manual: upload bank statement CSV, match transactions)
- Trial balance and fund balance reports
- Transaction audit log (who, when, what)
- EOFY summary report (for accountant)

**Compliance:** WA Strata Titles Act trust account requirements. Must produce audit trail showing all receipts and payments.

**Out of scope for MVP:** Automated bank feeds (requires Yodlee/Basiq integration—add in v2). Manual CSV upload is acceptable for small operators.

### 5.4 Meeting Administration (AGM/SGM)

**User Story:** Sarah needs to schedule AGMs, send notices, record minutes, and store resolutions. Currently does this in Word and loses old files.

**Features:**
- Create meeting (AGM or SGM: date, time, location/Zoom link)
- Generate meeting notice (template with agenda items, nomination forms if needed)
- Email meeting notice to all owners (certified delivery log)
- Attach documents (financial statements, budget, proposed by-law changes)
- Record meeting minutes (rich text editor)
- Record resolutions (motion text, vote outcome: passed/failed, vote count if available)
- Store AGM pack (notice, agenda, financials, minutes, resolutions) in document library
- Reminder system (e.g., AGM due in 30 days)

**Compliance:** WA/all states require annual AGM, minutes must be kept for 7 years.

**Out of scope for MVP:** Online voting (too complex for v1), video conferencing integration (just store Zoom link).

### 5.5 Maintenance Request Tracking

**User Story:** Owners report maintenance issues (broken gate, pool cleaner broken, etc.). Sarah needs to log, assign to tradesperson, and track to completion.

**Features:**
- Owners submit requests via owner portal (or manager creates on behalf)
- Request details (description, photos, urgency: low/medium/high)
- Assign to tradesperson (store tradesperson directory: name, trade, contact, ABN)
- Status workflow (new → assigned → in progress → completed)
- Internal notes (for manager/committee)
- Attach quotes, invoices, photos
- Notification to owner when status changes

**Compliance:** Audit trail for committee decisions on maintenance spend.

**Out of scope for MVP:** Automated tradesperson notifications (manual email/SMS is fine), tradesperson portal (they receive email, reply via email).

### 5.6 Document Storage (7-Year Retention)

**User Story:** Sarah needs compliant document storage for AGM packs, contracts, by-laws, insurance certificates, building reports, etc.

**Features:**
- Upload documents per scheme (PDF, images, Word, Excel)
- Folder structure (e.g., AGM, Correspondence, Contracts, By-laws, Insurance, Building Reports)
- Tagging/metadata (document type, date, keywords)
- Search by filename, tags, date range
- Automatic 7-year retention with expiry date tracking
- Download/email documents to owners
- Audit log (who accessed what, when)

**Compliance:** All states require record retention (typically 7 years). WA implies this via administrative record requirements.

**Out of scope for MVP:** OCR/auto-tagging (nice to have, not essential), version control (v1 just stores latest).

### 5.7 Basic Financial Reporting

**User Story:** Sarah needs to produce financial reports for committee meetings and AGMs without exporting to Excel.

**Features:**
- Levy roll (per scheme: lot, owner, levy due, paid, arrears)
- Fund balance summary (admin fund balance, capital works fund balance)
- Income statement (receipts and payments by category, budget vs. actual)
- Budget preparation tool (set next year's budget by category)
- EOFY summary for accountant

**Compliance:** Required for AGM reporting in all states.

**Out of scope for MVP:** Cash flow forecasting, advanced analytics, multi-year comparisons (add later).

### 5.8 Owner Portal (Self-Service)

**User Story:** Owners constantly email Sarah asking for levy balances, meeting dates, by-laws, contact details. A self-service portal reduces calls/emails by 50%+.

**Features:**
- Owner login (magic link via email, no password to remember)
- Dashboard showing:
  - Levy balance (current, arrears if any)
  - Next levy due date and amount
  - Upcoming AGM date
  - Recent committee meeting minutes (if published)
  - Maintenance requests submitted by them (status)
- Download documents (AGM packs, by-laws, insurance certificates, building plans)
- Submit maintenance request
- Update contact details (manager approves changes)

**Compliance:** Transparency = fewer complaints, better owner relations.

**Out of scope for MVP:** Online levy payment (add in v2 with Stripe/PayTo integration), owner-to-owner messaging (creates moderation burden).

### 5.9 User & Access Management

**User Story:** Sarah works alone but might hire a part-time admin. Needs basic role-based access.

**Features:**
- Manager role (full access to all schemes)
- Admin role (read/write but can't delete schemes or change trust account transactions)
- Auditor role (read-only financial access for accountant)
- Invite users via email

**Out of scope for MVP:** Granular scheme-level permissions (all users see all schemes for now—acceptable for small operators).

### 5.10 Mobile Responsiveness

**User Story:** Sarah attends site inspections and committee meetings. Needs to access platform on phone/tablet.

**Features:**
- Responsive design (Bootstrap or Tailwind CSS)
- Core workflows mobile-friendly (view levy roll, enter transaction, check maintenance request)

**Out of scope for MVP:** Native mobile app (PWA with offline support in v2).

---

## 6. Non-MVP Features (Post-Launch Roadmap)

These features are **important but not essential** for launch. Add based on customer feedback.

### Phase 2 (Months 4-9)
- **Automated bank feeds** (Yodlee/Basiq integration for trust account reconciliation)
- **Online levy payment** (Stripe/PayTo integration, 1.5% surcharge)
- **Bulk communications** (email/SMS broadcast to all owners with templates)
- **Insurance tracking** (policy expiry reminders, certificate storage)
- **By-law management** (store by-laws, amendment history, breach tracking)

### Phase 3 (Months 10-18)
- **Online AGM voting** (proxy collection, ballot system, live results)
- **Contractor management** (tradesperson portal, quote comparison, invoice approval workflow)
- **Budget vs. actual tracking** (variance reports, alerts when category overspent)
- **Multi-state compliance** (NSW, VIC, QLD legislation variations)
- **API access** (for accountants to pull data into Xero/MYOB)

### Phase 4 (Months 19-24+)
- **Mobile app** (iOS/Android native with offline support)
- **AI features** (auto-categorise expenses, predict levy increases, draft meeting minutes)
- **Multi-office support** (for agencies with 2+ branches)
- **White-label option** (rebrand for larger customers)

---

## 7. Tech Stack Recommendation

Leverage Chris's existing skills (Next.js + Supabase) to minimise learning curve and accelerate MVP development.

### Core Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| **Frontend** | Next.js 15 (App Router) | React framework, SSR/SSG, SEO-friendly, fast iteration |
| **Backend** | Supabase (PostgreSQL + Auth + Storage + Realtime) | Managed Postgres, row-level security, auth built-in, 500MB free tier (test), $25/month pro tier (production) |
| **Hosting** | Vercel (frontend) + Supabase Cloud (backend) | Zero-config deploy, edge functions, $20/month Vercel Pro + $25/month Supabase = $45/month infrastructure at MVP scale |
| **Database** | PostgreSQL (via Supabase) | Relational data model suits strata (schemes → lots → owners → transactions) |
| **Auth** | Supabase Auth + Magic Links | Passwordless login (email magic link), reduce friction for owners |
| **Storage** | Supabase Storage (S3-compatible) | Document storage with 7-year retention, CDN-backed |
| **Email** | Resend or SendGrid | Transactional emails (levy notices, AGM notices, magic links), $20-50/month at MVP scale |

### Supporting Libraries

| Purpose | Library | Notes |
|---------|---------|-------|
| **UI Components** | shadcn/ui + Radix UI | Accessible, customisable, works with Tailwind CSS |
| **Styling** | Tailwind CSS | Utility-first, mobile-responsive, fast prototyping |
| **Forms** | React Hook Form + Zod | Form validation, type-safe schemas |
| **PDF Generation** | react-pdf or PDFKit | Generate levy notices, financial reports, owner statements |
| **Date Handling** | date-fns | Lightweight, better than moment.js |
| **Tables** | TanStack Table (React Table v8) | Sortable, filterable tables for levy roll, transaction ledger |
| **Charts** | Recharts or Chart.js | Financial reports (budget vs. actual, fund balances over time) |
| **File Uploads** | react-dropzone | Drag-and-drop document upload |

### Infrastructure & Operations

| Service | Purpose | Cost (MVP) |
|---------|---------|------------|
| **Vercel** | Frontend hosting, edge functions | $20/month (Pro plan) |
| **Supabase** | Database, auth, storage, realtime | $25/month (Pro plan, 8GB DB, 100GB storage, 250K MAU) |
| **Resend** | Transactional email (levy notices, etc.) | $20/month (50K emails) |
| **Sentry** | Error tracking | Free tier (5K events/month) |
| **Plausible/PostHog** | Privacy-friendly analytics | $9-$19/month |
| **Backups** | Supabase daily backups | Included in Pro plan |

**Total infrastructure cost at MVP:** ~$75-$100/month for up to 500 users (owners + managers). Scales to $200-$300/month at 5,000 users.

### Security & Compliance

- **Supabase Row-Level Security (RLS):** Owners can only see their own lots/documents, managers see their schemes
- **Audit logging:** PostgreSQL triggers to log all trust account transactions (who, when, what)
- **Encryption:** Data at rest (Supabase default), HTTPS in transit
- **Backups:** Daily automated backups (Supabase), 7-day retention (upgrade to 30-day in production)
- **GDPR/Privacy Act compliance:** Owner data export tool, right to be forgotten (soft delete)

### Why This Stack?

1. **Chris already knows it:** Next.js + Supabase from Report Flow Pro = faster development
2. **Low initial cost:** ~$75-$100/month infrastructure vs. $500-$1K+/month for AWS/custom backend
3. **Fast iteration:** Supabase handles auth, DB, storage out of the box—no reinventing the wheel
4. **Scales to 1000+ users** without rewrite (Supabase Pro supports 100K+ rows, 8GB DB is plenty for MVP)
5. **Modern DX:** TypeScript, React Server Components, edge functions = maintainable codebase

---

## 8. Pricing Strategy

### Pricing Model: **Per-Lot, Per-Month**

Transparent, predictable, no sales calls required.

| Tier | Lots Managed | Price/Lot/Month | Monthly Cost Example | Annual Cost | Target Customer |
|------|--------------|-----------------|----------------------|-------------|-----------------|
| **Free** | 1-5 lots, 1 scheme | $0 | $0 | $0 | Trial / self-managed schemes |
| **Starter** | 11-50 lots | $8/lot | 30 lots = $240/month | $2,880/year | Sole practitioners (small portfolio) |
| **Professional** | 51-200 lots | $6/lot | 100 lots = $600/month | $7,200/year | Small agencies, real estate agents |
| **Growth** | 201-500 lots | $5/lot | 300 lots = $1,500/month | $18,000/year | Growing agencies |

**Paid tiers include:** Unlimited users, unlimited document storage (fair use 50GB/tier), all MVP features, email support (24-48h response).

**Free tier includes:** Scheme & lot register, levy management (manual notices only), document storage, owner portal, meeting admin. **14-day trial of all features** on signup.

**Free tier excludes (after trial):** Trust accounting, bulk levy notices, financial reporting, CSV import/export.

**Annual billing discount:** 2 months free (pay for 10 months, get 12).

### Rationale

- **$6/lot/month sweet spot:** 40-60% cheaper than Intellistrata ($10-$55/lot/year = $0.83-$4.58/lot/month) and 70-80% cheaper than enterprise platforms
- **Free tier (1-5 lots, 1 scheme):** Land-and-expand strategy. Small self-managed schemes get free access with core features. 14-day trial of full features on signup. When they professionalise or grow, they're already on the platform. Low limit (5 lots) prevents abuse while still being genuinely useful for trial.
- **Higher price for smallest tier (11-50 lots):** Subsidises free tier, reflects higher per-customer support cost
- **Volume discount incentive:** Encourages growth (customer adds schemes, price/lot drops)

### Revenue Projections

**Conservative MVP Scenario (WA, 12 Months):**
- 10 paying customers
- Average 100 lots per customer at $6/lot/month
- ARR: 10 × 100 × $6 × 12 = **$72,000**

**Growth Scenario (WA, 18 Months):**
- 30 paying customers
- Average 120 lots per customer
- ARR: 30 × 120 × $6 × 12 = **$259,200**

**National Expansion (24 Months):**
- 100 paying customers (WA + NSW/VIC/QLD)
- Average 150 lots per customer
- ARR: 100 × 150 × $6 × 12 = **$1,080,000**

### Payment Processing

- **Monthly billing:** Stripe Billing (1.7% + A$0.30 domestic cards + 0.7% Billing fee)
- **Annual billing:** Stripe Billing with 2-month discount
- **BECS Direct Debit:** Stripe AU (~1% + A$0.30, capped A$3.50) — preferred for B2B
- **Invoice option (for agencies preferring annual invoice):** Manual invoice, bank transfer

**Customer acquisition cost (CAC) target:** <$500 (aim to recover in 2-3 months of revenue)

---

## 9. Go-to-Market Strategy (WA Launch)

**Goal:** 10 paying customers in 12 months, 30 customers in 18 months.

### Month 1-2: Foundation & Validation

1. **Build landing page** (Next.js, hosted on Vercel)
   - Clear value proposition: "Strata management software for small operators—$6/lot/month, no minimums"
   - Pricing calculator (enter # of lots → see monthly cost)
   - Email capture for beta access
   - Publish to levylite.com.au (placeholder domain)

2. **Interview 5-10 WA operators** (including Donna Henneberry)
   - Validate pricing, features, pain points
   - Identify 3-5 "design partners" willing to beta test
   - Ask: "What would make you switch from spreadsheets within 30 days?"

3. **Build MVP alpha** (core features: schemes, lots, levies, documents, owner portal)
   - Internal testing with dummy data
   - Invite design partners to beta (free for 6 months in exchange for feedback)

### Month 3-6: Beta Testing & Iteration

4. **Onboard 3-5 design partners**
   - Weekly check-ins for first month
   - Fix critical bugs, iterate on UX
   - Collect testimonials ("This saved me 10 hours in the first week")

5. **Local networking (Perth)**
   - Attend Strata Community Association (WA) events
   - Connect with Donna Henneberry's network (small operators, real estate agents)
   - Join Real Estate Institute of WA (REIWA) as associate member
   - Speak at local real estate networking events ("How small operators can ditch spreadsheets")

6. **Content marketing**
   - Write 5-10 blog posts:
     - "WA Strata Titles Act: Trust Accounting Compliance Guide"
     - "How to Run an AGM Without Losing Your Mind"
     - "5 Signs You've Outgrown Spreadsheets for Strata Management"
   - Post on LinkedIn (target: strata managers, real estate agents)
   - SEO for "strata management software WA", "cheap strata software", "strata software for small operators"

### Month 7-12: Public Launch & Customer Acquisition

7. **Public launch** (end of beta)
   - Remove waitlist, open self-serve signup
   - Publish pricing page
   - Launch 30-day free trial (no credit card required)
   - Email beta users + waitlist (200-500 people by this point)

8. **Paid advertising (small budget: $500-$1,000/month)**
   - Google Ads: "strata management software Perth", "WA strata software"
   - Facebook/LinkedIn ads targeting WA strata managers, real estate agents
   - Retarget website visitors who didn't sign up

9. **Partnerships**
   - Partner with WA strata lawyers, accountants (referral fee: 1 month revenue)
   - Offer free training webinars ("Switching from Spreadsheets to Software in 1 Week")
   - Co-marketing with tradesperson directories, insurance brokers

10. **Case studies**
    - Publish 2-3 detailed case studies showing ROI:
      - "How Sarah saved 12 hours/week managing 15 schemes"
      - "How Mark's real estate agency reduced owner complaints by 60%"

### Month 13-18: Expand Within WA, Prepare National Expansion

11. **Regional WA expansion**
    - Target Mandurah, Bunbury, Albany, Geraldton (regional real estate agents)
    - Sponsor regional SCA events

12. **Feature iteration based on feedback**
    - Add top 3 customer-requested features (likely: bank feeds, online payment, bulk comms)

13. **Prepare NSW/VIC compliance**
    - Research NSW SSMA and VIC Owners Corporation Act variations
    - Build multi-state support (flag schemes by state, show state-specific compliance features)

14. **National marketing prep**
    - Expand SEO to NSW, VIC, QLD keywords
    - Outreach to SCA chapters in other states

### Success Metrics (Month 12)

- **10 paying customers** (WA)
- **1,000-1,500 lots under management** on platform
- **$60K-$90K ARR**
- **30-day free trial → paid conversion: 15-20%**
- **Churn: <5% monthly** (sticky product, high switching cost once onboarded)
- **Customer satisfaction: 8+/10 NPS**

---

## 10. Risks & Mitigations

### Risk 1: **Customer Acquisition Cost Too High**

**Risk:** Small operators aren't actively searching for software (using spreadsheets). Paid ads might not convert at acceptable CAC.

**Mitigation:**
- Focus on **word-of-mouth** and **referral incentives** (1 month free for every paying customer referred)
- Build **free tier** as trojan horse (self-managed schemes recommend to professional managers)
- **Local networking** (SCA events, REIWA) has lower CAC than paid ads
- Target: CAC <$500, recover in 2-3 months

### Risk 2: **Trust Accounting Compliance Errors**

**Risk:** Getting trust accounting wrong = regulatory penalties, customer churn, reputational damage.

**Mitigation:**
- **Consult WA strata lawyer** during MVP build (cost: $2K-$5K, worth it)
- **Audit trail built-in** (PostgreSQL triggers log all transactions)
- **Beta test with accountant design partner** (review ledger, reconciliation, EOFY reports)
- **Disclaimer in T&Cs:** Software assists with record-keeping but customer responsible for compliance
- **Support documentation:** WA trust account requirements, how to reconcile, EOFY checklist

### Risk 3: **Feature Creep / Scope Bloat**

**Risk:** Early customers demand enterprise features, delaying launch or bloating MVP.

**Mitigation:**
- **Strict MVP scope:** Only features that save time or reduce compliance risk
- **"Not now" roadmap:** Acknowledge requests, add to Phase 2/3 list, don't build immediately
- **Customer education:** "We're building for small operators. Enterprise features come later."
- **Monthly releases:** Small feature additions based on usage data, not loudest customer

### Risk 4: **Competitor Response**

**Risk:** Intellistrata lowers minimum to 300 lots, or enterprise players launch "lite" versions.

**Mitigation:**
- **Speed to market:** Launch before competitors notice the gap
- **Brand positioning:** "Built for small operators by a small operator" (Chris's credibility as software developer and founder)
- **Customer lock-in:** Once onboarded, switching cost is high (data migration, learning curve)
- **Feature differentiation:** Free tier, transparent pricing, WA-specific compliance focus

### Risk 5: **Churn (Customers Go Out of Business)**

**Risk:** Small operators have irregular cash flow, may close business or lose schemes.

**Mitigation:**
- **Diversify customer base:** Target 30-50 customers, not 5-10 (spread risk)
- **Annual billing discount:** Lock in customers for 12 months (churn occurs annually, not monthly)
- **Sticky product:** Document storage, trust accounting audit trails = hard to leave mid-year
- **Target: <5% monthly churn** (60% annual retention = healthy for SMB SaaS)

### Risk 6: **Data Security Breach**

**Risk:** Handling financial data + personal information = high responsibility. Breach = legal liability, reputational damage.

**Mitigation:**
- **Supabase security:** Row-Level Security (RLS), encryption at rest/transit, SOC 2 Type II certified infrastructure
- **Audit logging:** All access to trust account data logged (who, when, what)
- **Regular backups:** Daily automated, 30-day retention (upgrade from 7-day)
- **Privacy Policy + T&Cs:** GDPR/Privacy Act compliant, right to export/delete
- **Insurance:** Professional indemnity + cyber liability insurance (cost: $2K-$5K/year)

### Risk 7: **Chris's Time Availability**

**Risk:** Chris has a full-time day job. Building this as side project = limited hours.

**Mitigation:**
- **MVP-first approach:** Build smallest useful product, not comprehensive platform
- **Leverage existing skills:** Next.js + Supabase = faster development (no learning curve)
- **Outsource non-core:** UI design (Figma template $50-$200), copywriting ($500)
- **Timeline: 3-4 months to MVP** at 10-15 hours/week (120-180 hours total build time)
- **Validate before scaling:** 10 customers before hiring help (de-risk with revenue)

---

## 11. Success Metrics

### MVP Launch Success (Month 3)

- ✅ 3-5 design partner customers onboarded
- ✅ Core features functional (schemes, lots, levies, documents, owner portal)
- ✅ Zero critical bugs (trust accounting data integrity)
- ✅ Average 2-3 hours/week saved per customer (validated via feedback)

### 6-Month Success

- ✅ **5-10 paying customers**
- ✅ **500-1,000 lots under management**
- ✅ **$30K-$60K ARR**
- ✅ **8+/10 customer satisfaction** (NPS survey)
- ✅ **<5% monthly churn**
- ✅ **2-3 customer testimonials** published
- ✅ **Landing page conversion: 10-15%** (visitor → trial signup)

### 12-Month Success

- ✅ **10-15 paying customers**
- ✅ **1,200-2,000 lots under management**
- ✅ **$70K-$150K ARR**
- ✅ **Free trial → paid conversion: 15-20%**
- ✅ **CAC <$500** (recover in 2-3 months)
- ✅ **Product-market fit validated** (customers referring other operators)
- ✅ **Phase 2 features scoped** (bank feeds, online payment, bulk comms) based on customer feedback

### 18-Month Success (Expansion Ready)

- ✅ **25-35 paying customers** (WA)
- ✅ **3,000-5,000 lots under management**
- ✅ **$200K-$350K ARR**
- ✅ **Multi-state compliance built** (NSW, VIC, QLD)
- ✅ **National launch prep complete** (SCA chapter outreach, case studies)
- ✅ **Profitability:** Revenue > costs (infrastructure + marketing + Chris's time)

### Leading Indicators to Monitor

- **Website traffic:** 500-1,000 unique visitors/month by Month 6
- **Trial signups:** 10-20/month by Month 6
- **Activation rate:** 50%+ of trial users create first scheme + add lots
- **Time-to-value:** Average customer saves 5+ hours in first 2 weeks
- **Feature usage:** Levy notices sent, documents uploaded, owner portal logins
- **Support tickets:** <10/month (indicates intuitive UX)
- **Referral rate:** 20%+ of customers refer another operator

---

## Appendix: Why This Will Work

### Market Timing

- **Spreadsheet pain is universal** but no one's built for the bottom 92% of schemes
- **Intellistrata's 600-lot minimum** is a gift—proves pricing transparency works but leaves massive gap
- **COVID accelerated digital adoption**—even small operators now expect cloud software

### Chris's Advantages

1. **Local credibility:** Founder of Kokoro Software, experienced software developer based in Perth
2. **Existing tech stack:** Next.js + Supabase from Report Flow Pro = faster build
3. **Donna Henneberry connection:** Design partner + advocate in WA strata community
4. **Compliance expertise:** Can research WA Strata Titles Act, consult local lawyers

### Competitive Moat (Long-Term)

- **First-mover in "affordable strata"** segment (before Intellistrata drops minimum or Strack gets serious)
- **Network effects:** Free tier = 1,000s of self-managed schemes, some hire professional managers (already on platform)
- **Data lock-in:** Trust accounting audit trails, 7 years of documents = high switching cost
- **WA legislative expertise:** Deep knowledge of WA compliance = trusted locally, harder for interstate competitors to replicate

---

**End of PRD**

---

## Next Steps (For Discussion with Donna)

1. **Validate pricing:** Is $6/lot/month compelling? Would you switch from spreadsheets at that price?
2. **Feature prioritisation:** Which MVP features are must-haves vs. nice-to-haves from your perspective?
3. **Beta participation:** Would you be willing to test the platform with 2-3 schemes for 6 months (free) and provide weekly feedback?
4. **Referral potential:** If this works for you, how many other WA operators could you introduce?
5. **Compliance review:** Any WA-specific requirements I've missed?

**Contact:** Chris Johnstone | chris@kokorosoftware.com | Kokoro Software, Perth WA
