CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Only create a profile if the user has an email (skip anonymous users)
  IF NEW.email IS NOT NULL AND NEW.email <> '' THEN
    INSERT INTO public.profiles (user_id, email, full_name)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email))
    ON CONFLICT DO NOTHING;

    -- Auto-accept any pending invites matching this email
    INSERT INTO public.project_members (project_id, user_id, role)
    SELECT project_id, NEW.id, 'member' FROM public.project_invites
    WHERE lower(email) = lower(NEW.email) AND accepted = false
    ON CONFLICT DO NOTHING;

    UPDATE public.project_invites SET accepted = true
    WHERE lower(email) = lower(NEW.email) AND accepted = false;
  END IF;

  RETURN NEW;
END; $function$;