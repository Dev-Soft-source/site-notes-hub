ALTER TABLE public.project_updates REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_updates;