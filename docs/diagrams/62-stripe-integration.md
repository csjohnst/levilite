# Stripe Integration Diagrams

Covers Stripe Checkout flow, Customer Portal integration, webhook event handling, and BECS Direct Debit payment flow.

---

## 1. Stripe Checkout Flow (Sequence Diagram)

Initial subscription creation via Stripe Checkout, from plan selection through payment to subscription activation.

```mermaid
sequenceDiagram
    autonumber
    actor Manager
    participant App as LevyLite App
    participant API as POST /api/billing/create-checkout-session
    participant DB as PostgreSQL
    participant Stripe as Stripe Checkout
    participant Webhook as POST /api/webhooks/stripe

    Manager->>App: Navigate to /billing/select-plan
    App->>DB: Fetch current lot count, subscription status
    DB-->>App: 100 lots, status: trialing
    App-->>Manager: Show pricing (100 lots = $225/mo ex GST)

    Manager->>App: Click "Choose Monthly"
    App->>API: POST { billingInterval: "monthly" }
    API->>API: Validate auth (must be manager role)
    API->>DB: Get subscription + paid plan price ID
    API->>DB: Count lots for quantity

    alt No Stripe customer yet
        API->>Stripe: stripe.customers.create (email, org name, org_id metadata)
        Stripe-->>API: customer_id
        API->>DB: UPDATE subscriptions SET stripe_customer_id
    end

    API->>Stripe: stripe.checkout.sessions.create
    Note right of API: customer: customer_id<br/>payment_method_types: [card, au_becs_debit]<br/>mode: subscription<br/>line_items: [{ price: price_id, quantity: 100 }]<br/>metadata: { organisation_id }
    Stripe-->>API: session.url
    API-->>App: { sessionUrl }
    App-->>Manager: Redirect to Stripe Checkout

    Manager->>Stripe: Enter payment details
    Stripe->>Stripe: Process payment
    Stripe-->>Manager: Redirect to /billing/success

    Note over Stripe, DB: Webhook Activation

    Stripe->>Webhook: POST checkout.session.completed
    Webhook->>Webhook: Verify stripe-signature
    Webhook->>DB: UPDATE subscriptions SET status = 'active'
    Webhook->>DB: SET stripe_subscription_id, billing_interval
    Webhook->>DB: SET current_period_start, current_period_end
    Webhook->>DB: SET billed_lots_count = 100
    Webhook->>DB: INSERT payment_events
    Webhook-->>Stripe: 200 OK
```

---

## 2. Stripe Customer Portal (Sequence Diagram)

Self-service billing management via Stripe's hosted Customer Portal. Handles upgrades, downgrades, cancellations, and payment method updates.

```mermaid
sequenceDiagram
    autonumber
    actor Manager
    participant App as LevyLite App
    participant API as POST /api/billing/create-portal-session
    participant DB as PostgreSQL
    participant Portal as Stripe Customer Portal
    participant Webhook as POST /api/webhooks/stripe

    Manager->>App: Click "Manage Billing" in Settings
    App->>API: POST /api/billing/create-portal-session
    API->>DB: Get stripe_customer_id for organisation
    API->>Portal: stripe.billingPortal.sessions.create (customer_id, return_url)
    Portal-->>API: portal_session.url
    API-->>App: { portalUrl }
    App-->>Manager: Redirect to Stripe Customer Portal

    Note over Manager, Portal: Self-Service Actions

    alt Upgrade (add more lots)
        Manager->>Portal: Update subscription quantity
        Portal->>Portal: Calculate prorated charge
        Portal-->>Manager: Confirm upgrade + prorated amount
    else Downgrade
        Manager->>Portal: Reduce quantity or cancel at period end
        Portal->>Portal: Set cancel_at_period_end = true
    else Update payment method
        Manager->>Portal: Enter new card or BECS details
        Portal->>Portal: Update default payment method
    else Cancel subscription
        Manager->>Portal: Confirm cancellation
        Portal->>Portal: Set cancel_at_period_end = true
    end

    Portal-->>Manager: Redirect back to /settings/billing

    Note over Portal, DB: Webhook Sync

    Portal->>Webhook: POST customer.subscription.updated
    Webhook->>Webhook: Verify stripe-signature
    Webhook->>DB: UPDATE subscriptions (status, cancel_at_period_end, billed_lots_count, period dates)
    Webhook->>DB: INSERT payment_events
    Webhook-->>Portal: 200 OK

    App->>DB: Fetch updated subscription
    App-->>Manager: Show updated billing status
```

---

## 3. Webhook Event Handler (Flowchart)

How incoming Stripe webhook events are verified, routed, processed, and logged.

```mermaid
flowchart TD
    A["POST /api/webhooks/stripe"] --> B{"stripe-signature<br/>header present?"}

    B -->|No| C["Return 400<br/>Missing signature"]
    B -->|Yes| D["stripe.webhooks.constructEvent<br/>(body, signature, WEBHOOK_SECRET)"]

    D --> E{"Signature valid?"}
    E -->|No| F["Return 400<br/>Invalid signature"]
    E -->|Yes| G["Log event to payment_events<br/>(UPSERT on stripe_event_id)"]

    G --> H{"event.type?"}

    H -->|checkout.session.completed| I["handleCheckoutCompleted()"]
    I --> I1["Retrieve Stripe subscription"]
    I1 --> I2["UPDATE subscriptions:<br/>status = active,<br/>stripe_customer_id,<br/>stripe_subscription_id,<br/>billing_interval,<br/>billed_lots_count,<br/>period dates"]

    H -->|invoice.paid| J["handleInvoicePaid()"]
    J --> J1["UPDATE subscriptions:<br/>status = active,<br/>period dates,<br/>billed_lots_count"]
    J1 --> J2["UPSERT platform_invoices:<br/>subtotal, GST, total,<br/>lots_billed, status: paid,<br/>invoice URL, PDF URL"]

    H -->|invoice.payment_failed| K["handleInvoicePaymentFailed()"]
    K --> K1["UPDATE subscriptions:<br/>status = past_due"]
    K1 --> K2["Send in-app notification<br/>+ email to manager"]

    H -->|customer.subscription.updated| L["handleSubscriptionUpdated()"]
    L --> L1["UPDATE subscriptions:<br/>status, cancel_at_period_end,<br/>billed_lots_count, period dates"]
    L1 --> L2{"subscription.canceled_at<br/>is set?"}
    L2 -->|Yes| L3["SET canceled_at,<br/>data_retention_expires_at<br/>(+90 days)"]
    L2 -->|No| L4["Continue"]

    H -->|customer.subscription.deleted| M["handleSubscriptionDeleted()"]
    M --> M1["UPDATE subscriptions:<br/>status = canceled,<br/>canceled_at = now,<br/>data_retention_expires_at<br/>= now + 90 days"]

    H -->|Other| N["No handler<br/>(event still logged)"]

    I2 --> O["Mark event as processed<br/>(processed = true, processed_at)"]
    J2 --> O
    K2 --> O
    L3 --> O
    L4 --> O
    M1 --> O
    N --> O

    O --> P["Return 200 OK"]

    style C fill:#ffcdd2
    style F fill:#ffcdd2
    style P fill:#c8e6c9
```

---

## 4. BECS Direct Debit Flow (Flowchart)

Australian BECS Direct Debit payment flow via Stripe, showing the mandate creation and delayed settlement process.

```mermaid
flowchart TD
    A["Customer reaches Stripe Checkout"] --> B{"Select payment method"}

    B -->|Credit/Debit Card| C["Enter card details"]
    C --> D["Stripe charges card<br/>(instant settlement)"]
    D --> E["checkout.session.completed<br/>webhook fires immediately"]

    B -->|BECS Direct Debit| F["Enter BSB + Account Number"]
    F --> G["Customer accepts<br/>Direct Debit Request (DDR)<br/>service agreement"]
    G --> H["Stripe creates mandate<br/>(authorisation to debit account)"]
    H --> I["Stripe initiates debit<br/>(via BECS clearing system)"]
    I --> J["3-5 business day<br/>settlement period"]
    J --> K{"Debit succeeds?"}

    K -->|Yes| L["invoice.paid webhook fires"]
    L --> M["status = active<br/>Subscription confirmed"]

    K -->|No| N["invoice.payment_failed<br/>webhook fires"]
    N --> O["Possible reasons:<br/>- Insufficient funds<br/>- Invalid account<br/>- Mandate revoked"]
    O --> P["status = past_due<br/>Dunning process begins"]

    E --> Q["status = active<br/>Subscription confirmed"]

    Note over F,G: BECS fees: ~1% + A$0.30<br/>capped at A$3.50 per transaction

    style Q fill:#c8e6c9
    style M fill:#c8e6c9
    style P fill:#ffcdd2
```
