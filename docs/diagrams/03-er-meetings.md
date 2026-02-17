# Meetings Entity Relationship Diagram

Meeting administration entities covering AGMs, SGMs, committee meetings, agenda items, attendance, proxies, resolutions, and minutes.

**Tables:** meetings, agenda_items, attendees, proxies, resolutions, minutes

```mermaid
erDiagram
    meetings {
        UUID id PK
        UUID scheme_id FK
        TEXT meeting_type "agm | sgm | committee"
        TIMESTAMPTZ meeting_date
        TEXT location
        TEXT status "draft | scheduled | notice_sent | in_progress | completed | adjourned | cancelled"
        TIMESTAMPTZ notice_sent_at
        INTEGER quorum_required
        BOOLEAN quorum_met
        UUID created_by FK
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    agenda_items {
        UUID id PK
        UUID meeting_id FK
        INTEGER item_number
        TEXT title
        TEXT description
        TEXT item_type "presentation | discussion | motion | election"
        TIMESTAMPTZ created_at
    }

    attendees {
        UUID id PK
        UUID meeting_id FK
        UUID owner_id FK "for lot owners"
        UUID user_id FK "for managers/admins"
        TEXT attendance_type "in_person | proxy | online | absent"
        TEXT rsvp_status "yes | no | maybe"
        TIMESTAMPTZ rsvp_at
        TIMESTAMPTZ created_at
    }

    proxies {
        UUID id PK
        UUID meeting_id FK
        UUID owner_id FK "owner granting proxy"
        UUID proxy_holder_id FK "owner receiving proxy"
        TEXT proxy_type "directed | undirected"
        TIMESTAMPTZ lodged_at
        TIMESTAMPTZ created_at
    }

    resolutions {
        UUID id PK
        UUID meeting_id FK
        UUID agenda_item_id FK
        TEXT resolution_text
        TEXT resolution_type "ordinary | special | unanimous"
        UUID moved_by FK "owner"
        UUID seconded_by FK "owner"
        INTEGER votes_for
        INTEGER votes_against
        INTEGER votes_abstain
        TEXT result "passed | failed | deferred"
        TIMESTAMPTZ created_at
    }

    minutes {
        UUID id PK
        UUID meeting_id FK
        TEXT content
        DATE approved_at
        UUID approved_by FK
        UUID created_by FK
        TIMESTAMPTZ created_at
        TIMESTAMPTZ updated_at
    }

    meetings ||--o{ agenda_items : "has agenda"
    meetings ||--o{ attendees : "has attendees"
    meetings ||--o{ proxies : "has proxies"
    meetings ||--o{ resolutions : "has resolutions"
    meetings ||--o| minutes : "has minutes"
    agenda_items ||--o{ resolutions : "resolved at"
```
