# System Entity Relationship Diagram

System-level entities covering audit logging, user invitations, notifications, and email delivery tracking.

**Tables:** audit_log, invitations, notifications, email_log

```mermaid
erDiagram
    audit_log {
        UUID id PK
        UUID user_id FK
        TEXT action
        TEXT table_name
        UUID record_id
        JSONB old_values
        JSONB new_values
        INET ip_address
        TEXT user_agent
        TIMESTAMPTZ created_at
    }

    invitations {
        UUID id PK
        TEXT email
        TEXT role "manager | admin | auditor | owner"
        UUID organisation_id FK
        UUID scheme_id FK
        UUID owner_id FK "for owner portal invitations"
        TEXT token UK
        TIMESTAMPTZ expires_at
        TIMESTAMPTZ accepted_at
        UUID invited_by FK
        TIMESTAMPTZ created_at
    }

    notifications {
        UUID id PK
        UUID user_id FK
        UUID owner_id FK
        TEXT notification_type "levy_notice | meeting_notice | maintenance_update"
        TEXT title
        TEXT message
        TIMESTAMPTZ read_at
        TIMESTAMPTZ sent_at
        TIMESTAMPTZ created_at
    }

    email_log {
        UUID id PK
        TEXT recipient_email
        TEXT subject
        TEXT email_type "levy_notice | meeting_notice | invitation | maintenance_update"
        TEXT linked_entity_type
        UUID linked_entity_id
        TIMESTAMPTZ sent_at
        TIMESTAMPTZ delivered_at
        TIMESTAMPTZ bounced_at
        TIMESTAMPTZ opened_at
        TEXT external_id "email provider message ID"
        TEXT status "queued | sent | delivered | bounced | failed"
    }
```
