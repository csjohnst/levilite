# Cross-Feature Integration Overview

High-level integration diagrams showing how all LevyLite features connect, how data flows between modules, and how shared infrastructure underpins the platform.

---

## 1. Feature Integration Map

Shows all major features and their integration points. Arrows indicate data flow direction.

```mermaid
flowchart TD
    subgraph foundation["Foundation"]
        AUTH["Supabase Auth\n(magic link, sessions, JWT)"]
        ORG["Organisation &\nMulti-Tenancy\n(organisations, organisation_users)"]
        SLR["Scheme & Lot Register\n(schemes, lots, owners,\nlot_ownerships, committee_members)"]
    end

    subgraph financial["Financial Domain"]
        LEVY["Levy Management\n(levy_schedules, levy_periods,\nlevy_items)"]
        TRUST["Trust Accounting\n(transactions, transaction_lines,\nchart_of_accounts)"]
        BUDGET["Budgets & Reporting\n(budgets, budget_line_items,\nfinancial_years)"]
        RECON["Bank Reconciliation\n(bank_statements,\nreconciliations)"]
    end

    subgraph operations["Operations"]
        MEET["Meeting Administration\n(meetings, agenda_items,\nresolutions, minutes)"]
        MAINT["Maintenance Tracking\n(maintenance_requests,\nquotes, invoices)"]
    end

    subgraph content["Content & Communication"]
        DOCS["Document Storage\n(documents, document_versions,\ndocument_audit_log)"]
        EMAIL["Email Service\n(email_log via Resend)"]
        NOTIFY["Notifications\n(notifications table)"]
    end

    subgraph portal["Owner Portal"]
        PORTAL["Owner Self-Service\n(levy view, documents,\nmaintenance, meetings)"]
    end

    subgraph system["System"]
        AUDIT["Audit Log\n(audit_log table,\ntriggers on all tables)"]
    end

    subgraph billing["Subscription & Billing"]
        BILLING["Stripe Billing\n(subscriptions,\nper-lot pricing)"]
        PLANS["Plan & Feature Gating\n(subscription_plans.features JSONB,\nlot/scheme limits)"]
    end

    %% Foundation dependencies
    ORG --> AUTH
    SLR --> ORG

    %% Financial domain
    LEVY --> SLR
    TRUST --> SLR
    BUDGET --> SLR
    RECON --> TRUST

    %% Levy <-> Trust integration
    LEVY -->|"levy payments create\ntransactions (receipts)\nvia payment_allocations"| TRUST
    BUDGET -->|"approved budget totals\nflow to levy_schedules"| LEVY
    BUDGET -->|"budget vs actual compares\nbudget_line_items to transactions"| TRUST

    %% Maintenance -> Trust integration
    MAINT -->|"invoice payments create\ntransactions (payments)\nvia invoices.payment_reference"| TRUST

    %% Meeting integrations
    MEET --> SLR
    MEET -->|"AGM pack pulls\nfinancial statements"| BUDGET
    MEET -->|"proxy voting uses\nowners + lot_ownerships"| SLR

    %% Maintenance integrations
    MAINT --> SLR
    MAINT -->|"tradesperson directory\nscoped to organisation"| ORG

    %% Document integrations (polymorphic links)
    LEVY -->|"levy notice PDFs stored\nlinked_entity_type = levy"| DOCS
    MEET -->|"AGM notices, minutes stored\nlinked_entity_type = meeting"| DOCS
    MAINT -->|"quotes, invoices, photos stored\nlinked_entity_type = maintenance_request"| DOCS
    BUDGET -->|"EOFY reports stored\nlinked_entity_type = financial_report"| DOCS

    %% Email integrations
    LEVY -->|"send levy notices"| EMAIL
    MEET -->|"send meeting notices"| EMAIL
    MAINT -->|"status update emails"| EMAIL
    PORTAL -->|"magic link login\nportal invitations"| EMAIL

    %% Portal integrations
    PORTAL --> LEVY
    PORTAL --> DOCS
    PORTAL --> MAINT
    PORTAL --> MEET
    PORTAL --> AUTH

    %% Audit covers everything
    TRUST --> AUDIT
    LEVY --> AUDIT
    SLR --> AUDIT
    MEET --> AUDIT
    MAINT --> AUDIT

    %% Billing & Subscription
    BILLING --> ORG
    PLANS -->|"subscription status gates\nwrite access via RLS"| SLR
    PLANS -->|"feature gating via\nsubscription_plans.features JSONB"| financial
    SLR -->|"lot count changes\nsync to Stripe"| BILLING

    style foundation fill:#e8eef5,stroke:#1e3a5f
    style financial fill:#e8f5e9,stroke:#2e7d32
    style operations fill:#fff3e0,stroke:#e65100
    style content fill:#f3e5f5,stroke:#6a1b9a
    style portal fill:#e1f5fe,stroke:#0277bd
    style system fill:#f5f5f5,stroke:#616161
    style billing fill:#e0f2f1,stroke:#00695c
```

---

## 2. Data Flow: Levy Payment End-to-End

Shows how a single levy payment flows through the entire system, touching levy management, trust accounting, document storage, and the owner portal.

```mermaid
flowchart LR
    subgraph trigger["Trigger"]
        A["Manager records\nlevy payment"]
    end

    subgraph trust["Trust Accounting"]
        B["INSERT transactions\n(type=receipt, fund=admin)"]
        C["Trigger: auto_create_transaction_lines\nDEBIT 1100 Trust Account\nCREDIT 4100 Levy Income"]
    end

    subgraph levy["Levy Management"]
        D["INSERT payment_allocations\n(transaction_id, levy_item_id)"]
        E["Trigger: auto_update_levy_paid\nSUM(allocations) -> amount_paid"]
        F["Trigger: auto_update_levy_status\npaid | partial | overdue"]
    end

    subgraph audit["System"]
        G["Trigger: log_audit\naudit_log record created"]
    end

    subgraph portal["Owner Portal"]
        H["Owner sees updated\nlevy balance on dashboard"]
    end

    A --> B --> C
    B --> D --> E --> F
    B --> G
    F --> H

    style trigger fill:#e1f5fe
    style trust fill:#c8e6c9
    style levy fill:#fff9c4
    style audit fill:#f5f5f5
    style portal fill:#e1f5fe
```

---

## 3. Data Flow: Maintenance Invoice Payment

Shows how paying a maintenance invoice creates a trust accounting transaction and updates the maintenance record.

```mermaid
flowchart LR
    subgraph trigger["Trigger"]
        A["Manager clicks\nPay Invoice"]
    end

    subgraph trust["Trust Accounting"]
        B["INSERT transactions\n(type=payment, fund=admin,\ncategory=6110 Plumbing)"]
        C["Trigger: auto_create_transaction_lines\nDEBIT 6110 Maintenance\nCREDIT 1100 Trust Account"]
    end

    subgraph maint["Maintenance"]
        D["UPDATE invoices\npayment_reference = txn.id\npaid_at = NOW()"]
    end

    subgraph docs["Document Storage"]
        E["Invoice PDF already stored\nlinked_entity_type =\nmaintenance_request"]
    end

    subgraph audit["System"]
        F["audit_log records\ntransaction + invoice update"]
    end

    A --> B --> C
    A --> D
    D -.-> E
    B --> F
    D --> F

    style trigger fill:#e1f5fe
    style trust fill:#c8e6c9
    style maint fill:#fff3e0
    style docs fill:#f3e5f5
    style audit fill:#f5f5f5
```

---

## 4. Data Flow: AGM Pack Generation

Shows how the AGM pack brings together data from meeting administration, financial reporting, and document storage.

```mermaid
flowchart TD
    subgraph meeting["Meeting Administration"]
        M1["Create AGM\n(meetings table)"]
        M2["Build agenda\n(agenda_items table)"]
        M3["Generate notice PDF"]
        M4["Generate proxy forms\n(per owner via lot_ownerships)"]
    end

    subgraph financial["Financial Reporting"]
        F1["Generate income statement\n(from transactions)"]
        F2["Generate fund balance\n(from transactions)"]
        F3["Generate budget vs actual\n(budgets vs transactions)"]
        F4["Generate levy roll\n(from levy_items)"]
    end

    subgraph docs["Document Storage"]
        D1["Store all PDFs\n(Supabase Storage)"]
        D2["Create documents records\nlinked_entity_type = meeting\nlinked_entity_id = meeting.id"]
    end

    subgraph email["Email Delivery"]
        E1["Send AGM pack to all owners\n(via Resend API)"]
        E2["Log delivery in email_log"]
    end

    M1 --> M2
    M2 --> M3
    M2 --> M4

    F1 --> AGM["AGM Pack\n(combined PDF bundle)"]
    F2 --> AGM
    F3 --> AGM
    F4 --> AGM
    M3 --> AGM
    M4 --> AGM

    AGM --> D1
    AGM --> D2
    D2 --> E1
    E1 --> E2

    style meeting fill:#e6f3ff,stroke:#0066cc
    style financial fill:#e8f5e9,stroke:#2e7d32
    style docs fill:#f3e5f5,stroke:#6a1b9a
    style email fill:#fff3e0,stroke:#e65100
    style AGM fill:#fff9c4,stroke:#f9a825
```

---

## 5. Shared Infrastructure

Shows how shared Supabase services and external providers are consumed by all features.

```mermaid
flowchart TD
    subgraph supabase["Supabase Cloud"]
        SA["Supabase Auth\n(JWT, magic links, sessions)"]
        PG["PostgreSQL\n(44 tables, RLS on all)"]
        SS["Supabase Storage\n(S3-compatible, private buckets)"]
    end

    subgraph external["External Services"]
        RESEND["Resend\n(transactional email)"]
        STRIPE["Stripe\n(subscription billing)"]
        SENTRY["Sentry\n(error tracking)"]
    end

    subgraph consumers["Feature Consumers"]
        direction LR
        C1["Auth & Login"]
        C2["Scheme Register"]
        C3["Levy Management"]
        C4["Trust Accounting"]
        C5["Meeting Admin"]
        C6["Maintenance"]
        C7["Document Storage"]
        C8["Owner Portal"]
        C9["Billing"]
    end

    SA -->|"auth.uid() in every query"| C1
    SA -->|"magic link login"| C8

    PG -->|"RLS-filtered queries"| C2
    PG -->|"RLS-filtered queries"| C3
    PG -->|"RLS-filtered queries"| C4
    PG -->|"RLS-filtered queries"| C5
    PG -->|"RLS-filtered queries"| C6
    PG -->|"RLS-filtered queries"| C7
    PG -->|"RLS-filtered queries"| C8

    SS -->|"document files"| C7
    SS -->|"levy notice PDFs"| C3
    SS -->|"maintenance photos"| C6
    SS -->|"meeting documents"| C5

    RESEND -->|"levy notices"| C3
    RESEND -->|"meeting notices"| C5
    RESEND -->|"status updates"| C6
    RESEND -->|"portal invitations"| C8

    STRIPE -->|"subscription management"| C9

    SENTRY -->|"error reports"| consumers

    style supabase fill:#e8f5e9,stroke:#2e7d32
    style external fill:#f5f5f5,stroke:#616161
    style consumers fill:#e1f5fe,stroke:#0277bd
```

---

## 6. Audit Trail Coverage

Shows which tables have audit triggers and how all critical actions are captured in the `audit_log` table.

```mermaid
flowchart TD
    subgraph audited["Tables with Audit Triggers"]
        A1["schemes"]
        A2["lots"]
        A3["owners"]
        A4["transactions"]
        A5["levy_items"]
        A6["meetings"]
    end

    subgraph log["audit_log Table"]
        AL["user_id, action (INSERT/UPDATE/DELETE),\ntable_name, record_id,\nold_values (JSONB), new_values (JSONB),\nip_address, created_at"]
    end

    subgraph doc_audit["Document-Specific Audit"]
        DA["document_audit_log\naction: view | download | upload | delete\nuser_id, ip_address, user_agent"]
    end

    A1 -->|"log_audit() trigger"| AL
    A2 -->|"log_audit() trigger"| AL
    A3 -->|"log_audit() trigger"| AL
    A4 -->|"log_audit() trigger"| AL
    A5 -->|"log_audit() trigger"| AL
    A6 -->|"log_audit() trigger"| AL

    DOC["documents"] -->|"per-access tracking"| DA

    subgraph access["Who Can View Audit Logs"]
        R1["manager: full audit_log access"]
        R2["admin: limited audit_log access"]
        R3["auditor: read-only audit_log (financial tables)"]
    end

    AL --> access
    DA --> access

    style audited fill:#fff9c4
    style log fill:#e8f5e9
    style doc_audit fill:#f3e5f5
    style access fill:#f5f5f5
```

---

## 7. Cross-Feature Entity Relationship Summary

Shows key cross-domain foreign key relationships that connect feature areas.

```mermaid
flowchart LR
    subgraph core["Core Domain"]
        ORG["organisations"]
        SCH["schemes"]
        LOT["lots"]
        OWN["owners"]
    end

    subgraph financial["Financial Domain"]
        TXN["transactions"]
        LI["levy_items"]
        PA["payment_allocations"]
        COA["chart_of_accounts"]
    end

    subgraph meetings["Meeting Domain"]
        MTG["meetings"]
        ATT["attendees"]
        RES["resolutions"]
    end

    subgraph maintenance["Maintenance Domain"]
        MR["maintenance_requests"]
        INV["invoices"]
        TP["tradespeople"]
    end

    subgraph documents["Document Domain"]
        DOC["documents"]
    end

    subgraph subscription["Subscription & Billing Domain"]
        SUB["subscriptions"]
        SP["subscription_plans"]
        PE["payment_events"]
    end

    %% Core -> Financial
    SCH -->|"scheme_id"| TXN
    LOT -->|"lot_id"| LI
    TXN -->|"1:N"| PA
    LI -->|"N:1"| PA
    COA -->|"category_id"| TXN

    %% Core -> Meetings
    SCH -->|"scheme_id"| MTG
    OWN -->|"owner_id"| ATT
    OWN -->|"moved_by, seconded_by"| RES

    %% Core -> Maintenance
    SCH -->|"scheme_id"| MR
    OWN -->|"submitted_by"| MR
    ORG -->|"organisation_id"| TP
    TP -->|"assigned_to"| MR

    %% Financial <-> Maintenance
    INV -->|"payment_reference"| TXN

    %% All -> Documents (polymorphic)
    DOC -.->|"linked_entity_type\n= levy"| LI
    DOC -.->|"linked_entity_type\n= meeting"| MTG
    DOC -.->|"linked_entity_type\n= maintenance_request"| MR
    DOC -.->|"linked_entity_type\n= financial_report"| TXN

    %% Core -> Subscription
    ORG -->|"organisation_id"| SUB
    SP -->|"plan_id"| SUB
    ORG -->|"organisation_id"| PE

    style core fill:#e8eef5,stroke:#1e3a5f
    style financial fill:#e8f5e9,stroke:#2e7d32
    style meetings fill:#fff3e0,stroke:#e65100
    style maintenance fill:#ffe0e0,stroke:#c62828
    style documents fill:#f3e5f5,stroke:#6a1b9a
    style subscription fill:#e0f2f1,stroke:#00695c
```
