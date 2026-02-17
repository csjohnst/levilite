# Manager User Journeys

User journey diagrams for strata managers using LevyLite, covering onboarding, daily workflow, and scheme setup.

## 1. Manager Onboarding Journey

The end-to-end flow from first signup to sending the first levy notice. Designed for self-serve onboarding in under 30 minutes.

```mermaid
journey
    title Manager Onboarding Journey
    section Sign Up
      Visit landing page: 3: Manager
      View pricing calculator: 4: Manager
      Click "Start Free Trial": 5: Manager
      Enter email and name: 3: Manager
      Click magic link in email: 4: Manager
    section Create Organisation
      Enter organisation name: 4: Manager
      Enter ABN and contact details: 3: Manager
      Organisation created: 5: Manager
    section Add First Scheme
      Click "Create Scheme": 5: Manager
      Enter scheme number (SP format): 3: Manager
      Enter scheme name and address: 4: Manager
      Set financial year end: 4: Manager
      Set levy frequency and due day: 4: Manager
    section Add Lots
      Choose import method: 4: Manager
      Upload CSV or add manually: 3: Manager
      Enter lot numbers and entitlements: 3: Manager
      Review and confirm lots: 4: Manager
    section Import Owners
      Enter owner names and contacts: 3: Manager
      Link owners to lots: 4: Manager
      Set correspondence preferences: 4: Manager
    section Set Up Levies
      Define admin fund levy amount: 4: Manager
      Define capital works fund levy: 4: Manager
      Review levy schedule: 4: Manager
    section Send First Notices
      Generate levy notices (PDF): 5: Manager
      Preview notices before sending: 4: Manager
      Send levy notices via email: 5: Manager
      Onboarding complete: 5: Manager
```

## 2. Manager Onboarding Flow (Detail)

Step-by-step flowchart showing the onboarding decisions and branching paths.

```mermaid
flowchart TD
    A[Visit levylite.com.au] --> B[Click Start Free Trial]
    B --> C[Enter Email + Name]
    C --> D[Receive Magic Link Email]
    D --> E[Click Magic Link]
    E --> F[Create Organisation]
    F --> G{First Scheme?}
    G -->|Create Now| H[Scheme Setup Wizard]
    G -->|Skip for Later| Z[Dashboard - Empty State]

    H --> H1[Step 1: Basic Details]
    H1 --> H2[Step 2: Legal & Financial]
    H2 --> H3[Step 3: Lot Configuration]

    H3 --> I{Import Method?}
    I -->|CSV Import| J[Upload CSV File]
    I -->|Manual Entry| K[Add Lots One by One]
    I -->|Add Later| L[Create Scheme with 0 Lots]

    J --> J1[Preview & Validate CSV]
    J1 --> J2{Validation OK?}
    J2 -->|Yes| M[Lots Created]
    J2 -->|Errors| J3[Fix Errors & Re-upload]
    J3 --> J1

    K --> K1[Enter Lot Number + Entitlement]
    K1 --> K2{More Lots?}
    K2 -->|Yes| K1
    K2 -->|No| M

    M --> N[Add Owners to Lots]
    N --> O[Set Levy Amounts per Fund]
    O --> P[Generate First Levy Notices]
    P --> Q{Review Notices?}
    Q -->|Approve| R[Send Notices via Email]
    Q -->|Edit| P

    R --> S[Dashboard - Active Scheme]
    L --> S

    style A fill:#F6F8FA,stroke:#02667F
    style S fill:#10B981,stroke:#10B981,color:#fff
    style R fill:#0090B7,stroke:#02667F,color:#fff
```

## 3. Manager Daily Workflow

The typical daily routine for a strata manager using LevyLite to manage their portfolio.

```mermaid
journey
    title Manager Daily Workflow
    section Login & Dashboard
      Open LevyLite on phone or laptop: 5: Manager
      Authenticate via magic link or session: 4: Manager
      View dashboard summary cards: 5: Manager
    section Check Arrears
      Review arrears dashboard: 4: Manager
      Identify lots overdue >30 days: 3: Manager
      Send reminder notices: 4: Manager
      Log follow-up notes: 4: Manager
    section Process Payments
      Check bank statement for new payments: 3: Manager
      Enter payment transactions: 3: Manager
      Match payments to lot levies: 4: Manager
      Reconcile bank balance: 4: Manager
    section Handle Maintenance
      Review new maintenance requests: 4: Manager
      Assign tradesperson to request: 4: Manager
      Update request status: 4: Manager
      Add notes and photos: 4: Manager
      Notify owner of update: 5: Manager
    section Prepare for Meetings
      Check upcoming meeting dates: 4: Manager
      Generate AGM notice: 4: Manager
      Attach financial statements: 3: Manager
      Send notice to all owners: 5: Manager
    section Manage Billing
      Review subscription status: 4: Manager
      Check lot count vs billed lots: 4: Manager
      View invoice history: 4: Manager
      Update payment method if needed: 3: Manager
```

## 4. Daily Workflow Sequence

Technical sequence showing the manager's interaction with LevyLite systems during a typical day.

```mermaid
sequenceDiagram
    actor Manager
    participant App as LevyLite App
    participant DB as Supabase (PostgreSQL)
    participant Email as Resend (Email)
    participant Storage as Supabase Storage

    Note over Manager,Storage: Morning - Check Dashboard
    Manager->>App: Open dashboard
    App->>DB: Query arrears, open requests, upcoming meetings
    DB-->>App: Dashboard summary data
    App-->>Manager: Display stat cards and alerts

    Note over Manager,Storage: Process Payments
    Manager->>App: Navigate to Trust Accounting
    Manager->>App: Enter payment (lot, amount, date, ref)
    App->>DB: INSERT transaction record
    DB-->>App: Transaction confirmed
    App->>DB: UPDATE lot levy balance
    App-->>Manager: Payment recorded, balance updated

    Note over Manager,Storage: Handle Maintenance Request
    Manager->>App: Open maintenance request #1234
    App->>DB: Query request details + comments
    DB-->>App: Request data
    Manager->>App: Assign tradesperson, update status
    App->>DB: UPDATE maintenance_requests SET status='assigned'
    App->>Email: Send notification to owner
    Email-->>Manager: Owner notified

    Note over Manager,Storage: Send Arrears Reminder
    Manager->>App: Select overdue lots
    Manager->>App: Click "Send Reminder"
    App->>DB: Generate reminder notice data
    App->>Storage: Generate PDF reminder
    App->>Email: Send reminder to owner(s)
    Email-->>Manager: Reminders sent
    App->>DB: Log reminder in audit_log
```

## 5. Scheme Setup Flow

Detailed flow for creating a new strata scheme with lots, owners, and levy configuration.

```mermaid
flowchart TD
    subgraph Step1["Step 1: Basic Details"]
        A1[Enter Scheme Number - SP XXXXX] --> A2[Enter Scheme Name]
        A2 --> A3[Enter Street Address]
        A3 --> A4[Select Scheme Type]
        A4 --> A5[Select State - WA default]
    end

    subgraph Step2["Step 2: Legal & Financial"]
        B1[Enter ABN - optional] --> B2[Enter Registered Name - optional]
        B2 --> B3[Set Financial Year End]
        B3 --> B4[Set Levy Frequency]
        B4 --> B5[Set Levy Due Day]
    end

    subgraph Step3["Step 3: Add Lots"]
        C1{How many lots?} --> C2[Enter lot count]
        C2 --> C3{Import method?}
        C3 -->|Bulk Add| C4[Enter range: Lots 1-20]
        C3 -->|CSV Import| C5[Upload CSV file]
        C3 -->|Manual| C6[Add lots one at a time]
        C4 --> C7[Set equal entitlements]
        C5 --> C8[Preview and validate]
        C6 --> C9[Enter lot number + entitlement]
        C7 --> C10[Review lot list]
        C8 --> C10
        C9 --> C10
    end

    subgraph PlanCheck["Plan Check: Lot Limit"]
        PC1{Total lots > free tier limit?}
        PC1 -->|"No (≤10 lots)"| PC2[Continue on free plan]
        PC1 -->|"Yes (>10 lots)"| PC3[Show upgrade prompt]
        PC3 --> PC4[Redirect to Stripe Checkout]
        PC4 --> PC5[Select billing interval]
        PC5 --> PC6[Enter payment details]
        PC6 --> PC7[Subscription activated]
        PC2 --> D1
        PC7 --> D1
    end

    subgraph Step4["Step 4: Assign Owners"]
        D1[Select lot from list] --> D2[Create or search owner]
        D2 --> D3[Enter owner name + contact]
        D3 --> D4[Set ownership type]
        D4 --> D5{Joint ownership?}
        D5 -->|Yes| D6[Add additional owners]
        D5 -->|No| D7[Set as sole owner]
        D6 --> D8[Set ownership percentages]
        D7 --> D9{More lots?}
        D8 --> D9
        D9 -->|Yes| D1
        D9 -->|No| D10[All owners assigned]
    end

    subgraph Step5["Step 5: Configure Levies"]
        E1[Set Admin Fund levy per entitlement] --> E2[Set Capital Works Fund levy per entitlement]
        E2 --> E3[Review levy schedule]
        E3 --> E4[Preview per-lot levy amounts]
        E4 --> E5[Confirm levy configuration]
    end

    Step1 --> Step2 --> Step3 --> PlanCheck --> Step4 --> Step5
    Step5 --> F[Scheme Ready - Go to Dashboard]

    style Step1 fill:#F6F8FA,stroke:#02667F
    style Step2 fill:#F6F8FA,stroke:#02667F
    style Step3 fill:#F6F8FA,stroke:#02667F
    style Step4 fill:#F6F8FA,stroke:#02667F
    style Step5 fill:#F6F8FA,stroke:#02667F
    style PlanCheck fill:#FFF3E0,stroke:#E65100
    style F fill:#10B981,stroke:#10B981,color:#fff
```

## 6. Scheme Setup Sequence

Server-side sequence for the scheme creation process.

```mermaid
sequenceDiagram
    actor Manager
    participant App as Next.js App
    participant Action as Server Actions
    participant DB as PostgreSQL
    participant RLS as Row-Level Security

    Manager->>App: Complete scheme wizard
    App->>Action: createScheme(data)
    Action->>Action: Validate with Zod schema
    Action->>DB: Check scheme_number uniqueness
    DB-->>Action: No duplicate found
    Action->>DB: INSERT INTO schemes
    RLS-->>DB: Verify organisation_id matches user
    DB-->>Action: Scheme created (UUID)

    loop For each lot
        Manager->>App: Add lot details
        App->>Action: createLot(schemeId, lotData)
        Action->>DB: INSERT INTO lots
        DB-->>Action: Lot created
        Action->>DB: Trigger: update_scheme_total_entitlement()
    end

    loop For each owner
        Manager->>App: Add owner details
        App->>Action: createOwner(ownerData)
        Action->>DB: INSERT INTO owners
        DB-->>Action: Owner created

        App->>Action: linkOwnerToLot(ownerId, lotId, ownershipData)
        Action->>DB: INSERT INTO lot_ownerships
        DB-->>Action: Ownership linked
    end

    Manager->>App: Configure levy amounts
    App->>Action: setLevySchedule(schemeId, levyData)
    Action->>DB: INSERT levy configuration
    DB-->>Action: Levy schedule saved

    App-->>Manager: Scheme setup complete
```
