# Authentication Flows

Authentication flows for LevyLite, covering staff login (manager, admin, auditor), owner portal magic link login, user invitation/onboarding, and owner portal activation.

LevyLite uses Supabase Auth with three auth methods: magic link (primary), Google OAuth (optional for staff), and email/password (fallback for managers). Owners use magic link only.

---

## 1. Manager/Admin Login Flow (Email + Password)

Staff members (manager, admin) can log in via email/password or magic link. Password auth is available but hidden below the fold; magic link is the primary method.

```mermaid
sequenceDiagram
    participant U as Manager/Admin
    participant B as Browser
    participant N as Next.js App
    participant S as Supabase Auth
    participant DB as PostgreSQL

    U->>B: Navigate to /login
    B->>N: GET /login
    N-->>B: Render login form

    alt Password Login
        U->>B: Enter email + password
        B->>S: signInWithPassword(email, password)
        S->>S: Validate credentials (bcrypt)
        alt Valid credentials
            S->>S: Generate JWT (access + refresh tokens)
            S-->>B: Session (access_token, refresh_token)
            B->>B: Store session cookie (httpOnly, secure, sameSite=lax)
            B->>N: GET /dashboard
            N->>DB: Query organisation_users WHERE user_id = auth.uid()
            DB-->>N: {organisation_id, role}
            N-->>B: Render dashboard
        else Invalid credentials
            S-->>B: Error: invalid credentials
            B-->>U: "Invalid email or password"
            Note over B: After 3 failures, show CAPTCHA
        end
    else Magic Link Login
        U->>B: Enter email, click "Send magic link"
        B->>S: signInWithOtp(email)
        S->>S: Rate limit check (3/hour/email)
        S->>U: Send magic link email
        S-->>B: "Check your email"
        B-->>U: "Check your email for a login link"
        U->>B: Click magic link from email
        B->>N: GET /auth/callback?code=...
        N->>S: exchangeCodeForSession(code)
        S-->>N: Session (access_token, refresh_token)
        N-->>B: Set session cookie, redirect to /dashboard
    end
```

---

## 2. Owner Portal Magic Link Login Flow

Owners use magic link only -- no password option, no Google OAuth. This reduces friction for users who log in infrequently (quarterly levy checks, annual AGM documents).

```mermaid
sequenceDiagram
    participant O as Owner
    participant E as Email Inbox
    participant B as Browser
    participant N as Next.js App
    participant S as Supabase Auth
    participant DB as PostgreSQL

    alt Direct login
        O->>B: Navigate to /owner/login
        B->>N: GET /owner/login
        N-->>B: Render email-only login form
        O->>B: Enter email
        B->>S: signInWithOtp(email, shouldCreateUser: false)
        S->>S: Verify email exists in auth.users
        S->>E: Send magic link email
        S-->>B: "Check your email"
        B-->>O: "Check your email for a login link"
    else Notification-triggered login
        Note over E: Levy notice email with embedded magic link
        O->>E: Open notification email
    end

    O->>E: Click magic link
    E->>B: Open /auth/callback?token=...&type=magiclink
    B->>N: GET /auth/callback
    N->>S: exchangeCodeForSession(code)
    S->>S: Validate token (single-use, <1 hour)
    S-->>N: Session (access_token, refresh_token)

    N->>DB: Query owners WHERE auth_user_id = auth.uid()
    DB-->>N: owner record
    N->>DB: Query lot_ownerships WHERE owner_id = owner.id AND ownership_end_date IS NULL
    DB-->>N: [lot_ids]
    N-->>B: Set session cookie (90-day refresh), redirect to /owner/dashboard
    B-->>O: Owner portal dashboard (scoped to their lots)
```

---

## 3. User Invitation and Onboarding Flow (Staff)

Managers invite admin and auditor users via the Settings > Team Members page. Invitations use a 7-day expiry token sent via email.

```mermaid
sequenceDiagram
    participant M as Manager
    participant N as Next.js App
    participant DB as PostgreSQL
    participant ES as Email Service (Resend)
    participant R as Recipient (Admin/Auditor)
    participant S as Supabase Auth

    M->>N: Navigate to Settings > Team Members > Invite
    M->>N: Submit: email, role (admin/auditor)
    N->>N: Validate manager role (Server Action)
    N->>DB: INSERT INTO invitations (email, role, organisation_id, token, expires_at)
    DB-->>N: invitation record
    N->>ES: Send invitation email with link /auth/invite?token=...
    ES->>R: "You've been invited to join [Organisation] on LevyLite"
    N-->>M: "Invitation sent"

    Note over R: Within 7 days...

    R->>N: Click invitation link
    N->>DB: SELECT * FROM invitations WHERE token = ... AND expires_at > NOW() AND accepted_at IS NULL
    DB-->>N: invitation record (email, role, organisation_id)

    alt New user (no auth.users record)
        N-->>R: Render onboarding form (name, verify email)
        R->>N: Submit name
        N->>S: signUp(email, password) or signInWithOtp(email)
        S->>S: Create auth.users record
        S-->>N: New user session

        Note over DB: Trigger: handle_new_user()
        DB->>DB: INSERT INTO organisation_users (organisation_id, user_id, role)
        DB->>DB: UPDATE invitations SET accepted_at = NOW()
    else Existing user (already has account in another org)
        N-->>R: Error: "You already have a LevyLite account. Multi-org support coming soon."
    end

    N-->>R: Redirect to /dashboard
```

---

## 4. Owner Portal Invitation and Activation Flow

Managers invite owners from the Scheme > Lot Register. Owner invitations link directly to lot records and use magic link only.

```mermaid
sequenceDiagram
    participant M as Manager
    participant N as Next.js App
    participant DB as PostgreSQL
    participant ES as Email Service (Resend)
    participant O as Owner
    participant S as Supabase Auth

    M->>N: Navigate to Scheme > Lot Register
    M->>N: Select lots > "Invite Owners to Portal"
    N->>DB: Validate owners have email addresses
    DB-->>N: owners with emails (warn if missing)

    loop For each owner with email
        N->>DB: INSERT INTO invitations (email, role='owner', organisation_id, scheme_id, owner_id, token, expires_at)
        DB-->>N: invitation record
        N->>ES: Send portal invitation email
    end

    ES->>O: "You've been invited to access your strata scheme portal"
    N-->>M: "Invitations sent (X of Y)"

    Note over O: Owner clicks invitation link...

    O->>N: Click invitation link /auth/invite?token=...
    N->>DB: SELECT * FROM invitations WHERE token = ... AND accepted_at IS NULL
    DB-->>N: invitation record (owner_id, scheme_id)

    N->>S: signInWithOtp(email, shouldCreateUser: true)
    S->>S: Create auth.users record (if new)
    S->>O: Send verification magic link
    O->>N: Click verification link
    N->>S: exchangeCodeForSession(code)
    S-->>N: Session

    N->>DB: UPDATE owners SET auth_user_id = auth.uid(), portal_activated_at = NOW() WHERE id = owner_id
    N->>DB: UPDATE invitations SET accepted_at = NOW()
    DB-->>N: Confirmed

    N-->>O: Redirect to /owner/dashboard (scoped to their lots)
```

---

## 5. Auth Callback and Session Lifecycle

Overview of token handling, session refresh, and expiry across all user types.

```mermaid
flowchart TD
    A[Auth Event: login / magic link / OAuth] --> B[Supabase Auth issues tokens]
    B --> C[Access Token: 1 hour TTL]
    B --> D[Refresh Token: role-based TTL]

    D --> D1{User role?}
    D1 -->|manager / admin| D2[30-day refresh token]
    D1 -->|owner| D3[90-day refresh token]
    D1 -->|auditor| D4[7-day refresh token]

    C --> E{Access token expired?}
    E -->|No| F[Request proceeds with JWT]
    E -->|Yes| G[Next.js middleware intercepts]
    G --> H[Refresh using refresh_token]
    H --> I{Refresh token valid?}
    I -->|Yes| J[New access token issued]
    J --> F
    I -->|No| K[Redirect to /login]

    F --> L{Session limit check}
    L --> M{Active sessions >= 3?}
    M -->|No| N[Allow session]
    M -->|Yes| O[Evict oldest session]
    O --> N

    N --> P[Request processed with RLS using auth.uid]
```

---

## 6. Auth Method Decision Tree

Which authentication method is used based on user type and context.

```mermaid
flowchart TD
    A[User arrives at login] --> B{User type?}

    B -->|Staff: manager / admin / auditor| C{Preferred method?}
    C -->|Magic link: default| D[signInWithOtp]
    C -->|Password: below fold| E[signInWithPassword]
    C -->|Google OAuth: optional| F[signInWithOAuth: google]

    D --> G[Email sent > click link > session]
    E --> H[Validate password > session]
    F --> I[Google consent > callback > session]

    B -->|Owner| J[Magic link only]
    J --> K{How did they arrive?}
    K -->|Direct: /owner/login| L[Enter email > magic link sent]
    K -->|Notification email| M[Click embedded magic link]
    L --> N[Click link > session: 90-day refresh]
    M --> N

    G --> O[Session: role-based refresh TTL]
    H --> O
    I --> O
    N --> O

    O --> P[Redirect to role-appropriate dashboard]
```
