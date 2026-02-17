# Core Entity Relationship Diagram

Core entities covering multi-tenant organisations, strata schemes, lots, ownership, committee members, and tenants.

**Tables:** organisations, organisation_users, schemes, lots, owners, lot_ownerships, committee_members, tenants

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

    organisation_users {
        UUID organisation_id PK,FK
        UUID user_id PK,FK
        TEXT role "manager | admin | auditor"
        UUID invited_by FK
        TIMESTAMPTZ invited_at
        TIMESTAMPTZ joined_at
    }

    schemes {
        UUID id PK
        UUID organisation_id FK
        VARCHAR scheme_number UK
        VARCHAR scheme_name
        TEXT address
        VARCHAR suburb
        VARCHAR state
        VARCHAR postcode
        INTEGER total_lots
        BOOLEAN has_elevator
        BOOLEAN has_pool
        BOOLEAN has_gym
        SMALLINT financial_year_end_month
        SMALLINT financial_year_end_day
        TEXT levy_frequency "monthly | quarterly | annual | custom"
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
        TIMESTAMPTZ deleted_at
    }

    lots {
        UUID id PK
        UUID scheme_id FK
        VARCHAR lot_number
        TEXT street_address
        INTEGER unit_entitlement
        BOOLEAN is_owner_occupied
        BOOLEAN is_strata_titled
        INTEGER parking_bays
        INTEGER storage_units
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    owners {
        UUID id PK
        TEXT first_name
        TEXT last_name
        TEXT middle_name
        TEXT preferred_name
        TEXT email UK
        VARCHAR phone_mobile
        VARCHAR phone_work
        VARCHAR phone_home
        TEXT postal_address
        UUID auth_user_id FK
        TIMESTAMPTZ portal_activated_at
        TIMESTAMPTZ portal_invitation_sent_at
        TIMESTAMPTZ portal_invitation_accepted_at
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    lot_ownerships {
        UUID id PK
        UUID lot_id FK
        UUID owner_id FK
        DECIMAL ownership_percentage
        DATE ownership_start_date
        DATE ownership_end_date "NULL for current owners"
        BOOLEAN is_primary_contact
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    committee_members {
        UUID id PK
        UUID scheme_id FK
        UUID owner_id FK
        TEXT position "chair | treasurer | secretary | member"
        DATE elected_at
        DATE term_end_date
        BOOLEAN is_active
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    tenants {
        UUID id PK
        UUID lot_id FK
        TEXT first_name
        TEXT last_name
        TEXT email
        VARCHAR phone_mobile
        DATE lease_start_date
        DATE lease_end_date
        BOOLEAN is_current
        TEXT emergency_contact_name
        VARCHAR emergency_contact_phone
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    organisations ||--o{ organisation_users : "has users"
    organisations ||--o{ schemes : "manages"
    schemes ||--o{ lots : "contains"
    lots ||--o{ lot_ownerships : "has ownerships"
    owners ||--o{ lot_ownerships : "owns lots"
    lots ||--o{ tenants : "occupied by"
    schemes ||--o{ committee_members : "has committee"
    owners ||--o{ committee_members : "serves on"
```
