# Documents Entity Relationship Diagram

Document management entities covering document storage, versioning, and access audit logging.

**Tables:** documents, document_versions, document_audit_log

```mermaid
erDiagram
    documents {
        UUID id PK
        UUID scheme_id FK
        TEXT filename
        TEXT category "agm | levy | insurance | bylaw | maintenance | financial"
        TEXT visibility "owners | committee | manager_only"
        TEXT file_path
        BIGINT file_size
        TEXT mime_type
        TEXT linked_entity_type "levy | meeting | maintenance_request | financial_report"
        UUID linked_entity_id
        INTEGER version_number
        UUID uploaded_by FK
        TIMESTAMPTZ uploaded_at
    }

    document_versions {
        UUID id PK
        UUID document_id FK
        INTEGER version_number
        TEXT file_path
        BIGINT file_size
        UUID uploaded_by FK
        TIMESTAMPTZ uploaded_at
    }

    document_audit_log {
        UUID id PK
        UUID document_id FK
        UUID user_id FK
        TEXT action "view | download | upload | delete"
        INET ip_address
        TEXT user_agent
        TIMESTAMPTZ created_at
    }

    documents ||--o{ document_versions : "has versions"
    documents ||--o{ document_audit_log : "access tracked"
```
