# Signup & Onboarding Diagrams

Covers the full signup flow from landing page through trial, the trial expiry decision tree, and the pricing calculator logic.

---

## 1. Signup & Subscription Onboarding (Sequence Diagram)

Full flow from landing page visit through to an active paid subscription.

```mermaid
sequenceDiagram
    autonumber
    actor Manager
    participant Landing as Landing Page
    participant Auth as Supabase Auth
    participant DB as PostgreSQL
    participant App as LevyLite App
    participant Stripe as Stripe Checkout
    participant Webhook as Webhook Handler

    Note over Manager, Webhook: Phase 1 -- Signup & Trial

    Manager->>Landing: Visit landing page
    Manager->>Landing: Click "Start Free Trial"
    Landing->>Auth: POST /auth/signup (email, password, org name)
    Auth->>Auth: Create auth.users record
    Auth->>DB: Auth hook fires
    DB->>DB: INSERT organisations (name)
    DB->>DB: INSERT organisation_users (role: manager)
    DB->>DB: INSERT subscriptions (status: trialing, trial_end_date: NOW() + 14 days)
    Auth-->>Manager: Redirect to /dashboard

    Note over Manager, App: Phase 2 -- Onboarding & Trial Usage

    Manager->>App: Onboarding wizard
    App->>DB: Add first scheme
    App->>DB: Add lots to scheme
    Manager->>App: Use all features during trial (trust accounting, bulk notices, etc.)

    Note over Manager, App: Phase 3 -- Trial Nearing Expiry

    App->>Manager: Day 10: Email "Trial ends in 4 days"
    App->>Manager: Day 13: Email "Trial ends tomorrow"
    App->>Manager: Day 14: In-app banner "Trial expired - select a plan"

    Note over Manager, Stripe: Phase 4 -- Plan Selection & Payment

    Manager->>App: Navigate to /billing/select-plan
    App->>App: Show lot count, calculate graduated price
    Manager->>App: Click "Choose Monthly" or "Choose Annual"
    App->>Stripe: POST create-checkout-session (plan, org_id, lot count)
    Stripe-->>Manager: Redirect to Stripe Checkout page
    Manager->>Stripe: Enter payment details (card or BECS)
    Stripe->>Stripe: Process payment

    Note over Stripe, DB: Phase 5 -- Activation via Webhook

    Stripe->>Webhook: POST /api/webhooks/stripe (checkout.session.completed)
    Webhook->>Webhook: Verify Stripe signature
    Webhook->>DB: UPDATE subscriptions SET status = 'active'
    Webhook->>DB: SET stripe_customer_id, stripe_subscription_id
    Webhook->>DB: SET current_period_start, current_period_end
    Webhook->>DB: INSERT payment_events (event logged)
    Stripe-->>Manager: Redirect back to /billing/success
    Manager->>App: Full access continues with active subscription
```

---

## 2. Trial Expiry Decision Tree (Flowchart)

What happens when the 14-day trial expires, depending on the organisation's lot count and payment status.

```mermaid
flowchart TD
    A["Trial Expires (Day 14)"] --> B{"Has payment method?<br/>(Stripe subscription exists)"}

    B -->|Yes| C["Charge via Stripe"]
    C --> D{"Payment succeeds?"}
    D -->|Yes| E["status = active<br/>Full access continues"]
    D -->|No| F["status = past_due<br/>Start 7-day grace period"]

    B -->|No| G{"Organisation has<br/>> 10 lots OR > 1 scheme?"}

    G -->|Yes| H["Restrict features<br/>Read-only for paid features"]
    H --> I["Show upgrade prompt:<br/>'Subscribe to keep full access'"]
    I --> J["Manager selects plan<br/>-> Stripe Checkout"]

    G -->|No| K["Downgrade to free tier<br/>status = free"]
    K --> L["Core features remain:<br/>Scheme register, levy management,<br/>documents, owner portal, meetings"]
    L --> M["Paid features gated:<br/>Trust accounting, bulk notices,<br/>financial reporting, CSV import/export"]

    style E fill:#c8e6c9
    style K fill:#e1f5fe
    style H fill:#fff9c4
    style F fill:#ffcdd2
```

---

## 3. Pricing Calculator (Flowchart)

Interactive pricing calculator logic used on the landing page and billing settings. Shows graduated pricing calculation with a concrete example.

```mermaid
flowchart TD
    A["User enters lot count<br/>(slider or number input)"] --> B{"Total lots entered"}

    B --> C["Graduated Pricing Calculation"]

    C --> D["Tier 1: First 10 lots<br/>Rate: FREE ($0/lot)"]
    C --> E["Tier 2: Lots 11-100<br/>Rate: $2.50/lot/month ex GST"]
    C --> F["Tier 3: Lots 101-500<br/>Rate: $1.50/lot/month ex GST"]
    C --> G["Tier 4: Lots 501-2,000<br/>Rate: $1.00/lot/month ex GST"]
    C --> GA["Tier 5: Lots 2,001+<br/>Rate: $0.75/lot/month ex GST"]

    D --> H["Sum tier amounts"]
    E --> H
    F --> H
    G --> H
    GA --> H

    H --> I["Monthly subtotal ex GST"]
    I --> J["+ GST (10%)"]
    J --> K["Monthly total inc GST"]
    I --> L["Annual total ex GST<br/>(monthly x 12)"]
    I --> M["Annual discounted ex GST<br/>(monthly x 10 -- 2 months free)"]

    K --> N["Display Results"]
    L --> N
    M --> N

    N --> O["Example: 300 lots"]
    O --> P["Tier 1: 10 lots x $0 = $0"]
    O --> Q["Tier 2: 90 lots x $2.50 = $225"]
    O --> R["Tier 3: 200 lots x $1.50 = $300"]
    P --> S["Monthly subtotal: $525 ex GST"]
    Q --> S
    R --> S
    S --> T["GST: $52.50"]
    T --> U["Monthly total: $577.50 inc GST"]
    S --> V["Annual (no discount): $6,300 ex GST"]
    S --> W["Annual (2mo free): $5,250 ex GST<br/>Save $1,050"]

    style A fill:#e1f5fe
    style U fill:#c8e6c9
    style W fill:#c8e6c9
```
