# Budget & Reporting Diagrams

These diagrams describe the budget lifecycle (creation through AGM approval to levy schedule generation), financial reporting flows, and budget vs actual comparison.

---

## 1. Budget Workflow

Full lifecycle of a scheme budget: from initial draft through committee review, AGM approval, and generation of the corresponding levy schedule.

```mermaid
stateDiagram-v2
    [*] --> draft : Manager creates budget\n(copy from previous year\n+ inflation adjustment)

    draft --> draft : Manager edits line items\n(update amounts, add notes)

    draft --> review : Manager shares with committee\n(read-only link emailed)

    review --> draft : Committee requests changes\n(manager updates line items)

    review --> approved : Committee approves at AGM/SGM\n(manager records resolution date)

    approved --> amended : Mid-year amendment required\n(committee resolution + reason)

    amended --> approved : Amendment recorded\n(audit trail preserved)

    approved --> levy_generated : Levy schedule generated\n(budget totals -> levy_schedules)

    levy_generated --> [*]
```

---

## 2. Budget Creation and Levy Schedule Generation (Sequence Diagram)

Shows the end-to-end flow from budget drafting to the generation of levy schedules and per-lot levy amounts.

```mermaid
sequenceDiagram
    autonumber
    actor Manager
    participant UI as LevyLite UI
    participant API as Next.js API
    participant DB as PostgreSQL

    Note over Manager, DB: Phase 1 -- Budget Drafting

    Manager->>UI: Create Budget for FY 2026/27
    UI->>API: GET previous year budget + actuals
    API->>DB: SELECT budget_line_items for FY 2025/26<br/>+ SELECT SUM(transactions.amount) by category for FY 2025/26
    DB-->>API: Previous budget + actual spend per category
    API-->>UI: Pre-populated budget editor<br/>(previous amounts + 5% inflation suggestion)

    Manager->>UI: Edit line items:<br/>Insurance: $12,000 -> $13,500<br/>Maintenance: $8,000 -> $8,000<br/>Utilities: $4,800 -> $5,200<br/>Management Fees: $6,000 -> $6,000

    UI->>API: POST /schemes/{id}/budgets (status='draft')
    API->>DB: INSERT budgets (scheme_id, financial_year_id, budget_type='admin', total_amount)
    API->>DB: INSERT budget_line_items (category_id, budgeted_amount, notes) for each line
    DB-->>API: Budget saved as draft

    Note over Manager, DB: Phase 2 -- Levy Calculator Preview

    UI->>API: GET levy preview (budget totals + lot entitlements)
    API->>DB: SELECT SUM(budgeted_amount) for admin + capital_works
    API->>DB: SELECT lots with unit_entitlement for scheme
    API-->>UI: "Admin budget: $32,700 | CW budget: $18,000<br/>Total: $50,700<br/>Levy per unit per quarter: $1,267.50<br/>(based on 10 lots, equal entitlement)"

    Note over Manager, DB: Phase 3 -- Committee Review & Approval

    Manager->>UI: Share budget with committee (email link)
    UI->>API: Generate read-only shareable link
    API-->>UI: Link sent to committee members

    Note right of Manager: Committee reviews at meeting,<br/>requests "reduce gardening by $500"

    Manager->>UI: Update line item, mark as "Approved"
    UI->>API: PATCH /budgets/{id} (status='approved', approved_at, approved_by)
    API->>DB: UPDATE budgets SET status='approved', approved_at='2026-05-15'
    DB-->>API: Budget locked

    Note over Manager, DB: Phase 4 -- Generate Levy Schedule

    Manager->>UI: Generate levy schedule from approved budget
    UI->>API: POST /schemes/{id}/levy-schedules (from budget)
    API->>DB: SELECT budgets WHERE status='approved' for FY
    API->>DB: INSERT levy_schedules<br/>(admin_fund_total = admin budget total,<br/>capital_works_fund_total = CW budget total,<br/>frequency = scheme.levy_frequency)
    API->>DB: INSERT levy_periods (Q1, Q2, Q3, Q4)
    DB-->>API: Levy schedule created from approved budget
    API-->>UI: "Levy schedule FY 2026/27 created<br/>4 quarterly periods, ready to calculate levies"
```

---

## 3. Budget Line Items to Levy Amounts

Shows how approved budget line items aggregate into fund totals, which then flow into the levy calculation engine.

```mermaid
flowchart TD
    subgraph "Budget Line Items (Admin Fund)"
        BL1["Insurance - Building<br/>$13,500"]
        BL2["Maintenance - General<br/>$8,000"]
        BL3["Utilities - Water/Electricity<br/>$5,200"]
        BL4["Management Fees<br/>$6,000"]
    end

    subgraph "Budget Line Items (Capital Works Fund)"
        BL5["Painting Reserve<br/>$12,000"]
        BL6["Lift Maintenance Reserve<br/>$6,000"]
    end

    BL1 --> AT["Admin Fund Total<br/>$32,700"]
    BL2 --> AT
    BL3 --> AT
    BL4 --> AT

    BL5 --> CT["Capital Works Fund Total<br/>$18,000"]
    BL6 --> CT

    AT --> LS["levy_schedules<br/>admin_fund_total = $32,700<br/>capital_works_fund_total = $18,000<br/>frequency = quarterly (4 periods)"]
    CT --> LS

    LS --> CALC["Levy Calculation Engine<br/>Per lot per quarter:<br/>Admin = $32,700 * entitlement / 4<br/>CW = $18,000 * entitlement / 4"]

    CALC --> LI["levy_items<br/>(per lot, per period)<br/>Lot 1 Q1: Admin $817.50 + CW $450 = $1,267.50"]

    style AT fill:#c8e6c9
    style CT fill:#bbdefb
    style LS fill:#e1f5fe
    style LI fill:#fff9c4
```

---

## 4. Financial Reporting Flow

Shows how data from `transactions` flows into each report type. All reports are generated on-demand from the same transaction data.

```mermaid
flowchart TD
    subgraph "Source of Truth"
        TXN["transactions<br/>(all receipts, payments, journals)"]
        TXL["transaction_lines<br/>(debit/credit pairs)"]
        LI["levy_items<br/>(per-lot obligations)"]
        PA["payment_allocations<br/>(transaction -> levy_item links)"]
        BUD["budgets + budget_line_items<br/>(approved annual budgets)"]
    end

    TXN --> R1["Levy Roll Report<br/>Per lot: levy due, paid, outstanding<br/>Collection rate, arrears summary"]
    TXN --> R2["Income Statement<br/>Total income by category<br/>Total expenses by category<br/>Net surplus/deficit"]
    TXL --> R3["Trial Balance<br/>All accounts: debit, credit, balance<br/>Validates debits = credits"]
    TXN --> R4["Fund Balance Report<br/>Opening + receipts - payments = current<br/>Per fund (admin, capital works)"]
    TXN --> R5["EOFY Report Package<br/>Income statement + fund balances +<br/>levy roll + budget vs actual"]

    LI --> R1
    PA --> R1

    BUD --> R6["Budget vs Actual<br/>Per category: budget, actual, variance<br/>YTD and period comparisons"]
    TXN --> R6

    subgraph "Report Outputs"
        R1 --> PDF1["PDF / CSV / Excel"]
        R2 --> PDF2["PDF / CSV"]
        R3 --> PDF3["PDF / CSV / Excel"]
        R4 --> PDF4["PDF"]
        R5 --> PDF5["PDF Package (multi-page)"]
        R6 --> PDF6["PDF / CSV"]
    end

    PDF5 --> DOC["documents table<br/>(auto-stored for 7-year retention)"]

    style TXN fill:#e1f5fe
    style TXL fill:#e1f5fe
    style LI fill:#fff9c4
    style BUD fill:#f3e5f5
    style DOC fill:#c8e6c9
```

**Report descriptions:**

| Report | Purpose | Key Data Sources | Frequency |
|--------|---------|-----------------|-----------|
| Levy Roll | Per-lot levy status for AGM | levy_items, payment_allocations, transactions | Quarterly / on-demand |
| Income Statement | Revenue and expenses by category | transactions (receipts + payments) | Monthly / quarterly |
| Trial Balance | Accounting verification (debits = credits) | transaction_lines | On-demand / EOFY |
| Fund Balance | Current fund health snapshot | transactions (running totals) | Monthly / on-demand |
| EOFY Report | Annual financial package for AGM | All sources combined | Annual |
| Budget vs Actual | Spending against approved budget | budgets, budget_line_items, transactions | Monthly / quarterly |

---

## 5. Budget vs Actual Comparison

Shows how budget data and actual transaction data combine to produce variance analysis.

```mermaid
flowchart LR
    subgraph "Budget Data"
        B["budget_line_items<br/>category: Insurance<br/>annual_budget: $13,500<br/>YTD budget (9 months): $10,125"]
    end

    subgraph "Actual Data"
        T["transactions<br/>WHERE category = Insurance<br/>AND date within FY period<br/>SUM(amount) = $11,200"]
    end

    B --> COMP{"Variance Calculation"}
    T --> COMP

    COMP --> V1["Period Variance<br/>Actual - Budget<br/>$11,200 - $10,125 = +$1,075"]
    COMP --> V2["Variance %<br/>(Variance / Budget) * 100<br/>+10.6%"]
    COMP --> V3["Annual Projection<br/>$11,200 / 9 months * 12 = $14,933<br/>(exceeds $13,500 annual budget)"]

    V2 --> STATUS{"Status"}
    STATUS -->|"< 5%"| GREEN["ON TRACK"]
    STATUS -->|"5% - 15%"| YELLOW["MONITOR"]
    STATUS -->|"> 15%"| RED["OVER BUDGET<br/>Action Required"]

    style B fill:#f3e5f5
    style T fill:#e1f5fe
    style GREEN fill:#c8e6c9
    style YELLOW fill:#fff9c4
    style RED fill:#ffcdd2
```

---

## 6. EOFY Report Generation Workflow

End-of-financial-year process that produces the comprehensive financial package required for AGM presentation.

```mermaid
flowchart TD
    A["Manager initiates EOFY<br/>(Settings -> Finalize FY2025/26)"] --> B["Pre-EOFY Checklist"]

    B --> B1["All transactions entered?"]
    B --> B2["June bank reconciliation complete?"]
    B --> B3["Outstanding invoices recorded?"]
    B --> B4["Inter-fund transfers balanced?"]
    B --> B5["Next FY budget approved?"]

    B1 --> C{"All checks passed?"}
    B2 --> C
    B3 --> C
    B4 --> C
    B5 --> C

    C -->|"No"| D["Resolve outstanding items"]
    D --> B
    C -->|"Yes"| E["Generate EOFY Reports"]

    E --> E1["Trial Balance<br/>(as at 30 June)"]
    E --> E2["Income Statement<br/>(Admin + CW funds)"]
    E --> E3["Fund Balance Summary<br/>(Opening -> Closing)"]
    E --> E4["Levy Roll<br/>(collection rate, arrears)"]
    E --> E5["Budget vs Actual<br/>(annual variance)"]

    E1 --> F["EOFY Report Package (PDF)"]
    E2 --> F
    E3 --> F
    E4 --> F
    E5 --> F

    F --> G["Auto-store in documents table<br/>category: 'financial'<br/>linked_entity_type: 'financial_report'"]

    F --> H["EOFY Rollover"]

    H --> H1["Lock FY2025/26 transactions<br/>(no further edits without audit note)"]
    H --> H2["Carry forward fund balances:<br/>Admin closing -> Admin opening FY2026/27<br/>CW closing -> CW opening FY2026/27"]
    H --> H3["Create new financial_year record<br/>(FY2026/27, is_current=TRUE)"]
    H --> H4["Log rollover in audit_log<br/>(user, timestamp, balances)"]

    H1 --> I["FY2026/27 Active<br/>Ready for new transactions"]
    H2 --> I
    H3 --> I
    H4 --> I

    style A fill:#e1f5fe
    style F fill:#fff9c4
    style G fill:#c8e6c9
    style I fill:#c8e6c9
```

**EOFY rollover details:**
- Fund closing balances are calculated from `transactions`: `SUM(receipts) - SUM(payments)` for the FY period
- Opening balances for new FY are stored in `financial_years.admin_opening_balance` and `financial_years.capital_opening_balance` (if these columns exist) or derived from historical transactions
- Income/expense accounts reset to zero for the new FY (they are period-specific)
- Asset accounts (trust bank accounts) carry forward their running balance
