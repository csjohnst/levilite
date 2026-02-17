# Subscription & Billing Entity Relationship Diagram

Subscription and billing entities covering plan definitions, organisation subscriptions, usage tracking, platform invoices, and Stripe webhook event logging.

**Tables:** subscription_plans, subscriptions, usage_tracking, platform_invoices, payment_events

```mermaid
erDiagram
    organisations {
        UUID id PK
        TEXT name
        VARCHAR abn
        TEXT address
        VARCHAR phone
        VARCHAR email
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    subscription_plans {
        UUID id PK
        VARCHAR plan_code UK "free | paid"
        VARCHAR plan_name
        TEXT description
        INTEGER max_lots "NULL = unlimited"
        INTEGER max_schemes "NULL = unlimited"
        JSONB features "feature flags"
        VARCHAR stripe_monthly_price_id
        VARCHAR stripe_annual_price_id
        BOOLEAN is_active
        INTEGER sort_order
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    subscriptions {
        UUID id PK
        UUID organisation_id FK,UK "one per org"
        UUID plan_id FK
        TEXT status "trialing | active | past_due | canceled | paused | free"
        TEXT billing_interval "monthly | annual"
        INTEGER billed_lots_count
        VARCHAR stripe_customer_id
        VARCHAR stripe_subscription_id UK
        DATE current_period_start
        DATE current_period_end
        DATE trial_start_date
        DATE trial_end_date
        BOOLEAN cancel_at_period_end
        TIMESTAMPTZ canceled_at
        TIMESTAMPTZ data_retention_expires_at
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    usage_tracking {
        UUID id PK
        UUID organisation_id FK
        UUID subscription_id FK
        TIMESTAMPTZ tracked_at
        INTEGER total_lots
        INTEGER total_schemes
        INTEGER total_users
        TEXT snapshot_type "daily | billing_cycle | manual"
        TIMESTAMPTZ created_at
    }

    platform_invoices {
        UUID id PK
        UUID organisation_id FK
        UUID subscription_id FK
        VARCHAR stripe_invoice_id UK
        VARCHAR invoice_number
        DECIMAL subtotal_ex_gst "DECIMAL(12,2)"
        DECIMAL gst_amount "DECIMAL(12,2)"
        DECIMAL total_inc_gst "DECIMAL(12,2)"
        INTEGER lots_billed
        TEXT billing_interval "monthly | annual"
        DATE invoice_date
        DATE due_date
        TIMESTAMPTZ paid_at
        TEXT status "draft | open | paid | void | uncollectible"
        TEXT stripe_invoice_url
        TEXT stripe_pdf_url
        JSONB line_items
        TIMESTAMPTZ created_at
    }

    payment_events {
        UUID id PK
        UUID organisation_id FK
        TEXT event_type
        VARCHAR stripe_event_id UK
        JSONB payload
        BOOLEAN processed
        TIMESTAMPTZ processed_at
        TEXT error_message
        TIMESTAMPTZ created_at
    }

    organisations ||--|| subscriptions : "has subscription"
    subscription_plans ||--o{ subscriptions : "defines plan"
    organisations ||--o{ usage_tracking : "tracks usage"
    subscriptions ||--o{ usage_tracking : "snapshots for"
    organisations ||--o{ platform_invoices : "billed via"
    subscriptions ||--o{ platform_invoices : "generates"
    organisations ||--o{ payment_events : "logs events"
```
