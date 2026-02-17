# Meeting Administration Workflows

Diagrams for the meeting administration feature (AGM, SGM, committee meetings). Covers meeting lifecycle states, AGM end-to-end workflow, proxy voting flow, and AGM pack generation (cross-feature integration).

Reference: [Feature 05 - Meeting Administration](../features/05-meeting-administration.md)

---

## 1. Meeting Status State Diagram

Shows the lifecycle of a meeting from draft through completion, adjournment, or cancellation.

```mermaid
stateDiagram-v2
    [*] --> draft : Manager creates meeting

    draft --> scheduled : Set date, time, location
    draft --> cancelled : Manager cancels

    scheduled --> notice_sent : Generate & send notices to owners
    scheduled --> cancelled : Manager cancels before notice

    notice_sent --> in_progress : Meeting commences (quorum met)
    notice_sent --> adjourned : Quorum not met at start
    notice_sent --> cancelled : Manager cancels after notice

    in_progress --> completed : All agenda items resolved,\nmeeting closed
    in_progress --> adjourned : Quorum lost during meeting

    adjourned --> scheduled : Reschedule to new date\n(7 days later, same time/place)

    completed --> [*]
    cancelled --> [*]

    note right of draft
        Meeting type: agm / sgm / committee
        Notice periods: AGM=21d, SGM=14d, Committee=7d
    end note

    note right of adjourned
        WA default: adjourned meeting
        held 7 days later, no quorum
        required for adjourned meeting
    end note
```

---

## 2. AGM Workflow Sequence Diagram

End-to-end sequence for running an Annual General Meeting, from creation through minutes publication.

```mermaid
sequenceDiagram
    actor Manager
    participant System as LevyLite
    participant Owners
    participant Chair as Chairperson

    rect rgb(240, 248, 255)
        note over Manager, System: Phase 1 - Preparation
        Manager->>System: Create meeting (type=agm, date, location)
        System-->>Manager: Meeting created (status=draft)
        Manager->>System: Add agenda items (standard + custom motions)
        System-->>Manager: Agenda saved with item order
        Manager->>System: Generate AGM pack (financials + budget)
        System->>System: Pull financial statements from reporting module
        System->>System: Generate notice PDF with agenda
        System->>System: Generate proxy forms (pre-filled per owner)
        System-->>Manager: AGM pack ready for review
    end

    rect rgb(255, 248, 240)
        note over Manager, Owners: Phase 2 - Notice Distribution
        Manager->>System: Send notices to all owners
        System->>Owners: Email: AGM notice + proxy form + financials
        System-->>Manager: Notice sent (status=notice_sent)
        System->>System: Log delivery per owner (timestamp, email status)
    end

    rect rgb(240, 255, 240)
        note over Manager, Owners: Phase 3 - Proxy Collection
        Owners-->>Manager: Return proxy forms (email/mail)
        Manager->>System: Register proxy (owner, proxy holder, type)
        System->>System: Validate 5% proxy limit per holder
        System-->>Manager: Proxy registered (or rejected if limit exceeded)
    end

    rect rgb(248, 240, 255)
        note over Manager, Chair: Phase 4 - Meeting Day
        Manager->>System: Mark owners present (attendance check-in)
        System->>System: Calculate quorum (present + proxies vs 30%)
        alt Quorum met
            System-->>Manager: Quorum met - proceed
            Manager->>System: Update status to in_progress
            loop Each agenda item
                Manager->>System: Record resolution (motion, moved_by, seconded_by)
                Manager->>System: Enter votes (for, against, abstain)
                System->>System: Calculate result (ordinary >50%, special >=75%)
                System-->>Manager: Resolution result (carried/defeated)
            end
            Manager->>System: Close meeting (status=completed)
        else Quorum not met
            Manager->>System: Adjourn meeting
            System->>System: Create new meeting (date + 7 days)
            System->>Owners: Email: Meeting adjourned to [new date]
        end
    end

    rect rgb(255, 255, 240)
        note over Manager, Chair: Phase 5 - Minutes & Approval
        Manager->>System: Generate draft minutes
        System->>System: Auto-populate from attendance,\nresolutions, vote counts
        System-->>Manager: Draft minutes PDF (status=draft)
        Manager->>System: Review and edit custom sections
        Manager->>System: Mark as manager_reviewed
        System->>Chair: Email: Please review and approve minutes
        Chair->>System: Approve minutes (upload signed PDF)
        System-->>Manager: Minutes approved (status=approved)
        Manager->>System: Publish minutes
        System->>System: Store in document storage (7-year retention)
        System->>Owners: Minutes available in owner portal
    end
```

---

## 3. Proxy Voting Flow

Shows how proxy voting works from form generation through vote casting, including the WA 5% limit enforcement.

```mermaid
flowchart TD
    A[Manager creates AGM] --> B[System generates proxy forms<br/>pre-filled per owner]
    B --> C[Proxy forms sent with<br/>AGM notice to all owners]

    C --> D{Owner attending<br/>in person?}
    D -->|Yes| E[Owner attends meeting<br/>votes directly]
    D -->|No| F[Owner completes proxy form]

    F --> G{Proxy type?}
    G -->|Open / undirected| H[Proxy holder votes<br/>at their discretion]
    G -->|Directed| I[Owner specifies votes<br/>per agenda item]

    H --> J[Owner submits proxy form<br/>to manager before deadline]
    I --> J

    J --> K[Manager registers proxy<br/>in system]
    K --> L{5% limit check<br/>for proxy holder}

    L -->|Within limit| M[Proxy registered<br/>is_valid = true]
    L -->|Exceeds limit| N[Proxy rejected<br/>ERROR: holder at max proxies]

    M --> O{Owner arrives<br/>in person on day?}
    O -->|Yes| P[Proxy voided<br/>owner votes directly]
    O -->|No| Q[Proxy holder attends<br/>votes on behalf of owner]

    Q --> R{Directed proxy?}
    R -->|Yes| S[Must vote per<br/>owner instructions]
    R -->|No| T[Votes at proxy<br/>holder discretion]

    E --> U[Votes counted in<br/>resolution recording]
    S --> U
    T --> U
    P --> U

    style N fill:#ffcccc,stroke:#cc0000
    style M fill:#ccffcc,stroke:#00cc00
    style P fill:#ffffcc,stroke:#cccc00
```

---

## 4. AGM Pack Generation (Cross-Feature Integration)

Shows how the AGM pack brings together documents from meeting administration, financial reporting, and document storage.

```mermaid
flowchart LR
    subgraph meeting["Meeting Administration"]
        M1[Create AGM] --> M2[Build agenda<br/>standard + custom items]
        M2 --> M3[Generate meeting notice PDF]
        M2 --> M4[Generate proxy form PDFs]
        M2 --> M5[Generate nomination forms]
    end

    subgraph financial["Financial Reporting"]
        F1[Admin fund statement] --> F3[Financial statements PDF]
        F2[Capital works fund statement] --> F3
        F4[Budget proposal<br/>next FY] --> F5[Budget report PDF]
    end

    subgraph docstore["Document Storage"]
        D1[(Supabase Storage<br/>scheme-documents bucket)]
        D2[documents table<br/>linked_entity_type = meeting]
    end

    M3 --> AGM_PACK
    M4 --> AGM_PACK
    M5 --> AGM_PACK
    F3 --> AGM_PACK
    F5 --> AGM_PACK

    AGM_PACK["AGM Pack<br/>(combined PDF bundle)"]

    AGM_PACK --> D1
    AGM_PACK --> D2

    D2 --> SEND[Send notices to owners<br/>email with PDF attachments]

    SEND --> AUDIT[Document audit log<br/>7-year retention tracking]

    style meeting fill:#e6f3ff,stroke:#0066cc
    style financial fill:#fff3e6,stroke:#cc6600
    style docstore fill:#e6ffe6,stroke:#00cc00
    style AGM_PACK fill:#f0e6ff,stroke:#6600cc
```

---

## 5. Minutes Approval Workflow

Shows the status progression of meeting minutes from auto-generation through publication.

```mermaid
stateDiagram-v2
    [*] --> draft : System auto-generates\nfrom meeting data

    draft --> manager_reviewed : Manager edits custom sections\n(correspondence, discussion notes)

    manager_reviewed --> pending_approval : System emails chairperson\nfor review

    pending_approval --> approved : Chairperson signs\n(digital signature or uploaded PDF)
    pending_approval --> manager_reviewed : Chairperson requests changes

    approved --> published : Manager clicks Publish\n(visible in owner portal)

    published --> [*]

    note right of draft
        Auto-populated:
        - Attendance list
        - Vote counts
        - Resolution outcomes
        Cannot be edited (audit trail)
    end note

    note right of published
        Stored in document storage
        linked_entity_type = meeting
        7-year retention applies
        Owner-accessible = true
    end note
```
