-- Migration 00006: Auth trigger for new user signup
-- Handles both manager signup (creates new org) and invited user signup (joins existing org).

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  _org_id UUID;
  _org_name TEXT;
  _invitation RECORD;
BEGIN
  -- Check if this is a manager signup (raw_user_meta_data contains 'organisation_name')
  _org_name := NEW.raw_user_meta_data ->> 'organisation_name';

  IF _org_name IS NOT NULL AND _org_name <> '' THEN
    -- Manager signup: create a new organisation and link the user as manager
    INSERT INTO public.organisations (name)
    VALUES (_org_name)
    RETURNING id INTO _org_id;

    INSERT INTO public.organisation_users (organisation_id, user_id, role, joined_at)
    VALUES (_org_id, NEW.id, 'manager', NOW());

    RETURN NEW;
  END IF;

  -- Check if there is a pending invitation for this email
  SELECT * INTO _invitation
  FROM public.invitations
  WHERE email = NEW.email
    AND accepted_at IS NULL
    AND expires_at > NOW()
  ORDER BY created_at DESC
  LIMIT 1;

  IF _invitation IS NOT NULL THEN
    -- Invited user: join the existing organisation with the invited role
    INSERT INTO public.organisation_users (organisation_id, user_id, role, invited_by, joined_at)
    VALUES (_invitation.organisation_id, NEW.id, _invitation.role, _invitation.invited_by, NOW());

    -- Mark invitation as accepted
    UPDATE public.invitations
    SET accepted_at = NOW()
    WHERE id = _invitation.id;

    RETURN NEW;
  END IF;

  -- No organisation_name and no invitation -- user signed up without context.
  -- They will need to be invited or create an org later.
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users INSERT
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
