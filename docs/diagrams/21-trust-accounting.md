# Trust Accounting Diagrams

These diagrams describe the double-entry accounting system, fund management, and bank reconciliation workflow that form the financial backbone of LevyLite.

---

## 1. Double-Entry Accounting: Transaction to Transaction Lines

Every record in `transactions` automatically generates balanced debit/credit pairs in `transaction_lines` via the `auto_create_transaction_lines` trigger.

```mermaid
flowchart TD
    subgraph "Manager Action"
        A["Manager records transaction<br/>(via Levy Management or Trust Accounting UI)"]
    end

    A --> B["INSERT INTO transactions<br/>(scheme_id, transaction_date, transaction_type,<br/>fund_type, category_id, amount, description)"]

    B --> C{"Trigger:<br/>auto_create_transaction_lines"}

    C -->|"transaction_type = 'receipt'"| D["Receipt (Money In)"]
    C -->|"transaction_type = 'payment'"| E["Payment (Money Out)"]
    C -->|"transaction_type = 'journal'"| F["Journal Entry<br/>(manual lines required)"]

    D --> D1["DEBIT: Trust Account<br/>(asset: 1100 Admin or 1200 CW)<br/>amount = transaction.amount"]
    D --> D2["CREDIT: Income Account<br/>(income: category_id e.g. 4100 Levy Income)<br/>amount = transaction.amount"]

    E --> E1["DEBIT: Expense Account<br/>(expense: category_id e.g. 6200 Insurance)<br/>amount = transaction.amount"]
    E --> E2["CREDIT: Trust Account<br/>(asset: 1100 Admin or 1200 CW)<br/>amount = transaction.amount"]

    D1 --> G{"Validation:<br/>SUM(debits) = SUM(credits)"}
    D2 --> G
    E1 --> G
    E2 --> G

    G -->|"Balanced"| H["Transaction committed"]
    G -->|"Unbalanced"| I["RAISE EXCEPTION<br/>'debits must equal credits'"]

    style A fill:#e1f5fe
    style H fill:#c8e6c9
    style I fill:#ffcdd2
```

**Key accounts used by trigger:**
| Fund Type | Trust Account (Asset) | Code |
|-----------|----------------------|------|
| admin | Trust Account - Admin Fund | 1100 |
| capital_works | Trust Account - Capital Works Fund | 1200 |

**Trigger logic (simplified):**
- Receipt: Debit bank (asset increases), Credit income category
- Payment: Debit expense category, Credit bank (asset decreases)
- Journal: Application must supply lines manually (inter-fund transfers)

---

## 2. Double-Entry Ledger Example

Concrete example showing how a levy receipt and an insurance payment each produce balanced ledger entries.

```mermaid
flowchart LR
    subgraph "Transaction 1: Levy Receipt ($1,800)"
        T1["transactions<br/>type: receipt<br/>fund: admin<br/>amount: $1,800<br/>category: 4100 Levy Income"]
        T1L1["transaction_lines<br/>DEBIT 1100 Trust Account Admin<br/>$1,800"]
        T1L2["transaction_lines<br/>CREDIT 4100 Levy Income Admin<br/>$1,800"]
        T1 --> T1L1
        T1 --> T1L2
    end

    subgraph "Transaction 2: Insurance Payment ($8,500)"
        T2["transactions<br/>type: payment<br/>fund: admin<br/>amount: $8,500<br/>category: 6200 Insurance"]
        T2L1["transaction_lines<br/>DEBIT 6200 Insurance - Building<br/>$8,500"]
        T2L2["transaction_lines<br/>CREDIT 1100 Trust Account Admin<br/>$8,500"]
        T2 --> T2L1
        T2 --> T2L2
    end

    subgraph "Ledger Balance Check"
        BAL["Trial Balance<br/>Total Debits = $10,300<br/>Total Credits = $10,300<br/>Difference = $0.00"]
    end

    T1L1 --> BAL
    T1L2 --> BAL
    T2L1 --> BAL
    T2L2 --> BAL

    style T1 fill:#c8e6c9
    style T2 fill:#ffcdd2
    style BAL fill:#e1f5fe
```

---

## 3. Fund Flow: Admin Fund vs Capital Works Fund

Each strata scheme maintains two separate funds. Receipts flow in (levies, interest, other income) and payments flow out (expenses). Inter-fund transfers require committee resolution.

```mermaid
flowchart TD
    subgraph "INCOME (Receipts)"
        R1["Levy Payments<br/>(4100 Admin / 4200 CW)"]
        R2["Interest Income<br/>(4300)"]
        R3["Other Income<br/>(4400)"]
    end

    subgraph "ADMIN FUND"
        direction TB
        AF_BANK["Trust Account - Admin<br/>(1100 Asset)"]
        AF_BAL["Current Balance<br/>= Opening + Receipts - Payments"]
    end

    subgraph "CAPITAL WORKS FUND"
        direction TB
        CW_BANK["Trust Account - CW<br/>(1200 Asset)"]
        CW_BAL["Current Balance<br/>= Opening + Receipts - Payments"]
    end

    subgraph "EXPENSES (Payments)"
        P1["Insurance (6200)"]
        P2["Maintenance (6100)"]
        P3["Utilities (6300)"]
        P4["Management Fees (6400)"]
        P5["Capital Projects (6150)"]
    end

    R1 -->|"admin levies"| AF_BANK
    R1 -->|"CW levies"| CW_BANK
    R2 --> AF_BANK
    R2 --> CW_BANK
    R3 --> AF_BANK

    AF_BANK --> P1
    AF_BANK --> P2
    AF_BANK --> P3
    AF_BANK --> P4

    CW_BANK --> P5

    AF_BANK <-->|"Inter-fund transfer<br/>(requires committee resolution<br/>transaction_type = 'journal')"| CW_BANK

    AF_BANK --> AF_BAL
    CW_BANK --> CW_BAL

    style AF_BANK fill:#c8e6c9
    style CW_BANK fill:#bbdefb
    style R1 fill:#e8f5e9
    style R2 fill:#e8f5e9
    style R3 fill:#e8f5e9
    style P1 fill:#ffebee
    style P2 fill:#ffebee
    style P3 fill:#ffebee
    style P4 fill:#ffebee
    style P5 fill:#ffebee
```

**Fund separation rules (WA Strata Titles Act):**
- Admin fund covers day-to-day operating expenses
- Capital works fund covers long-term capital projects
- Funds must be separately accounted (separate `fund_type` on every transaction)
- Inter-fund transfers require committee resolution reference
- Capital works funds cannot be used for admin expenses without owner approval

---

## 4. Bank Reconciliation Workflow

Monthly process to match the trust account ledger against the actual bank statement, ensuring accuracy and compliance.

```mermaid
sequenceDiagram
    autonumber
    actor Manager
    participant UI as LevyLite UI
    participant API as Next.js API
    participant DB as PostgreSQL
    participant Parser as CSV Parser

    Note over Manager, DB: Step 1 -- Upload Bank Statement

    Manager->>UI: Download CSV from bank (CBA/Westpac/Bankwest)
    Manager->>UI: Upload CSV to reconciliation page
    UI->>API: POST /schemes/{id}/bank-statements (file, fund_type, statement_date)
    API->>Parser: Parse CSV (detect bank format)
    Parser-->>API: Extracted lines (date, description, debit, credit, balance)
    API->>DB: INSERT bank_statements (scheme_id, fund_type, opening_balance, closing_balance)
    API->>DB: INSERT bank_statement_lines (date, description, debit_amount, credit_amount, balance)
    API-->>UI: 87 lines imported

    Note over API, DB: Step 2 -- Auto-Matching

    API->>DB: SELECT unreconciled transactions for scheme + period
    API->>API: Match algorithm:<br/>1. Amount exact match (required)<br/>2. Date within +/- 3 days<br/>3. Reference/description similarity
    API->>DB: UPDATE bank_statement_lines SET matched=TRUE, matched_transaction_id=...
    API-->>UI: 72 auto-matched, 15 unmatched

    Note over Manager, DB: Step 3 -- Manual Review

    UI->>Manager: Display 3-column view:<br/>Bank Lines | Match Status | Ledger Transactions
    Manager->>UI: Review auto-matched items (green)
    Manager->>UI: Manually match suggested items (yellow)

    alt Unmatched bank line (money in bank, not in ledger)
        Manager->>UI: Click "Create Transaction" for unmatched bank line
        UI->>API: POST /schemes/{id}/transactions (from bank line data)
        API->>DB: INSERT transactions + trigger creates transaction_lines
        API->>DB: UPDATE bank_statement_lines SET matched=TRUE
    end

    alt Unmatched ledger item (in ledger, not in bank)
        Manager->>UI: Mark as "Outstanding" (e.g. cheque not yet cleared)
    end

    Note over Manager, DB: Step 4 -- Finalize Reconciliation

    Manager->>UI: All items resolved, click "Finalize"
    UI->>API: POST /schemes/{id}/bank-statements/{id}/finalize
    API->>DB: INSERT reconciliations (bank_balance, ledger_balance, outstanding_deposits, outstanding_withdrawals)
    API->>DB: Validate: adjusted_balance = bank_balance + outstanding_deposits - outstanding_withdrawals
    API->>DB: UPDATE bank_reconciliations SET status='reconciled'
    API->>DB: UPDATE transactions SET is_reconciled=TRUE for all matched transactions
    API-->>UI: Reconciliation complete<br/>Bank: $26,840 | Ledger: $26,590 | Outstanding: $250 | Difference: $0.00
```

---

## 5. Bank Reconciliation Balance Diagram

Visual breakdown of how reconciliation proves ledger accuracy.

```mermaid
flowchart TD
    A["Bank Statement Balance<br/>$26,840.00"] --> B["+ Outstanding Deposits<br/>(in ledger, not yet in bank)<br/>$450.00"]
    B --> C["- Outstanding Withdrawals<br/>(in ledger, not yet cleared)<br/>$700.00"]
    C --> D["= Adjusted Bank Balance<br/>$26,590.00"]

    E["Ledger Balance<br/>(SUM of all transaction_lines<br/>for Trust Account asset)<br/>$26,590.00"]

    D --> F{"Difference =<br/>Adjusted Bank - Ledger"}
    E --> F

    F -->|"$0.00"| G["RECONCILED"]
    F -->|"!= $0.00"| H["DISCREPANCY<br/>Investigate unmatched items"]

    style A fill:#e1f5fe
    style E fill:#fff9c4
    style G fill:#c8e6c9
    style H fill:#ffcdd2
```

**Reconciliation tables:**
- `bank_statements` -- uploaded statement metadata (scheme, fund, date, opening/closing balance)
- `bank_statement_lines` -- individual lines parsed from CSV (linked to `matched_transaction_id` when matched)
- `reconciliations` -- final reconciliation record with balances and status
