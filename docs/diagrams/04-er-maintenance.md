# Maintenance Entity Relationship Diagram

Maintenance management entities covering work requests, comments, tradespeople, quotes, invoices, and attachments.

**Tables:** maintenance_requests, maintenance_comments, tradespeople, quotes, invoices, maintenance_attachments

```mermaid
erDiagram
    maintenance_requests {
        UUID id PK
        UUID scheme_id FK
        UUID lot_id FK "NULL for common property"
        UUID submitted_by FK "owner"
        TEXT priority "low | medium | high | urgent"
        TEXT category "plumbing | electrical | painting etc."
        TEXT title
        TEXT description
        TEXT location
        TEXT status "new | acknowledged | assigned | in_progress | quoted | approved | completed | closed"
        UUID assigned_to FK "tradesperson"
        DECIMAL estimated_cost
        DECIMAL actual_cost
        DATE scheduled_date
        DATE completed_date
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    maintenance_comments {
        UUID id PK
        UUID maintenance_request_id FK
        UUID user_id FK
        UUID owner_id FK
        TEXT comment
        BOOLEAN is_internal "not visible to owners"
        TIMESTAMPTZ created_at
    }

    tradespeople {
        UUID id PK
        UUID organisation_id FK
        TEXT business_name
        TEXT contact_name
        TEXT email
        VARCHAR phone
        VARCHAR abn
        TEXT trade_type "plumber | electrician | painter etc."
        BOOLEAN is_preferred
        DATE insurance_expiry
        VARCHAR license_number
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    quotes {
        UUID id PK
        UUID maintenance_request_id FK
        UUID tradesperson_id FK
        DECIMAL quote_amount
        DATE quote_date
        VARCHAR quote_reference
        BOOLEAN is_accepted
        TEXT notes
        TIMESTAMPTZ created_at
    }

    invoices {
        UUID id PK
        UUID maintenance_request_id FK
        UUID tradesperson_id FK
        VARCHAR invoice_number
        DATE invoice_date
        DECIMAL invoice_amount
        DECIMAL gst_amount
        UUID payment_reference FK "links to transactions"
        TIMESTAMPTZ paid_at
        TIMESTAMPTZ created_at
    }

    maintenance_attachments {
        UUID id PK
        UUID maintenance_request_id FK
        TEXT file_path
        TEXT filename
        TEXT file_type "image | pdf | document"
        UUID uploaded_by FK
        TIMESTAMPTZ uploaded_at
    }

    maintenance_requests ||--o{ maintenance_comments : "has comments"
    maintenance_requests ||--o{ quotes : "has quotes"
    maintenance_requests ||--o{ invoices : "has invoices"
    maintenance_requests ||--o{ maintenance_attachments : "has attachments"
    tradespeople ||--o{ quotes : "provides quotes"
    tradespeople ||--o{ invoices : "issues invoices"
    tradespeople ||--o{ maintenance_requests : "assigned to"
```
