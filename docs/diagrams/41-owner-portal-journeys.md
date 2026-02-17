# Owner Portal Journeys

User journey diagrams for strata scheme owners accessing the self-service portal. The portal is mobile-first with passwordless (magic link) authentication.

## 1. Owner Activation Journey

The end-to-end flow from receiving an invitation email to viewing the owner dashboard for the first time.

```mermaid
journey
    title Owner Activation Journey
    section Receive Invitation
      Manager clicks Invite to Portal: 5: Manager
      System sends invitation email: 5: System
      Owner receives Welcome email: 4: Owner
    section Activate Account
      Owner clicks Activate My Account: 5: Owner
      Browser opens activation page: 4: Owner
      Owner confirms email address: 4: Owner
      System creates Supabase Auth user: 5: System
      System links auth user to owner record: 5: System
    section First Login
      System sends magic link email: 5: System
      Owner clicks Log In to Portal: 5: Owner
      Session created - 90 day expiry: 5: System
      Owner sees dashboard for first time: 5: Owner
```

## 2. Owner Activation Flow (Detail)

Step-by-step flowchart showing the invitation and activation process including error handling.

```mermaid
flowchart TD
    subgraph ManagerSide["Manager Portal"]
        M1[Navigate to Scheme > Lot Register] --> M2[Select owner record]
        M2 --> M3[Click 'Invite to Portal']
        M3 --> M4{Owner has email?}
        M4 -->|No| M5[Error: Email required]
        M4 -->|Yes| M6{Already invited?}
        M6 -->|Yes| M7[Option: Resend invitation]
        M6 -->|No| M8[System sends invitation email]
        M7 --> M8
    end

    subgraph EmailDelivery["Email Delivery"]
        M8 --> E1[Resend delivers invitation email]
        E1 --> E2["Welcome to [Scheme Name] Owner Portal"]
        E2 --> E3[CTA: Activate My Account]
    end

    subgraph OwnerActivation["Owner Activation"]
        E3 --> O1[Owner clicks activation link]
        O1 --> O2{Token valid?}
        O2 -->|Expired| O3[Error: Link expired, request new one]
        O2 -->|Valid| O4[Display confirmation page]
        O4 --> O5[Owner clicks 'Confirm and Continue']
        O5 --> O6[Create Supabase Auth user]
        O6 --> O7[Link auth_user_id to owners table]
        O7 --> O8[Set portal_invite_accepted_at]
        O8 --> O9[Send magic link email automatically]
    end

    subgraph FirstLogin["First Login"]
        O9 --> L1[Owner receives magic link email]
        L1 --> L2[Owner clicks 'Log In to Portal']
        L2 --> L3[Supabase validates magic link token]
        L3 --> L4[Session created - 90 day expiry]
        L4 --> L5[Redirect to owner dashboard]
    end

    style ManagerSide fill:#F6F8FA,stroke:#02667F
    style EmailDelivery fill:#F6F8FA,stroke:#0090B7
    style OwnerActivation fill:#F6F8FA,stroke:#0090B7
    style FirstLogin fill:#F6F8FA,stroke:#10B981
    style L5 fill:#10B981,stroke:#10B981,color:#fff
```

## 3. Returning Owner Login Flow

The magic link authentication flow for owners who already have an activated account.

```mermaid
sequenceDiagram
    actor Owner
    participant Portal as Owner Portal
    participant Auth as Supabase Auth
    participant Email as Resend (Email)
    participant DB as PostgreSQL

    Owner->>Portal: Visit portal.levylite.com.au/login
    Portal-->>Owner: Display email input form

    Owner->>Portal: Enter email, click "Send Login Link"
    Portal->>Auth: requestMagicLink(email)
    Auth->>DB: Check email exists in owners table
    DB-->>Auth: Owner found (auth_user_id set)
    Auth->>Email: Send magic link email
    Email-->>Owner: "Your Login Link" email delivered

    Note over Owner: Owner opens email on phone

    Owner->>Portal: Click "Log In to Portal"
    Portal->>Auth: verifyMagicLinkToken(token)
    Auth-->>Portal: Token valid, session created
    Portal->>DB: Query owner lots via lot_ownerships
    DB-->>Portal: Owner's lot data
    Portal-->>Owner: Redirect to dashboard

    Note over Owner,DB: Session active for 90 days
```

## 4. Owner Dashboard Components

Visual layout showing the key components of the owner dashboard for single-lot and multi-lot owners.

```mermaid
flowchart TD
    subgraph Header["Header Bar"]
        H1[LevyLite Logo]
        H2["Scheme: Sunset Apartments"]
        H3["Lot: Unit 12"]
        H4["User Menu: John ▼"]
    end

    subgraph HeroCard["Hero Card: Levy Balance"]
        L1["Current Balance: $0.00"]
        L2["Status: Up to Date ✓"]
        L3["Next Levy: $450.00 on 31 Mar 2026"]
        L4["CTA: View Payment Details"]
    end

    subgraph PaymentChart["Payment History (12 months)"]
        P1["Bar chart: green=on time, orange=late, red=unpaid"]
    end

    subgraph QuickActions["Quick Actions Grid (2x2)"]
        Q1["View Levy Statement"]
        Q2["Submit Maintenance Request"]
        Q3["View Documents"]
        Q4["Upcoming Meetings"]
    end

    Header --> HeroCard
    HeroCard --> PaymentChart
    PaymentChart --> QuickActions

    style Header fill:#02667F,stroke:#02667F,color:#fff
    style HeroCard fill:#F6F8FA,stroke:#10B981
    style PaymentChart fill:#F6F8FA,stroke:#0090B7
    style QuickActions fill:#F6F8FA,stroke:#02667F
```

## 5. Multi-Lot Owner Dashboard

Dashboard variation for owners with multiple lots across one or more schemes.

```mermaid
flowchart TD
    subgraph LotSelector["Lot Selector (Sticky Top)"]
        LS1["All Lots (Summary) ▼"]
        LS2["Sunset Apartments - Unit 12"]
        LS3["Sunset Apartments - Unit 5"]
        LS4["Ocean View Towers - Unit 401"]
    end

    subgraph Summary["All Lots Summary View"]
        S1["Total Balance: $1,234.56"]
        S2["Lots in Arrears: 1 of 3"]
        S3["Next Levies Due: $1,350.00"]
    end

    subgraph LotTable["Lot Breakdown Table"]
        T1["Sunset Apts - Unit 12 | $1,234.56 | Overdue"]
        T2["Sunset Apts - Unit 5  | $0.00     | Up to Date"]
        T3["Ocean View  - Unit 401| $0.00     | Up to Date"]
    end

    LotSelector --> Summary
    Summary --> LotTable
    LotTable -->|Click row| D1[Drill into lot-specific dashboard]

    style LotSelector fill:#02667F,stroke:#02667F,color:#fff
    style Summary fill:#F6F8FA,stroke:#F59E0B
    style LotTable fill:#F6F8FA,stroke:#02667F
```

## 6. Owner Self-Service Flows

Flowchart showing all the self-service actions an owner can perform through the portal.

```mermaid
flowchart TD
    D[Owner Dashboard] --> F1[View Levy Statement]
    D --> F2[Download Documents]
    D --> F3[Submit Maintenance Request]
    D --> F4[Update Contact Details]
    D --> F5[View Meeting Information]

    subgraph LevyFlow["View Levy Statement"]
        F1 --> L1[View current balance + arrears]
        L1 --> L2[View payment history table]
        L2 --> L3[View payment instructions - bank details]
        L3 --> L4{Download?}
        L4 -->|PDF| L5[Download PDF statement]
        L4 -->|CSV| L6[Export to CSV]
    end

    subgraph DocFlow["Download Documents"]
        F2 --> D1[Browse by category]
        D1 --> D2[Search by filename or keyword]
        D2 --> D3[Filter by date range]
        D3 --> D4{Action?}
        D4 -->|Preview| D5[Open PDF in browser]
        D4 -->|Download| D6[Download to device]
    end

    subgraph MaintFlow["Submit Maintenance Request"]
        F3 --> MR1[Enter subject and description]
        MR1 --> MR2[Select location - common area]
        MR2 --> MR3[Set priority - low/medium/high]
        MR3 --> MR4{Attach photos?}
        MR4 -->|Yes| MR5[Take photo or choose from gallery]
        MR4 -->|No| MR6[Submit request]
        MR5 --> MR6
        MR6 --> MR7[Receive confirmation + request number]
        MR7 --> MR8[Track status updates via email]
    end

    subgraph ContactFlow["Update Contact Details"]
        F4 --> C1[View current details]
        C1 --> C2[Edit phone, address, preferences]
        C2 --> C3{Email changed?}
        C3 -->|Yes| C4[Verification email sent to new address]
        C3 -->|No| C5[Save changes immediately]
        C4 --> C6[Click verification link]
        C6 --> C7[Email updated, manager notified]
        C5 --> C8[Changes saved, manager notified]
    end

    subgraph MeetingFlow["View Meeting Information"]
        F5 --> MT1[View upcoming meetings]
        MT1 --> MT2[View meeting date, time, location]
        MT2 --> MT3{Action?}
        MT3 -->|Download| MT4[Download meeting notice PDF]
        MT3 -->|Calendar| MT5[Add to calendar - .ics file]
        MT3 -->|Past| MT6[Browse past meeting minutes]
    end

    style D fill:#02667F,stroke:#02667F,color:#fff
    style LevyFlow fill:#F6F8FA,stroke:#0090B7
    style DocFlow fill:#F6F8FA,stroke:#0090B7
    style MaintFlow fill:#F6F8FA,stroke:#0090B7
    style ContactFlow fill:#F6F8FA,stroke:#0090B7
    style MeetingFlow fill:#F6F8FA,stroke:#0090B7
```

## 7. Maintenance Request Lifecycle (Owner Perspective)

Sequence diagram showing the full lifecycle of a maintenance request from the owner's point of view.

```mermaid
sequenceDiagram
    actor Owner
    participant Portal as Owner Portal
    participant DB as PostgreSQL
    participant Storage as Supabase Storage
    participant Email as Resend
    actor Manager

    Owner->>Portal: Click "Submit Maintenance Request"
    Owner->>Portal: Fill in subject, description, location, priority
    Owner->>Portal: Take photo with phone camera
    Portal->>Storage: Upload compressed photo
    Storage-->>Portal: Photo URL
    Owner->>Portal: Click "Submit Request"
    Portal->>DB: INSERT maintenance_requests
    Portal->>DB: INSERT maintenance_attachments
    DB-->>Portal: Request #1234 created
    Portal-->>Owner: "Request submitted - #1234"
    Portal->>Email: Notify manager of new request
    Email-->>Manager: "New maintenance request #1234"

    Note over Owner,Manager: Manager assigns tradesperson

    Manager->>DB: UPDATE status = 'assigned'
    DB->>Email: Trigger notification to owner
    Email-->>Owner: "Your request has been assigned"

    Note over Owner,Manager: Tradesperson completes work

    Manager->>DB: UPDATE status = 'completed', add note
    DB->>Email: Trigger notification to owner
    Email-->>Owner: "Your request has been completed"

    Owner->>Portal: View request #1234
    Portal->>DB: Query request + comments
    DB-->>Portal: Request details + activity timeline
    Portal-->>Owner: Display completed request

    Owner->>Portal: Add comment: "Gate working perfectly"
    Portal->>DB: INSERT maintenance_comments
    Portal->>Email: Notify manager of comment
```

## 8. Owner Notification Flow

Overview of all email notifications an owner receives and their triggers.

```mermaid
flowchart LR
    subgraph Triggers["Notification Triggers"]
        T1[Manager invites owner]
        T2[Owner requests login]
        T3[Manager sends levy notice]
        T4[Maintenance request updated]
        T5[New document uploaded]
        T6[Meeting notice created]
        T7[Owner updates contact details]
    end

    subgraph Emails["Email Notifications"]
        E1["Welcome to Portal"]
        E2["Your Login Link"]
        E3["Levy Notice for Q2 2026"]
        E4["Update on Request #1234"]
        E5["New Document: AGM Minutes"]
        E6["Notice of AGM - 15 May"]
        E7["Contact Details Updated"]
    end

    subgraph Actions["Owner Actions"]
        A1[Activate account]
        A2[Log in to portal]
        A3[View levy in portal]
        A4[View request in portal]
        A5[Download document]
        A6[Add to calendar]
        A7[Confirmation only]
    end

    T1 --> E1 --> A1
    T2 --> E2 --> A2
    T3 --> E3 --> A3
    T4 --> E4 --> A4
    T5 --> E5 --> A5
    T6 --> E6 --> A6
    T7 --> E7 --> A7

    style Triggers fill:#F6F8FA,stroke:#02667F
    style Emails fill:#F6F8FA,stroke:#0090B7
    style Actions fill:#F6F8FA,stroke:#10B981
```
