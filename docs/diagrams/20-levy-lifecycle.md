# Levy Lifecycle Diagrams

These diagrams describe the full levy lifecycle: from schedule creation through period generation, notice sending, payment recording, and status management.

---

## 1. Levy Item Status Diagram

A levy item (`levy_items`) tracks a single lot's obligation for a single billing period. Its status transitions are driven by manager actions and automated triggers.

```mermaid
stateDiagram-v2
    [*] --> pending : levy_items record created\n(calculate levies for period)

    pending --> sent : notice_sent_at set\n(manager sends levy notice email)

    sent --> paid : amount_paid >= total_levy_amount\n(trigger: auto_update_levy_status)
    sent --> partial : 0 < amount_paid < total_levy_amount\n(trigger: auto_update_levy_status)
    sent --> overdue : due_date < TODAY AND balance > 0\n(daily cron: mark_overdue_levies)

    partial --> paid : remaining balance paid\n(trigger: auto_update_levy_status)
    partial --> overdue : due_date < TODAY AND balance > 0\n(daily cron: mark_overdue_levies)

    overdue --> paid : full balance paid\n(trigger: auto_update_levy_status)
    overdue --> partial : partial payment received\n(trigger: auto_update_levy_status)

    paid --> [*]
```

**Key triggers:**
- `auto_update_levy_status` -- BEFORE INSERT OR UPDATE on `levy_items`, evaluates `amount_paid` vs `total_levy_amount` and `due_date` vs `CURRENT_DATE`.
- `mark_overdue_levies()` -- daily cron job (03:00 AWST) updates `sent` or `partial` items past due date to `overdue`.

---

## 2. Full Levy Workflow (Sequence Diagram)

End-to-end workflow from budget approval through to payment recording. Shows the manager's actions and system automation.

```mermaid
sequenceDiagram
    autonumber
    actor Manager
    participant UI as LevyLite UI
    participant API as Next.js API
    participant DB as PostgreSQL
    participant Email as Resend API
    participant Cron as Daily Cron Job

    Note over Manager, DB: Phase 1 -- Schedule & Period Setup

    Manager->>UI: Create levy schedule for FY
    UI->>API: POST /schemes/{id}/levy-schedules
    API->>DB: INSERT levy_schedules (admin_fund_total, capital_works_fund_total, frequency)
    DB-->>API: schedule created
    API->>DB: INSERT levy_periods (Q1, Q2, Q3, Q4 with due_dates)
    DB-->>API: 4 periods created
    API-->>UI: Schedule + periods confirmed

    Note over Manager, DB: Phase 2 -- Levy Calculation

    Manager->>UI: Calculate levies for Q1
    UI->>API: POST /levy-periods/{id}/calculate-levies
    API->>DB: SELECT lots with unit_entitlement for scheme
    DB-->>API: lot list
    API->>API: For each lot: admin_levy = (admin_total * entitlement) / periods<br/>capital_levy = (cw_total * entitlement) / periods<br/>ROUND to 2 decimal places
    API->>DB: INSERT levy_items (lot_id, admin_levy_amount, capital_levy_amount, due_date, status='pending')
    DB-->>API: levy_items created
    API-->>UI: 100 levy items calculated

    Note over Manager, Email: Phase 3 -- Notice Generation & Delivery

    Manager->>UI: Generate PDF notices
    UI->>API: POST /levy-periods/{id}/generate-notices
    API->>API: For each levy_item: render PDF via @react-pdf/renderer
    API->>DB: Upload PDFs to Supabase Storage
    API->>DB: UPDATE levy_items SET notice_generated_at = NOW()
    API-->>UI: 100 PDFs generated (progress bar)

    Manager->>UI: Send all notices
    UI->>API: POST /levy-periods/{id}/send-notices
    loop For each levy_item (rate limited 10/sec)
        API->>Email: Send email with PDF attachment
        Email-->>API: message_id
        API->>DB: INSERT email_log (levy_item_id, status='sent')
        API->>DB: UPDATE levy_items SET notice_sent_at = NOW(), status = 'sent'
    end
    API-->>UI: 98 sent, 2 bounced

    Note over Manager, Cron: Phase 4 -- Payment & Arrears

    Manager->>UI: Record payment ($1,800 for Lot 5)
    UI->>API: POST /schemes/{id}/transactions (type='receipt', category='levy_income')
    API->>DB: INSERT transactions (receipt, admin fund, $1,800)
    DB->>DB: Trigger: auto_create_transaction_lines<br/>(debit Trust Account, credit Levy Income)
    API->>DB: INSERT payment_allocations (transaction_id, levy_item_id, $1,800)
    DB->>DB: Trigger: auto_update_levy_paid<br/>(SUM allocations -> levy_items.amount_paid)
    DB->>DB: Trigger: auto_update_levy_status<br/>(amount_paid >= total -> status = 'paid')
    API-->>UI: Payment recorded, Lot 5 Q1 = PAID

    Note over Cron, DB: Phase 5 -- Automated Arrears Detection

    Cron->>DB: SELECT mark_overdue_levies()
    DB->>DB: UPDATE levy_items SET status='overdue'<br/>WHERE status IN ('sent','partial')<br/>AND due_date < CURRENT_DATE AND balance > 0
    Cron->>DB: Check overdue items for reminder milestones (7d, 14d, 30d)
    Cron->>Email: Send automated reminder emails
    Cron->>DB: INSERT arrears_reminders (levy_item_id, reminder_type)
```

---

## 3. Levy Calculation Flow

Shows how the approved scheme budget flows through unit entitlements to produce per-lot levy amounts.

```mermaid
flowchart TD
    A["Approved Annual Budget<br/>(levy_schedules)"] --> B{"Fund Split"}

    B -->|"admin_fund_total<br/>e.g. $48,000"| C["Admin Fund Budget"]
    B -->|"capital_works_fund_total<br/>e.g. $24,000"| D["Capital Works Fund Budget"]

    C --> E["Divide by periods_per_year<br/>(e.g. 4 quarters)"]
    D --> F["Divide by periods_per_year<br/>(e.g. 4 quarters)"]

    E --> G["Admin per-period pool<br/>$48,000 / 4 = $12,000"]
    F --> H["CW per-period pool<br/>$24,000 / 4 = $6,000"]

    I["Lot Register<br/>(lots.unit_entitlement)"] --> J{"For Each Lot"}

    G --> J
    H --> J

    J --> K["Lot Entitlement Ratio<br/>lot.unit_entitlement / SUM(all entitlements)"]

    K --> L["Admin Levy per Lot<br/>ROUND(admin_pool * ratio, 2)<br/>e.g. $12,000 * 0.10 = $1,200.00"]
    K --> M["CW Levy per Lot<br/>ROUND(cw_pool * ratio, 2)<br/>e.g. $6,000 * 0.10 = $600.00"]

    L --> N["levy_items record<br/>admin_levy_amount = $1,200"]
    M --> N

    N --> O["total_levy_amount<br/>(GENERATED: admin + capital)<br/>$1,200 + $600 = $1,800"]

    O --> P{"Rounding Check"}
    P -->|"SUM(all lots) matches budget"| Q["Schedule Confirmed"]
    P -->|"Rounding difference <= $0.10"| R["Note rounding difference<br/>(applied to admin fund)"]
    R --> Q

    style A fill:#e1f5fe
    style Q fill:#c8e6c9
    style R fill:#fff9c4
```

**Calculation formula:**
```
Admin Levy (per lot, per period) = ROUND(admin_fund_total * unit_entitlement / periods_per_year, 2)
CW Levy (per lot, per period)    = ROUND(capital_works_fund_total * unit_entitlement / periods_per_year, 2)
Total Levy                       = admin_levy_amount + capital_levy_amount  (GENERATED column)
```

---

## 4. Levy Period Generation

Shows how a single levy schedule produces multiple billing periods with their corresponding levy items.

```mermaid
flowchart LR
    LS["levy_schedules<br/>FY 2026/27<br/>Quarterly<br/>Admin: $48,000<br/>CW: $24,000"] --> LP1["levy_periods<br/>Q1: Jul-Sep<br/>Due: 31 Jul"]
    LS --> LP2["levy_periods<br/>Q2: Oct-Dec<br/>Due: 31 Oct"]
    LS --> LP3["levy_periods<br/>Q3: Jan-Mar<br/>Due: 31 Jan"]
    LS --> LP4["levy_periods<br/>Q4: Apr-Jun<br/>Due: 30 Apr"]

    LP1 --> LI1["levy_items<br/>Lot 1: $1,800<br/>Lot 2: $1,440<br/>...<br/>Lot N: $2,160"]
    LP2 --> LI2["levy_items<br/>(same amounts<br/>per lot)"]
    LP3 --> LI3["levy_items<br/>(same amounts<br/>per lot)"]
    LP4 --> LI4["levy_items<br/>(same amounts<br/>per lot)"]

    style LS fill:#e1f5fe
    style LP1 fill:#f3e5f5
    style LP2 fill:#f3e5f5
    style LP3 fill:#f3e5f5
    style LP4 fill:#f3e5f5
    style LI1 fill:#fff9c4
    style LI2 fill:#fff9c4
    style LI3 fill:#fff9c4
    style LI4 fill:#fff9c4
```

**Relationships:**
- `levy_schedules` 1 --- N `levy_periods` (one schedule has N periods, where N = periods_per_year)
- `levy_periods` 1 --- M `levy_items` (one period has M items, where M = number of lots in the scheme)
- Each `levy_item` has a unique constraint on `(lot_id, levy_period_id)`
