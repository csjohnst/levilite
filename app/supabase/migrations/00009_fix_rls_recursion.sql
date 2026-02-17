-- Fix infinite recursion: owners RLS -> lot_ownerships RLS -> owners RLS
-- Remove the circular owners reference from lot_ownerships policy.
-- Staff access via lots -> schemes -> organisation chain is sufficient.

DROP POLICY "tenant_isolation" ON public.lot_ownerships;

CREATE POLICY "tenant_isolation" ON public.lot_ownerships
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.lots
      JOIN public.schemes ON schemes.id = lots.scheme_id
      WHERE lots.id = lot_ownerships.lot_id
      AND schemes.organisation_id = public.user_organisation_id()
    )
  );
