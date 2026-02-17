# Navigation & Information Architecture

Navigation trees and information architecture for the Manager Portal and Owner Portal, plus a feature module dependency map.

## 1. Manager Portal Navigation Tree

The full sidebar navigation structure for the manager-facing application. Available on desktop as a persistent sidebar (240px) and on mobile as a hamburger menu with bottom navigation.

```mermaid
flowchart TD
    subgraph Sidebar["Manager Portal Sidebar (240px)"]
        direction TB
        LOGO["LevyLite Logo"]
        SWITCH["Scheme Switcher ▼"]

        NAV1["Dashboard"]
        NAV2["Schemes"]
        NAV3["Levies"]
        NAV4["Trust Accounting"]
        NAV5["Meetings"]
        NAV6["Maintenance"]
        NAV7["Documents"]
        NAV8["Reports"]
        NAV9["Settings"]
        USER["User Profile"]
    end

    LOGO --> SWITCH
    SWITCH --> NAV1
    NAV1 --> NAV2
    NAV2 --> NAV3
    NAV3 --> NAV4
    NAV4 --> NAV5
    NAV5 --> NAV6
    NAV6 --> NAV7
    NAV7 --> NAV8
    NAV8 --> NAV9
    NAV9 --> USER

    style Sidebar fill:#F6F8FA,stroke:#02667F
    style LOGO fill:#02667F,stroke:#02667F,color:#fff
    style SWITCH fill:#0090B7,stroke:#0090B7,color:#fff
```

## 2. Manager Portal Navigation Detail

Expanded navigation showing all sub-pages and routes.

```mermaid
flowchart LR
    subgraph Dashboard["/dashboard"]
        D1["Summary stat cards"]
        D2["Arrears alerts"]
        D3["Upcoming meetings"]
        D4["Recent activity feed"]
        D5["Open maintenance requests"]
    end

    subgraph Schemes["/dashboard/schemes"]
        S1["/schemes - Scheme list"]
        S2["/schemes/new - Create scheme wizard"]
        S3["/schemes/[id] - Scheme detail"]
        S3 --> S3a["Overview tab"]
        S3 --> S3b["Lots tab"]
        S3 --> S3c["Owners tab"]
        S3 --> S3d["Activity log tab"]
        S3b --> S3b1["/schemes/[id]/lots/new - Add lot"]
        S3b --> S3b2["/schemes/[id]/lots/import - CSV import"]
        S3c --> S3c1["/schemes/[id]/owners/new - Add owner"]
    end

    subgraph Levies["/dashboard/levies"]
        L1["Levy roll (per scheme)"]
        L2["Generate levy notices"]
        L3["Send notices via email"]
        L4["Record payments"]
        L5["Arrears dashboard"]
        L6["Owner levy statements"]
    end

    subgraph Trust["/dashboard/trust"]
        T1["General ledger"]
        T2["Transaction entry"]
        T3["Bank reconciliation"]
        T4["Fund balances"]
        T5["Trial balance"]
        T6["EOFY summary"]
    end

    subgraph Meetings["/dashboard/meetings"]
        M1["Meeting list"]
        M2["Create meeting (AGM/SGM)"]
        M3["Generate meeting notice"]
        M4["Record attendance"]
        M5["Record minutes"]
        M6["Store resolutions"]
    end

    subgraph Maintenance["/dashboard/maintenance"]
        MN1["Request list (filterable)"]
        MN2["Request detail"]
        MN3["Assign tradesperson"]
        MN4["Update status"]
        MN5["Add notes and photos"]
        MN6["Tradesperson directory"]
    end

    subgraph Documents["/dashboard/documents"]
        DC1["Document library"]
        DC2["Upload documents"]
        DC3["Folder structure"]
        DC4["Search and filter"]
        DC5["Set visibility (owner/manager)"]
    end

    subgraph Reports["/dashboard/reports"]
        R1["Levy roll report"]
        R2["Fund balance summary"]
        R3["Income statement"]
        R4["Budget vs actual"]
        R5["EOFY report for accountant"]
    end

    subgraph Settings["/dashboard/settings"]
        ST1["Organisation details"]
        ST2["User management (invite/roles)"]
        ST3["Billing and subscription"]
        ST4["Email templates"]
        ST5["Notification preferences"]
    end

    style Dashboard fill:#F6F8FA,stroke:#02667F
    style Schemes fill:#F6F8FA,stroke:#02667F
    style Levies fill:#F6F8FA,stroke:#10B981
    style Trust fill:#F6F8FA,stroke:#10B981
    style Meetings fill:#F6F8FA,stroke:#F59E0B
    style Maintenance fill:#F6F8FA,stroke:#F59E0B
    style Documents fill:#F6F8FA,stroke:#0090B7
    style Reports fill:#F6F8FA,stroke:#0090B7
    style Settings fill:#F6F8FA,stroke:#6B7280
```

## 3. Mobile Navigation (Manager)

Bottom navigation bar for mobile devices (viewport < 640px) with 5 primary items.

```mermaid
flowchart TD
    subgraph TopBar["Top Bar (Sticky)"]
        direction LR
        TB1["Hamburger Menu"]
        TB2["Scheme Switcher ▼"]
        TB3["Notifications Bell"]
        TB4["User Avatar"]
    end

    subgraph BottomNav["Bottom Navigation (Fixed)"]
        direction LR
        BN1["Home\n(Dashboard)"]
        BN2["Schemes\n(Scheme List)"]
        BN3["Levies\n(Levy Roll)"]
        BN4["Docs\n(Documents)"]
        BN5["More\n(All Other)"]
    end

    subgraph MoreMenu["'More' Expanded Menu"]
        direction TB
        MM1["Trust Accounting"]
        MM2["Meetings"]
        MM3["Maintenance"]
        MM4["Reports"]
        MM5["Settings"]
    end

    BN5 --> MoreMenu

    style TopBar fill:#02667F,stroke:#02667F,color:#fff
    style BottomNav fill:#F6F8FA,stroke:#02667F
    style MoreMenu fill:#F6F8FA,stroke:#0090B7
```

## 4. Owner Portal Navigation Tree

The navigation structure for the owner-facing self-service portal. Simplified compared to the manager portal, with focus on information consumption rather than data entry.

```mermaid
flowchart TD
    subgraph OwnerNav["Owner Portal Navigation"]
        direction TB
        ON1["Dashboard"]
        ON2["Levy Statements"]
        ON3["Documents"]
        ON4["Maintenance"]
        ON5["Meetings"]
        ON6["Profile"]
    end

    subgraph DashboardPage["/portal - Dashboard"]
        D1["Levy balance hero card"]
        D2["Payment history chart"]
        D3["Quick action cards"]
        D4["Lot selector (multi-lot)"]
    end

    subgraph LevyPage["/portal/levies - Levy Statements"]
        L1["Current balance summary"]
        L2["Payment instructions (bank details)"]
        L3["Payment history table"]
        L4["Download PDF statement"]
        L5["Export CSV"]
    end

    subgraph DocsPage["/portal/documents - Documents"]
        DC1["Browse by category"]
        DC2["Search documents"]
        DC3["Filter by date range"]
        DC4["Preview PDF in browser"]
        DC5["Download documents"]
    end

    subgraph MaintPage["/portal/maintenance - Maintenance"]
        MN1["My requests list"]
        MN2["Submit new request"]
        MN3["View request detail"]
        MN4["Add comment"]
        MN5["Attach photos"]
    end

    subgraph MeetingsPage["/portal/meetings - Meetings"]
        MT1["Upcoming meetings"]
        MT2["Download meeting notice"]
        MT3["Download agenda"]
        MT4["Add to calendar (.ics)"]
        MT5["Past meeting minutes"]
    end

    subgraph ProfilePage["/portal/profile - Profile"]
        P1["View contact details"]
        P2["Update phone and address"]
        P3["Change email (with verification)"]
        P4["Correspondence preferences"]
        P5["Emergency contact"]
        P6["Notification settings"]
    end

    ON1 --> DashboardPage
    ON2 --> LevyPage
    ON3 --> DocsPage
    ON4 --> MaintPage
    ON5 --> MeetingsPage
    ON6 --> ProfilePage

    style OwnerNav fill:#02667F,stroke:#02667F,color:#fff
    style DashboardPage fill:#F6F8FA,stroke:#02667F
    style LevyPage fill:#F6F8FA,stroke:#10B981
    style DocsPage fill:#F6F8FA,stroke:#0090B7
    style MaintPage fill:#F6F8FA,stroke:#F59E0B
    style MeetingsPage fill:#F6F8FA,stroke:#0090B7
    style ProfilePage fill:#F6F8FA,stroke:#6B7280
```

## 5. Mobile Navigation (Owner)

Owner portal mobile navigation. Simpler than the manager portal since there are fewer sections.

```mermaid
flowchart TD
    subgraph OwnerTopBar["Top Bar (Sticky)"]
        direction LR
        OT1["Hamburger Menu"]
        OT2["Scheme / Lot Selector ▼"]
        OT3["User Menu"]
    end

    subgraph OwnerBottomNav["Bottom Navigation (Fixed)"]
        direction LR
        OB1["Home\n(Dashboard)"]
        OB2["Levies\n(Statements)"]
        OB3["Docs\n(Documents)"]
        OB4["Requests\n(Maintenance)"]
        OB5["More\n(Meetings, Profile)"]
    end

    subgraph OwnerMore["'More' Expanded"]
        direction TB
        OM1["Meetings"]
        OM2["Profile"]
        OM3["Notification Settings"]
        OM4["Logout"]
    end

    OB5 --> OwnerMore

    style OwnerTopBar fill:#02667F,stroke:#02667F,color:#fff
    style OwnerBottomNav fill:#F6F8FA,stroke:#0090B7
    style OwnerMore fill:#F6F8FA,stroke:#0090B7
```

## 6. Feature Module Dependency Map

Shows how feature modules depend on each other. The Scheme & Lot Register is the foundational layer upon which all other features are built.

```mermaid
flowchart BT
    subgraph Foundation["Foundation Layer"]
        AUTH["Authentication\n& User Management\n(Supabase Auth)"]
        SLR["Scheme & Lot Register\n(schemes, lots, owners,\nlot_ownerships, tenants)"]
    end

    subgraph Core["Core Feature Layer"]
        LEVY["Levy Management\n(notices, payments,\narrears tracking)"]
        TRUST["Trust Accounting\n(ledger, transactions,\nreconciliation)"]
        DOCS["Document Storage\n(upload, categorise,\n7-year retention)"]
    end

    subgraph Operational["Operational Feature Layer"]
        MEET["Meeting Administration\n(AGM/SGM, notices,\nminutes, resolutions)"]
        MAINT["Maintenance Requests\n(submit, assign,\ntrack, photos)"]
        REPORT["Financial Reporting\n(levy roll, fund balance,\nbudget vs actual)"]
    end

    subgraph Portal["Owner Portal Layer"]
        PORTAL["Owner Portal\n(dashboard, levy info,\ndocuments, maintenance,\nmeetings, profile)"]
    end

    subgraph UI["UI Framework (Cross-cutting)"]
        MOBILE["Mobile UI Framework\n(shadcn/ui, Tailwind,\nresponsive, WCAG 2.1 AA)"]
    end

    %% Dependencies
    SLR --> AUTH
    LEVY --> SLR
    TRUST --> SLR
    DOCS --> SLR
    MEET --> SLR
    MEET --> DOCS
    MAINT --> SLR
    REPORT --> LEVY
    REPORT --> TRUST
    PORTAL --> LEVY
    PORTAL --> DOCS
    PORTAL --> MAINT
    PORTAL --> MEET

    %% UI is cross-cutting
    MOBILE -.-> PORTAL
    MOBILE -.-> Core
    MOBILE -.-> Operational

    style Foundation fill:#02667F,stroke:#02667F,color:#fff
    style Core fill:#F6F8FA,stroke:#10B981
    style Operational fill:#F6F8FA,stroke:#F59E0B
    style Portal fill:#F6F8FA,stroke:#0090B7
    style UI fill:#F6F8FA,stroke:#6B7280
```

## 7. Route Map (Complete)

All application routes organised by portal type and access level.

```mermaid
flowchart TD
    subgraph Public["Public Routes (No Auth)"]
        PUB1["/ - Landing page"]
        PUB2["/pricing - Pricing calculator"]
        PUB3["/login - Manager login"]
        PUB4["/portal/login - Owner login"]
        PUB5["/auth/callback - Magic link callback"]
    end

    subgraph Manager["Manager Routes (Auth + Role: manager/admin)"]
        MGR1["/dashboard"]
        MGR2["/dashboard/schemes/**"]
        MGR3["/dashboard/levies/**"]
        MGR4["/dashboard/trust/**"]
        MGR5["/dashboard/meetings/**"]
        MGR6["/dashboard/maintenance/**"]
        MGR7["/dashboard/documents/**"]
        MGR8["/dashboard/reports/**"]
        MGR9["/dashboard/settings/**"]
    end

    subgraph Owner["Owner Routes (Auth + owners.auth_user_id)"]
        OWN1["/portal"]
        OWN2["/portal/levies"]
        OWN3["/portal/documents"]
        OWN4["/portal/maintenance/**"]
        OWN5["/portal/meetings"]
        OWN6["/portal/profile"]
    end

    subgraph API["API Routes"]
        API1["/api/portal/auth/**"]
        API2["/api/portal/dashboard"]
        API3["/api/portal/levy/**"]
        API4["/api/portal/documents/**"]
        API5["/api/portal/maintenance/**"]
        API6["/api/portal/meetings/**"]
        API7["/api/portal/profile/**"]
        API8["/api/webhooks/stripe"]
    end

    style Public fill:#F6F8FA,stroke:#6B7280
    style Manager fill:#F6F8FA,stroke:#02667F
    style Owner fill:#F6F8FA,stroke:#0090B7
    style API fill:#F6F8FA,stroke:#10B981
```

## 8. Scheme Context Switching

How the scheme context switcher works across the manager portal navigation.

```mermaid
flowchart TD
    subgraph Switcher["Scheme Switcher Component"]
        SW1["Current: Sunset Gardens ▼"]
        SW2["Search schemes..."]
        SW3["Recently Viewed (top 5)"]
        SW4["Favourites (starred)"]
        SW5["All Schemes link"]
    end

    subgraph Context["Scheme Context Effect"]
        CX1["Dashboard scoped to scheme"]
        CX2["Levy roll filtered to scheme"]
        CX3["Trust ledger filtered to scheme"]
        CX4["Meetings filtered to scheme"]
        CX5["Maintenance filtered to scheme"]
        CX6["Documents filtered to scheme"]
    end

    subgraph Persistence["Context Persistence"]
        PS1["localStorage: lastViewedSchemeId"]
        PS2["URL params: /dashboard?scheme=uuid"]
        PS3["Restored on next login"]
    end

    Switcher --> Context
    Switcher --> Persistence

    style Switcher fill:#0090B7,stroke:#0090B7,color:#fff
    style Context fill:#F6F8FA,stroke:#02667F
    style Persistence fill:#F6F8FA,stroke:#6B7280
```

## 9. Information Hierarchy

The conceptual information hierarchy showing how data is structured from organisation down to individual transactions.

```mermaid
flowchart TD
    ORG["Organisation\n(Sarah's Strata Management)"]
    ORG --> SCH1["Scheme: Sunset Gardens\nSP 12345 | 15 lots"]
    ORG --> SCH2["Scheme: Ocean View\nSP 67890 | 24 lots"]
    ORG --> SCH3["Scheme: Parkside Apts\nSP 11111 | 8 lots"]

    SCH1 --> LOT1["Lot 1 - Unit 1\nEntitlement: 5"]
    SCH1 --> LOT2["Lot 2 - Unit 2\nEntitlement: 5"]
    SCH1 --> LOTN["... Lot 15"]

    LOT1 --> OWN1["Owner: J. Smith\njohn@example.com"]
    LOT1 --> LEV1["Levies: $625/qtr\nAdmin: $500 | CW: $125"]
    LOT1 --> TXN1["Transactions:\nPayments, notices, arrears"]

    LOT2 --> OWN2["Owner: M. Jones\nmjones@example.com"]
    LOT2 --> OWN3["Co-owner: P. Jones\n(joint tenants)"]

    SCH1 --> MEET["Meetings:\nAGM 2026, SGM Oct 2025"]
    SCH1 --> DOCS["Documents:\nBy-laws, Insurance, Minutes"]
    SCH1 --> MAINT["Maintenance:\n3 open requests"]
    SCH1 --> TRUST["Trust Account:\nAdmin Fund, CW Fund"]

    style ORG fill:#02667F,stroke:#02667F,color:#fff
    style SCH1 fill:#0090B7,stroke:#0090B7,color:#fff
    style SCH2 fill:#0090B7,stroke:#0090B7,color:#fff
    style SCH3 fill:#0090B7,stroke:#0090B7,color:#fff
    style LOT1 fill:#F6F8FA,stroke:#02667F
    style LOT2 fill:#F6F8FA,stroke:#02667F
    style LOTN fill:#F6F8FA,stroke:#02667F
```
