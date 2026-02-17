# Billing Lifecycle Diagrams

Covers subscription state transitions, monthly billing cycle, and the failed payment dunning process.

---

## 1. Subscription State Diagram

All subscription states and their transitions, driven by payment events, trial expiry, and user actions.

```mermaid
stateDiagram-v2
    [*] --> trialing : Organisation created\n(14-day trial, all features)

    trialing --> active : trial_expires_with_payment\n(Stripe subscription exists, payment succeeds)
    trialing --> free : trial_expires_without_payment\n(<=10 lots, <=1 scheme, no payment method)
    trialing --> canceled : trial_expires_without_payment\n(>10 lots or >1 scheme, no payment method)

    free --> active : payment_success\n(user subscribes via Stripe Checkout)

    active --> past_due : payment_failed\n(invoice.payment_failed webhook)
    active --> canceled : user_cancels\n(cancel_at_period_end, then period ends)
    active --> paused : admin_pauses\n(billing dispute, manual admin action)

    past_due --> active : payment_success\n(retry succeeds or payment method updated)
    past_due --> canceled : grace_expired\n(7-day grace period, all retries failed)

    paused --> active : admin_resumes\n(dispute resolved, manual reactivation)

    canceled --> active : user_reactivates\n(new payment within 90-day retention)
    canceled --> [*] : data_retention_expired\n(90 days, org data permanently deleted)
```

---

## 2. Monthly Billing Cycle (Sequence Diagram)

How a recurring billing cycle works: lot count snapshot, graduated price calculation, Stripe invoice, and subscription update.

```mermaid
sequenceDiagram
    autonumber
    participant Cron as Cron / Stripe
    participant DB as PostgreSQL
    participant Stripe as Stripe Billing
    participant Webhook as Webhook Handler
    participant App as LevyLite App

    Note over Cron, App: Billing Cycle Start

    Cron->>DB: snapshot_billing_usage()
    DB->>DB: Count active lots for organisation
    DB->>DB: INSERT usage_tracking (snapshot_type: billing_cycle)
    DB-->>Cron: Lot count snapshot saved

    Note over Stripe, Webhook: Stripe Invoice Creation

    Stripe->>Stripe: Create invoice at period end
    Stripe->>Stripe: Apply graduated pricing tiers to lot count
    Note right of Stripe: First 10 lots: $0<br/>Lots 11-100: $2.50/lot<br/>Lots 101-500: $1.50/lot<br/>Lots 501-2000: $1.00/lot<br/>Lots 2001+: $0.75/lot
    Stripe->>Stripe: Charge payment method (card or BECS)

    alt Payment succeeds
        Stripe->>Webhook: POST webhook (invoice.paid)
        Webhook->>Webhook: Verify Stripe signature
        Webhook->>DB: UPDATE subscriptions SET status = 'active'
        Webhook->>DB: UPDATE current_period_start, current_period_end
        Webhook->>DB: UPDATE billed_lots_count
        Webhook->>DB: UPSERT platform_invoices (subtotal, GST, total, lots_billed, status: paid)
        Webhook->>DB: INSERT payment_events (event_type: invoice.paid)
        App->>App: Subscription active, full access continues
    else Payment fails
        Stripe->>Webhook: POST webhook (invoice.payment_failed)
        Webhook->>DB: UPDATE subscriptions SET status = 'past_due'
        Webhook->>DB: INSERT payment_events (event_type: invoice.payment_failed)
        App->>App: Show in-app banner "Payment failed"
        App->>App: Email manager with payment update link
    end
```

---

## 3. Failed Payment Dunning Process (Flowchart)

What happens when a recurring payment fails, including Stripe Smart Retries, grace period, and eventual data retention/purge.

```mermaid
flowchart TD
    A["Payment fails<br/>(invoice.payment_failed webhook)"] --> B["status = past_due<br/>In-app banner: 'Payment failed'"]

    B --> C["Stripe Smart Retry #1<br/>(Day 1)"]
    C --> D{"Retry succeeds?"}
    D -->|Yes| E["status = active<br/>Full access restored"]
    D -->|No| F["Stripe Smart Retry #2<br/>(Day 3)"]

    F --> G{"Retry succeeds?"}
    G -->|Yes| E
    G -->|No| H["Stripe Smart Retry #3<br/>(Day 5)"]

    H --> I{"Retry succeeds?"}
    I -->|Yes| E
    I -->|No| J["All retries exhausted<br/>status remains past_due"]

    J --> K["7-day grace period begins<br/>Email: 'Update payment method'"]
    K --> L["Day 3 of grace: Email reminder<br/>'4 days to update payment'"]
    L --> M{"Manager updates<br/>payment method?"}

    M -->|Yes| N["Stripe charges new method"]
    N --> O{"Payment succeeds?"}
    O -->|Yes| E
    O -->|No| K

    M -->|No| P["Grace period expires (Day 7)"]
    P --> Q["status = canceled<br/>Write access revoked (read-only)"]
    Q --> R["Email: 'Subscription canceled.<br/>90 days to export data.'"]

    R --> S["90-day data retention<br/>Read-only access, can reactivate"]
    S --> T["Day 83: Email warning<br/>'Data deleted in 7 days'"]
    T --> U{"Manager reactivates?"}

    U -->|Yes| V["New payment via Stripe Checkout"]
    V --> E
    U -->|No| W["Day 90: Organisation data<br/>permanently deleted"]

    style E fill:#c8e6c9
    style Q fill:#ffcdd2
    style W fill:#ef9a9a
    style J fill:#fff9c4
```
