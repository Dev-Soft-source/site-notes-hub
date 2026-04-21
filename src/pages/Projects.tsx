import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Plus, QrCode, LogOut, HardHat, MapPin, Bell } from "lucide-react";
import { toast } from "sonner";

interface Project {
  id: string; name: string; site_address: string | null; created_at: string;
}

export default function Projects() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, site_address, created_at")
        .order("created_at", { ascending: false });
      if (error) toast.error(error.message);
      setProjects(data || []);
      const { count } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .is("read_at", null);
      setUnread(count || 0);
      setLoading(false);
    };
    load();

    // Realtime: increment badge + toast when a new notification arrives for this user
    const channel = supabase
      .channel(`notif-badge-${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n: any = payload.new;
          setUnread((u) => u + 1);
          toast(n.title, { description: n.body || undefined });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => {
          // Recompute unread when items get marked read elsewhere
          supabase
            .from("notifications")
            .select("*", { count: "exact", head: true })
            .is("read_at", null)
            .then(({ count }) => setUnread(count || 0));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const signOut = async () => {
    await supabase.auth.signOut();
    await supabase.auth.signInAnonymously();
    nav("/");
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="gradient-primary text-primary-foreground px-5 pt-12 pb-8 safe-pt rounded-b-3xl shadow-elevated">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="size-9 rounded-xl bg-accent grid place-items-center">
              <HardHat className="size-5 text-accent-foreground" />
            </div>
            <span className="font-bold text-lg tracking-tight">SiteSync</span>
          </div>
          <div className="flex gap-2">
            <Link to="/notifications" className="relative size-10 rounded-full bg-white/10 grid place-items-center active:bg-white/20">
              <Bell className="size-5" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 bg-accent text-accent-foreground text-[10px] font-bold size-5 rounded-full grid place-items-center">
                  {unread}
                </span>
              )}
            </Link>
            <button onClick={signOut} className="size-10 rounded-full bg-white/10 grid place-items-center active:bg-white/20">
              <LogOut className="size-5" />
            </button>
          </div>
        </div>
        <h1 className="text-2xl font-semibold">Hello{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name.split(" ")[0]}` : ""}</h1>
        <p className="opacity-80 text-sm mt-1">Your active projects</p>
      </header>

      <div className="px-5 mt-5 grid grid-cols-2 gap-3">
        <Link to="/projects/new" className="rounded-2xl bg-card shadow-card p-4 flex flex-col gap-2 active:scale-[0.98] transition">
          <div className="size-10 rounded-xl gradient-accent grid place-items-center shadow-accent-glow">
            <Plus className="size-5 text-accent-foreground" />
          </div>
          <div>
            <div className="font-semibold">New project</div>
            <div className="text-xs text-muted-foreground">Set up a job</div>
          </div>
        </Link>
        <Link to="/scan" className="rounded-2xl bg-card shadow-card p-4 flex flex-col gap-2 active:scale-[0.98] transition">
          <div className="size-10 rounded-xl bg-secondary grid place-items-center">
            <QrCode className="size-5 text-primary" />
          </div>
          <div>
            <div className="font-semibold">Scan QR</div>
            <div className="text-xs text-muted-foreground">Open a site</div>
          </div>
        </Link>
      </div>

      <div className="px-5 mt-7">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Projects</h2>
        {loading ? (
          <div className="text-muted-foreground text-sm">Loading…</div>
        ) : projects.length === 0 ? (
          <div className="rounded-2xl bg-card shadow-card p-8 text-center">
            <p className="text-muted-foreground text-sm mb-4">No projects yet.</p>
            <Button asChild><Link to="/projects/new">Create your first project</Link></Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {projects.map((p) => (
              <li key={p.id}>
                <Link to={`/projects/${p.id}`} className="block rounded-2xl bg-card shadow-card p-4 active:scale-[0.99] transition">
                  <div className="font-semibold text-base">{p.name}</div>
                  {p.site_address && (
                    <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                      <MapPin className="size-3.5" /> {p.site_address}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
