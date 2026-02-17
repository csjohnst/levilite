-- Fix: owners INSERT blocked by RLS because lot_ownerships don't exist yet
-- Split the FOR ALL policy into per-operation policies so INSERT is allowed
-- for any authenticated user in an organisation.

DROP POLICY "tenant_isolation" ON public.owners;

-- SELECT: org chain via lot_ownerships, portal user, OR created by current user
-- (created_by check needed so .insert().select() works before lot_ownerships exist)
CREATE POLICY "owners_select" ON public.owners
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.lot_ownerships
      JOIN public.lots ON lots.id = lot_ownerships.lot_id
      JOIN public.schemes ON schemes.id = lots.scheme_id
      WHERE lot_ownerships.owner_id = owners.id
      AND schemes.organisation_id = public.user_organisation_id()
    ) OR
    portal_user_id = auth.uid() OR
    created_by = auth.uid()
  );

-- INSERT: any authenticated user with an org can create owners
CREATE POLICY "owners_insert" ON public.owners
  FOR INSERT WITH CHECK (
    public.user_organisation_id() IS NOT NULL
  );

-- UPDATE: org chain via lot_ownerships, portal user, or created by current user
CREATE POLICY "owners_update" ON public.owners
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.lot_ownerships
      JOIN public.lots ON lots.id = lot_ownerships.lot_id
      JOIN public.schemes ON schemes.id = lots.scheme_id
      WHERE lot_ownerships.owner_id = owners.id
      AND schemes.organisation_id = public.user_organisation_id()
    ) OR
    portal_user_id = auth.uid() OR
    created_by = auth.uid()
  );

-- DELETE: org chain via lot_ownerships only (portal users can't delete)
CREATE POLICY "owners_delete" ON public.owners
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.lot_ownerships
      JOIN public.lots ON lots.id = lot_ownerships.lot_id
      JOIN public.schemes ON schemes.id = lots.scheme_id
      WHERE lot_ownerships.owner_id = owners.id
      AND schemes.organisation_id = public.user_organisation_id()
    )
  );
