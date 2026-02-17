# Multi-Tenancy Isolation

Diagrams showing how LevyLite enforces strict data isolation between organisations using Supabase Row-Level Security (RLS), the dual auth model for staff vs owners, and the complete data access paths.

Each organisation (strata management business) is a tenant. All data is scoped to an organisation via `organisation_id` columns and RLS policies evaluated on every database query.

---

## 1. RLS Policy Flow: Staff Access Path

Staff users (manager, admin, auditor) are authenticated via `organisation_users`. RLS policies resolve the user's organisation and filter all data accordingly.

```mermaid
flowchart TD
    A[Authenticated request with JWT] --> B["auth.uid() extracts user ID from JWT"]

    B --> C["auth.user_organisation_id()"]
    C --> D[SELECT organisation_id<br/>FROM organisation_users<br/>WHERE user_id = auth.uid]
    D --> E{Found?}

    E -->|Yes| F[organisation_id resolved]
    E -->|No| G[No staff record: check owner path]

    F --> H[RLS policy evaluation]

    H --> I{Table has direct organisation_id?}
    I -->|Yes: schemes, tradespeople, etc.| J["WHERE organisation_id = auth.user_organisation_id()"]
    I -->|No: lots, transactions, etc.| K[Chain through parent table]

    K --> L["lots: WHERE scheme_id IN<br/>(SELECT id FROM schemes<br/>WHERE organisation_id = auth.user_organisation_id())"]

    K --> M["levy_items: WHERE lot_id IN<br/>(SELECT id FROM lots WHERE scheme_id IN<br/>(SELECT id FROM schemes<br/>WHERE organisation_id = auth.user_organisation_id()))"]

    J --> N[Filtered result set: tenant-isolated]
    L --> N
    M --> N

    N --> O{Role-based filtering}
    O -->|manager| P[Full CRUD access]
    O -->|admin| Q[CRU access, no delete]
    O -->|auditor| R[SELECT only on financial tables]
```

---

## 2. Owner Portal Access Path

Owner portal users are authenticated via the `owners` table (`owners.auth_user_id`), not `organisation_users`. Data access is scoped to the lots they own.

```mermaid
flowchart TD
    A[Owner authenticates via magic link] --> B["auth.uid() from JWT"]

    B --> C["auth.is_owner()"]
    C --> D[SELECT EXISTS<br/>FROM owners<br/>WHERE auth_user_id = auth.uid]
    D --> E{Is owner?}

    E -->|Yes| F[Resolve owned lots]
    E -->|No| G[Access denied: not an owner]

    F --> H["auth.owner_lot_ids()"]
    H --> I[SELECT lot_id FROM lot_ownerships<br/>WHERE owner_id IN<br/>(SELECT id FROM owners WHERE auth_user_id = auth.uid)<br/>AND ownership_end_date IS NULL]

    I --> J[Set of owned lot IDs]

    J --> K[RLS policy: lot-scoped access]
    K --> K1["lots: WHERE id IN (owner_lot_ids)"]
    K --> K2["levy_items: WHERE lot_id IN (owner_lot_ids)"]
    K --> K3["maintenance_requests: WHERE submitted_by = owner.id"]

    J --> L[RLS policy: scheme-scoped documents]
    L --> L1[Resolve scheme_ids from owned lots]
    L1 --> L2["documents: WHERE scheme_id IN (owner_scheme_ids)<br/>AND visibility IN ('owners', 'committee')"]

    K1 --> M[Owner sees only their data]
    K2 --> M
    K3 --> M
    L2 --> M
```

---

## 3. Dual Auth Model

LevyLite uses two parallel auth patterns: staff via `organisation_users` and owners via `owners.auth_user_id`. Both resolve to `auth.users` but follow different data access paths.

```mermaid
flowchart TD
    A["auth.users (Supabase Auth)"] --> B{User type?}

    B -->|Staff| C["organisation_users table"]
    B -->|Owner| D["owners table"]

    subgraph Staff Auth Path
        C --> C1[organisation_id: direct tenant link]
        C --> C2["role: manager | admin | auditor"]
        C1 --> C3["auth.user_organisation_id() helper"]
        C3 --> C4[RLS: filter by organisation_id]
    end

    subgraph Owner Auth Path
        D --> D1["auth_user_id: links to auth.users"]
        D --> D2[owner_id: links to lot_ownerships]
        D2 --> D3["auth.owner_lot_ids() helper"]
        D3 --> D4[RLS: filter by lot_id / scheme_id]
    end

    C4 --> E[Query result: organisation-scoped]
    D4 --> F[Query result: lot-scoped]

    style C fill:#1e3a5f,color:#fff
    style D fill:#6b8e5e,color:#fff
```

---

## 4. Dual Auth Model -- Sequence Detail

Step-by-step comparison of how a staff request and an owner request are processed through the same Supabase RLS infrastructure.

```mermaid
sequenceDiagram
    participant SU as Staff User
    participant OU as Owner User
    participant App as Next.js App
    participant SB as Supabase Client
    participant DB as PostgreSQL + RLS

    Note over SU,DB: Staff request: list all schemes
    SU->>App: GET /dashboard/schemes
    App->>SB: supabase.from('schemes').select('*')
    SB->>DB: SELECT * FROM schemes (with JWT)
    DB->>DB: RLS: organisation_id = auth.user_organisation_id()
    DB->>DB: Lookup organisation_users WHERE user_id = jwt.sub
    DB-->>SB: Rows where organisation_id matches
    SB-->>App: Filtered schemes
    App-->>SU: All schemes in their organisation

    Note over SU,DB: Owner request: view lot details
    OU->>App: GET /owner/lots
    App->>SB: supabase.from('lots').select('*')
    SB->>DB: SELECT * FROM lots (with JWT)
    DB->>DB: RLS: id IN (SELECT lot_id FROM lot_ownerships ...)
    DB->>DB: Lookup owners WHERE auth_user_id = jwt.sub
    DB->>DB: Lookup lot_ownerships WHERE owner_id = owner.id
    DB-->>SB: Rows where lot_id is in owner's lots
    SB-->>App: Filtered lots
    App-->>OU: Only their owned lots
```

---

## 5. Tenant Isolation Architecture

Complete view of how organisation boundaries are enforced from the network edge to the database.

```mermaid
flowchart TD
    subgraph Edge["Network Edge"]
        R1[HTTPS request with session cookie]
    end

    subgraph AppLayer["Application Layer (Next.js)"]
        MW[Middleware: validate session, refresh tokens]
        SA[Server Action: business logic]
        MW --> SA
    end

    subgraph AuthLayer["Auth Layer (Supabase Auth)"]
        JWT[JWT validation]
        UID["auth.uid() extracted from JWT"]
        JWT --> UID
    end

    subgraph DataLayer["Database Layer (PostgreSQL)"]
        direction TB
        RLS[RLS Policy Engine]

        subgraph Helpers["Helper Functions"]
            H1["auth.user_organisation_id()"]
            H2["auth.user_role()"]
            H3["auth.is_manager()"]
            H4["auth.is_owner()"]
            H5["auth.owner_lot_ids()"]
        end

        subgraph Tables["Tenant-Isolated Tables"]
            T1[organisations]
            T2[schemes]
            T3[lots]
            T4[owners]
            T5[transactions]
            T6[levy_items]
            T7[documents]
            T8["... (44 tables total)"]
        end

        RLS --> Helpers
        Helpers --> Tables
    end

    R1 --> MW
    SA --> JWT
    UID --> RLS

    style Edge fill:#f5f5f5,color:#333
    style AuthLayer fill:#e8eef5,color:#333
    style DataLayer fill:#e5ede5,color:#333
```

---

## 6. Cross-Tenant Isolation: What Gets Blocked

Demonstrates how RLS prevents data leakage between organisations, even if the application layer is compromised.

```mermaid
sequenceDiagram
    participant A as User from Org A
    participant App as Next.js App
    participant DB as PostgreSQL + RLS

    Note over A,DB: Legitimate request
    A->>App: GET /schemes (authenticated as Org A user)
    App->>DB: SELECT * FROM schemes
    DB->>DB: RLS: organisation_id = auth.user_organisation_id()
    DB->>DB: auth.user_organisation_id() returns Org A ID
    DB-->>App: Schemes belonging to Org A only
    App-->>A: 3 schemes displayed

    Note over A,DB: URL manipulation attack
    A->>App: GET /schemes/[org-b-scheme-id]
    App->>DB: SELECT * FROM schemes WHERE id = 'org-b-scheme-id'
    DB->>DB: RLS: organisation_id = auth.user_organisation_id()
    DB->>DB: Org B scheme has organisation_id != Org A ID
    DB-->>App: Empty result (0 rows)
    App-->>A: 404 Not Found

    Note over A,DB: Direct API attack
    A->>App: POST /api with forged organisation_id = Org B
    App->>DB: INSERT INTO schemes (organisation_id = 'org-b-id', ...)
    DB->>DB: RLS: organisation_id = auth.user_organisation_id()
    DB->>DB: Org B ID != Org A ID
    DB-->>App: RLS policy violation error
    App-->>A: 403 Forbidden
```

---

## 7. Data Access Scope by Role

Summary of what data each role can access and through which path.

```mermaid
flowchart LR
    subgraph auth_users["auth.users"]
        U[Authenticated User]
    end

    subgraph staff_path["Staff Path: organisation_users"]
        OU[organisation_users<br/>role + organisation_id]
    end

    subgraph owner_path["Owner Path: owners"]
        OW[owners<br/>auth_user_id]
        LO[lot_ownerships<br/>owner_id + lot_id]
        OW --> LO
    end

    U --> OU
    U --> OW

    subgraph org_data["Organisation-Scoped Data"]
        S[schemes]
        L[lots]
        T[transactions]
        D[documents]
        M[meetings]
        MR[maintenance_requests]
        AL[audit_log]
    end

    subgraph lot_data["Lot-Scoped Data (Owner View)"]
        OL[own lots]
        OLI[own levy_items]
        OD[scheme documents: visibility = owners]
        OMR[own maintenance_requests]
    end

    OU -->|"manager: CRUD"| org_data
    OU -->|"admin: CRU"| org_data
    OU -->|"auditor: R (financial)"| T
    OU -->|"auditor: R (financial)"| D

    LO -->|"owner: R (own)"| lot_data
```
