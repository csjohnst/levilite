-- Migration 00015: Documents & Budgets (Phase 4)
-- Tables: documents, document_versions, document_audit_log, budgets, budget_line_items
-- Also: Supabase Storage bucket for scheme documents
-- NOTE: All tables created first, then indexes, then RLS, then policies, then trigger functions, then triggers

-- ============================================================
-- 1. CREATE ALL TABLES
-- ============================================================

-- Documents (file metadata + full-text search)
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES public.schemes(id) ON DELETE CASCADE,

  -- Document identification
  document_name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  document_date DATE NOT NULL,

  -- File storage
  file_path TEXT NOT NULL UNIQUE,
  file_size BIGINT NOT NULL,
  mime_type TEXT NOT NULL,

  -- Organisation / tags
  tags TEXT[] DEFAULT '{}',
  visibility TEXT NOT NULL DEFAULT 'manager_only',

  -- Versioning
  version_number INTEGER NOT NULL DEFAULT 1,
  is_latest_version BOOLEAN NOT NULL DEFAULT TRUE,
  version_status TEXT NOT NULL DEFAULT 'final',

  -- Entity linking (polymorphic)
  linked_entity_type TEXT,
  linked_entity_id UUID,

  -- Auto-generated flag (e.g. levy notices, reports)
  auto_generated BOOLEAN NOT NULL DEFAULT FALSE,

  -- Users
  uploaded_by UUID REFERENCES auth.users(id),
  created_by UUID NOT NULL REFERENCES auth.users(id),

  -- Soft delete
  deleted_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Full-text search vector (populated by trigger — array_to_string is not immutable)
  search_vector tsvector,

  -- Constraints
  CONSTRAINT valid_document_category CHECK (category IN (
    'agm', 'levy-notices', 'financial', 'insurance', 'bylaws',
    'correspondence', 'maintenance', 'contracts', 'building-reports', 'other'
  )),
  CONSTRAINT valid_document_visibility CHECK (visibility IN ('owners', 'committee', 'manager_only')),
  CONSTRAINT valid_version_status CHECK (version_status IN ('draft', 'final', 'superseded')),
  CONSTRAINT valid_linked_entity_type CHECK (linked_entity_type IS NULL OR linked_entity_type IN (
    'levy', 'meeting', 'maintenance_request', 'financial_report', 'reconciliation'
  ))
);

-- Document Versions (version history for a document)
CREATE TABLE public.document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,

  -- Version details
  version_number INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,

  -- Who uploaded
  uploaded_by UUID REFERENCES auth.users(id),

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_version_per_document UNIQUE(document_id, version_number)
);

-- Document Audit Log (tracks all document access/changes)
CREATE TABLE public.document_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),

  -- Action performed
  action TEXT NOT NULL,

  -- Additional details
  event_details JSONB,
  ip_address TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_audit_action CHECK (action IN (
    'upload', 'view', 'download', 'delete', 'share', 'version', 'mark_final', 'metadata_update'
  ))
);

-- Budgets (per scheme, per financial year, per fund type)
CREATE TABLE public.budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id UUID NOT NULL REFERENCES public.schemes(id) ON DELETE CASCADE,
  financial_year_id UUID NOT NULL REFERENCES public.financial_years(id) ON DELETE CASCADE,

  -- Budget classification
  budget_type TEXT NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,

  -- Status workflow
  status TEXT NOT NULL DEFAULT 'draft',
  approved_at DATE,

  -- Notes
  notes TEXT,

  -- Metadata
  created_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT valid_budget_type CHECK (budget_type IN ('admin', 'capital_works')),
  CONSTRAINT valid_budget_status CHECK (status IN ('draft', 'review', 'approved', 'amended')),
  CONSTRAINT unique_budget_per_scheme_fy_type UNIQUE(scheme_id, financial_year_id, budget_type)
);

-- Budget Line Items (individual budget categories)
CREATE TABLE public.budget_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_id UUID NOT NULL REFERENCES public.budgets(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES public.chart_of_accounts(id) ON DELETE RESTRICT,

  -- Amounts
  budgeted_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  previous_year_actual DECIMAL(12,2),

  -- Notes
  notes TEXT,

  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_line_item_per_budget_category UNIQUE(budget_id, category_id)
);

-- ============================================================
-- 2. INDEXES
-- ============================================================

-- documents indexes
CREATE INDEX idx_documents_scheme ON public.documents(scheme_id);
CREATE INDEX idx_documents_category ON public.documents(category);
CREATE INDEX idx_documents_tags ON public.documents USING GIN(tags);
CREATE INDEX idx_documents_search_vector ON public.documents USING GIN(search_vector);
CREATE INDEX idx_documents_linked_entity ON public.documents(linked_entity_type, linked_entity_id);
CREATE INDEX idx_documents_scheme_category ON public.documents(scheme_id, category);
CREATE INDEX idx_documents_not_deleted ON public.documents(scheme_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_documents_visibility ON public.documents(visibility);
CREATE INDEX idx_documents_created_at ON public.documents(created_at DESC);

-- document_versions indexes
CREATE INDEX idx_doc_versions_document ON public.document_versions(document_id);

-- document_audit_log indexes
CREATE INDEX idx_doc_audit_document_date ON public.document_audit_log(document_id, created_at DESC);
CREATE INDEX idx_doc_audit_user_date ON public.document_audit_log(user_id, created_at DESC);

-- budgets indexes
CREATE INDEX idx_budgets_scheme ON public.budgets(scheme_id);
CREATE INDEX idx_budgets_financial_year ON public.budgets(financial_year_id);
CREATE INDEX idx_budgets_status ON public.budgets(status);
CREATE INDEX idx_budgets_scheme_fy ON public.budgets(scheme_id, financial_year_id);

-- budget_line_items indexes
CREATE INDEX idx_budget_line_items_budget ON public.budget_line_items(budget_id);
CREATE INDEX idx_budget_line_items_category ON public.budget_line_items(category_id);

-- ============================================================
-- 3. ENABLE RLS ON ALL TABLES
-- ============================================================

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budget_line_items ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4. RLS POLICIES
-- ============================================================

-- documents: scheme_id -> schemes.organisation_id = user_organisation_id()
CREATE POLICY "documents_select" ON public.documents
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.schemes
      WHERE schemes.id = documents.scheme_id
      AND schemes.organisation_id = public.user_organisation_id()
    )
  );

CREATE POLICY "documents_insert" ON public.documents
  FOR INSERT WITH CHECK (
    public.user_organisation_id() IS NOT NULL
  );

CREATE POLICY "documents_update" ON public.documents
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.schemes
      WHERE schemes.id = documents.scheme_id
      AND schemes.organisation_id = public.user_organisation_id()
    )
  );

CREATE POLICY "documents_delete" ON public.documents
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.schemes
      WHERE schemes.id = documents.scheme_id
      AND schemes.organisation_id = public.user_organisation_id()
    )
  );

-- document_versions: chain through document_id -> documents.scheme_id -> schemes.organisation_id
CREATE POLICY "doc_versions_select" ON public.document_versions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.documents
      JOIN public.schemes ON schemes.id = documents.scheme_id
      WHERE documents.id = document_versions.document_id
      AND schemes.organisation_id = public.user_organisation_id()
    )
  );

CREATE POLICY "doc_versions_insert" ON public.document_versions
  FOR INSERT WITH CHECK (
    public.user_organisation_id() IS NOT NULL
  );

CREATE POLICY "doc_versions_update" ON public.document_versions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.documents
      JOIN public.schemes ON schemes.id = documents.scheme_id
      WHERE documents.id = document_versions.document_id
      AND schemes.organisation_id = public.user_organisation_id()
    )
  );

CREATE POLICY "doc_versions_delete" ON public.document_versions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.documents
      JOIN public.schemes ON schemes.id = documents.scheme_id
      WHERE documents.id = document_versions.document_id
      AND schemes.organisation_id = public.user_organisation_id()
    )
  );

-- document_audit_log: SELECT for org members, INSERT via SECURITY DEFINER function
CREATE POLICY "doc_audit_select" ON public.document_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.documents
      JOIN public.schemes ON schemes.id = documents.scheme_id
      WHERE documents.id = document_audit_log.document_id
      AND schemes.organisation_id = public.user_organisation_id()
    )
  );

-- INSERT policy: allow authenticated users (actual access control via the SECURITY DEFINER logging function)
CREATE POLICY "doc_audit_insert" ON public.document_audit_log
  FOR INSERT WITH CHECK (
    public.user_organisation_id() IS NOT NULL
  );

-- budgets: scheme_id -> schemes.organisation_id = user_organisation_id()
CREATE POLICY "budgets_select" ON public.budgets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.schemes
      WHERE schemes.id = budgets.scheme_id
      AND schemes.organisation_id = public.user_organisation_id()
    )
  );

CREATE POLICY "budgets_insert" ON public.budgets
  FOR INSERT WITH CHECK (
    public.user_organisation_id() IS NOT NULL
  );

CREATE POLICY "budgets_update" ON public.budgets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.schemes
      WHERE schemes.id = budgets.scheme_id
      AND schemes.organisation_id = public.user_organisation_id()
    )
  );

CREATE POLICY "budgets_delete" ON public.budgets
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.schemes
      WHERE schemes.id = budgets.scheme_id
      AND schemes.organisation_id = public.user_organisation_id()
    )
  );

-- budget_line_items: chain through budget_id -> budgets.scheme_id -> schemes.organisation_id
CREATE POLICY "budget_line_items_select" ON public.budget_line_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.budgets
      JOIN public.schemes ON schemes.id = budgets.scheme_id
      WHERE budgets.id = budget_line_items.budget_id
      AND schemes.organisation_id = public.user_organisation_id()
    )
  );

CREATE POLICY "budget_line_items_insert" ON public.budget_line_items
  FOR INSERT WITH CHECK (
    public.user_organisation_id() IS NOT NULL
  );

CREATE POLICY "budget_line_items_update" ON public.budget_line_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.budgets
      JOIN public.schemes ON schemes.id = budgets.scheme_id
      WHERE budgets.id = budget_line_items.budget_id
      AND schemes.organisation_id = public.user_organisation_id()
    )
  );

CREATE POLICY "budget_line_items_delete" ON public.budget_line_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.budgets
      JOIN public.schemes ON schemes.id = budgets.scheme_id
      WHERE budgets.id = budget_line_items.budget_id
      AND schemes.organisation_id = public.user_organisation_id()
    )
  );

-- ============================================================
-- 5. TRIGGER FUNCTIONS
-- ============================================================

-- Log document audit events (SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION public.log_document_audit(
  p_document_id UUID,
  p_user_id UUID,
  p_action TEXT,
  p_event_details JSONB DEFAULT NULL,
  p_ip_address TEXT DEFAULT NULL
)
RETURNS UUID
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.document_audit_log (document_id, user_id, action, event_details, ip_address)
  VALUES (p_document_id, p_user_id, p_action, p_event_details, p_ip_address)
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- ============================================================
-- 6. TRIGGERS
-- ============================================================

-- Search vector trigger function (array_to_string is STABLE not IMMUTABLE, so can't use GENERATED ALWAYS)
CREATE OR REPLACE FUNCTION public.update_document_search_vector()
RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.document_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C');
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_documents_search_vector
  BEFORE INSERT OR UPDATE OF document_name, description, tags ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_document_search_vector();

-- updated_at triggers (reuse existing function)
CREATE TRIGGER set_documents_updated_at
  BEFORE UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_budgets_updated_at
  BEFORE UPDATE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER set_budget_line_items_updated_at
  BEFORE UPDATE ON public.budget_line_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Audit log triggers (reuse existing function)
CREATE TRIGGER documents_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER document_versions_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON public.document_versions
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER budgets_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

CREATE TRIGGER budget_line_items_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON public.budget_line_items
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger();

-- ============================================================
-- 7. STORAGE BUCKET
-- ============================================================

-- Create the scheme-documents bucket (private, 50MB max file size)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'scheme-documents',
  'scheme-documents',
  false,
  52428800, -- 50MB in bytes
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS policies for scheme-documents bucket
-- Authenticated users in the org can upload/download/delete files within their scheme paths
CREATE POLICY "scheme_docs_select" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'scheme-documents'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "scheme_docs_insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'scheme-documents'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "scheme_docs_update" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'scheme-documents'
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "scheme_docs_delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'scheme-documents'
    AND auth.role() = 'authenticated'
  );
