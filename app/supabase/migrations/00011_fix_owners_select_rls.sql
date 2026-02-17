-- Fix: .insert().select() fails because SELECT policy doesn't allow reading
-- the newly created owner before lot_ownerships are linked.
-- Add created_by = auth.uid() to SELECT and UPDATE policies.

DROP POLICY "owners_select" ON public.owners;
DROP POLICY "owners_update" ON public.owners;

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
