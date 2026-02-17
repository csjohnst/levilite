# Authorization and Roles

Role-based access control (RBAC) diagrams for LevyLite, covering the role hierarchy, permission matrix, and committee member overlay.

Roles are assigned per organisation (tenant), not globally. Staff roles (manager, admin, auditor) are stored in `organisation_users`. Owner identity is stored in the `owners` table with an optional `auth_user_id` link to Supabase Auth.

---

## 1. Role Hierarchy

The four user roles form a clear hierarchy of descending permissions. Committee member is an overlay on the owner role, not a separate role.

```mermaid
flowchart TD
    subgraph Organisation Scope
        MG[manager<br/>Full control within organisation]
        AD[admin<br/>Day-to-day operations, no destructive actions]
        AU[auditor<br/>Read-only financial access, time-limited]
    end

    subgraph Owner Portal Scope
        OW[owner<br/>Self-service access to own lots]
        CM[committee member<br/>Overlay: owner + governance permissions]
    end

    MG -->|"invites & manages"| AD
    MG -->|"invites & manages"| AU
    MG -->|"invites via lot register"| OW
    OW -.->|"elected at AGM"| CM

    style MG fill:#1e3a5f,color:#fff
    style AD fill:#2d5a87,color:#fff
    style AU fill:#4a7fb5,color:#fff
    style OW fill:#6b8e5e,color:#fff
    style CM fill:#8fae7e,color:#fff
```

---

## 2. Role Details and Database Mapping

How each role maps to database tables and auth patterns.

```mermaid
classDiagram
    class Manager {
        +role: "manager"
        +table: organisation_users
        +auth: email/password, magic link, Google OAuth
        +session_ttl: 30 days
        --
        Full CRUD on all resources
        Invite/remove users
        Organisation settings
        View audit logs
        Export all data
    }

    class Admin {
        +role: "admin"
        +table: organisation_users
        +auth: email/password, magic link, Google OAuth
        +session_ttl: 30 days
        --
        Create/Read/Update (no Delete)
        Enter transactions (edit own <24h)
        Send notices
        Upload documents
        Cannot invite users
        Cannot access billing
    }

    class Auditor {
        +role: "auditor"
        +table: organisation_users
        +auth: magic link (invite-only)
        +session_ttl: 7 days
        --
        Read-only financial data
        Download financial reports
        View levy roll and arrears
        Cannot view owner contact details
        Cannot edit any data
        Time-limited access (90 days default)
    }

    class Owner {
        +role: "owner"
        +table: owners (auth_user_id -> auth.users)
        +auth: magic link only
        +session_ttl: 90 days
        --
        View own lot levy balance
        Download scheme documents
        Submit maintenance requests
        Update own contact details
        Cannot view other lots
        Cannot access trust accounting
    }

    class CommitteeMember {
        +overlay on: Owner
        +table: committee_members
        +position: chair | treasurer | secretary | member
        --
        View committee-only documents
        Access meeting admin features
        Additional financial report access
        Elected at AGM, term-limited
    }

    Manager --|> Admin : higher privilege
    Admin --|> Auditor : higher privilege
    Owner <|-- CommitteeMember : extends
```

---

## 3. Permission Matrix

Detailed CRUD permissions by role across all major resources.

```mermaid
flowchart LR
    subgraph Legend
        direction LR
        CR[C = Create]
        RD[R = Read]
        UP[U = Update]
        DL[D = Delete]
        NO[- = No access]
    end
```

```mermaid
block-beta
    columns 5
    block:header:5
        columns 5
        h1["Resource"] h2["manager"] h3["admin"] h4["auditor"] h5["owner"]
    end
    block:schemes:5
        columns 5
        r1["Schemes"] r2["CRUD"] r3["CRU"] r4["-"] r5["R (own)"]
    end
    block:lots:5
        columns 5
        r6["Lots"] r7["CRUD"] r8["CRU"] r9["-"] r10["R (own)"]
    end
    block:owners:5
        columns 5
        r11["Owners"] r12["CRUD"] r13["CRU"] r14["-"] r15["U (self)"]
    end
    block:levies:5
        columns 5
        r16["Levy notices"] r17["CRUD"] r18["CR"] r19["R"] r20["R (own)"]
    end
    block:trust:5
        columns 5
        r21["Trust accounting"] r22["CRUD"] r23["CR*"] r24["R"] r25["-"]
    end
    block:docs:5
        columns 5
        r26["Documents"] r27["CRUD"] r28["CRU"] r29["R (financial)"] r30["R (scheme)"]
    end
    block:maint:5
        columns 5
        r31["Maintenance"] r32["CRUD"] r33["CRUD"] r34["-"] r35["CR (own)"]
    end
    block:meetings:5
        columns 5
        r36["Meetings"] r37["CRUD"] r38["CR"] r39["-"] r40["R (published)"]
    end
    block:users:5
        columns 5
        r41["Users"] r42["CRUD"] r43["-"] r44["-"] r45["-"]
    end
    block:audit:5
        columns 5
        r46["Audit logs"] r47["R"] r48["-"] r49["R (own actions)"] r50["-"]
    end
```

*Admin can create/read transactions, edit own entries within 24 hours, cannot delete.

---

## 4. Permission Enforcement Flow

How role-based permissions are enforced at the database level via RLS policies.

```mermaid
flowchart TD
    A[Authenticated request] --> B[Next.js Server Action / API Route]
    B --> C[Supabase client with user JWT]
    C --> D[PostgreSQL query with RLS enabled]

    D --> E{Which RLS policy applies?}

    E --> F[auth.user_organisation_id]
    F --> G[Query organisation_users WHERE user_id = auth.uid]
    G --> H{Found?}
    H -->|Yes: staff user| I[Get organisation_id + role]
    H -->|No: check owner| J[Query owners WHERE auth_user_id = auth.uid]

    I --> K{Role check}
    K -->|manager| L[Full CRUD within organisation]
    K -->|admin| M[CRU within organisation, no delete]
    K -->|auditor| N[SELECT only on financial tables]

    J --> O{Owner found?}
    O -->|Yes| P[Query lot_ownerships for owner_id]
    P --> Q[Scope to owned lots only]
    O -->|No| R[Access denied]

    L --> S[Return filtered rows]
    M --> S
    N --> S
    Q --> S
    R --> T[Empty result set]
```

---

## 5. Committee Member Overlay

Committee membership is an overlay on the owner role, granting additional permissions for governance features. It is not a separate role -- it augments owner access.

```mermaid
flowchart TD
    A[Owner authenticates] --> B{Is committee member?}

    B -->|No: regular owner| C[Standard owner permissions]
    C --> C1[View own lot levy balance]
    C --> C2[Download scheme documents: visibility = 'owners']
    C --> C3[Submit maintenance requests for own lot]
    C --> C4[Update own contact details]

    B -->|Yes: committee member| D[Owner permissions + committee overlay]
    D --> C1
    D --> C2
    D --> C3
    D --> C4
    D --> E[Additional committee permissions]
    E --> E1[View documents: visibility = 'committee']
    E --> E2[Access meeting admin features]
    E --> E3[View additional financial reports]

    subgraph Committee Check
        F[auth.is_committee_member: scheme_id]
        F --> G[Query committee_members]
        G --> H[JOIN owners ON owner_id]
        H --> I[WHERE auth_user_id = auth.uid AND is_active = true]
    end

    B -.-> F

    subgraph Committee Positions
        P1[chair: presides over meetings]
        P2[treasurer: financial oversight]
        P3[secretary: record keeping]
        P4[member: general committee duties]
    end
```

---

## 6. Role Assignment and Lifecycle

How roles are assigned, changed, and revoked throughout the user lifecycle.

```mermaid
sequenceDiagram
    participant M as Manager
    participant S as System
    participant DB as PostgreSQL
    participant U as Target User

    Note over M,U: Invite new staff member
    M->>S: Invite user (email, role=admin)
    S->>DB: INSERT INTO invitations
    S->>U: Send invitation email
    U->>S: Accept invitation
    S->>DB: INSERT INTO organisation_users (user_id, role='admin')

    Note over M,U: Change role
    M->>S: Change role (user_id, new_role=auditor)
    S->>DB: UPDATE organisation_users SET role = 'auditor'
    Note over DB: RLS policies auto-adjust access

    Note over M,U: Deactivate user
    M->>S: Deactivate user
    S->>DB: DELETE FROM organisation_users WHERE user_id = ...
    S->>DB: Revoke all sessions
    Note over U: User can no longer access organisation data

    Note over M,U: Owner committee election
    M->>S: Add owner to committee (owner_id, position=treasurer)
    S->>DB: INSERT INTO committee_members (scheme_id, owner_id, position, elected_at)
    Note over U: Owner gains committee-level document access

    Note over M,U: Committee term ends
    M->>S: End committee term
    S->>DB: UPDATE committee_members SET is_active = false, term_end_date = NOW()
    Note over U: Owner reverts to standard owner permissions
```
