# Payment Flow Diagrams

These diagrams describe how levy payments and maintenance invoice payments integrate with the trust accounting system. The `transactions` table is the **single source of truth** for all financial data -- there is no separate `payments` table.

---

## 1. Levy Payment Flow

When a manager records a levy payment, the system creates a `transactions` record (receipt), links it to the relevant `levy_items` via `payment_allocations`, and triggers update the levy item's paid amount and status.

```mermaid
sequenceDiagram
    autonumber
    actor Manager
    participant UI as Levy Management UI
    participant API as Next.js API
    participant DB as PostgreSQL
    participant TL as Trigger: auto_create_transaction_lines
    participant LP as Trigger: auto_update_levy_paid
    participant LS as Trigger: auto_update_levy_status

    Manager->>UI: Record Payment<br/>Lot 5, $2,250, Bank Transfer, ref "LOT5-Q12027"
    UI->>API: POST /schemes/{id}/transactions

    Note over API: System searches for matching levy items<br/>(lot_id + outstanding balance, oldest first)

    API->>DB: SELECT levy_items WHERE lot_id = lot5<br/>AND status IN ('sent','partial','overdue')<br/>ORDER BY due_date ASC

    DB-->>API: Q4 FY2026 arrears: $450 (overdue)<br/>Q1 FY2027: $1,800 (sent)

    Note over API: FIFO allocation: oldest first

    API->>DB: INSERT transactions<br/>(type='receipt', fund='admin',<br/>category=4100 'Levy Income',<br/>amount=$2,250, lot_id=lot5)

    DB->>TL: Trigger fires on INSERT

    TL->>DB: INSERT transaction_lines<br/>DEBIT 1100 Trust Account Admin $2,250
    TL->>DB: INSERT transaction_lines<br/>CREDIT 4100 Levy Income Admin $2,250

    API->>DB: INSERT payment_allocations<br/>(transaction_id, levy_item_id=Q4, allocated_amount=$450)

    DB->>LP: Trigger fires on INSERT
    LP->>DB: UPDATE levy_items (Q4)<br/>SET amount_paid = SUM(allocations) = $450
    DB->>LS: Trigger fires on UPDATE
    LS->>DB: amount_paid ($450) >= total ($450)<br/>SET status = 'paid'

    API->>DB: INSERT payment_allocations<br/>(transaction_id, levy_item_id=Q1, allocated_amount=$1,800)

    DB->>LP: Trigger fires on INSERT
    LP->>DB: UPDATE levy_items (Q1)<br/>SET amount_paid = SUM(allocations) = $1,800
    DB->>LS: Trigger fires on UPDATE
    LS->>DB: amount_paid ($1,800) >= total ($1,800)<br/>SET status = 'paid'

    API-->>UI: Payment recorded<br/>Q4 FY2026: PAID ($450)<br/>Q1 FY2027: PAID ($1,800)
```

---

## 2. Maintenance Invoice Payment Flow

When a manager pays a maintenance invoice, the system creates a `transactions` record (payment) and links it back to the invoice via `invoices.payment_reference`.

```mermaid
sequenceDiagram
    autonumber
    actor Manager
    participant UI as Maintenance Request UI
    participant API as Next.js API
    participant DB as PostgreSQL
    participant TL as Trigger: auto_create_transaction_lines

    Manager->>UI: View maintenance request #456<br/>(plumbing repair, common property)
    UI-->>Manager: Invoice from "ABC Plumbing"<br/>Amount: $850 + GST $85 = $935

    Manager->>UI: Click "Pay Invoice"
    UI->>Manager: Pre-filled form:<br/>Amount: $935<br/>Category: 6110 Maintenance - Plumbing<br/>Fund: admin (manager can change to capital_works)
    Manager->>UI: Confirm payment details

    UI->>API: POST /schemes/{id}/transactions

    API->>DB: INSERT transactions<br/>(type='payment', fund='admin',<br/>category=6110 'Maintenance - Plumbing',<br/>amount=$935, gst_amount=$85,<br/>description='Invoice #INV-2026-001 - ABC Plumbing',<br/>reference='INV-2026-001')

    DB->>TL: Trigger fires on INSERT

    TL->>DB: INSERT transaction_lines<br/>DEBIT 6110 Maintenance - Plumbing $935
    TL->>DB: INSERT transaction_lines<br/>CREDIT 1100 Trust Account Admin $935

    API->>DB: UPDATE invoices<br/>SET payment_reference = transaction.id,<br/>paid_at = NOW()<br/>WHERE id = invoice_id

    API-->>UI: Invoice marked as PAID<br/>Transaction #TXN-789 created

    Note over UI: Maintenance request detail view<br/>now shows "Invoice PAID on 15/02/2026"
```

---

## 3. Payment Allocation: One Payment Covering Multiple Levy Items

Demonstrates FIFO (oldest-first) allocation when a single payment covers multiple outstanding levy items, including partial payment scenarios.

```mermaid
flowchart TD
    subgraph "Incoming Payment"
        PAY["transactions record<br/>type: receipt<br/>amount: $3,000<br/>Lot 5, Bank Transfer"]
    end

    subgraph "Outstanding Levy Items (Lot 5, oldest first)"
        LI1["levy_items: Q3 FY2026<br/>total: $1,800 | paid: $0<br/>status: overdue (90 days)"]
        LI2["levy_items: Q4 FY2026<br/>total: $1,800 | paid: $0<br/>status: overdue (45 days)"]
        LI3["levy_items: Q1 FY2027<br/>total: $1,800 | paid: $0<br/>status: sent"]
    end

    subgraph "FIFO Allocation"
        PA1["payment_allocations<br/>transaction_id -> Q3<br/>allocated: $1,800"]
        PA2["payment_allocations<br/>transaction_id -> Q4<br/>allocated: $1,200<br/>(remaining from $3,000)"]
    end

    PAY --> PA1
    PAY --> PA2

    PA1 --> LI1
    PA2 --> LI2

    subgraph "After Allocation"
        R1["Q3 FY2026<br/>paid: $1,800 | balance: $0<br/>status: PAID"]
        R2["Q4 FY2026<br/>paid: $1,200 | balance: $600<br/>status: PARTIAL"]
        R3["Q1 FY2027<br/>paid: $0 | balance: $1,800<br/>status: sent (unchanged)"]
    end

    LI1 -.->|"trigger updates"| R1
    LI2 -.->|"trigger updates"| R2
    LI3 -.->|"no allocation"| R3

    style PAY fill:#e1f5fe
    style PA1 fill:#fff9c4
    style PA2 fill:#fff9c4
    style R1 fill:#c8e6c9
    style R2 fill:#ffe0b2
    style R3 fill:#f5f5f5
```

**Allocation logic:**
1. Query `levy_items` for the lot, ordered by `due_date ASC` (oldest first)
2. Allocate payment amount to each item until payment is exhausted:
   - If remaining payment >= item balance: fully pay the item, move to next
   - If remaining payment < item balance: partially pay the item, stop
3. Create `payment_allocations` record for each allocation
4. Triggers cascade: `auto_update_levy_paid` -> `auto_update_levy_status`

---

## 4. Trigger Chain: Payment to Status Update

Shows the full cascade of database triggers that fire when a payment allocation is inserted.

```mermaid
flowchart TD
    A["INSERT payment_allocations<br/>(transaction_id, levy_item_id, allocated_amount)"] --> B["Trigger: auto_update_levy_paid<br/>(AFTER INSERT on payment_allocations)"]

    B --> C["UPDATE levy_items<br/>SET amount_paid = (<br/>  SELECT SUM(allocated_amount)<br/>  FROM payment_allocations<br/>  WHERE levy_item_id = NEW.levy_item_id<br/>)"]

    C --> D["Trigger: auto_update_levy_status<br/>(BEFORE UPDATE on levy_items)"]

    D --> E{"Evaluate new status"}

    E -->|"amount_paid >= total_levy_amount"| F["status = 'paid'"]
    E -->|"amount_paid > 0 AND < total"| G["status = 'partial'"]
    E -->|"due_date < TODAY AND amount_paid = 0"| H["status = 'overdue'"]
    E -->|"notice_sent_at IS NOT NULL"| I["status = 'sent'"]
    E -->|"else"| J["status = 'pending'"]

    F --> K["levy_items updated<br/>(amount_paid, amount_outstanding, status)"]
    G --> K
    H --> K
    I --> K
    J --> K

    style A fill:#e1f5fe
    style B fill:#fff9c4
    style D fill:#fff9c4
    style K fill:#c8e6c9
```

**Important notes:**
- `amount_outstanding` is a GENERATED column: `total_levy_amount - amount_paid`
- The `auto_update_levy_paid` trigger recalculates from the SUM of all allocations (not incremental), making it safe for updates and deletes
- The `auto_update_levy_status` trigger runs BEFORE UPDATE, modifying the NEW row before it is written

---

## 5. Data Model: Payment Flow Entity Relationships

Shows how the `transactions` table connects to both levy items (via `payment_allocations`) and maintenance invoices (via `invoices.payment_reference`), serving as the single source of truth.

```mermaid
flowchart LR
    subgraph "Trust Accounting (Source of Truth)"
        TXN["transactions<br/>- id (PK)<br/>- scheme_id<br/>- lot_id (nullable)<br/>- transaction_type<br/>- fund_type<br/>- category_id -> chart_of_accounts<br/>- amount<br/>- description<br/>- reference"]
        TXL["transaction_lines<br/>- transaction_id (FK)<br/>- account_id -> chart_of_accounts<br/>- line_type (debit/credit)<br/>- amount"]
    end

    subgraph "Levy Management"
        LI["levy_items<br/>- id (PK)<br/>- lot_id<br/>- levy_period_id<br/>- total_levy_amount<br/>- amount_paid<br/>- amount_outstanding<br/>- status"]
        PA["payment_allocations<br/>- transaction_id (FK)<br/>- levy_item_id (FK)<br/>- allocated_amount"]
    end

    subgraph "Maintenance"
        INV["invoices<br/>- id (PK)<br/>- maintenance_request_id<br/>- tradesperson_id<br/>- invoice_amount<br/>- payment_reference (FK)<br/>- paid_at"]
    end

    TXN -->|"1:N"| TXL
    TXN -->|"1:N via payment_allocations"| PA
    PA -->|"N:1"| LI
    TXN -->|"1:1 via payment_reference"| INV

    style TXN fill:#e1f5fe
    style TXL fill:#e1f5fe
    style PA fill:#fff9c4
    style LI fill:#fff9c4
    style INV fill:#f3e5f5
```

**Key design decisions:**
- There is NO separate `payments` table. The `transactions` table records all financial activity.
- Levy payments: `transactions` (receipt) linked to `levy_items` via `payment_allocations` (many-to-many, one payment can cover multiple levies)
- Maintenance payments: `transactions` (payment) linked to `invoices` via `invoices.payment_reference` (one-to-one)
- Both types of transactions generate `transaction_lines` (debit/credit pairs) via the `auto_create_transaction_lines` trigger
