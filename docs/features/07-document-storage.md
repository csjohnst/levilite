# Feature Specification: Document Storage (7-Year Retention)

**Product:** LevyLite  
**Feature:** Document Storage & Management  
**Version:** 1.0 MVP  
**Date:** 16 February 2026  
**Author:** Kai (AI Assistant), Kokoro Software  

---

## 1. Overview

Document storage is a **critical compliance feature** for strata management. The Western Australian Strata Titles Act requires managers to maintain comprehensive records, with an implied 7-year retention period for administrative records, meeting minutes, financial statements, and correspondence. Currently, small operators store documents in a mix of local folders, email archives, and paper files—creating compliance risk, retrieval inefficiency, and potential data loss.

This specification defines a **cloud-based document management system** built on Supabase Storage, providing:

- **Compliant 7-year retention** with automatic expiry tracking
- **Per-scheme organisation** with flexible folder structure
- **Full-text search** across filenames, tags, and metadata
- **Granular access control** via Supabase Row-Level Security (RLS)
- **Complete audit trail** of all document operations
- **Seamless integration** with levy notices, AGM administration, financial reports, and maintenance requests

### Business Goals

1. **Eliminate compliance risk:** Never lose documents, track retention automatically, survive Consumer Protection audits
2. **Save manager time:** 5-10 hours/month saved vs. manual filing/retrieval
3. **Reduce owner queries:** Self-service portal access to common documents (by-laws, AGM minutes, insurance certificates)
4. **Enable feature integration:** Automatically store system-generated documents (levy notices, meeting minutes, financial reports)

### Success Metrics

- **Adoption:** 80%+ of customers upload at least 20 documents per scheme within first month
- **Search effectiveness:** <30 seconds to find any document (vs. 5-10 minutes with manual filing)
- **Owner portal usage:** 40%+ of owners download at least 1 document per year (reduced manager workload)
- **Zero compliance failures:** No customer fails document retention audit due to platform limitations

---

## 2. Storage Architecture

### 2.1 Supabase Storage Buckets

Supabase Storage provides S3-compatible object storage with CDN distribution, encryption at rest, and RLS integration. We'll use a **single bucket per environment** with logical separation via folder paths.

**Bucket Configuration:**

```javascript
// Supabase Storage bucket setup
const bucketConfig = {
  name: 'scheme-documents',
  public: false, // All files private by default
  fileSizeLimit: 52428800, // 50MB per file
  allowedMimeTypes: [
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv',
    
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    
    // Archives
    'application/zip',
    'application/x-rar-compressed'
  ]
};
```

**Storage Policy (Supabase Dashboard):**

```sql
-- Storage: Bucket RLS Policy
-- Managers can upload/view/delete documents for their schemes
CREATE POLICY "Managers access their scheme documents"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'scheme-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT scheme_id::text 
    FROM schemes 
    WHERE manager_user_id = auth.uid()
  )
);

-- Owners can view documents for their lots (read-only)
CREATE POLICY "Owners view their scheme documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'scheme-documents'
  AND (storage.foldername(name))[1] IN (
    SELECT s.scheme_id::text
    FROM lots l
    JOIN schemes s ON l.scheme_id = s.scheme_id
    WHERE l.owner_user_id = auth.uid()
  )
  AND EXISTS (
    -- Check document is marked owner-accessible
    SELECT 1 FROM documents d
    WHERE d.storage_path = name
    AND d.owner_accessible = true
  )
);
```

### 2.2 Folder Structure

**Path Format:** `{scheme_id}/{category}/{year}/{filename}`

**Example:**
```
scheme-documents/
├── sch_abc123/
│   ├── agm/
│   │   ├── 2024/
│   │   │   ├── agm-notice-2024-annual.pdf
│   │   │   ├── agm-minutes-2024-annual.pdf
│   │   │   └── financial-statements-2024.pdf
│   │   ├── 2025/
│   │   └── 2026/
│   ├── levy-notices/
│   │   ├── 2024/
│   │   └── 2025/
│   ├── insurance/
│   │   └── 2025/
│   │       └── building-insurance-certificate-2025.pdf
│   ├── bylaws/
│   │   └── 2019/
│   │       └── amended-bylaws-2019.pdf
│   ├── correspondence/
│   │   └── 2025/
│   ├── maintenance/
│   │   └── 2025/
│   └── contracts/
│       └── 2024/
```

**Benefits:**

- **Scheme isolation:** RLS policies filter by scheme_id (first path segment)
- **Category browsing:** Natural folder hierarchy for manager navigation
- **Year-based retention:** Easy to identify documents approaching 7-year expiry
- **Collision avoidance:** Year subfolder reduces filename conflicts

### 2.3 Fair Use Policy

**Storage Limits by Tier:**

| Tier | Lots | Storage Limit | Documents/Scheme (est.) |
|------|------|---------------|-------------------------|
| Free | 1-10 | 5 GB | ~500-1,000 documents |
| Starter | 11-50 | 25 GB | ~250 docs/scheme |
| Professional | 51-200 | 100 GB | ~200 docs/scheme |
| Growth | 201-500 | 250 GB | ~150 docs/scheme |

**Overage:** $0.50/GB/month beyond limit (aligns with Supabase Storage pricing of $0.021/GB/month + CDN costs).

**Typical Usage Estimate:**
- Average document size: 500 KB (PDFs with images)
- Average scheme: 50 documents/year × 7 years = 350 documents = 175 MB
- 100-lot customer (20 schemes): 3.5 GB well within Professional tier limit

---

## 3. Document Types

### 3.1 Category Taxonomy

**Primary Categories** (system-defined, non-editable):

| Category | Description | Retention | Owner Access |
|----------|-------------|-----------|--------------|
| **AGM/SGM** | Annual/Special General Meeting notices, agendas, minutes, resolutions, financial statements | 7 years | Yes (minutes, notices, financials) |
| **Levy Notices** | Quarterly/annual levy notices, owner statements | 7 years | Yes (own lot only) |
| **Financial** | Bank statements, reconciliations, budgets, EOFY reports, accountant letters | 7 years | Limited (AGM financials only) |
| **Insurance** | Building insurance certificates, strata title insurance, liability policies | 7 years (current + 1 expired) | Yes (current certificate) |
| **By-laws** | Registered by-laws, amendments, schedules | Permanent (until superseded) | Yes (current version) |
| **Correspondence** | Owner emails, lawyer letters, government notices, complaints | 7 years | No (manager only) |
| **Maintenance** | Quotes, invoices, contractor reports, building inspections, before/after photos | 7 years | Limited (linked to request) |
| **Contracts** | Management agreements, contractor agreements, service contracts | 7 years after expiry | No (manager only) |
| **Building Reports** | Strata reports (pre-purchase), building defect reports, structural assessments | 7 years | Yes (recent reports) |
| **Other** | Miscellaneous documents not fitting above categories | 7 years | No (manager only) |

### 3.2 Auto-Generated Documents

Documents created by other LevyLite features are **automatically stored** with appropriate metadata:

| Source Feature | Document Type | Category | Auto-Tags |
|----------------|---------------|----------|-----------|
| Levy Management | Levy notice PDF | Levy Notices | `levy-notice`, `auto-generated`, `{year}`, `{quarter}` |
| Levy Management | Owner statement PDF | Levy Notices | `owner-statement`, `auto-generated`, lot number |
| AGM Administration | AGM notice | AGM/SGM | `agm-notice`, `auto-generated`, `{year}` |
| AGM Administration | AGM minutes | AGM/SGM | `agm-minutes`, `auto-generated`, `{year}` |
| AGM Administration | AGM pack (combined) | AGM/SGM | `agm-pack`, `auto-generated`, includes all attachments |
| Financial Reporting | EOFY summary | Financial | `eofy-report`, `auto-generated`, `{year}` |
| Financial Reporting | Budget vs. actual | Financial | `budget-report`, `auto-generated`, `{year}` |
| Maintenance Tracking | Contractor quote | Maintenance | `quote`, linked to request ID |
| Maintenance Tracking | Invoice | Maintenance | `invoice`, linked to request ID |

**Implementation:** When system generates a document, it:
1. Renders PDF (react-pdf or PDFKit)
2. Uploads to Supabase Storage at correct path
3. Creates `documents` table entry with `auto_generated = true`
4. Links to source entity (e.g., `agm_id`, `maintenance_request_id`)

---

## 4. Upload & Management

### 4.1 Upload Interface

**Drag-and-Drop Uploader** (react-dropzone):

```tsx
// Component: DocumentUploader.tsx
import { useDropzone } from 'react-dropzone';

interface DocumentUploaderProps {
  schemeId: string;
  category: DocumentCategory;
  onUploadComplete: (documents: Document[]) => void;
}

export function DocumentUploader({ schemeId, category, onUploadComplete }: DocumentUploaderProps) {
  const { getRootProps, getInputProps, acceptedFiles } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'application/msword': ['.doc'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'application/vnd.ms-excel': ['.xls'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'image/webp': ['.webp'],
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
      'application/zip': ['.zip']
    },
    maxSize: 52428800, // 50MB
    onDrop: async (files) => {
      await handleUpload(files, schemeId, category);
    }
  });

  return (
    <div {...getRootProps()} className="border-2 border-dashed p-8 text-center cursor-pointer hover:bg-gray-50">
      <input {...getInputProps()} />
      <p>Drag files here or click to select</p>
      <p className="text-sm text-gray-500">PDF, Word, Excel, images up to 50MB</p>
    </div>
  );
}
```

**Upload Workflow:**

1. **File selection:** Drag-and-drop or file picker
2. **Client-side validation:**
   - File type allowed?
   - File size ≤50MB?
   - Duplicate filename in same category/year? (warn, allow rename)
3. **Metadata input modal:**
   - Document name (pre-filled from filename, editable)
   - Category (pre-selected or chooseable)
   - Year (auto-detected from filename or current year)
   - Description (optional)
   - Tags (optional, comma-separated)
   - Owner-accessible? (checkbox, default based on category)
4. **Upload to Supabase Storage:**
   - Generate path: `{scheme_id}/{category}/{year}/{sanitized-filename}`
   - Upload via Supabase client SDK
   - Show progress bar (chunked upload for large files)
5. **Create database record:** Insert into `documents` table
6. **Confirmation:** Show success message, refresh document list

### 4.2 Bulk Upload

**Use Case:** Manager migrating from spreadsheets, uploading 50+ historical AGM packs.

**Interface:**

1. **Select folder:** "Upload Folder" button → file picker (allows folder selection in modern browsers)
2. **Auto-categorization:**
   - Parse filenames for keywords (e.g., "agm" → AGM/SGM, "levy" → Levy Notices)
   - Extract year from filename (regex: `20\d{2}`)
   - Show preview table with suggested category, year (editable)
3. **Batch metadata:**
   - Apply tags to all (e.g., "historical-migration")
   - Set owner-accessible default
4. **Upload queue:** Process 5 files concurrently, show overall progress

**CSV Metadata Import** (advanced):

For power users, allow CSV upload with columns:
```
filename,category,year,description,tags,owner_accessible
agm-2019.pdf,AGM/SGM,2019,Annual meeting minutes,"agm,minutes,2019",true
levy-q1-2020.pdf,Levy Notices,2020,Q1 levy notices,"levy,q1,2020",true
```

System matches filenames to selected files, applies metadata, uploads.

### 4.3 File Type Support

**Supported Formats:**

- **Documents:** PDF, DOC, DOCX, XLS, XLSX, TXT, CSV
- **Images:** JPG, PNG, GIF, WebP, HEIC (converted to JPG on upload for browser compatibility)
- **Archives:** ZIP (for bulk downloads; cannot preview contents)

**Preview Support:**

| Type | Browser Preview | Fallback |
|------|-----------------|----------|
| PDF | Inline viewer (PDF.js or browser native) | Download |
| Images | Inline thumbnail + lightbox | Download |
| Word/Excel | Convert to PDF via LibreOffice API (future) | Download |
| TXT/CSV | Syntax-highlighted viewer | Download |

**Future Enhancement:** HEIC → JPG conversion via serverless function (Vercel Edge Function with sharp library).

### 4.4 File Size Limits

**Per-File Limit:** 50MB (balances usability vs. cost)

**Rationale:**
- Most strata documents are <5MB (PDFs with images)
- 50MB accommodates large building inspection reports with photos
- Prevents abuse (1GB video uploads)

**Error Handling:**
- Files >50MB: "File too large. Please compress or split. Contact support for exceptions."
- For rare exceptions (e.g., detailed engineering report), support can manually adjust bucket policy or accept email transfer.

### 4.5 Virus Scanning

**MVP Approach:** **Client-side file type validation only** (no server-side antivirus).

**Rationale:**
- Small operator use case = low risk (not public upload portal)
- Trusted users (managers, committee members) uploading documents
- Antivirus adds latency (1-5 seconds per file) and cost ($50-$200/month for ClamAV/third-party API)

**Future Enhancement (Post-MVP):**
- Integrate VirusTotal API or AWS S3 Macie for suspicious file detection
- Scan on upload, quarantine flagged files, notify manager
- Triggered by first reported malware incident or customer request

**Alternative:** Supabase Storage bucket policy to block executable file types (.exe, .sh, .bat, .scr).

---

## 5. Tagging & Categorisation

### 5.1 Tag System

**Tag Types:**

1. **System Tags** (auto-applied, read-only):
   - `auto-generated` — created by system (levy notice, AGM pack, etc.)
   - `{year}` — extracted from filename or upload date (e.g., `2024`)
   - `{category}` — lowercase category name (e.g., `agm`, `levy-notices`)

2. **Auto-Tags** (context-based, manager can remove):
   - Applied when uploading during workflow (e.g., uploading during AGM creation → `agm-2024`)
   - Applied when linked to entity (e.g., maintenance request #45 → `maintenance-req-45`)

3. **Custom Tags** (manager-defined):
   - Free-form text, comma-separated on upload
   - Autocomplete from existing tags in scheme
   - Examples: `pool-compliance`, `urgent`, `committee-review`, `legal`

**Tag Storage:** JSON array in `documents` table (searchable via PostgreSQL GIN index).

### 5.2 Auto-Tagging Rules

**AGM Workflow Integration:**

When manager creates AGM and uploads documents:
```javascript
// Auto-apply tags
const autoTags = [
  `agm-${year}`,
  'meeting-notice',
  scheme.name.toLowerCase().replace(/\s+/g, '-')
];

// If uploading financial statements during AGM prep
if (documentType === 'financial-statement') {
  autoTags.push('financial', 'eofy');
}
```

**Levy Notice Generation:**

When system generates levy notice PDF:
```javascript
const autoTags = [
  'levy-notice',
  `q${quarter}-${year}`,
  'auto-generated',
  lot.lot_number
];
```

**Maintenance Request:**

When uploading quote/invoice via maintenance request:
```javascript
const autoTags = [
  `maint-${request.id}`,
  request.category, // e.g., 'plumbing', 'electrical'
  request.status // e.g., 'quote', 'completed'
];
```

### 5.3 Category Management

**Categories are system-defined** (not user-editable) to ensure consistency for retention policies and owner access rules.

**Future Enhancement:** Allow managers to create sub-categories within primary categories (e.g., "Correspondence > Legal" vs. "Correspondence > Owners").

---

## 6. Search & Filtering

### 6.1 Search Capabilities

**Full-Text Search** (PostgreSQL `tsvector`):

```sql
-- Add full-text search column to documents table
ALTER TABLE documents ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', COALESCE(document_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(tags, ' ')), 'C')
  ) STORED;

-- GIN index for fast full-text search
CREATE INDEX idx_documents_search ON documents USING GIN (search_vector);

-- Example search query
SELECT * FROM documents
WHERE search_vector @@ to_tsquery('english', 'AGM & 2024')
ORDER BY ts_rank(search_vector, to_tsquery('english', 'AGM & 2024')) DESC;
```

**Search Fields:**

- **Document name** (weight A, highest relevance)
- **Description** (weight B)
- **Tags** (weight C)
- **Filename** (extracted from `storage_path`)

**Search Operators:**

- `AGM 2024` — find documents containing both terms (AND)
- `"annual general meeting"` — exact phrase match
- `levy OR notice` — find documents with either term

### 6.2 Filters

**Filter Panel** (sidebar on document library page):

```tsx
interface DocumentFilters {
  scheme_id?: string; // Dropdown (all schemes manager has access to)
  category?: DocumentCategory; // Checkboxes (multi-select)
  year?: number[]; // Range slider (2019-2026)
  uploaded_by?: string; // Dropdown (users who uploaded docs)
  date_range?: { start: Date; end: Date }; // Date picker
  owner_accessible?: boolean; // Toggle
  tags?: string[]; // Autocomplete multi-select
}
```

**Filter Combination:** All filters are AND conditions (e.g., category=AGM AND year=2024 AND uploaded_by=Sarah).

**Saved Searches** (future): Allow managers to save frequently-used filter combinations (e.g., "All AGM docs from last 3 years").

### 6.3 Sort Options

- **Relevance** (search only, ts_rank score)
- **Upload date** (newest/oldest first)
- **Document name** (A-Z, Z-A)
- **Year** (newest/oldest first)
- **File size** (largest/smallest first)

Default: **Newest first** (most common use case: "What did I just upload?").

---

## 7. Version Control

### 7.1 Versioning Workflow

**Use Case:** Manager uploads AGM minutes draft, committee reviews, manager uploads final version.

**Approach:** **Simple replacement with version history** (not full branching/merging).

**Version States:**

1. **Draft** — initial upload, marked as draft (not visible to owners)
2. **Final** — manager marks as final (visible to owners if category allows)
3. **Superseded** — previous version when new version uploaded

**Database Schema Addition:**

```sql
-- Add version columns to documents table
ALTER TABLE documents 
ADD COLUMN version_number INTEGER DEFAULT 1,
ADD COLUMN is_latest_version BOOLEAN DEFAULT TRUE,
ADD COLUMN superseded_by_id UUID REFERENCES documents(document_id),
ADD COLUMN version_status TEXT DEFAULT 'final' CHECK (version_status IN ('draft', 'final', 'superseded'));
```

**Upload Replacement Workflow:**

1. Manager uploads `agm-minutes-2024.pdf` (v1, status=draft)
2. Committee reviews, requests changes
3. Manager clicks "Upload New Version" → uploads revised file
4. System:
   - Creates new `documents` row (v2, status=draft)
   - Sets v1 `is_latest_version = false`, `superseded_by_id = v2.document_id`, `version_status = 'superseded'`
   - Keeps v1 file in storage (path: `{scheme_id}/{category}/{year}/{filename}-v1.pdf`)
5. Manager marks v2 as "final" → owners can now see it

**Version History UI:**

On document detail page, show:
```
Version History:
- v2 (Final) — uploaded 15 Jan 2025 by Sarah — [Download]
- v1 (Superseded) — uploaded 10 Jan 2025 by Sarah — [Download] [Restore]
```

**Restore Version:** Clicking "Restore" on v1 creates v3 as copy of v1 (preserves audit trail).

### 7.2 Draft vs. Final

**Draft Documents:**

- `version_status = 'draft'`
- NOT visible to owners in portal
- Visible to manager + admin users
- Show "DRAFT" badge in UI

**Marking Final:**

- Manager clicks "Mark as Final" button
- Sets `version_status = 'final'`
- If `owner_accessible = true`, document now appears in owner portal

**Use Case:** Manager prepares AGM pack (financial statements, notice, agenda) as drafts, reviews with treasurer, then publishes all as final in one action.

---

## 8. 7-Year Retention Policy

### 8.1 Retention Rules

**WA Compliance:** While the Strata Titles Act doesn't explicitly state "7 years", it's industry best practice derived from:
- Financial records retention (7 years for tax audit)
- Legal action limitation period (6 years in WA, extended to 7 for safety)
- Consumer Protection audit expectations

**Retention Period by Category:**

| Category | Retention Period | Auto-Delete? |
|----------|------------------|--------------|
| AGM/SGM | 7 years from meeting date | No (warn only) |
| Levy Notices | 7 years from issue date | No (warn only) |
| Financial | 7 years from financial year end | No (warn only) |
| Insurance | 7 years from policy expiry | Yes (expired policies only) |
| By-laws | Permanent (until superseded by new by-law) | No |
| Correspondence | 7 years from date | Yes (optional, manager choice) |
| Maintenance | 7 years from completion date | Yes (optional) |
| Contracts | 7 years from contract expiry | No (warn only) |
| Building Reports | 7 years from report date | No (warn only) |
| Other | 7 years from upload date | Yes (optional) |

**Database Schema:**

```sql
ALTER TABLE documents
ADD COLUMN retention_date DATE GENERATED ALWAYS AS (
  CASE 
    WHEN category = 'bylaws' THEN NULL -- permanent
    WHEN category = 'agm' THEN (document_date + INTERVAL '7 years')::DATE
    WHEN category = 'levy-notices' THEN (document_date + INTERVAL '7 years')::DATE
    WHEN category = 'financial' THEN (document_date + INTERVAL '7 years')::DATE
    WHEN category = 'insurance' THEN (document_date + INTERVAL '7 years')::DATE
    ELSE (created_at + INTERVAL '7 years')::DATE
  END
) STORED;
```

### 8.2 Expiry Warnings

**Manager Dashboard Widget:**

```
Documents Expiring Soon:
- 12 documents expiring in next 30 days
- 45 documents expiring in next 90 days
[View Details]
```

**Email Notifications:**

- **90 days before expiry:** "12 documents from Sunset Villas will expire in 90 days. Review before auto-delete."
- **30 days before expiry:** "WARNING: 12 documents will be deleted in 30 days unless extended."
- **7 days before expiry:** "URGENT: 12 documents will be deleted in 7 days. Review now."

**Document List Warnings:**

Documents with `retention_date` within 90 days show:
- 🟡 Yellow badge "Expires in 45 days"
- 🔴 Red badge "Expires in 7 days"

### 8.3 Legal Hold

**Use Case:** Strata company involved in legal dispute. Lawyer advises "preserve all documents from 2020-2023, do not delete anything."

**Implementation:**

```sql
ALTER TABLE documents
ADD COLUMN legal_hold BOOLEAN DEFAULT FALSE,
ADD COLUMN legal_hold_reason TEXT,
ADD COLUMN legal_hold_set_by UUID REFERENCES users(user_id),
ADD COLUMN legal_hold_date TIMESTAMPTZ;

-- Legal hold prevents deletion
CREATE FUNCTION check_document_deletion() RETURNS TRIGGER AS $$
BEGIN
  IF OLD.legal_hold = TRUE THEN
    RAISE EXCEPTION 'Cannot delete document under legal hold: %', OLD.document_name;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_legal_hold_deletion
BEFORE DELETE ON documents
FOR EACH ROW EXECUTE FUNCTION check_document_deletion();
```

**UI:**

Manager can set legal hold on individual documents or bulk-apply to date range:
1. Select documents (checkbox list)
2. Click "Apply Legal Hold"
3. Enter reason: "Smith v. Sunset Villas lawsuit - preserve all 2020-2023 docs"
4. Documents marked with 🔒 icon, cannot be deleted
5. After lawsuit settled, manager removes hold

### 8.4 Deletion Workflow

**Auto-Delete** (daily cron job):

```sql
-- Nightly job: soft-delete expired documents
UPDATE documents
SET deleted_at = NOW(), deleted_by = 'system'
WHERE retention_date < CURRENT_DATE
  AND legal_hold = FALSE
  AND category IN ('correspondence', 'maintenance', 'other') -- only auto-delete categories
  AND deleted_at IS NULL;

-- 30-day soft-delete grace period (recoverable)
-- After 30 days, hard delete from storage
DELETE FROM documents
WHERE deleted_at < (CURRENT_DATE - INTERVAL '30 days');
```

**Manual Delete:**

Manager can delete before expiry (e.g., duplicate upload):
1. Click "Delete" on document
2. Confirmation modal: "Are you sure? This cannot be undone after 30 days."
3. Soft delete (move to "Trash" folder, recoverable for 30 days)
4. Manager can "Empty Trash" to force hard delete

**Bulk Delete:**

Select multiple documents, "Delete Selected" → confirmation modal shows count, categories, earliest retention date.

---

## 9. Access Control

### 9.1 User Roles & Permissions

| Role | Upload | View | Download | Delete | Share | Manage Retention |
|------|--------|------|----------|--------|-------|------------------|
| **Manager** | ✅ All schemes | ✅ All schemes | ✅ | ✅ | ✅ | ✅ |
| **Admin** | ✅ All schemes | ✅ All schemes | ✅ | ❌ (soft delete only) | ✅ | ❌ |
| **Auditor** | ❌ | ✅ Financial only | ✅ | ❌ | ❌ | ❌ |
| **Owner** | ❌ | ✅ Owner-accessible only | ✅ | ❌ | ❌ | ❌ |
| **Tenant** | ❌ | ✅ Limited (by-laws, notices) | ✅ | ❌ | ❌ | ❌ |
| **Committee Member** | ✅ Their scheme only | ✅ Their scheme only | ✅ | ❌ | ✅ | ❌ |

### 9.2 Supabase RLS Policies

**Documents Table Policies:**

```sql
-- Policy 1: Managers see all documents for their schemes
CREATE POLICY "Managers access scheme documents"
ON documents
FOR ALL
USING (
  scheme_id IN (
    SELECT scheme_id FROM schemes WHERE manager_user_id = auth.uid()
  )
);

-- Policy 2: Owners see owner-accessible documents for their lots
CREATE POLICY "Owners view accessible documents"
ON documents
FOR SELECT
USING (
  owner_accessible = TRUE
  AND scheme_id IN (
    SELECT scheme_id FROM lots WHERE owner_user_id = auth.uid()
  )
);

-- Policy 3: Auditors see financial documents only
CREATE POLICY "Auditors view financial documents"
ON documents
FOR SELECT
USING (
  category IN ('financial', 'agm') -- AGM includes financial statements
  AND scheme_id IN (
    SELECT scheme_id FROM scheme_auditors WHERE auditor_user_id = auth.uid()
  )
);

-- Policy 4: Committee members see their scheme documents
CREATE POLICY "Committee members access scheme documents"
ON documents
FOR SELECT
USING (
  scheme_id IN (
    SELECT scheme_id FROM committee_members WHERE user_id = auth.uid()
  )
);
```

**Storage Bucket Policies** (see Section 2.1):

Storage policies are more restrictive:
- Managers: full access to their schemes' folders
- Owners: read-only to owner-accessible documents (cross-referenced with `documents` table)
- Auditors: read-only to financial documents (requires JOIN with `documents` table in policy)

### 9.3 Owner Portal Access

**Owner Dashboard → Documents Tab:**

```tsx
// Components/OwnerPortal/DocumentsTab.tsx
export function OwnerDocumentsTab({ lotId }: { lotId: string }) {
  const { data: documents } = useQuery(
    'owner-documents',
    () => supabase
      .from('documents')
      .select('*')
      .eq('owner_accessible', true)
      .eq('scheme_id', lot.scheme_id)
      .order('created_at', { ascending: false })
  );

  return (
    <DocumentGrid documents={documents} allowDownload={true} allowUpload={false} />
  );
}
```

**Owner-Accessible Categories** (default):

- ✅ AGM/SGM (minutes, notices, financial statements)
- ✅ Levy Notices (own lot only via filter)
- ✅ Insurance (current certificate only)
- ✅ By-laws (current version)
- ✅ Building Reports (recent reports)
- ❌ Correspondence (manager only)
- ❌ Contracts (manager only)
- ❌ Financial (except AGM financials)

**Per-Document Override:**

Manager can toggle "Owner-accessible" checkbox on any document (e.g., make specific correspondence visible to owners if related to shared issue).

### 9.4 Share Functionality

**Internal Sharing** (within platform):

Manager can share document link with specific user:
1. Click "Share" button on document
2. Enter user email or select from list (committee members, auditor)
3. System sends email: "Sarah shared 'AGM Minutes 2024' with you. [View Document]"
4. Recipient clicks link, authenticated via magic link, sees document

**External Sharing** (generate temporary link):

For sharing with lawyers, contractors, government agencies:
1. Click "Generate Share Link"
2. Options:
   - Expiry date (24 hours, 7 days, 30 days)
   - Password-protected? (optional)
   - Download allowed? (or view-only)
3. System generates signed URL: `https://levylite.com.au/share/{token}`
4. Manager copies link, sends via email
5. Recipient clicks, sees document (no login required if not password-protected)
6. Audit log records external access

**Supabase Signed URL Generation:**

```javascript
// Generate temporary signed URL for external sharing
const { data, error } = await supabase.storage
  .from('scheme-documents')
  .createSignedUrl(storagePath, 86400); // 24 hours expiry

// Store share token in database
await supabase.from('document_shares').insert({
  document_id: doc.id,
  token: data.signedUrl.split('/').pop(),
  expires_at: new Date(Date.now() + 86400 * 1000),
  shared_by: userId,
  password_hash: bcrypt.hash(password) // if password-protected
});
```

---

## 10. Audit Log

### 10.1 Logged Events

**All document operations are audited:**

| Event | Details Captured |
|-------|------------------|
| **Upload** | user_id, document_id, filename, category, timestamp |
| **View** | user_id, document_id, timestamp, IP address |
| **Download** | user_id, document_id, timestamp, IP address |
| **Delete** | user_id, document_id, reason, timestamp |
| **Share** | user_id, document_id, recipient (email or user_id), expiry, timestamp |
| **Version Upload** | user_id, document_id, version_number, timestamp |
| **Mark Final** | user_id, document_id, previous_status, timestamp |
| **Legal Hold** | user_id, document_id, reason, timestamp |
| **Restore** | user_id, document_id, version_restored, timestamp |

### 10.2 Audit Table Schema

```sql
CREATE TABLE document_audit_log (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(document_id),
  user_id UUID REFERENCES users(user_id),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'upload', 'view', 'download', 'delete', 'share', 'version', 
    'mark_final', 'legal_hold', 'restore', 'metadata_update'
  )),
  event_details JSONB, -- flexible metadata (e.g., {recipient: 'lawyer@example.com', expiry: '2025-02-01'})
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast queries by document
CREATE INDEX idx_audit_log_document ON document_audit_log(document_id, timestamp DESC);

-- Index for compliance reports (all activity by user)
CREATE INDEX idx_audit_log_user ON document_audit_log(user_id, timestamp DESC);
```

### 10.3 Audit Triggers

**Auto-Log on Document Operations:**

```sql
-- Trigger: log all document views
CREATE FUNCTION log_document_view() RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO document_audit_log (document_id, user_id, event_type, ip_address, user_agent)
  VALUES (NEW.document_id, auth.uid(), 'view', inet_client_addr(), current_setting('request.headers')::json->>'user-agent');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Note: View logging requires application-level implementation (RLS doesn't trigger on SELECT)
-- Implement in Next.js API route that serves document downloads
```

**Application-Level Logging** (Next.js API):

```typescript
// app/api/documents/[id]/download/route.ts
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await getUser(req);
  const document = await getDocument(params.id);
  
  // Log download
  await supabase.from('document_audit_log').insert({
    document_id: params.id,
    user_id: user.id,
    event_type: 'download',
    ip_address: req.headers.get('x-forwarded-for'),
    user_agent: req.headers.get('user-agent')
  });
  
  // Serve file
  const { data } = await supabase.storage.from('scheme-documents').download(document.storage_path);
  return new Response(data);
}
```

### 10.4 Compliance Reports

**Manager can generate reports:**

1. **Document Access Report** — who accessed which documents (filter by date range, user, category)
2. **External Share Report** — all documents shared externally (recipient, expiry, access count)
3. **Deletion Report** — all deleted documents (who, when, reason)
4. **Retention Compliance Report** — documents approaching expiry, documents past expiry still retained

**Export Format:** CSV or PDF (for Consumer Protection audits).

**Example Query:**

```sql
-- All document activity for Scheme X in last 12 months
SELECT 
  d.document_name,
  u.email AS user_email,
  a.event_type,
  a.timestamp,
  a.ip_address
FROM document_audit_log a
JOIN documents d ON a.document_id = d.document_id
JOIN users u ON a.user_id = u.user_id
WHERE d.scheme_id = 'sch_xyz'
  AND a.timestamp > NOW() - INTERVAL '12 months'
ORDER BY a.timestamp DESC;
```

---

## 11. Integration Points

### Document Linking Convention (Cross-Feature Standard)

All features that generate documents link to this table via:
- `linked_entity_type` — identifies the source feature ('levy', 'meeting', 'maintenance_request', 'financial_report', 'scheme')
- `linked_entity_id` — UUID of the source record

**No foreign keys on source tables.** Other feature tables (meetings, levy_items, etc.) do NOT store `document_id` columns. Instead, query documents by entity:

```sql
SELECT * FROM documents 
WHERE linked_entity_type = 'meeting' 
  AND linked_entity_id = :meeting_id
ORDER BY uploaded_at DESC;
```

This approach is more flexible (supports multiple documents per entity) and avoids circular foreign key dependencies.

### 11.1 Feature Dependencies

**Documents are generated/linked by ALL other features:**

| Source Feature | Integration Type | Generated Documents | Database Link |
|----------------|------------------|---------------------|---------------|
| **Levy Management** | Auto-generate + store | Levy notices (PDF), owner statements (PDF) | `levy_id`, `lot_id` |
| **AGM Administration** | Auto-generate + store | AGM notice, agenda, minutes, resolutions, AGM pack (combined PDF) | `agm_id` |
| **Financial Reporting** | Auto-generate + store | EOFY summary, budget vs. actual, trial balance, fund balance report | `financial_period_id` |
| **Maintenance Tracking** | Manual upload + link | Quotes, invoices, before/after photos, contractor reports | `maintenance_request_id` |
| **Trust Accounting** | Auto-generate + store | Bank reconciliation report, transaction ledger | `reconciliation_id` |
| **By-law Management** (future) | Manual upload + version | By-law amendments, registered by-laws | `bylaw_id` |
| **Insurance Tracking** (future) | Manual upload | Insurance certificates, policy documents | `insurance_policy_id` |

### 11.2 Linking Documents to Entities

**Foreign Key Relationships:**

```sql
ALTER TABLE documents
ADD COLUMN linked_entity_type TEXT CHECK (linked_entity_type IN (
  'levy', 'agm', 'financial_report', 'maintenance_request', 
  'reconciliation', 'bylaw', 'insurance_policy'
)),
ADD COLUMN linked_entity_id UUID;

-- Index for fast lookups (e.g., "show all documents for AGM #123")
CREATE INDEX idx_documents_linked_entity ON documents(linked_entity_type, linked_entity_id);
```

**Example: AGM → Documents:**

When manager creates AGM:
1. Upload AGM notice → creates document with `linked_entity_type = 'agm'`, `linked_entity_id = agm.id`
2. System generates AGM pack PDF → auto-creates document, linked to AGM
3. AGM detail page shows "Attached Documents" section with all linked docs

**Example: Maintenance Request → Documents:**

Owner reports broken gate, uploads photo:
1. Photo uploaded via maintenance request form
2. Document created with `linked_entity_type = 'maintenance_request'`, `linked_entity_id = req.id`
3. Maintenance request detail page shows embedded photo

**Bidirectional Navigation:**

- From AGM → Documents: "View all AGM documents"
- From Document → AGM: Document detail page shows "Related to: AGM 2024" link

### 11.3 Auto-Generation Workflow

**Example: Levy Notice PDF Generation**

```typescript
// services/levyNoticeGenerator.ts
export async function generateLevyNotice(levyId: string) {
  const levy = await getLevy(levyId);
  const scheme = await getScheme(levy.scheme_id);
  const lot = await getLot(levy.lot_id);
  
  // Generate PDF
  const pdf = await renderLevyNoticePDF({ levy, scheme, lot });
  
  // Upload to Supabase Storage
  const filename = `levy-notice-${lot.lot_number}-${levy.period}-${levy.year}.pdf`;
  const storagePath = `${scheme.scheme_id}/levy-notices/${levy.year}/${filename}`;
  
  await supabase.storage
    .from('scheme-documents')
    .upload(storagePath, pdf, { contentType: 'application/pdf' });
  
  // Create document record
  await supabase.from('documents').insert({
    scheme_id: scheme.scheme_id,
    document_name: `Levy Notice - Lot ${lot.lot_number} - ${levy.period} ${levy.year}`,
    category: 'levy-notices',
    document_date: new Date(),
    storage_path: storagePath,
    file_size: pdf.byteLength,
    mime_type: 'application/pdf',
    auto_generated: true,
    linked_entity_type: 'levy',
    linked_entity_id: levyId,
    tags: ['levy-notice', `${levy.year}`, `q${levy.quarter}`, 'auto-generated'],
    owner_accessible: true, // owners can view their own levy notices
    uploaded_by: 'system'
  });
}
```

**Trigger Points:**

- **Levy notices:** When manager clicks "Send Levy Notices" (batch generation for all lots)
- **AGM pack:** When manager clicks "Finalize AGM Pack" (combines notice + agenda + financials)
- **EOFY report:** When manager closes financial year
- **Maintenance quote:** When contractor submits quote via email (future: parse email attachment)

### 11.4 Owner Portal Integration

**Owner Dashboard → "Documents" Tab:**

Shows documents categorized by type:
- **Levy Notices** (own lot only)
- **AGM Minutes** (past 3 years)
- **Insurance Certificates** (current)
- **By-laws** (current version)
- **Building Reports** (if available)

**Recent Documents Widget:**

On owner dashboard home, show 5 most recent uploaded documents (e.g., "AGM Minutes 2024 uploaded 2 weeks ago").

**Download Tracking:**

When owner downloads document, log in audit table (for compliance: "prove owners had access to by-laws").

---

## 12. Database Schema

### 12.1 Documents Table (Full Schema)

```sql
CREATE TABLE documents (
  -- Primary key
  document_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Foreign keys
  scheme_id UUID NOT NULL REFERENCES schemes(scheme_id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES users(user_id), -- NULL if system-generated
  
  -- Document metadata
  document_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN (
    'agm', 'levy-notices', 'financial', 'insurance', 'bylaws', 
    'correspondence', 'maintenance', 'contracts', 'building-reports', 'other'
  )),
  document_date DATE NOT NULL, -- date document relates to (e.g., AGM date, levy period)
  
  -- Storage
  storage_path TEXT NOT NULL UNIQUE, -- path in Supabase Storage bucket
  file_size BIGINT NOT NULL, -- bytes
  mime_type TEXT NOT NULL,
  
  -- Tagging
  tags TEXT[] DEFAULT '{}', -- array of tags
  
  -- Versioning
  version_number INTEGER DEFAULT 1,
  is_latest_version BOOLEAN DEFAULT TRUE,
  superseded_by_id UUID REFERENCES documents(document_id),
  version_status TEXT DEFAULT 'final' CHECK (version_status IN ('draft', 'final', 'superseded')),
  
  -- Access control
  owner_accessible BOOLEAN DEFAULT FALSE,
  
  -- Retention
  retention_date DATE GENERATED ALWAYS AS (
    CASE 
      WHEN category = 'bylaws' THEN NULL
      WHEN category IN ('agm', 'levy-notices', 'financial') THEN (document_date + INTERVAL '7 years')::DATE
      ELSE (created_at + INTERVAL '7 years')::DATE
    END
  ) STORED,
  legal_hold BOOLEAN DEFAULT FALSE,
  legal_hold_reason TEXT,
  legal_hold_set_by UUID REFERENCES users(user_id),
  legal_hold_date TIMESTAMPTZ,
  
  -- Linking to other entities
  linked_entity_type TEXT CHECK (linked_entity_type IN (
    'levy', 'agm', 'financial_report', 'maintenance_request', 
    'reconciliation', 'bylaw', 'insurance_policy'
  )),
  linked_entity_id UUID,
  
  -- System flags
  auto_generated BOOLEAN DEFAULT FALSE,
  
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  deleted_by UUID REFERENCES users(user_id),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_documents_scheme ON documents(scheme_id);
CREATE INDEX idx_documents_category ON documents(category);
CREATE INDEX idx_documents_tags ON documents USING GIN(tags);
CREATE INDEX idx_documents_retention ON documents(retention_date) WHERE retention_date IS NOT NULL;
CREATE INDEX idx_documents_linked ON documents(linked_entity_type, linked_entity_id);

-- Full-text search
ALTER TABLE documents ADD COLUMN search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', COALESCE(document_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(description, '')), 'B') ||
    setweight(to_tsvector('english', array_to_string(tags, ' ')), 'C')
  ) STORED;

CREATE INDEX idx_documents_search ON documents USING GIN(search_vector);

-- Update timestamp trigger
CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 12.2 Document Audit Log Table

```sql
CREATE TABLE document_audit_log (
  audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(document_id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(user_id),
  event_type TEXT NOT NULL CHECK (event_type IN (
    'upload', 'view', 'download', 'delete', 'share', 'version', 
    'mark_final', 'legal_hold', 'restore', 'metadata_update'
  )),
  event_details JSONB,
  ip_address INET,
  user_agent TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_document ON document_audit_log(document_id, timestamp DESC);
CREATE INDEX idx_audit_log_user ON document_audit_log(user_id, timestamp DESC);
CREATE INDEX idx_audit_log_timestamp ON document_audit_log(timestamp DESC);
```

### 12.3 Document Shares Table

```sql
CREATE TABLE document_shares (
  share_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(document_id) ON DELETE CASCADE,
  shared_by UUID NOT NULL REFERENCES users(user_id),
  recipient_email TEXT, -- if sharing externally
  recipient_user_id UUID REFERENCES users(user_id), -- if sharing internally
  share_token TEXT UNIQUE NOT NULL, -- for external share URLs
  expires_at TIMESTAMPTZ NOT NULL,
  password_hash TEXT, -- if password-protected
  allow_download BOOLEAN DEFAULT TRUE,
  access_count INTEGER DEFAULT 0, -- track how many times accessed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_shares_token ON document_shares(share_token);
CREATE INDEX idx_shares_document ON document_shares(document_id);
CREATE INDEX idx_shares_expiry ON document_shares(expires_at) WHERE expires_at > NOW();
```

### 12.4 Supabase RLS Policies (Complete)

```sql
-- Enable RLS on all tables
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_shares ENABLE ROW LEVEL SECURITY;

-- Documents: Managers see their schemes
CREATE POLICY "Managers access scheme documents"
ON documents FOR ALL
USING (organisation_id = auth.user_organisation_id());

-- Documents: Owners see owner-accessible docs
CREATE POLICY "Owners view accessible documents"
ON documents FOR SELECT
USING (
  owner_accessible = TRUE
  AND is_latest_version = TRUE
  AND version_status = 'final'
  AND deleted_at IS NULL
  AND scheme_id IN (
    SELECT scheme_id FROM lots WHERE owner_user_id = auth.uid()
  )
);

-- Documents: Auditors see financial docs
CREATE POLICY "Auditors view financial documents"
ON documents FOR SELECT
USING (
  category IN ('financial', 'agm')
  AND scheme_id IN (
    SELECT scheme_id FROM scheme_auditors WHERE auditor_user_id = auth.uid()
  )
);

-- Audit log: Users see their own activity
CREATE POLICY "Users view own audit log"
ON document_audit_log FOR SELECT
USING (user_id = auth.uid());

-- Audit log: Managers see all activity for their schemes
CREATE POLICY "Managers view scheme audit log"
ON document_audit_log FOR SELECT
USING (
  document_id IN (
    SELECT document_id FROM documents 
    WHERE organisation_id = auth.user_organisation_id()
  )
);

-- Shares: Managers manage shares for their documents
CREATE POLICY "Managers manage shares"
ON document_shares FOR ALL
USING (
  document_id IN (
    SELECT document_id FROM documents 
    WHERE organisation_id = auth.user_organisation_id()
  )
);
```

---

## 13. API Endpoints

### 13.1 Document CRUD

**Upload Document**

```
POST /api/documents/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data

Body:
- scheme_id (required)
- category (required)
- file (required, max 50MB)
- document_name (optional, defaults to filename)
- description (optional)
- document_date (optional, defaults to today)
- tags (optional, comma-separated)
- owner_accessible (optional, default based on category)
- linked_entity_type (optional)
- linked_entity_id (optional)

Response:
{
  "document_id": "doc_abc123",
  "storage_path": "sch_xyz/agm/2024/agm-minutes.pdf",
  "file_size": 2458923,
  "created_at": "2025-02-16T10:30:00Z"
}
```

**Get Document Metadata**

```
GET /api/documents/{document_id}
Authorization: Bearer {token}

Response:
{
  "document_id": "doc_abc123",
  "scheme_id": "sch_xyz",
  "document_name": "AGM Minutes 2024",
  "category": "agm",
  "document_date": "2024-11-15",
  "storage_path": "sch_xyz/agm/2024/agm-minutes.pdf",
  "file_size": 2458923,
  "mime_type": "application/pdf",
  "tags": ["agm", "2024", "minutes"],
  "version_number": 2,
  "is_latest_version": true,
  "version_status": "final",
  "owner_accessible": true,
  "retention_date": "2031-11-15",
  "created_at": "2025-02-16T10:30:00Z"
}
```

**Download Document**

```
GET /api/documents/{document_id}/download
Authorization: Bearer {token}

Response:
- Binary file data
- Headers: Content-Disposition: attachment; filename="agm-minutes-2024.pdf"
- Logs download in audit table
```

**Update Document Metadata**

```
PATCH /api/documents/{document_id}
Authorization: Bearer {token}

Body:
{
  "document_name": "Updated Name",
  "description": "Updated description",
  "tags": ["new", "tags"],
  "owner_accessible": true
}

Response: Updated document object
```

**Delete Document**

```
DELETE /api/documents/{document_id}
Authorization: Bearer {token}

Response:
{
  "message": "Document soft-deleted successfully. Recoverable for 30 days."
}
```

### 13.2 Search & Filter

**Search Documents**

```
GET /api/documents/search?q={query}&scheme_id={id}&category={cat}&year={year}
Authorization: Bearer {token}

Query Params:
- q (optional): full-text search query
- scheme_id (optional): filter by scheme
- category (optional): filter by category
- year (optional): filter by document year
- uploaded_by (optional): filter by uploader
- owner_accessible (optional): true/false
- tags (optional): comma-separated tags

Response:
{
  "documents": [
    { document object },
    ...
  ],
  "total": 42,
  "page": 1,
  "per_page": 25
}
```

### 13.3 Versioning

**Upload New Version**

```
POST /api/documents/{document_id}/version
Authorization: Bearer {token}
Content-Type: multipart/form-data

Body:
- file (required)
- version_status (optional, default 'draft')

Response:
{
  "document_id": "doc_newversion",
  "version_number": 3,
  "supersedes": "doc_abc123"
}
```

**Get Version History**

```
GET /api/documents/{document_id}/versions
Authorization: Bearer {token}

Response:
{
  "versions": [
    { version 3 (current) },
    { version 2 (superseded) },
    { version 1 (superseded) }
  ]
}
```

### 13.4 Sharing

**Generate Share Link**

```
POST /api/documents/{document_id}/share
Authorization: Bearer {token}

Body:
{
  "recipient_email": "lawyer@example.com", // optional
  "expires_in_hours": 24, // default 24
  "password": "optional-password",
  "allow_download": true
}

Response:
{
  "share_url": "https://levylite.com.au/share/{token}",
  "expires_at": "2025-02-17T10:30:00Z"
}
```

**Access Shared Document**

```
GET /share/{token}?password={password}

Response:
- If valid: renders document viewer with download button
- If expired: "This link has expired"
- If password-protected: shows password prompt
- Logs access in audit table
```

---

## 14. Storage Cost Estimates

### 14.1 Per-Customer Storage Growth

**Assumptions:**
- Average small operator: 20 schemes, 5 lots/scheme = 100 lots
- Documents per scheme per year: 50 (12 levy notices × 4 lots, 5 AGM docs, 10 maintenance docs, 10 correspondence, 5 insurance/contracts, 8 other)
- Average document size: 500 KB (mix of PDFs, images, Office docs)
- 7-year retention

**Calculation:**

```
Per-scheme storage (7 years):
- 50 docs/year × 7 years × 500 KB = 175 MB

Per-customer storage (20 schemes):
- 175 MB × 20 schemes = 3.5 GB
```

**Professional Tier (51-200 lots, ~40 schemes):**
- 175 MB × 40 = 7 GB (within 100 GB limit)

**Growth Tier (201-500 lots, ~100 schemes):**
- 175 MB × 100 = 17.5 GB (within 250 GB limit)

### 14.2 Platform-Wide Storage Projections

**Year 1 (30 customers):**
- Average 100 lots/customer = 20 schemes
- 30 × 3.5 GB = 105 GB total
- Supabase Pro (100 GB free, $0.021/GB/month overage) = $25/month + (5 GB × $0.021) = ~$25/month

**Year 2 (100 customers):**
- 100 × 3.5 GB = 350 GB total
- $25/month + (250 GB × $0.021) = $25 + $5.25 = ~$30/month

**Year 3 (300 customers):**
- 300 × 3.5 GB = 1,050 GB (1 TB)
- $25/month + (950 GB × $0.021) = $25 + $20 = ~$45/month

**Cost Per Customer:**
- Year 1: $25/month ÷ 30 customers = $0.83/customer/month
- Year 2: $30/month ÷ 100 customers = $0.30/customer/month
- Year 3: $45/month ÷ 300 customers = $0.15/customer/month

**Pricing headroom:** At graduated pricing, a 100-lot customer pays $225/month. Storage cost is <$1/month per customer → **storage is <0.5% of revenue**. Very sustainable.

### 14.3 Bandwidth Costs

**Supabase Storage bandwidth:**
- Free tier: 200 GB/month egress
- Overage: $0.09/GB

**Typical usage:**
- Owner downloads 5 documents/month × 500 KB = 2.5 MB/owner
- 100 lots × 2.5 MB = 250 MB/customer/month
- 100 customers × 250 MB = 25 GB/month (well within 200 GB free)

**Year 3 (300 customers):**
- 300 × 250 MB = 75 GB/month (still within free tier)

**Conclusion:** Bandwidth costs are negligible for MVP and foreseeable growth.

---

## 15. Dependencies on Other Features

### 15.1 Upstream Dependencies (Features that Generate Documents)

| Feature | Dependency Type | Impact if Feature Delayed |
|---------|-----------------|---------------------------|
| **Levy Management** | Strong | Document storage less valuable without auto-generated levy notices |
| **AGM Administration** | Strong | AGM workflow incomplete without document attachment/storage |
| **Financial Reporting** | Medium | EOFY reports can be manually uploaded (less seamless) |
| **Maintenance Tracking** | Medium | Can manually upload quotes/invoices (not linked to requests) |
| **Trust Accounting** | Weak | Reconciliation reports can be manually uploaded |

**Recommendation:** Build Document Storage in parallel with Levy Management and AGM Administration. These three features form the **core compliance triad** and should launch together.

### 15.2 Downstream Dependencies (Features Requiring Document Storage)

| Feature | Dependency | Mitigation if Document Storage Delayed |
|---------|------------|----------------------------------------|
| **Owner Portal** | Strong (owners expect document access) | Portal can launch with limited functionality (levy balance, maintenance requests only) |
| **Auditor Access** | Medium | Auditors can request manual email of reports (not scalable) |
| **Legal Hold** | Weak (rare use case) | Can implement later as edge case arises |

### 15.3 Integration Testing Checklist

Before launch, test:

- ✅ Levy notice generation → document auto-created → appears in document library
- ✅ AGM pack upload → documents linked to AGM → accessible from AGM detail page
- ✅ Owner logs in → sees only owner-accessible documents for their lot
- ✅ Manager deletes scheme → all documents soft-deleted (CASCADE)
- ✅ Document reaches 7-year expiry → warning email sent → auto-delete (if category allows)
- ✅ Manager searches "AGM 2024" → finds all related documents
- ✅ External share link → guest clicks → sees document (no login required)
- ✅ Audit log captures all operations → CSV export works

---

## 16. Open Questions

### 16.1 Technical Decisions

1. **OCR for scanned documents?**
   - **Question:** Should we OCR scanned PDFs to enable full-text search on legacy documents?
   - **Options:** (a) No OCR in MVP (too slow, costly), (b) Use Tesseract.js client-side (slow), (c) Use Google Vision API ($$)
   - **Recommendation:** No OCR in MVP. Most modern docs are digital. Add in Phase 2 if customers request.

2. **Document preview in browser?**
   - **Question:** Inline PDF viewer vs. download-only?
   - **Recommendation:** Use react-pdf or browser native PDF viewer. Improves UX (owners don't need to download every document).

3. **Email attachments?**
   - **Question:** Can managers email documents directly from platform?
   - **Recommendation:** Yes, in Phase 2. For MVP, managers download and attach manually.

4. **HEIC image handling?**
   - **Question:** iPhones default to HEIC. Convert to JPG on upload?
   - **Recommendation:** Yes, use Vercel Edge Function with sharp library (auto-convert HEIC → JPG). Prevents compatibility issues.

5. **Storage backup beyond Supabase?**
   - **Question:** Should we replicate documents to S3/Wasabi for disaster recovery?
   - **Recommendation:** Not for MVP (Supabase has 99.9% uptime). Add in Phase 2 for enterprise customers.

### 16.2 Business/Legal Questions

1. **Who owns the documents?**
   - **Question:** If customer churns, do they retain access to documents?
   - **Recommendation:** Yes, provide 90-day grace period to export all documents as ZIP. After 90 days, hard delete (disclose in T&Cs).

2. **Compliance liability?**
   - **Question:** If manager forgets to upload critical document and fails audit, is LevyLite liable?
   - **Recommendation:** T&Cs must state: "Platform facilitates record-keeping. Manager responsible for compliance. We provide tools, not legal advice."

3. **GDPR/Privacy Act compliance?**
   - **Question:** Owner requests all their data deleted (right to be forgotten).
   - **Recommendation:** Soft-delete owner record + anonymize documents (replace owner name with "Former Owner #123"). Retain financial records for 7 years (legal requirement).

4. **Subpoena handling?**
   - **Question:** Court orders production of documents. How do we respond?
   - **Recommendation:** T&Cs: "We may disclose data if legally compelled. Manager notified unless prohibited by law." Legal hold feature supports this.

### 16.3 UX Questions

1. **Folder vs. list view?**
   - **Question:** Should documents be shown in nested folders (like Google Drive) or flat list with filters (like Gmail)?
   - **Recommendation:** Hybrid: List view by default (faster search), optional "Browse by Folder" mode for users who prefer hierarchy.

2. **Mobile upload?**
   - **Question:** Can managers upload photos from phone (e.g., on-site inspection)?
   - **Recommendation:** Yes, responsive drag-and-drop works on mobile browsers. Native app not needed for MVP.

3. **Bulk tagging?**
   - **Question:** Select 20 documents, apply tag "urgent" to all?
   - **Recommendation:** Yes, add bulk actions (tag, delete, set owner-accessible) in Phase 1.5 (quick win after MVP).

---

## 17. Success Metrics (Document Storage Specific)

### 17.1 Adoption Metrics

- **% of customers with 20+ documents uploaded within first 30 days:** Target 80%
- **Average documents per scheme:** Target 50 (indicates healthy usage)
- **% of schemes with at least 1 document in each major category:** Target 60% (shows comprehensive record-keeping)

### 17.2 Engagement Metrics

- **Search queries per user per month:** Target 10+ (indicates users finding value)
- **Owner portal document downloads per lot per year:** Target 2+ (reduces manager calls)
- **External shares generated per month:** Target 5+ (shows feature used for collaboration)

### 17.3 Compliance Metrics

- **% of documents approaching expiry with manager action taken (extend or delete):** Target 90% (shows retention policy working)
- **Zero audit failures due to missing documents:** Target 100% (core value prop)
- **Audit log export requests per month:** Target 5+ (indicates compliance-conscious customers)

### 17.4 Performance Metrics

- **Average upload time (5MB PDF):** Target <10 seconds
- **Search result latency:** Target <1 second
- **Document preview load time:** Target <3 seconds

---

## Appendix A: File Naming Conventions

To reduce collisions and improve organization, recommend standardized filename formats to managers:

| Document Type | Format | Example |
|---------------|--------|---------|
| AGM Notice | `agm-notice-{year}-{type}.pdf` | `agm-notice-2024-annual.pdf` |
| AGM Minutes | `agm-minutes-{year}-{type}.pdf` | `agm-minutes-2024-annual.pdf` |
| Levy Notice | `levy-{lot}-{period}-{year}.pdf` | `levy-12-q3-2024.pdf` |
| Insurance | `insurance-{type}-{year}.pdf` | `insurance-building-2024.pdf` |
| By-law | `bylaw-{topic}-{date}.pdf` | `bylaw-pets-2020-03-15.pdf` |
| Contractor Quote | `quote-{company}-{job}-{date}.pdf` | `quote-acme-plumbing-leak-2024-02-10.pdf` |

**Enforcement:** Not enforced (too restrictive), but suggested during upload via tooltips.

---

## Appendix B: Migration from Existing Systems

For customers switching from spreadsheets or other platforms:

### B.1 Spreadsheet Migration

**Common scenario:** Manager has 50 PDFs in `Documents/Sunset Villas/AGM/`.

**Steps:**
1. Bulk upload folder via web interface
2. System auto-detects year from filenames
3. Manager reviews suggested categories (editable)
4. Confirms, system uploads all

**Timeline:** 15-30 minutes per scheme (vs. manual one-by-one upload).

### B.2 Email Archive Migration

**Scenario:** Manager stores correspondence in Gmail folders.

**Steps:**
1. Export Gmail folder as MBOX
2. Extract attachments using email client or script
3. Bulk upload attachments, tag as "email-archive"
4. Optional: Store email body as TXT file (for context)

**Future:** Email integration (forward to `uploads@levylite.com.au` → auto-categorize, store).

### B.3 StrataMax/Intellistrata Export

**Scenario:** Customer switching from incumbent platform.

**Challenge:** Proprietary formats, no standard export API.

**Workaround:**
1. Export documents manually (if platform allows bulk download)
2. Use bulk upload + CSV metadata import
3. We offer **free migration service** for first 10 paying customers (competitive advantage)

**Future:** Build importers for common platforms (StrataMax CSV format, Intellistrata API).

---

## Conclusion

This specification defines a **comprehensive, compliant, and user-friendly document storage system** tailored to the unique needs of small strata operators. By automating document generation, enforcing 7-year retention, and providing granular access control, LevyLite eliminates the compliance risk and inefficiency of spreadsheet-based document management.

**Next Steps:**

1. **Schema review:** Validate database schema with Donna Henneberry (design partner) — does it cover all WA requirements?
2. **Storage bucket setup:** Configure Supabase Storage in dev environment, test RLS policies
3. **Upload UI prototype:** Build drag-and-drop uploader, test with 50-file bulk upload
4. **Integration planning:** Coordinate with Levy Management and AGM features for auto-document generation
5. **Legal review:** Consult WA strata lawyer on retention policies, T&Cs language ($2K-$5K investment)

**Estimated Development Time:**
- Core upload/storage/search: 40 hours
- Versioning + retention logic: 20 hours
- RLS policies + audit logging: 15 hours
- Owner portal integration: 10 hours
- Auto-generation workflows (levy, AGM): 20 hours
- **Total: ~105 hours** (13 working days at 8 hours/day, or 10 weeks at 10 hours/week side-project pace)

**Dependency Path:** Build in parallel with Levy Management (weeks 1-4) and AGM Administration (weeks 5-8). Document Storage provides the storage layer both features depend on.

---

**Document Control:**
- **Version:** 1.0
- **Last Updated:** 16 February 2026
- **Author:** Kai (AI Assistant), Kokoro Software
- **Reviewed By:** [Pending — Chris Johnstone, Donna Henneberry]
- **Approval Status:** Draft
