# Plan Limits & Graduated Pricing Diagrams

Covers graduated pricing calculation, plan limit enforcement, upgrade flow, downgrade flow, and feature gating.

---

## 1. Graduated Pricing Calculation (Flowchart)

How the graduated pricing model works, with a concrete example for 300 lots.

```mermaid
flowchart TD
    A["Input: 300 lots"] --> B["Apply graduated tiers<br/>(each tier applies only to lots in that range)"]

    B --> C["Tier 1: Lots 1-10<br/>10 lots x $0/lot = $0"]
    B --> D["Tier 2: Lots 11-100<br/>90 lots x $2.50/lot = $225"]
    B --> E["Tier 3: Lots 101-500<br/>200 lots x $1.50/lot = $300"]
    B --> F["Tier 4: Lots 501-2000<br/>0 lots x $1.00/lot = $0"]
    B --> FA["Tier 5: Lots 2001+<br/>0 lots x $0.75/lot = $0"]

    C --> G["Sum all tiers"]
    D --> G
    E --> G
    F --> G
    FA --> G

    G --> H["Monthly subtotal: $525 ex GST"]
    H --> I["GST (10%): $52.50"]
    I --> J["Monthly total: $577.50 inc GST"]

    H --> K{"Billing interval?"}

    K -->|Monthly| L["$525/month ex GST<br/>$577.50/month inc GST<br/>$6,300/year ex GST"]

    K -->|Annual| M["2 months free discount<br/>$525 x 10 = $5,250/year ex GST"]
    M --> N["GST (10%): $525"]
    N --> O["Annual total: $5,775 inc GST<br/>Savings: $1,050 ex GST vs monthly"]

    style A fill:#e1f5fe
    style J fill:#c8e6c9
    style L fill:#c8e6c9
    style O fill:#c8e6c9
```

---

## 2. Plan Limit Enforcement (Flowchart)

Database-level enforcement when a manager adds a lot. A trigger fires `check_plan_limits()` to validate the lot count against the subscription plan.

```mermaid
flowchart TD
    A["Manager adds a new lot<br/>INSERT INTO lots"] --> B["BEFORE INSERT trigger fires:<br/>enforce_lot_limit()"]

    B --> C["Get organisation_id<br/>from scheme"]
    C --> D["Call check_plan_limits(org_id)"]

    D --> E["Count current lots<br/>across all schemes for org"]
    E --> F["Get subscription status<br/>and plan max_lots"]

    F --> G{"status = trialing or active<br/>AND max_lots IS NULL?"}
    G -->|Yes| H["Unlimited lots<br/>(paid plan)"]
    H --> I["RETURN: within_limits = TRUE"]
    I --> J["Lot INSERT succeeds"]

    G -->|No| K{"current_lots >= max_lots?"}
    K -->|No| L["Within limits"]
    L --> J

    K -->|Yes| M["RAISE EXCEPTION:<br/>'Lot limit reached: N/N.<br/>Upgrade your plan.'"]
    M --> N["Lot INSERT blocked"]
    N --> O["UI shows upgrade prompt<br/>with price difference"]

    style J fill:#c8e6c9
    style N fill:#ffcdd2
    style O fill:#fff9c4
```

---

## 3. Upgrade Flow (Sequence Diagram)

What happens when a free-tier manager reaches the 10-lot limit, triggering an upgrade to a paid plan.

```mermaid
sequenceDiagram
    autonumber
    actor Manager
    participant App as LevyLite App
    participant DB as PostgreSQL
    participant Stripe as Stripe Billing
    participant Webhook as Webhook Handler

    Note over Manager, Webhook: Approaching Limit

    Manager->>App: Add lot #9 (of 10 max on free tier)
    App->>DB: INSERT lots (lot #9)
    DB->>DB: enforce_lot_limit() trigger
    DB->>DB: check_plan_limits(): 9/10 within limits
    DB-->>App: Lot added successfully
    App-->>Manager: Warning banner: "1 lot remaining on free tier"

    Manager->>App: Add lot #10 (of 10 max)
    App->>DB: INSERT lots (lot #10)
    DB->>DB: enforce_lot_limit() trigger
    DB->>DB: check_plan_limits(): 10/10 within limits (equal, not over)
    DB-->>App: Lot added successfully
    App-->>Manager: Warning: "Lot limit reached (10/10). Upgrade to add more."

    Note over Manager, Stripe: Upgrade Required

    Manager->>App: Try to add lot #11
    App->>DB: INSERT lots (lot #11)
    DB->>DB: enforce_lot_limit() trigger
    DB->>DB: check_plan_limits(): 10/10 at limit
    DB-->>App: EXCEPTION: "Lot limit reached"
    App-->>Manager: "You need to upgrade. 11 lots = $2.50/mo ex GST."

    Manager->>App: Click "Upgrade Now"
    App->>Stripe: Create Checkout session (quantity: 11)
    Note right of Stripe: Stripe Checkout page<br/>with graduated pricing
    Stripe-->>App: Subscription created
    Stripe->>Webhook: POST checkout.session.completed
    Webhook->>DB: UPDATE subscriptions SET status = 'active'
    Webhook->>DB: INSERT payment_events
    Webhook-->>Stripe: 200 OK

    Manager->>App: Retry add lot #11
    App->>DB: INSERT lots (lot #11)
    DB->>DB: check_plan_limits(): 11 lots, max_lots = NULL (paid, unlimited)
    DB-->>App: Lot added successfully
    App-->>Manager: "Lot 11 added. Monthly rate: $2.50/mo ex GST."
```

---

## 4. Downgrade Flow (Sequence Diagram)

What happens when a manager on a paid plan attempts to cancel and revert to the free tier. Lots must be within the free tier limits (10 lots, 1 scheme) before the downgrade can proceed.

```mermaid
sequenceDiagram
    autonumber
    actor Manager
    participant App as LevyLite App
    participant DB as PostgreSQL
    participant Stripe as Stripe Billing
    participant Webhook as Webhook Handler

    Manager->>App: Navigate to Settings > Billing
    App->>DB: Fetch subscription (status: active, 120 lots)
    App-->>Manager: Current plan: Paid (120 lots, $255/mo ex GST)

    Manager->>App: Click "Cancel Subscription"
    App->>App: Check: will revert to free tier (max 10 lots, 1 scheme)
    App-->>Manager: Warning: "You have 120 lots across 8 schemes.<br/>Free tier allows max 10 lots and 1 scheme.<br/>You must remove lots and schemes first,<br/>or stay on your current plan."

    alt Manager stays on current plan
        Manager->>App: Click "Keep Current Plan"
        App-->>Manager: No changes made
    else Manager reduces lots
        Note over Manager, DB: Manager removes lots over multiple sessions
        Manager->>App: Remove lots and schemes until at 10 lots, 1 scheme
        App->>DB: DELETE/soft-delete lots and schemes
        Manager->>App: Click "Cancel Subscription" again
        App->>App: Check: 10 lots, 1 scheme -- within free tier limits
        App-->>Manager: "Your subscription will remain active until<br/>[period end date]. After that, you'll be on the<br/>free tier with core features."
        Manager->>App: Confirm cancellation
        App->>Stripe: Set cancel_at_period_end = true
        Stripe-->>App: Confirmed
        Stripe->>Webhook: POST customer.subscription.updated
        Webhook->>DB: UPDATE subscriptions SET cancel_at_period_end = true
        Webhook-->>Stripe: 200 OK
        App-->>Manager: "Cancellation scheduled for [date]"

        Note over Stripe, DB: At Period End
        Stripe->>Webhook: POST customer.subscription.deleted
        Webhook->>DB: UPDATE subscriptions SET status = 'free', plan_id = free_plan_id
        Webhook-->>Stripe: 200 OK
    end
```

---

## 5. Feature Gating (Flowchart)

How access to paid-only features is controlled via the `subscription_plans.features` JSONB column.

```mermaid
flowchart TD
    A["User requests access to feature<br/>(e.g., trust accounting, bulk notices)"] --> B["canAccessFeature(status, trialEndDate, feature)"]

    B --> C{"subscription.status<br/>= 'active'?"}
    C -->|Yes| D["All features enabled<br/>Access GRANTED"]

    C -->|No| E{"subscription.status<br/>= 'trialing'?"}
    E -->|Yes| F{"Trial still active?<br/>(now < trial_end_date)"}
    F -->|Yes| D
    F -->|No| G["Trial expired<br/>Check feature flags"]

    E -->|No| G

    G --> H["Lookup subscription_plans.features JSONB"]
    H --> I{"feature enabled<br/>in plan?"}
    I -->|Yes| D
    I -->|No| J["Access DENIED"]

    J --> K{"Which feature?"}
    K -->|trust_accounting| L["'Trust accounting requires<br/>a paid subscription'"]
    K -->|bulk_levy_notices| M["'Bulk levy notices require<br/>a paid subscription'"]
    K -->|financial_reporting| N["'Financial reporting requires<br/>a paid subscription'"]
    K -->|csv_import_export| O["'CSV import/export requires<br/>a paid subscription'"]

    L --> P["Show upgrade prompt<br/>with pricing calculator"]
    M --> P
    N --> P
    O --> P

    style D fill:#c8e6c9
    style J fill:#ffcdd2
    style P fill:#fff9c4
```
