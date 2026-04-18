
-- Profiles
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Projects
CREATE TABLE public.projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  site_address TEXT,
  description TEXT,
  qr_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Project members
CREATE TABLE public.project_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Helper function (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_project_member(_project_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.project_members WHERE project_id = _project_id AND user_id = _user_id
  ) OR EXISTS (
    SELECT 1 FROM public.projects WHERE id = _project_id AND created_by = _user_id
  );
$$;

-- Project policies
CREATE POLICY "Members can view projects" ON public.projects FOR SELECT
  USING (public.is_project_member(id, auth.uid()));
CREATE POLICY "Users can create projects" ON public.projects FOR INSERT
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Members can update projects" ON public.projects FOR UPDATE
  USING (public.is_project_member(id, auth.uid()));
CREATE POLICY "Owner can delete projects" ON public.projects FOR DELETE
  USING (auth.uid() = created_by);

-- Project member policies
CREATE POLICY "Members can view membership" ON public.project_members FOR SELECT
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Owner can add members" ON public.project_members FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND created_by = auth.uid()));
CREATE POLICY "Owner can remove members" ON public.project_members FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND created_by = auth.uid()));

-- Project invites (by email, before user signs up)
CREATE TABLE public.project_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(project_id, email)
);
ALTER TABLE public.project_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view invites" ON public.project_invites FOR SELECT
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Owner can create invites" ON public.project_invites FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects WHERE id = project_id AND created_by = auth.uid()));

-- Drawings
CREATE TABLE public.drawings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  original_path TEXT NOT NULL,
  qr_pdf_path TEXT,
  mime_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.drawings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view drawings" ON public.drawings FOR SELECT
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members add drawings" ON public.drawings FOR INSERT
  WITH CHECK (public.is_project_member(project_id, auth.uid()) AND auth.uid() = uploaded_by);
CREATE POLICY "Members delete drawings" ON public.drawings FOR DELETE
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members update drawings" ON public.drawings FOR UPDATE
  USING (public.is_project_member(project_id, auth.uid()));

-- Updates (text + voice notes)
CREATE TABLE public.project_updates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'note', -- 'note' | 'voice'
  body TEXT,
  audio_path TEXT,
  transcription TEXT,
  transcription_status TEXT DEFAULT 'pending', -- 'pending'|'done'|'failed'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.project_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view updates" ON public.project_updates FOR SELECT
  USING (public.is_project_member(project_id, auth.uid()));
CREATE POLICY "Members add updates" ON public.project_updates FOR INSERT
  WITH CHECK (public.is_project_member(project_id, auth.uid()) AND auth.uid() = author_id);
CREATE POLICY "Author updates own" ON public.project_updates FOR UPDATE
  USING (auth.uid() = author_id);
CREATE POLICY "Author deletes own" ON public.project_updates FOR DELETE
  USING (auth.uid() = author_id);

-- Notifications (in-app)
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own notifications" ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "Service inserts notifications" ON public.notifications FOR INSERT
  WITH CHECK (true);

-- Timestamps trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_projects_updated BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto profile + accept invites on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  -- Auto-accept any pending invites matching this email
  INSERT INTO public.project_members (project_id, user_id, role)
  SELECT project_id, NEW.id, 'member' FROM public.project_invites
  WHERE lower(email) = lower(NEW.email) AND accepted = false
  ON CONFLICT DO NOTHING;

  UPDATE public.project_invites SET accepted = true
  WHERE lower(email) = lower(NEW.email) AND accepted = false;

  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto add creator as member
CREATE OR REPLACE FUNCTION public.add_project_creator_as_member()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.project_members (project_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_add_creator_member
  AFTER INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.add_project_creator_as_member();

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('drawings', 'drawings', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('voice-notes', 'voice-notes', false);

-- Storage policies: project members access by project_id prefix
CREATE POLICY "Members read drawings" ON storage.objects FOR SELECT
  USING (bucket_id = 'drawings' AND public.is_project_member(((storage.foldername(name))[1])::uuid, auth.uid()));
CREATE POLICY "Members upload drawings" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'drawings' AND public.is_project_member(((storage.foldername(name))[1])::uuid, auth.uid()));
CREATE POLICY "Members delete drawings" ON storage.objects FOR DELETE
  USING (bucket_id = 'drawings' AND public.is_project_member(((storage.foldername(name))[1])::uuid, auth.uid()));

CREATE POLICY "Members read voice notes" ON storage.objects FOR SELECT
  USING (bucket_id = 'voice-notes' AND public.is_project_member(((storage.foldername(name))[1])::uuid, auth.uid()));
CREATE POLICY "Members upload voice notes" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'voice-notes' AND public.is_project_member(((storage.foldername(name))[1])::uuid, auth.uid()));
CREATE POLICY "Members delete voice notes" ON storage.objects FOR DELETE
  USING (bucket_id = 'voice-notes' AND public.is_project_member(((storage.foldername(name))[1])::uuid, auth.uid()));
