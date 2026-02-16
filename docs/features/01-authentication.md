# LevyLite Feature Specification: Authentication & User Management

**Feature ID:** 01  
**Version:** 1.0  
**Last Updated:** 16 February 2026  
**Owner:** Chris Johnstone, Kokoro Software  
**Status:** Specification

---

## 1. Overview

Authentication and user management form the foundation of LevyLite's security architecture. This feature enables secure multi-tenant access for strata managers, their staff, external auditors, and lot owners while maintaining strict data isolation between organisations.

### Technical Conventions (Apply to All Features)
- **Database timestamps**: Always use `TIMESTAMPTZ` (timezone-aware)
- **Database naming**: `snake_case` for tables and columns
- **API JSON**: `camelCase` for request/response payloads
- **Enums**: Always lowercase, snake_case if multi-word
- **RLS policies**: Use `auth.user_organisation_id()` helper for tenant isolation
- **PDF generation**: `@react-pdf/renderer` (standardised across all features)
- **Date handling**: `date-fns` library
- **Charts**: `recharts` library
- **Server Actions**: For form submissions and mutations
- **API Routes**: For webhooks, file downloads, and external integrations only

### Design Philosophy

1. **Frictionless for non-technical users**: Magic link authentication eliminates password fatigue for lot owners who access the portal infrequently (quarterly levy checks, annual AGM documents).

2. **Security without complexity**: Leverage Supabase Auth's battle-tested infrastructure instead of rolling custom auth. Row-Level Security (RLS) provides database-level isolation—even a compromised application layer cannot leak cross-tenant data.

3. **Trust by default, verify by design**: Small strata operators work in high-trust environments (sole practitioners, family businesses), but trust accounting demands audit trails. Every auth event is logged.

4. **Progressive disclosure**: Start with email-based auth (MVP), add Google social auth when needed, reserve MFA for high-value accounts (large portfolios, sensitive schemes).

### Target User Classes

| User Type | Count (per org) | Auth Method | Access Pattern | Security Requirement |
|-----------|-----------------|-------------|----------------|----------------------|
| **Manager** | 1-2 | Magic link or password | Daily (desktop) | Full access, audit log |
| **Admin Staff** | 0-3 | Magic link or password | Daily (desktop/mobile) | Read/write, no destructive ops |
| **Auditor** | 0-1 | Magic link (invite-only) | Quarterly (desktop) | Read-only financial |
| **Lot Owner** | 50-500+ per org | Magic link only | Monthly/quarterly (mobile) | Scoped to their lot(s) |

### Success Criteria

- Owner login success rate >95% (magic link doesn't land in spam)
- Manager onboarding <5 minutes (create account → add first scheme)
- Zero cross-tenant data leaks (validated via security audit)
- Auth system scales to 10,000+ owners without performance degradation

---

## 2. Authentication Methods

### 2.1 Magic Link (Email) — Primary Method

**Why Magic Link First?**

Our target users—sole practitioners managing small schemes and lot owners checking balances—are not security-savvy. They:
- Forget passwords (support burden)
- Reuse weak passwords across sites (security risk)
- Access the platform infrequently (owners: quarterly levy checks, annual AGM)

Magic links eliminate password fatigue while providing good security: an attacker needs both email access and session hijacking capability.

**Implementation (Supabase Auth)**

```typescript
// Client-side: Request magic link
const { error } = await supabase.auth.signInWithOtp({
  email: 'owner@example.com',
  options: {
    emailRedirectTo: 'https://levylite.com.au/auth/callback',
    shouldCreateUser: false, // Owners must be invited, not self-signup
  }
})
```

**Email Template Requirements**

- **Subject:** "Your LevyLite login link (expires in 1 hour)"
- **Body:**
  - Clear call-to-action button: "Sign in to LevyLite"
  - Expiry warning: "This link expires in 60 minutes"
  - Security note: "If you didn't request this, ignore this email"
  - No-reply address: noreply@levylite.com.au
  - Support contact: support@levylite.com.au
- **Deliverability:** SPF, DKIM, DMARC configured via Resend
- **Link format:** `https://levylite.com.au/auth/verify?token=...&type=magiclink`

**User Experience Flow**

1. User enters email on `/login`
2. System validates email exists in `profiles` table (prevent enumeration by showing same message for valid/invalid)
3. "Check your email for a login link" screen (with resend option after 60s)
4. User clicks link in email → redirected to `/auth/callback` → token exchange → session created → redirect to dashboard
5. Session cookie stored (httpOnly, secure, sameSite=lax)

**Edge Cases**

- **Email not received:** Resend button (rate-limited: 1 resend per 60s, max 3 per hour per email)
- **Link expired:** Clear error message: "This link has expired. Request a new one."
- **Link already used:** Same error as expired (prevents replay attacks)
- **Multiple active links:** Allow up to 3 concurrent unexpired links (user requests new link before checking email)

### 2.2 Google Social Auth — Optional Convenience

**Use Case:** Managers who use Google Workspace for business email (common among small businesses) can sign in with existing Google credentials.

**Implementation**

```typescript
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: 'https://levylite.com.au/auth/callback',
    queryParams: {
      access_type: 'offline',
      prompt: 'consent',
    },
    scopes: 'email profile', // Don't request Google Calendar/Drive unnecessarily
  }
})
```

**OAuth Flow**

1. User clicks "Sign in with Google" button on `/login`
2. Redirect to Google OAuth consent screen
3. User approves → Google redirects to `/auth/callback?code=...`
4. Supabase exchanges code for Google access token
5. First-time Google users: Create `auth.users` record + link to existing `profiles` entry (if invited via email) OR show "You haven't been invited" error
6. Returning users: Session created → dashboard

**Security Considerations**

- **Email verification:** Google emails are pre-verified (trust Google's verification)
- **Account linking:** If user previously signed in via magic link with same email, automatically link accounts
- **OAuth state parameter:** Supabase handles CSRF protection via state parameter

**Limitations**

- Not available for lot owners (magic link only, to reduce complexity)
- Requires Google Developer Console project setup (free, one-time config)

### 2.3 Password-Based Auth — Fallback for Managers

**Use Case:** Some managers prefer traditional passwords, especially if they use password managers (1Password, Bitwarden).

**Implementation**

```typescript
const { data, error } = await supabase.auth.signUp({
  email: 'manager@example.com',
  password: 'SecureP@ssw0rd123',
  options: {
    emailRedirectTo: 'https://levylite.com.au/auth/callback',
    data: {
      role: 'manager', // Custom metadata
    }
  }
})
```

**Password Requirements**

- Minimum 12 characters (Supabase default is 6, we increase it)
- Must include: uppercase, lowercase, number, special character
- No common passwords (check against top 10,000 leaked passwords via haveibeenpwned API)
- Validated client-side (instant feedback) + server-side (security)

**Password Reset Flow**

1. User clicks "Forgot password?" on `/login`
2. Enter email → Supabase sends password reset email
3. User clicks reset link → `/reset-password?token=...` page
4. Enter new password (with strength indicator) → submit
5. Supabase validates token + updates password → redirect to login

**Why Not Primary?**

- Support burden: password resets, "forgot password" tickets
- Security risk: weak passwords, password reuse
- Poor UX for infrequent users (owners forget passwords)

We'll implement password auth but **hide it by default**: magic link button is prominent, "Or sign in with password" link is below fold.

---

## 3. User Roles & Permissions (RBAC)

LevyLite uses a **role-based access control (RBAC)** model with four roles. Roles are assigned per organisation (tenant), not globally.

### 3.1 Role Definitions

#### Manager (Superuser within Organisation)

**Who:** Business owner, principal strata manager  
**Responsibilities:** Full control over organisation's schemes, financials, users  
**Permissions:**
- ✅ Create/edit/delete schemes, lots, owners
- ✅ Manage trust accounting (all transactions)
- ✅ Invite/remove users (Admin, Auditor, Owner roles)
- ✅ Change organisation settings (branding, billing, integrations)
- ✅ View audit logs
- ✅ Export all data
- ❌ Cannot access other organisations (strict tenant isolation)

**Database:** `profiles.role = 'manager'`

#### Admin (Staff Member)

**Who:** Part-time admin assistant, junior strata manager  
**Responsibilities:** Day-to-day operations, but not destructive actions  
**Permissions:**
- ✅ Create/edit schemes, lots, owners (cannot delete)
- ✅ Enter trust accounting transactions (cannot delete, can edit own entries within 24h)
- ✅ Send levy notices, meeting notices
- ✅ Upload documents, respond to maintenance requests
- ❌ Cannot delete schemes or lots (prevents accidental data loss)
- ❌ Cannot delete trust account transactions (compliance: audit trail integrity)
- ❌ Cannot invite/remove users (Manager only)
- ❌ Cannot access billing or organisation settings

**Database:** `profiles.role = 'admin'`

**Audit Trail:** All Admin actions logged with `performed_by` field (Manager can review)

#### Auditor (External Accountant)

**Who:** External accountant, compliance auditor, Consumer Protection WA inspector  
**Responsibilities:** Review financial records for compliance  
**Permissions:**
- ✅ Read-only access to trust accounting ledger, trial balance, fund balances
- ✅ Download financial reports (PDF/CSV export)
- ✅ View levy roll, arrears, payment history
- ❌ Cannot view owner contact details (privacy: only lot number, balance)
- ❌ Cannot edit any data
- ❌ Cannot access non-financial data (maintenance requests, meeting minutes)

**Database:** `profiles.role = 'auditor'`

**Access Control:** Time-limited invitations (default 90 days, Manager can extend/revoke)

#### Owner (Lot Owner / Portal User)

**Who:** Individual lot owners, strata company committee members  
**Responsibilities:** Self-service access to their lot's information  
**Permissions:**
- ✅ View their lot's levy balance, payment history, arrears
- ✅ Download levy notices, AGM packs, by-laws, building reports (scheme-wide documents)
- ✅ Submit maintenance requests for their lot
- ✅ Update their contact details (Manager approves changes)
- ❌ Cannot view other lots' financial details (privacy)
- ❌ Cannot view other owners' contact information
- ❌ Cannot access trust accounting ledger (Manager/Auditor only)

**Database:** `profiles.role = 'owner'` + linked to `lot_ownerships` table (many-to-many: one owner can own multiple lots, one lot can have multiple owners)

**Scoping:** Owner's access is scoped via RLS policies to lots they own within schemes managed by their organisation.

### 3.2 Permission Matrix

| Feature | Manager | Admin | Auditor | Owner |
|---------|---------|-------|---------|-------|
| **Schemes** | CRUD | CRU | - | R (own) |
| **Lots** | CRUD | CRU | - | R (own) |
| **Owners** | CRUD | CRU | - | U (self) |
| **Levy notices** | CRUD | CR | R | R (own) |
| **Trust accounting** | CRUD | CR* | R | - |
| **Documents** | CRUD | CRU | R (financial) | R (scheme) |
| **Maintenance requests** | CRUD | CRUD | - | CR (own) |
| **Meeting minutes** | CRUD | CR | - | R (published) |
| **Users** | CRUD | - | - | - |
| **Audit logs** | R | - | R (own actions) | - |

*Admin can create/read transactions, edit own entries <24h, cannot delete

### 3.3 Database Schema for Roles

```sql
-- Enum type for roles
CREATE TYPE user_role AS ENUM ('manager', 'admin', 'auditor', 'owner');

-- Profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  role user_role NOT NULL DEFAULT 'owner',
  full_name TEXT NOT NULL,
  email TEXT NOT NULL, -- Denormalised from auth.users for convenience
  phone TEXT,
  invited_by UUID REFERENCES profiles(id), -- Who invited this user
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  activated_at TIMESTAMPTZ, -- When they first logged in
  deactivated_at TIMESTAMPTZ, -- Soft delete (preserve audit trail)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_profiles_organisation_role ON profiles(organisation_id, role);
CREATE INDEX idx_profiles_email ON profiles(email);

-- RLS policies (examples)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Managers see all users in their organisation
CREATE POLICY profiles_manager_all ON profiles
  FOR ALL
  USING (
    organisation_id IN (
      SELECT organisation_id FROM profiles 
      WHERE id = auth.uid() AND role = 'manager'
    )
  );

-- Admins see all users but cannot modify
CREATE POLICY profiles_admin_read ON profiles
  FOR SELECT
  USING (
    organisation_id IN (
      SELECT organisation_id FROM profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Owners can only see/update their own profile
CREATE POLICY profiles_owner_self ON profiles
  FOR ALL
  USING (id = auth.uid());
```

---

## 4. Multi-Tenancy & Data Isolation

### 4.1 Tenant Model

**Organisation** = one strata management business (tenant). Multiple strata schemes roll up to one organisation.

**Key Principle:** All data tables have `organisation_id` foreign key. Supabase RLS policies enforce tenant isolation at database level.

### 4.2 Database Schema

```sql
-- TENANCY (Multi-Tenant Isolation)
CREATE TABLE organisations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  abn TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE organisation_users (
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('manager', 'admin', 'auditor')),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  PRIMARY KEY (organisation_id, user_id)
);

-- COMMITTEE MEMBERS (Owners with Extra Permissions)
-- Committee members are owners with additional permissions, not a separate role.
-- RLS policies check committee membership for features that require it (e.g., meeting admin, financial report access).
CREATE TABLE committee_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  position TEXT CHECK (position IN ('chair', 'treasurer', 'secretary', 'member')),
  elected_at DATE NOT NULL,
  term_end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(scheme_id, owner_id, elected_at)
);

-- Schemes belong to organisations
CREATE TABLE schemes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  plan_number TEXT, -- Strata plan number (e.g., "SP12345")
  abn TEXT, -- Scheme's ABN (if strata company)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_schemes_organisation ON schemes(organisation_id);

-- Lots belong to schemes
CREATE TABLE lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES schemes(id) ON DELETE CASCADE,
  lot_number TEXT NOT NULL,
  unit_address TEXT,
  entitlement NUMERIC(5,4), -- e.g., 0.0125 = 1.25% (for levy calculations)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lots_scheme ON lots(scheme_id);

-- Lot ownerships (many-to-many: one owner can own multiple lots, one lot can have multiple owners)
CREATE TABLE lot_ownerships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_id UUID NOT NULL REFERENCES lots(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ownership_share NUMERIC(3,2) DEFAULT 1.00, -- e.g., 0.50 = 50% (for co-owned lots)
  is_primary BOOLEAN DEFAULT TRUE, -- Primary contact for this lot
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lot_ownerships_lot ON lot_ownerships(lot_id);
CREATE INDEX idx_lot_ownerships_owner ON lot_ownerships(owner_id);
```

### 4.3 Row-Level Security (RLS) Policies

**Critical:** Every table must have RLS enabled + policies that filter by `organisation_id`.

**Reusable helper function for tenant isolation:**

```sql
CREATE OR REPLACE FUNCTION auth.user_organisation_id() RETURNS UUID AS $$
  SELECT organisation_id FROM organisation_users WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

**Example: Schemes table**

```sql
ALTER TABLE schemes ENABLE ROW LEVEL SECURITY;

-- All RLS policies use this helper:
CREATE POLICY "tenant_isolation" ON schemes
  FOR ALL USING (organisation_id = auth.user_organisation_id());
```

**Example: Lots table (via scheme_id)**

```sql
ALTER TABLE lots ENABLE ROW LEVEL SECURITY;

CREATE POLICY lots_tenant_isolation ON lots
  FOR ALL
  USING (
    scheme_id IN (
      SELECT id FROM schemes WHERE organisation_id = auth.user_organisation_id()
    )
  );
```

**Example: Owner-scoped access to lots**

```sql
-- Owners can only view lots they own
CREATE POLICY lots_owner_access ON lots
  FOR SELECT
  USING (
    id IN (
      SELECT lot_id FROM lot_ownerships WHERE owner_id = auth.uid()
    )
  );
```

### 4.4 Testing Tenant Isolation

**Security Audit Checklist:**

1. ✅ User from Org A cannot read/write data from Org B (test via Supabase SQL editor with `SET role = 'authenticated'; SET request.jwt.claim.sub = '<user_id>';`)
2. ✅ RLS policies deny access when `organisation_id` doesn't match
3. ✅ API endpoints validate `organisation_id` matches authenticated user (defense in depth)
4. ✅ Supabase Realtime subscriptions filtered by `organisation_id` (prevent cross-tenant real-time leaks)

**Tools:**

- Supabase RLS test suite (write tests for each policy)
- Automated tests via Playwright (login as User A, attempt to access User B's scheme ID via URL injection)

---

## 5. Invitation Flow

### 5.1 Manager Invites Admin/Auditor

**Scenario:** Sarah (Manager) hires a part-time admin assistant and needs to grant access.

**Flow:**

1. Sarah navigates to **Settings → Team Members** → clicks "Invite User"
2. Form: Enter email, select role (Admin or Auditor), optional message
3. Backend creates `profiles` record with `activated_at = NULL` (pending)
4. Email sent: "You've been invited to join [Organisation Name] on LevyLite"
5. Email contains magic link: `https://levylite.com.au/auth/invite?token=...`
6. Recipient clicks link → **If new user:** "Set your name and verify your email" form → **If existing user (invited to second org):** Error: "You already have a LevyLite account. Multi-organisation support coming soon."
7. User completes onboarding → `activated_at` set → redirect to dashboard

**Database Changes:**

```sql
-- Invitation tokens (separate table for security)
CREATE TABLE invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES organisations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role user_role NOT NULL,
  invited_by UUID NOT NULL REFERENCES profiles(id),
  token TEXT NOT NULL UNIQUE, -- Cryptographically random, hashed in DB
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_invitations_token ON invitations(token);
```

**Security:**

- Token is single-use (marked as `accepted_at` after use)
- Expires after 7 days (Manager can resend)
- Rate limit: Manager can send max 10 invitations per day (prevent abuse)

### 5.2 Manager Invites Lot Owner (Portal Access)

**Scenario:** Sarah manages a scheme with 20 lots. She wants to give all owners portal access.

**Flow:**

1. Sarah navigates to **Scheme → Lot Register** → selects multiple lots → clicks "Invite Owners to Portal"
2. System checks: do owners have email addresses on file? (If missing, show warning: "3 owners missing email. Add emails first.")
3. Bulk invitation sent to all owners
4. Email: "You've been invited to access your strata scheme portal. View levy balances, download documents, submit maintenance requests."
5. Owner clicks magic link → minimal onboarding: "Verify your email" → redirect to owner dashboard

**Differences from Staff Invitations:**

- **No password option** (magic link only, reduce friction)
- **Auto-link to lots** (invitation email contains `lot_id`, system creates `lot_ownerships` record)
- **No manual account creation** (owners can't sign up, must be invited)

**Database Changes:**

```sql
-- Extend invitations table to support lot ownership linking
ALTER TABLE invitations ADD COLUMN lot_ids UUID[] DEFAULT '{}';

-- When owner accepts invitation:
-- 1. Create profiles record (role = 'owner')
-- 2. Create lot_ownerships records (one per lot_id in invitation)
```

**Bulk Invitation UX:**

- Show progress bar: "Sending invitations... 5 of 20 sent"
- Allow retry for failed sends (email bounces)
- Track invitation status: Invited, Accepted, Bounced

---

## 6. Session Management

### 6.1 Token Handling

**Supabase Auth uses JWT-based sessions:**

- **Access token:** Short-lived (1 hour), contains user ID + metadata, signed by Supabase
- **Refresh token:** Long-lived (30 days default), stored in httpOnly cookie, used to obtain new access tokens
- **Session cookie:** httpOnly, secure, sameSite=lax (CSRF protection)

**Client-Side Token Refresh:**

```typescript
// Next.js middleware: Refresh token if expired
import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  
  // This automatically refreshes expired tokens
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session && req.nextUrl.pathname.startsWith('/dashboard')) {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  
  return res
}
```

### 6.2 Session Expiry

**Defaults:**

- Access token: 1 hour
- Refresh token: 30 days (configurable in Supabase Dashboard → Authentication → Settings)
- Idle timeout: None (rely on refresh token expiry)

**Custom Rules:**

- **Manager/Admin:** 30-day refresh token (infrequent re-login acceptable)
- **Owner:** 90-day refresh token (may only log in quarterly for levy checks)
- **Auditor:** 7-day refresh token (temporary access, higher security)

**Implementation:**

Set custom expiry via Supabase Auth metadata:

```typescript
const { data, error } = await supabase.auth.signInWithOtp({
  email: 'auditor@example.com',
  options: {
    data: {
      role: 'auditor',
      session_ttl: 7 * 24 * 60 * 60, // 7 days in seconds
    }
  }
})
```

### 6.3 Concurrent Sessions

**Policy:** Allow up to 3 concurrent sessions per user (desktop + mobile + tablet).

**Implementation:**

- Supabase doesn't natively limit concurrent sessions
- Custom solution: Store active sessions in `user_sessions` table, enforce limit at login

```sql
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_token TEXT NOT NULL UNIQUE, -- Supabase session ID
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
```

**Login Flow:**

1. User logs in successfully
2. Check: `SELECT COUNT(*) FROM user_sessions WHERE user_id = ... AND expires_at > NOW()`
3. If count ≥ 3: Delete oldest session (by `last_active_at`), create new session
4. Insert new session record

**Security:** Prevents session hijacking from spreading indefinitely (attacker can only have 3 sessions before legitimate user notices).

### 6.4 Logout

**Client-Side:**

```typescript
const { error } = await supabase.auth.signOut()
// Redirect to /login
```

**Server-Side (revoke all sessions):**

```typescript
// Manager can revoke a user's sessions (e.g., fired employee)
await supabase.auth.admin.deleteUser(userId)
// OR keep user but invalidate sessions:
DELETE FROM user_sessions WHERE user_id = ...;
```

---

## 7. Supabase Auth Integration

### 7.1 Supabase Auth Features Used

- ✅ **Email OTP (Magic Link)** — Primary auth method
- ✅ **OAuth (Google)** — Optional social login
- ✅ **Email/Password** — Fallback for managers
- ✅ **Row-Level Security (RLS)** — Database-level tenant isolation
- ✅ **Auth Hooks** — Custom logic on signup/login (assign default organisation, log events)
- ❌ Phone auth (not needed for MVP)
- ❌ Multi-factor auth (roadmap: Phase 2)

### 7.2 Auth Hooks (Postgres Functions)

**Supabase Auth Hooks** allow running custom logic on auth events (signup, login, token refresh).

**Example: Assign User to Organisation on Signup**

```sql
-- Trigger function: When auth.users row is created, create profiles row
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if invitation exists
  INSERT INTO public.profiles (id, organisation_id, role, email, full_name)
  SELECT 
    NEW.id,
    i.organisation_id,
    i.role,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  FROM public.invitations i
  WHERE i.email = NEW.email 
    AND i.accepted_at IS NULL 
    AND i.expires_at > NOW()
  LIMIT 1;
  
  -- Mark invitation as accepted
  UPDATE public.invitations
  SET accepted_at = NOW()
  WHERE email = NEW.email AND accepted_at IS NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger: Run after insert on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

**Example: Log Auth Events**

```sql
CREATE TABLE auth_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  event_type TEXT NOT NULL, -- 'login', 'logout', 'password_reset', 'magic_link_sent'
  ip_address INET,
  user_agent TEXT,
  success BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_auth_events_user ON auth_events(user_id, created_at DESC);
```

### 7.3 RLS Policies Summary

**All tables must have RLS enabled + policies.**

**Pattern:**

```sql
-- For tenant-isolated tables (schemes, lots, transactions):
CREATE POLICY <table>_tenant_isolation ON <table>
  FOR ALL
  USING (organisation_id = auth.user_organisation_id());

-- For owner-scoped tables (lot_ownerships):
CREATE POLICY <table>_owner_access ON <table>
  FOR SELECT
  USING (owner_id = auth.uid());

-- For role-based access (e.g., auditors read-only):
CREATE POLICY <table>_auditor_read ON <table>
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = auth.uid() 
        AND role IN ('auditor', 'admin', 'manager')
        AND organisation_id = <table>.organisation_id
    )
  );
```

---

## 8. API Routes & Server Actions

LevyLite uses **Next.js 15 App Router** with Server Actions (preferred) and API routes (for webhooks, external integrations).

### 8.1 Server Actions (Next.js)

**Advantages:**

- Type-safe (TypeScript)
- No need to expose REST endpoints
- Built-in CSRF protection
- Automatic error handling

**Example: Invite User (Server Action)**

```typescript
// app/actions/inviteUser.ts
'use server'

import { createServerClient } from '@/lib/supabase-server'
import { sendInvitationEmail } from '@/lib/email'
import { z } from 'zod'

const inviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'auditor', 'owner']),
  lotIds: z.array(z.string().uuid()).optional(),
})

export async function inviteUser(formData: FormData) {
  const supabase = createServerClient()
  
  // Validate auth
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  
  // Get inviter's profile
  const { data: inviter } = await supabase
    .from('profiles')
    .select('organisation_id, role')
    .eq('id', user.id)
    .single()
  
  if (inviter?.role !== 'manager') {
    throw new Error('Only managers can invite users')
  }
  
  // Validate input
  const input = inviteSchema.parse({
    email: formData.get('email'),
    role: formData.get('role'),
    lotIds: formData.getAll('lotIds'),
  })
  
  // Create invitation
  const token = crypto.randomUUID() // In production: use crypto.getRandomValues
  const { data: invitation, error } = await supabase
    .from('invitations')
    .insert({
      organisation_id: inviter.organisation_id,
      email: input.email,
      role: input.role,
      invited_by: user.id,
      token,
      lot_ids: input.lotIds || [],
    })
    .select()
    .single()
  
  if (error) throw error
  
  // Send email
  await sendInvitationEmail({
    to: input.email,
    inviterName: user.user_metadata.full_name,
    organisationName: '...', // Fetch from organisations table
    inviteUrl: `${process.env.NEXT_PUBLIC_APP_URL}/auth/invite?token=${token}`,
  })
  
  return { success: true, invitationId: invitation.id }
}
```

**Usage in Client Component:**

```typescript
'use client'

import { inviteUser } from '@/app/actions/inviteUser'
import { useFormState } from 'react-dom'

export function InviteUserForm() {
  const [state, formAction] = useFormState(inviteUser, null)
  
  return (
    <form action={formAction}>
      <input name="email" type="email" required />
      <select name="role">
        <option value="admin">Admin</option>
        <option value="auditor">Auditor</option>
      </select>
      <button type="submit">Send Invitation</button>
      {state?.success && <p>Invitation sent!</p>}
    </form>
  )
}
```

### 8.2 API Routes (Webhooks, External Services)

**Use Case:** Stripe webhook for subscription events, Resend webhook for email delivery status.

**Example: Auth Callback Route**

```typescript
// app/auth/callback/route.ts
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  
  if (code) {
    const cookieStore = cookies()
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore })
    
    // Exchange code for session
    await supabase.auth.exchangeCodeForSession(code)
  }
  
  // Redirect to dashboard
  return NextResponse.redirect(new URL('/dashboard', requestUrl.origin))
}
```

### 8.3 Required Endpoints

| Endpoint | Method | Purpose | Auth |
|----------|--------|---------|------|
| `/auth/callback` | GET | OAuth/magic link redirect | Public |
| `/auth/invite` | GET | Accept invitation | Public (token-protected) |
| `/api/webhooks/stripe` | POST | Handle subscription events | Stripe signature |
| `/api/webhooks/resend` | POST | Email delivery status | Resend signature |

---

## 9. Security Considerations

### 9.1 Rate Limiting

**Critical endpoints:**

- **Magic link requests:** 3 per hour per email (prevent spam)
- **Login attempts:** 10 per hour per IP (prevent brute force)
- **Password reset:** 3 per hour per email
- **Invitation sends:** 10 per day per manager (prevent abuse)

**Implementation:** Use Vercel Edge Config + KV for rate limit tracking.

```typescript
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(3, '1 h'),
})

export async function rateLimitMagicLink(email: string) {
  const { success } = await ratelimit.limit(`magic_link:${email}`)
  if (!success) throw new Error('Too many requests. Try again in 1 hour.')
}
```

### 9.2 Brute Force Protection

**Supabase built-in:** Automatic rate limiting on auth endpoints (configurable in Dashboard).

**Additional:** CAPTCHA on login form after 3 failed attempts (use hCaptcha or Cloudflare Turnstile).

### 9.3 Audit Logging

**What to log:**

- User login/logout (with IP, user agent, timestamp)
- Trust account transactions (who created/edited/deleted)
- Scheme/lot creation/deletion
- Document uploads/deletions
- Role changes (Manager promotes Admin)
- Failed login attempts

**Database Schema:**

```sql
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  organisation_id UUID REFERENCES organisations(id),
  action TEXT NOT NULL, -- 'login', 'transaction.create', 'scheme.delete'
  resource_type TEXT, -- 'scheme', 'lot', 'transaction'
  resource_id UUID,
  changes JSONB, -- Before/after values for edits
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_log_organisation ON audit_log(organisation_id, created_at DESC);
```

**Retention:** Keep audit logs for 7 years (compliance with strata record-keeping requirements).

### 9.4 MFA (Phase 2)

**Not in MVP** but design for it:

- Add `mfa_enabled BOOLEAN` column to `profiles`
- Supabase supports TOTP-based MFA (Google Authenticator, Authy)
- Require MFA for:
  - Managers with >500 lots under management
  - Any user accessing trust accounting from new device/IP

**Implementation (future):**

```typescript
const { data, error } = await supabase.auth.mfa.enroll({
  factorType: 'totp',
})
// Show QR code to user, verify challenge code
```

### 9.5 Password Security

- **Hash:** bcrypt (Supabase default)
- **Salt rounds:** 10 (adequate for 2026)
- **Password reset:** Single-use tokens, expire after 1 hour
- **Leaked password check:** Integrate haveibeenpwned API on signup/password change

---

## 10. Owner Portal Auth (Separate Flow)

### 10.1 Design Differences

**Key Insight:** Lot owners are not power users. They log in quarterly to check levy balances, download AGM minutes. Auth must be **invisible**.

**Decisions:**

1. **Magic link only** (no password option, no Google OAuth for owners)
2. **No account creation flow** (must be invited by Manager)
3. **Auto-logout after 90 days** (prevent stale sessions from owners who sold property)
4. **Simplified dashboard** (no settings, no profile edit—Manager updates owner details)

### 10.2 Owner Login Flow

1. Owner receives email: "You have a new levy notice. View in your portal: [Click here]"
2. Email link contains magic link token (no separate login step)
3. Click → auto-login → redirect to levy notice page
4. Owner can browse portal while session is active

**UX Optimisation:**

- **Direct links:** Email notifications contain magic link to specific page (levy notice, AGM pack)
- **No "check your email" step:** Owner clicks email link, immediately sees content
- **Persistent session:** 90-day refresh token (owner doesn't re-login until next levy cycle)

### 10.3 Database Scoping

**Critical:** Owners must only see their lots + scheme-wide documents (not other owners' data).

**RLS Policy:**

```sql
-- Owners can only view their lots
CREATE POLICY lots_owner_view ON lots
  FOR SELECT
  USING (
    id IN (
      SELECT lot_id FROM lot_ownerships WHERE owner_id = auth.uid()
    )
  );

-- Owners can view scheme-wide documents (AGM packs, by-laws)
CREATE POLICY documents_owner_view ON documents
  FOR SELECT
  USING (
    scheme_id IN (
      SELECT scheme_id FROM lots WHERE id IN (
        SELECT lot_id FROM lot_ownerships WHERE owner_id = auth.uid()
      )
    )
    AND is_public = TRUE -- Only published documents (not draft AGM agendas)
  );

-- Owners cannot view other owners' contact details
CREATE POLICY profiles_owner_privacy ON profiles
  FOR SELECT
  USING (
    id = auth.uid() -- Can only see own profile
  );
```

---

## 11. Edge Cases & Account Management

### 11.1 Account Recovery

**Scenario:** Owner lost access to email (email address changed, inbox full).

**Solution:**

1. Owner contacts Manager via phone
2. Manager navigates to **Lot Register → [Owner's Lot] → Edit Owner Details**
3. Manager updates email address (requires confirmation: "Send verification email to new address?")
4. Owner receives verification email at new address → clicks link → email updated → can request magic link

**Security:** Email changes require Manager approval (prevent account takeover via social engineering).

### 11.2 Email Address Change

**Two scenarios:**

**A. Owner-initiated (self-service):**

1. Owner logs in → **Settings → Change Email**
2. Enter new email → "Verification email sent to new address"
3. Click verification link → **"Pending Manager approval"** (old email still works)
4. Manager receives notification: "Owner requested email change: old@example.com → new@example.com"
5. Manager approves/rejects → if approved, email updated immediately

**B. Manager-initiated (support ticket):**

1. Manager updates email directly (no approval flow)
2. System sends notification to both old + new email addresses (security alert)

**Database:**

```sql
ALTER TABLE profiles ADD COLUMN pending_email TEXT;
ALTER TABLE profiles ADD COLUMN email_change_requested_at TIMESTAMPTZ;

-- When owner requests change, set pending_email + send verification
-- When manager approves, copy pending_email → email, clear pending_email
```

### 11.3 Account Deactivation

**Scenario:** Admin leaves company, lot owner sells property.

**Solution:**

1. Manager navigates to **Settings → Team Members → [User] → Deactivate**
2. System sets `deactivated_at = NOW()` (soft delete, preserves audit trail)
3. User's sessions are revoked (delete from `user_sessions`)
4. User cannot log in (RLS policy: `deactivated_at IS NULL`)

**Re-activation:**

- Manager can reactivate deactivated accounts (clear `deactivated_at`)
- Useful for seasonal contractors (AGM season consultants)

### 11.4 Manager Leaves / Transfers Ownership

**Scenario:** Sarah sells her strata management business to another operator.

**Solution:**

1. Sarah invites new Manager via **Settings → Team Members → Invite User (Manager role)**
2. New Manager accepts invitation → now two Managers in organisation
3. Sarah demotes herself to Admin or deactivates account
4. Alternatively: Sarah contacts LevyLite support to transfer ownership (change organisation owner, update billing)

**Database:**

```sql
-- Organisations can have multiple managers (no "primary owner" concept in MVP)
-- Billing owner: Separate field organisations.billing_contact_id
```

### 11.5 Lot Ownership Transfer

**Scenario:** Lot 5 is sold. Old owner deactivated, new owner added.

**Solution:**

1. Manager navigates to **Scheme → Lot Register → Lot 5 → Edit Owners**
2. Remove old owner from `lot_ownerships` (soft delete: add `ended_at TIMESTAMPTZ`)
3. Add new owner: enter email → send invitation → new owner accepts → linked to Lot 5

**Historical Data:**

- Old owner retains access to historical levy notices (up to `ended_at` date)
- Implemented via RLS policy: `lot_ownerships.ended_at IS NULL OR lot_ownerships.ended_at > document.created_at`

---

## 12. Dependencies on Other Features

| Feature | Dependency | Reason |
|---------|------------|--------|
| **Levy Management** | Requires owner email addresses | Send levy notices via email |
| **Document Storage** | Requires RLS policies | Owners can only view public docs |
| **Audit Logging** | Requires auth events table | Trust accounting compliance |
| **Billing** | Requires organisation subscription status | Gate features by tier (e.g., >50 lots) |
| **Email Service** | Resend integration | Magic links, invitations, notifications |

---

## 12. User Management Workflows

### Invite Staff Member
1. Manager navigates to Settings → Team Members
2. Clicks "Invite Team Member"
3. Enters email address, selects role (Admin or Auditor)
4. System creates invitation record (7-day expiry token)
5. Email sent via Resend with magic link
6. Recipient clicks link → creates auth.users record → links to organisation

### Change User Role
1. Manager navigates to Settings → Team Members
2. Clicks user → Edit Role
3. Selects new role from dropdown
4. System updates `organisation_users.role`
5. RLS policies automatically adjust access

### Deactivate User
1. Manager navigates to Settings → Team Members
2. Clicks user → Deactivate
3. System sets `organisation_users.deactivated_at = NOW()`
4. User's sessions are invalidated
5. User can no longer log in (RLS policies exclude deactivated users)
6. Historical data (audit trail entries) preserved

---

## 13. Open Questions & Decisions Needed

### Q1: Multi-Organisation Support for Users?

**Scenario:** A manager works for two separate strata businesses (moonlighting).

**Options:**

- **A. Not supported (MVP):** One user = one organisation. If they need access to two orgs, create two accounts with different emails.
- **B. Organisation switcher (Phase 2):** One user, multiple `profiles` rows (one per org), dropdown to switch context.

**Recommendation:** Start with A (simpler), add B if customers request.

### Q2: SSO / SAML for Enterprise Customers?

**Scenario:** Larger agencies (200+ lots) require SSO (Okta, Azure AD) for compliance.

**Recommendation:** Not in MVP. Target market (sole practitioners) doesn't need SSO. Add in Phase 3 for "Growth" tier customers.

### Q3: Password Strength Enforcement?

**Current:** 12 chars, uppercase, lowercase, number, special character.

**Question:** Too strict for small operators (support burden) or necessary for trust accounting?

**Recommendation:** Enforce for Managers/Admins (they handle money), relax for Owners (magic link only anyway).

### Q4: Audit Log Retention?

**Options:**

- **7 years** (matches strata document retention requirements)
- **Indefinite** (storage is cheap, better for compliance)

**Recommendation:** 7 years minimum, offer indefinite as paid add-on ($50/year/org).

---

## 14. Testing & Validation

### 14.1 Functional Tests

- ✅ Magic link login (happy path + expired link + already used)
- ✅ Google OAuth login (new user + existing user)
- ✅ Password reset flow
- ✅ Invitation flow (Manager invites Admin, Auditor, Owner)
- ✅ RLS policies (user cannot access other org's data)
- ✅ Session expiry + refresh
- ✅ Rate limiting (magic link spam prevention)
- ✅ Role-based access (Owner cannot delete schemes)

### 14.2 Security Tests

- ✅ SQL injection attempts (Supabase RLS + parameterised queries)
- ✅ Cross-tenant data leakage (User A cannot see User B's schemes via URL manipulation)
- ✅ CSRF protection (Next.js built-in)
- ✅ Session hijacking (httpOnly cookies, secure flag)
- ✅ Brute force login attempts (rate limiting kicks in)

### 14.3 Performance Tests

- ✅ 10,000 concurrent owner logins (simulate quarterly levy notice emails)
- ✅ RLS policy performance (ensure `organisation_id` index is used)
- ✅ Session refresh latency (<100ms)

---

## 15. Implementation Checklist

### Phase 1: Core Auth (Week 1-2)

- [ ] Set up Supabase project + enable Email Auth
- [ ] Configure magic link email templates (Resend integration)
- [ ] Build login page (`/login`) with magic link form
- [ ] Implement auth callback route (`/auth/callback`)
- [ ] Create `organisations` and `profiles` tables + RLS policies
- [ ] Test magic link flow (send → receive → login → dashboard)

### Phase 2: Roles & Permissions (Week 3)

- [ ] Define `user_role` enum + add `role` column to `profiles`
- [ ] Implement RLS policies for Manager/Admin/Auditor/Owner
- [ ] Build invitation flow (Server Action + email)
- [ ] Create invitation acceptance page (`/auth/invite`)
- [ ] Test role-based access (Owner cannot delete schemes)

### Phase 3: Multi-Tenancy (Week 4)

- [ ] Add `organisation_id` to all tables
- [ ] Implement tenant isolation RLS policies
- [ ] Test cross-tenant data leakage (automated Playwright tests)
- [ ] Audit log table + trigger functions
- [ ] Dashboard UX (show current organisation, user role)

### Phase 4: Polish & Security (Week 5-6)

- [ ] Rate limiting (magic link, login attempts)
- [ ] CAPTCHA on login after failed attempts
- [ ] Audit logging (login events, trust account changes)
- [ ] Session management (concurrent session limits)
- [ ] Password auth (optional, hidden by default)
- [ ] Google OAuth (optional)
- [ ] Owner portal auth flow (simplified)

### Phase 5: Testing & Launch (Week 7-8)

- [ ] Write functional tests (Jest + Playwright)
- [ ] Security audit (manual testing + automated scans)
- [ ] Performance testing (load test with 10k users)
- [ ] Documentation (user guide, API docs)
- [ ] Beta testing with 3-5 design partners
- [ ] Production launch

---

## 16. Summary

LevyLite's authentication system prioritises **simplicity for non-technical users** (magic links, no passwords for owners) while maintaining **enterprise-grade security** (RLS policies, audit logging, multi-factor auth roadmap). By leveraging Supabase Auth, we avoid reinventing the wheel and ship a compliant, scalable system in 6-8 weeks.

**Key Differentiators:**

- **Magic link primary** (not fallback) — reduces support burden
- **Strict tenant isolation** (RLS at database level) — prevents data leaks even if app layer is compromised
- **Role-based access** (Manager/Admin/Auditor/Owner) — fits strata industry's hierarchical structure
- **Audit-first design** — every trust account action is logged (WA compliance)

**Next Steps:**

1. Review with Donna Henneberry (validate Manager invitation flow matches industry practice)
2. Prototype magic link flow (test email deliverability via Resend)
3. Security audit RLS policies (hire external pen tester or use Supabase security review)
4. Document API endpoints for future integrations (Xero, Stripe)

---

**Document End**

_For questions or clarifications, contact Chris Johnstone at chris@kokorosoftware.com_
