
DROP POLICY "Service inserts notifications" ON public.notifications;
-- Allow inserts only for notifications targeted at users in projects where the current user is a member
CREATE POLICY "Members notify other members" ON public.notifications FOR INSERT
  WITH CHECK (
    project_id IS NULL OR public.is_project_member(project_id, auth.uid())
  );
