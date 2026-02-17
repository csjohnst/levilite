# Financial Entity Relationship Diagram

Financial entities covering trust accounting, chart of accounts, levy management, budgets, and bank reconciliation.

**Tables:** chart_of_accounts, financial_years, transactions, transaction_lines, levy_schedules, levy_periods, levy_items, payment_allocations, budgets, budget_line_items, bank_statements, reconciliations

```mermaid
erDiagram
    chart_of_accounts {
        UUID id PK
        VARCHAR code UK
        VARCHAR name
        TEXT account_type "asset | liability | income | expense | equity"
        TEXT fund_type "admin | capital_works | NULL"
        UUID parent_id FK "self-referencing"
        BOOLEAN is_system
        BOOLEAN is_active
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    financial_years {
        UUID id PK
        UUID scheme_id FK
        VARCHAR year_label "e.g. 2025/26"
        DATE start_date
        DATE end_date
        BOOLEAN is_current
        TIMESTAMPTZ created_at
    }

    transactions {
        UUID id PK
        UUID scheme_id FK
        UUID lot_id FK "NULL for scheme-level"
        DATE transaction_date
        TEXT transaction_type "receipt | payment | journal"
        TEXT fund_type "admin | capital_works"
        UUID category_id FK
        DECIMAL amount
        DECIMAL gst_amount
        TEXT description
        VARCHAR reference
        TEXT payment_method "eft | credit_card | cheque | cash | bpay"
        UUID bank_statement_id FK
        BOOLEAN is_reconciled
        UUID created_by FK
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
        TIMESTAMPTZ deleted_at
    }

    transaction_lines {
        UUID id PK
        UUID transaction_id FK
        UUID account_id FK
        TEXT line_type "debit | credit"
        DECIMAL amount
        TEXT description
        TIMESTAMPTZ created_at
    }

    levy_schedules {
        UUID id PK
        UUID scheme_id FK
        UUID financial_year_id FK
        TEXT frequency "monthly | quarterly | annual | custom"
        DECIMAL admin_fund_total
        DECIMAL capital_works_fund_total
        DATE approved_at
        UUID approved_by FK
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    levy_periods {
        UUID id PK
        UUID levy_schedule_id FK
        VARCHAR period_label "e.g. Q1 2026"
        DATE period_start_date
        DATE period_end_date
        DATE due_date
        DATE notice_sent_date
        TIMESTAMPTZ created_at
    }

    levy_items {
        UUID id PK
        UUID lot_id FK
        UUID levy_period_id FK
        DECIMAL admin_levy_amount
        DECIMAL capital_levy_amount
        DECIMAL total_levy_amount "generated"
        DECIMAL amount_paid
        DECIMAL amount_outstanding "generated"
        DATE due_date
        TEXT status "pending | sent | paid | partial | overdue"
        TIMESTAMPTZ notice_sent_at
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    payment_allocations {
        UUID id PK
        UUID transaction_id FK
        UUID levy_item_id FK
        DECIMAL allocated_amount
        TIMESTAMPTZ created_at
    }

    budgets {
        UUID id PK
        UUID scheme_id FK
        UUID financial_year_id FK
        TEXT budget_type "admin | capital_works"
        DECIMAL total_amount
        DATE approved_at
        UUID approved_by FK
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    budget_line_items {
        UUID id PK
        UUID budget_id FK
        UUID category_id FK
        DECIMAL budgeted_amount
        TEXT notes
        TIMESTAMPTZ created_at
    }

    bank_statements {
        UUID id PK
        UUID scheme_id FK
        TEXT fund_type "admin | capital_works"
        DATE statement_date
        DECIMAL opening_balance
        DECIMAL closing_balance
        UUID uploaded_by FK
        TIMESTAMPTZ uploaded_at
    }

    reconciliations {
        UUID id PK
        UUID bank_statement_id FK
        UUID reconciled_by FK
        TIMESTAMPTZ reconciled_at
        TEXT notes
    }

    chart_of_accounts ||--o{ chart_of_accounts : "parent-child"
    chart_of_accounts ||--o{ transactions : "categorises"
    chart_of_accounts ||--o{ transaction_lines : "account for"
    chart_of_accounts ||--o{ budget_line_items : "budget category"

    financial_years ||--o{ levy_schedules : "schedule for year"
    financial_years ||--o{ budgets : "budget for year"

    transactions ||--o{ transaction_lines : "has lines"
    transactions ||--o{ payment_allocations : "allocated to levies"

    levy_schedules ||--o{ levy_periods : "has periods"
    levy_periods ||--o{ levy_items : "has items per lot"
    levy_items ||--o{ payment_allocations : "receives payments"

    budgets ||--o{ budget_line_items : "has line items"

    bank_statements ||--o{ reconciliations : "reconciled via"
    bank_statements ||--o{ transactions : "linked to"
```
