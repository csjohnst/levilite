# Maintenance Request Workflows

Diagrams for the maintenance request tracking feature. Covers request lifecycle states, the full request-to-payment sequence, and integration with trust accounting.

Reference: [Feature 06 - Maintenance Requests](../features/06-maintenance-requests.md)

---

## 1. Maintenance Request Status State Diagram

Shows all valid status transitions for a maintenance request, including the emergency bypass path and quote approval routing.

```mermaid
stateDiagram-v2
    [*] --> new : Owner or manager\nsubmits request

    new --> acknowledged : Manager reviews request
    new --> assigned : Manager assigns tradesperson\n(skip acknowledge)
    new --> closed : Spam / duplicate / no action

    acknowledged --> assigned : Manager selects tradesperson\nfrom directory
    acknowledged --> closed : No action needed

    assigned --> in_progress : Tradesperson begins work\n(emergency bypass, no quote)
    assigned --> quoted : Tradesperson provides quote
    assigned --> closed : Tradesperson declined

    quoted --> approved : Quote approved\n(manager or committee)
    quoted --> closed : Quote rejected

    approved --> in_progress : Work authorised,\ntradesperson begins

    in_progress --> completed : Work finished,\ninvoice attached
    in_progress --> quoted : Quote needed mid-work\n(scope change)

    completed --> closed : Final review,\nrequest archived

    closed --> new : Reopen if issue recurs

    note right of new
        Priority levels:
        emergency (2h ack / 24h resolve)
        urgent (24h ack / 7d resolve)
        routine (3d ack / 30d resolve)
        cosmetic (7d ack / 90d resolve)
    end note

    note left of quoted
        Threshold-based approval:
        Below threshold: manager approves
        Above threshold: committee approval
        (configurable per scheme)
    end note

    note right of in_progress
        Emergency requests can skip
        quoted/approved states.
        Post-facto approval documented
        in notes.
    end note
```

---

## 2. Maintenance Request Sequence Diagram

Full lifecycle from owner submission through invoice payment, showing all participants and system interactions.

```mermaid
sequenceDiagram
    actor Owner
    participant System as LevyLite
    actor Manager
    actor Tradesperson
    actor Committee
    participant Trust as Trust Accounting

    rect rgb(240, 248, 255)
        note over Owner, System: Phase 1 - Submission
        Owner->>System: Submit maintenance request<br/>(subject, description, photos, priority)
        System-->>Owner: Email confirmation with request ID
        System->>Manager: Notification: new request received
        System->>System: Set SLA targets based on priority
    end

    rect rgb(255, 248, 240)
        note over Manager, System: Phase 2 - Triage & Assignment
        Manager->>System: Review request, set responsibility<br/>(common_property / lot_owner)
        Manager->>System: Acknowledge request (status=acknowledged)
        System->>Owner: Email: request acknowledged
        Manager->>System: Assign tradesperson from directory<br/>(preferred vendors shown first)
        System->>System: Update status to assigned
        System->>Tradesperson: Email: new job assigned<br/>(request details, photos, contact)
        System->>Owner: Email: tradesperson assigned
    end

    rect rgb(240, 255, 240)
        note over Manager, Tradesperson: Phase 3 - Quote & Approval
        Tradesperson-->>Manager: Provides quote (PDF or verbal)
        Manager->>System: Upload quote (amount, PDF, tradesperson)
        System->>System: Update status to quoted

        alt Quote below threshold
            Manager->>System: Approve quote directly
            System->>System: approval_status = approved
        else Quote above threshold
            System->>Committee: Email: quote requires approval<br/>(amount, PDF, request details)
            Committee-->>Manager: Approve or reject via email
            Manager->>System: Record committee decision
        end

        alt Quote approved
            System->>System: Update status to approved
            System->>Tradesperson: Email: work approved, proceed
            System->>Owner: Email: quote approved, work scheduled
        else Quote rejected
            System->>Tradesperson: Email: quote not accepted
            Manager->>System: Add rejection reason
        end
    end

    rect rgb(248, 240, 255)
        note over Manager, Tradesperson: Phase 4 - Work Completion
        Tradesperson-->>Manager: Work completed
        Manager->>System: Update status to in_progress
        Manager->>System: Upload progress/completion photos
        Manager->>System: Mark as completed
        System->>System: Update status to completed, set completed_at
        System->>Owner: Email: work completed
    end

    rect rgb(255, 255, 240)
        note over Manager, Trust: Phase 5 - Invoice & Payment
        Tradesperson-->>Manager: Provides invoice (PDF)
        Manager->>System: Upload invoice<br/>(amount, invoice number, PDF)
        System->>System: Validate: warn if >10% variance from quote
        Manager->>System: Pay invoice (select fund, category)
        System->>Trust: Create transaction record<br/>(type=payment, category=maintenance)
        Trust-->>System: Transaction recorded,<br/>invoice.payment_reference linked
        System->>System: invoices.paid_at = NOW()
        Manager->>System: Close request (status=closed)
        System->>Owner: Email: request closed
    end
```

---

## 3. Maintenance to Trust Accounting Integration

Shows how maintenance invoice payments flow into the trust accounting ledger, creating the financial audit trail.

```mermaid
flowchart TD
    subgraph maintenance["Maintenance Request Module"]
        MR[Maintenance Request<br/>status = completed] --> INV[Invoice uploaded<br/>amount, PDF, invoice_number]
        INV --> PAY{Manager clicks<br/>Pay Invoice}
    end

    PAY --> MODAL[Payment Modal<br/>pre-filled from invoice]

    subgraph modal_fields["Payment Details"]
        MODAL --> AMT[Amount: from invoice total]
        MODAL --> FUND[Fund: admin or capital_works]
        MODAL --> CAT[Category: auto-selected<br/>from trade type]
        MODAL --> REF[Reference / notes]
    end

    AMT --> CONFIRM[Manager confirms payment]
    FUND --> CONFIRM
    CAT --> CONFIRM
    REF --> CONFIRM

    subgraph trust["Trust Accounting Module"]
        CONFIRM --> TXN["Create transaction record<br/>type = payment<br/>category_id from chart_of_accounts<br/>fund_type = admin or capital_works"]
        TXN --> LINES["Auto-create transaction lines<br/>DEBIT: expense account (e.g. 6110 Plumbing)<br/>CREDIT: trust account (1100 Admin / 1200 CW)"]
        LINES --> LEDGER[(Trust Accounting Ledger<br/>transactions table)]
    end

    subgraph update["Update Maintenance Records"]
        CONFIRM --> PAID["invoices.paid_at = NOW()<br/>invoices.payment_reference = txn.id"]
        PAID --> STATUS["Request status updated<br/>if all invoices paid"]
    end

    LEDGER --> REPORTS[Financial Reports<br/>Maintenance cost analysis<br/>Budget vs actual]

    style maintenance fill:#e6f3ff,stroke:#0066cc
    style trust fill:#fff3e6,stroke:#cc6600
    style update fill:#e6ffe6,stroke:#00cc00
    style REPORTS fill:#f0e6ff,stroke:#6600cc
```

---

## 4. Quote Approval Threshold Routing

Shows how quote amounts are routed to the appropriate approver based on per-scheme thresholds.

```mermaid
flowchart TD
    A[Tradesperson provides quote] --> B[Manager uploads quote<br/>to maintenance request]
    B --> C{Quote amount vs<br/>scheme threshold}

    C -->|"Below threshold<br/>(e.g. < $1,000)"| D[Manager Approval]
    C -->|"At or above threshold<br/>(e.g. >= $1,000)"| E[Committee Approval Required]

    D --> F[Manager clicks Approve Quote]
    F --> G[approval_status = approved<br/>approved_by = manager_id]

    E --> H[System flags quote as<br/>Pending Committee Approval]
    H --> I[Manager sends details<br/>to committee email list]
    I --> J{Committee decision}

    J -->|Approve| K[Manager records approval<br/>approved_by = committee_ref]
    J -->|Reject| L[Manager records rejection<br/>with reason]

    G --> M[Status -> approved<br/>Notify tradesperson: proceed]
    K --> M

    L --> N[Status remains quoted<br/>Manager may seek<br/>alternative quote]
    N --> O{Source new quote?}
    O -->|Yes| A
    O -->|No| P[Close request<br/>quote rejected]

    style D fill:#ccffcc,stroke:#00cc00
    style E fill:#ffffcc,stroke:#cccc00
    style L fill:#ffcccc,stroke:#cc0000
    style M fill:#ccffcc,stroke:#00cc00
```

---

## 5. SLA Tracking States

Shows how SLA status is calculated based on priority targets and elapsed time.

```mermaid
flowchart LR
    subgraph priority["Priority SLA Targets"]
        P1["Emergency<br/>Ack: 2h / Resolve: 24h"]
        P2["Urgent<br/>Ack: 24h / Resolve: 7d"]
        P3["Routine<br/>Ack: 3d / Resolve: 30d"]
        P4["Cosmetic<br/>Ack: 7d / Resolve: 90d"]
    end

    subgraph tracking["SLA Status Calculation"]
        T1{"Acknowledged?"}
        T1 -->|"No, within target"| S1["on_track"]
        T1 -->|"No, past target"| S2["overdue_acknowledgment"]
        T1 -->|"Yes"| T2{"Completed?"}
        T2 -->|"No, within target"| S1
        T2 -->|"No, past target"| S3["overdue_resolution"]
        T2 -->|"Yes, within target"| S4["met"]
        T2 -->|"Yes, past target"| S5["breached"]
    end

    P1 --> tracking
    P2 --> tracking
    P3 --> tracking
    P4 --> tracking

    S2 --> ALERT["Manager notification:<br/>overdue request alert"]
    S3 --> ALERT

    style S1 fill:#ccffcc,stroke:#00cc00
    style S2 fill:#ffcccc,stroke:#cc0000
    style S3 fill:#ffcccc,stroke:#cc0000
    style S4 fill:#ccffcc,stroke:#00cc00
    style S5 fill:#ffcccc,stroke:#cc0000
    style ALERT fill:#ffffcc,stroke:#cccc00
```
