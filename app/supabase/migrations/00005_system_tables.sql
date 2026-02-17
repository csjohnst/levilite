-- Migration 00005: System tables (invitations, notifications)
-- Note: audit_log table was created in 00001 alongside the trigger function.

-- Row-level security for audit_log (created in 00001, policies added here
-- since they depend on schemes/lots/owners existing)
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_see_own_org_audit_logs" ON public.audit_log
  FOR SELECT USING (
    -- Users can see audit logs for records belonging to their organisation.
    -- This checks the most common tables; extend as needed.
    (table_name = 'schemes' AND EXISTS (
      SELECT 1 FROM public.schemes WHERE schemes.id = audit_log.record_id
      AND schemes.organisation_id = auth.user_organisation_id()
    )) OR
    (table_name = 'lots' AND EXISTS (
      SELECT 1 FROM public.lots
      JOIN public.schemes ON schemes.id = lots.scheme_id
      WHERE lots.id = audit_log.record_id
      AND schemes.organisation_id = auth.user_organisation_id()
    )) OR
    (table_name = 'owners' AND EXISTS (
      SELECT 1 FROM public.owners
      JOIN public.lot_ownerships ON lot_ownerships.owner_id = owners.id
      JOIN public.lots ON lots.id = lot_ownerships.lot_id
      JOIN public.schemes ON schemes.id = lots.scheme_id
      WHERE owners.id = audit_log.record_id
      AND schemes.organisation_id = auth.user_organisation_id()
    )) OR
    (table_name = 'organisations' AND EXISTS (
      SELECT 1 FROM public.organisations WHERE organisations.id = audit_log.record_id
      AND organisations.id = auth.user_organisation_id()
    )) OR
    (table_name IN ('lot_ownerships','committee_members','tenants') AND EXISTS (
      SELECT 1 FROM public.organisation_users
      WHERE organisation_users.user_id = auth.uid()
      AND organisation_users.organisation_id = auth.user_organisation_id()
    ))
  );

-- ============================================================
-- Invitations table
-- ============================================================

CREATE TABLE public.invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organisation_id UUID NOT NULL REFERENCES public.organisations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('manager','admin','auditor','owner')),
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invitations_token ON public.invitations(token);
CREATE INDEX idx_invitations_org ON public.invitations(organisation_id);
CREATE INDEX idx_invitations_email ON public.invitations(email);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation" ON public.invitations
  FOR ALL USING (organisation_id = auth.user_organisation_id());

-- ============================================================
-- Notifications table
-- ============================================================

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organisation_id UUID REFERENCES public.organisations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT DEFAULT 'info' CHECK (type IN ('info','warning','success','error')),
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id);
CREATE INDEX idx_notifications_unread ON public.notifications(user_id) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_see_own_notifications" ON public.notifications
  FOR ALL USING (user_id = auth.uid());
