import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Public QR landing — looks up project by qr_token, then redirects to /projects/:id
export default function QrLanding() {
  const { token } = useParams<{ token: string }>();
  const nav = useNavigate();

  useEffect(() => {
    const go = async () => {
      if (!token) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Save token, send to auth, redirect back
        sessionStorage.setItem("pending_qr_token", token);
        nav("/auth", { replace: true });
        return;
      }
      const { data, error } = await supabase.from("projects").select("id").eq("qr_token", token).maybeSingle();
      if (error || !data) {
        toast.error("You don't have access to this project. Ask the owner to invite you.");
        nav("/", { replace: true });
        return;
      }
      nav(`/projects/${data.id}`, { replace: true });
    };
    go();
  }, [token, nav]);

  return <div className="min-h-screen grid place-items-center text-muted-foreground">Opening project…</div>;
}
