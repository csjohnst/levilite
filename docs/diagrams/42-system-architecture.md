# System Architecture

Technical architecture diagrams for LevyLite covering the full stack: Next.js 15 frontend on Vercel, Supabase backend (PostgreSQL + Auth + Storage), and external service integrations.

## 1. High-Level System Architecture

Overview of the complete LevyLite tech stack and how components connect.

```mermaid
flowchart TB
    subgraph Clients["Client Devices"]
        direction LR
        C1["Manager Browser\n(Desktop/Mobile)"]
        C2["Owner Browser\n(Mobile-first)"]
    end

    subgraph Vercel["Vercel (Hosting)"]
        direction TB
        N1["Next.js 15 App Router"]
        N2["React Server Components"]
        N3["Server Actions"]
        N4["API Routes"]
        N5["Edge Middleware\n(Auth check)"]
    end

    subgraph Supabase["Supabase Cloud"]
        direction TB
        S1["Supabase Auth\n(Magic Links, Sessions)"]
        S2["PostgreSQL\n(Row-Level Security)"]
        S3["Supabase Storage\n(S3-compatible)"]
        S4["Supabase Realtime\n(Future: live updates)"]
    end

    subgraph External["External Services"]
        direction LR
        E1["Resend\n(Transactional Email)"]
        E2["Stripe\n(Billing & Payments)"]
        E3["Sentry\n(Error Tracking)"]
        E4["Plausible\n(Analytics)"]
    end

    subgraph StripeDetail["Stripe Services"]
        direction LR
        SD1["Stripe Billing\n(Graduated per-lot pricing)"]
        SD2["Stripe Checkout\n(Payment capture)"]
        SD3["Stripe Customer Portal\n(Self-service billing)"]
        SD4["Stripe Webhooks\n(subscription.updated, invoice.paid,\npayment_intent.failed)"]
    end

    C1 -->|HTTPS| Vercel
    C2 -->|HTTPS| Vercel
    N5 -->|Validate session| S1
    N3 -->|Queries with RLS| S2
    N4 -->|File upload/download| S3
    N3 -->|Send emails| E1
    N4 -->|Subscription billing| E2
    N1 -->|Error reports| E3
    N1 -->|Page views| E4
    S2 -.->|Triggers| S4

    E2 --- StripeDetail
    SD4 -->|"POST /api/webhooks/stripe"| N4
    N4 -->|"UPDATE subscriptions,\npayment_events"| S2

    style Clients fill:#F6F8FA,stroke:#3A3A3A
    style Vercel fill:#F6F8FA,stroke:#02667F
    style Supabase fill:#F6F8FA,stroke:#10B981
    style External fill:#F6F8FA,stroke:#0090B7
    style StripeDetail fill:#F6F8FA,stroke:#635BFF
```

## 2. Application Layer Architecture

Detailed view of the Next.js 15 application structure showing pages, server components, server actions, and API routes.

```mermaid
flowchart TD
    subgraph Browser["Browser (React Client Components)"]
        direction LR
        UI1["shadcn/ui Components"]
        UI2["TanStack Table"]
        UI3["Recharts"]
        UI4["React Hook Form + Zod"]
    end

    subgraph Middleware["Edge Middleware"]
        MW1["Auth Session Check"]
        MW2["Role-based Route Guard"]
        MW3["Rate Limiting"]
    end

    subgraph Pages["Next.js Pages / Routes"]
        direction TB
        P1["/dashboard - Manager Dashboard"]
        P2["/dashboard/schemes - Scheme List"]
        P3["/dashboard/schemes/[id] - Scheme Detail"]
        P4["/dashboard/levies - Levy Management"]
        P5["/dashboard/trust - Trust Accounting"]
        P6["/dashboard/meetings - Meeting Admin"]
        P7["/dashboard/maintenance - Maintenance"]
        P8["/dashboard/documents - Documents"]
        P9["/portal - Owner Dashboard"]
        P10["/portal/levies - Owner Levy Info"]
        P11["/portal/documents - Owner Documents"]
    end

    subgraph RSC["React Server Components"]
        SC1["Data fetching at component level"]
        SC2["Streaming with Suspense"]
        SC3["Server-side PDF generation"]
    end

    subgraph Actions["Server Actions"]
        direction TB
        A1["schemes.ts - CRUD schemes"]
        A2["lots.ts - CRUD lots"]
        A3["owners.ts - CRUD owners, transfers"]
        A4["levies.ts - Generate notices, record payments"]
        A5["trust.ts - Transactions, reconciliation"]
        A6["meetings.ts - CRUD meetings, minutes"]
        A7["maintenance.ts - Requests, comments"]
        A8["documents.ts - Upload, categorise"]
        A9["import.ts - CSV import"]
    end

    subgraph API["API Routes"]
        direction TB
        R1["POST /api/portal/auth/magic-link"]
        R2["GET /api/portal/dashboard"]
        R3["GET /api/portal/levy/statement/pdf"]
        R4["GET /api/portal/documents/[id]/download"]
        R5["POST /api/portal/maintenance/submit"]
        R6["POST /api/webhooks/stripe"]
    end

    Browser --> Middleware
    Middleware --> Pages
    Pages --> RSC
    RSC --> Actions
    Pages --> API

    style Browser fill:#F6F8FA,stroke:#3A3A3A
    style Middleware fill:#F59E0B,stroke:#F59E0B,color:#fff
    style Pages fill:#F6F8FA,stroke:#02667F
    style RSC fill:#F6F8FA,stroke:#0090B7
    style Actions fill:#F6F8FA,stroke:#10B981
    style API fill:#F6F8FA,stroke:#0090B7
```

## 3. Data Flow: Browser to Database (with RLS)

Sequence diagram showing how a request flows from the browser through Next.js to Supabase PostgreSQL, with Row-Level Security enforcing data isolation.

```mermaid
sequenceDiagram
    participant Browser
    participant Edge as Edge Middleware
    participant RSC as Server Component
    participant Action as Server Action
    participant Client as Supabase Client
    participant RLS as Row-Level Security
    participant PG as PostgreSQL

    Browser->>Edge: HTTP Request + Session Cookie
    Edge->>Edge: Validate supabase-auth-token
    alt Invalid/Expired Session
        Edge-->>Browser: 302 Redirect to /login
    end
    Edge->>RSC: Forward authenticated request

    RSC->>Client: createClient() with user context
    Client->>PG: SELECT from schemes WHERE ...
    PG->>RLS: Evaluate policy: organisation_id = user_organisation_id()
    RLS-->>PG: Filter rows to user's organisation
    PG-->>Client: Filtered result set
    Client-->>RSC: Typed data
    RSC-->>Browser: Rendered HTML (streamed)

    Note over Browser,PG: User submits form (Server Action)

    Browser->>Action: formAction(formData)
    Action->>Action: Validate with Zod schema
    Action->>Client: supabase.from('table').insert(data)
    Client->>PG: INSERT with RLS check
    PG->>RLS: Evaluate INSERT policy
    alt Policy denied
        RLS-->>Client: Error: insufficient privileges
        Client-->>Action: Error response
        Action-->>Browser: Error message
    else Policy allowed
        PG-->>Client: Row inserted
        Client-->>Action: Success
        Action->>Action: revalidatePath()
        Action-->>Browser: Updated UI
    end
```

## 4. Authentication Architecture

How Supabase Auth handles both manager and owner authentication with magic links.

```mermaid
flowchart TD
    subgraph ManagerAuth["Manager Authentication"]
        MA1["Manager visits /login"] --> MA2["Enter email"]
        MA2 --> MA3["Supabase sends magic link"]
        MA3 --> MA4["Click link in email"]
        MA4 --> MA5["Supabase Auth validates token"]
        MA5 --> MA6["Session created\n(cookie: supabase-auth-token)"]
        MA6 --> MA7["Edge Middleware checks\norganisation_users role"]
        MA7 --> MA8["Access granted to /dashboard/*"]
    end

    subgraph OwnerAuth["Owner Authentication"]
        OA1["Owner visits /portal/login"] --> OA2["Enter email"]
        OA2 --> OA3["System checks owners table\nfor auth_user_id"]
        OA3 --> OA4["Supabase sends magic link"]
        OA4 --> OA5["Click link in email"]
        OA5 --> OA6["Session created\n(30-day expiry)"]
        OA6 --> OA7["Edge Middleware checks\nowners.auth_user_id"]
        OA7 --> OA8["Access granted to /portal/*"]
    end

    subgraph SharedAuth["Shared Auth Infrastructure"]
        SA1["Supabase Auth (PKCE flow)"]
        SA2["Magic Link Provider"]
        SA3["JWT tokens (1hr link, 30-day session)"]
        SA4["Rate limiting (5 requests/email/hour)"]
    end

    ManagerAuth --> SharedAuth
    OwnerAuth --> SharedAuth

    style ManagerAuth fill:#F6F8FA,stroke:#02667F
    style OwnerAuth fill:#F6F8FA,stroke:#0090B7
    style SharedAuth fill:#F6F8FA,stroke:#10B981
```

## 5. Database Architecture (PostgreSQL via Supabase)

High-level view of the database schema grouped by domain area, with RLS policies on every table.

```mermaid
flowchart TD
    subgraph Core["Core Entities"]
        direction LR
        T1[("organisations")]
        T2[("organisation_users")]
        T3[("schemes")]
        T4[("lots")]
        T5[("owners")]
        T6[("lot_ownerships")]
        T7[("tenants")]
    end

    subgraph Financial["Financial Entities"]
        direction LR
        T8[("levy_schedules")]
        T9[("levy_items")]
        T10[("transactions")]
        T11[("bank_statements")]
        T12[("budgets")]
    end

    subgraph Operational["Operational Entities"]
        direction LR
        T13[("meetings")]
        T14[("maintenance_requests")]
        T15[("maintenance_comments")]
        T16[("maintenance_attachments")]
        T17[("documents")]
    end

    subgraph System["System Entities"]
        direction LR
        T18[("audit_log")]
        T19[("invitations")]
        T20[("notifications")]
        T21[("email_log")]
    end

    subgraph Subscription["Subscription & Billing Entities"]
        direction LR
        T22[("subscription_plans")]
        T23[("subscriptions")]
        T24[("usage_tracking")]
        T25[("platform_invoices")]
        T26[("payment_events")]
    end

    subgraph Security["Security Layer"]
        RLS["Row-Level Security (RLS)\non all tables"]
        POLICY1["Manager policy:\norganisation_id = user_organisation_id()"]
        POLICY2["Owner policy:\nowner_id via auth.uid() lookup"]
    end

    Core --> Financial
    Core --> Operational
    Core --> System
    Core --> Subscription
    Security -.-> Core
    Security -.-> Financial
    Security -.-> Operational
    Security -.-> System
    Security -.-> Subscription

    style Core fill:#F6F8FA,stroke:#02667F
    style Financial fill:#F6F8FA,stroke:#10B981
    style Operational fill:#F6F8FA,stroke:#F59E0B
    style System fill:#F6F8FA,stroke:#6B7280
    style Subscription fill:#F6F8FA,stroke:#635BFF
    style Security fill:#EF4444,stroke:#EF4444,color:#fff
```

## 6. External Service Integrations

How LevyLite connects to external services for email, payments, error tracking, and analytics.

```mermaid
flowchart LR
    subgraph App["LevyLite (Next.js)"]
        A1["Server Actions"]
        A2["API Routes"]
        A3["Webhooks"]
    end

    subgraph Resend["Resend (Email)"]
        R1["Levy notice emails"]
        R2["Meeting notice emails"]
        R3["Magic link emails"]
        R4["Maintenance update emails"]
        R5["Owner portal invitations"]
    end

    subgraph Stripe["Stripe (Billing)"]
        S1["Stripe Billing\n(Subscription management)"]
        S2["Stripe Checkout\n(Graduated per-lot pricing)"]
        S3["Stripe Customer Portal\n(Self-service billing,\nBECS Direct Debit)"]
        S4["Stripe Webhooks\n(subscription.updated,\ninvoice.paid,\npayment_intent.failed)"]
    end

    subgraph Storage["Supabase Storage"]
        ST1["Scheme documents (PDFs)"]
        ST2["Maintenance request photos"]
        ST3["Generated levy notice PDFs"]
        ST4["Meeting minutes and agendas"]
    end

    subgraph Monitoring["Monitoring"]
        MO1["Sentry - Error tracking"]
        MO2["Plausible - Privacy analytics"]
    end

    A1 -->|Send transactional email| Resend
    A2 -->|Manage subscriptions,\nCheckout sessions| Stripe
    A3 -->|POST /api/webhooks/stripe\nreceive billing events| Stripe
    A1 -->|Upload/download files| Storage
    App -->|Report errors| Monitoring
    App -->|Track page views| Monitoring

    style App fill:#F6F8FA,stroke:#02667F
    style Resend fill:#F6F8FA,stroke:#0090B7
    style Stripe fill:#F6F8FA,stroke:#10B981
    style Storage fill:#F6F8FA,stroke:#F59E0B
    style Monitoring fill:#F6F8FA,stroke:#6B7280
```

## 7. Deployment Architecture

How LevyLite is deployed across Vercel and Supabase Cloud.

```mermaid
flowchart TD
    subgraph GitHub["GitHub Repository"]
        G1["main branch"]
        G2["Pull Requests"]
        G3["GitHub Actions CI"]
    end

    subgraph Vercel["Vercel Platform"]
        V1["Production\n(main branch auto-deploy)"]
        V2["Preview Deployments\n(PR branches)"]
        V3["Edge Network (CDN)\n(Static assets, ISR pages)"]
        V4["Serverless Functions\n(API routes, Server Actions)"]
    end

    subgraph SupabaseCloud["Supabase Cloud"]
        SC1["PostgreSQL Database\n(8GB Pro plan)"]
        SC2["Auth Service\n(250K MAU)"]
        SC3["Storage\n(100GB, S3-compatible)"]
        SC4["Daily Backups\n(30-day retention)"]
        SC5["Database Migrations\n(SQL migration files)"]
    end

    subgraph DNS["DNS & Domain"]
        D1["levylite.com.au\n(Vercel)"]
        D2["portal.levylite.com.au\n(Vercel)"]
        D3["*.supabase.co\n(API + Auth + Storage)"]
    end

    G1 -->|Auto deploy| V1
    G2 -->|Preview deploy| V2
    G3 -->|Run tests, lint, type check| G1

    V1 --> V3
    V1 --> V4
    V4 -->|Supabase JS Client| SupabaseCloud

    DNS --> Vercel
    DNS --> SupabaseCloud

    style GitHub fill:#F6F8FA,stroke:#3A3A3A
    style Vercel fill:#F6F8FA,stroke:#02667F
    style SupabaseCloud fill:#F6F8FA,stroke:#10B981
    style DNS fill:#F6F8FA,stroke:#6B7280
```

## 8. Infrastructure Cost Summary

```mermaid
flowchart LR
    subgraph MVP["MVP Infrastructure (~$100/month)"]
        direction TB
        IC1["Vercel Pro: $20/mo"]
        IC2["Supabase Pro: $25/mo"]
        IC3["Resend: $20/mo\n(50K emails)"]
        IC4["Sentry: Free\n(5K events)"]
        IC5["Plausible: $9/mo"]
        IC6["Domain: ~$3/mo"]
    end

    subgraph Scale["Scale (5K users, ~$300/month)"]
        direction TB
        SC1["Vercel Pro: $20/mo"]
        SC2["Supabase Pro: $25/mo\n+ compute add-on"]
        SC3["Resend: $50/mo\n(100K emails)"]
        SC4["Sentry: $26/mo"]
        SC5["Plausible: $19/mo"]
        SC6["Domain: ~$3/mo"]
    end

    style MVP fill:#F6F8FA,stroke:#10B981
    style Scale fill:#F6F8FA,stroke:#0090B7
```
