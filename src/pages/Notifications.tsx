import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft } from "lucide-react";

interface Notif {
  id: string; title: string; body: string | null; project_id: string | null;
  read_at: string | null; created_at: string;
}

export default function Notifications() {
  const nav = useNavigate();
  const [items, setItems] = useState<Notif[]>([]);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
      setItems((data as Notif[]) || []);
      // Mark all as read
      const unreadIds = (data || []).filter((n: any) => !n.read_at).map((n: any) => n.id);
      if (unreadIds.length) {
        await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", unreadIds);
      }
    };
    load();

    // Realtime: prepend new notifications as they arrive
    const channel = supabase
      .channel("notif-list")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const n = payload.new as Notif;
          setItems((prev) => [n, ...prev]);
          // Mark immediately as read since the user is on this page
          supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", n.id);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="min-h-screen bg-background safe-pt pb-10">
      <header className="px-5 pt-4 pb-3 flex items-center gap-2">
        <button onClick={() => nav(-1)} className="size-10 -ml-2 grid place-items-center rounded-full active:bg-secondary">
          <ChevronLeft className="size-6" />
        </button>
        <h1 className="text-xl font-bold">Notifications</h1>
      </header>
      <div className="px-5 mt-2 space-y-3">
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-12">No notifications yet</div>
        ) : items.map((n) => (
          <Link to={n.project_id ? `/projects/${n.project_id}` : "#"} key={n.id} className={`block rounded-2xl bg-card shadow-card p-4 ${!n.read_at ? "border-l-4 border-accent" : ""}`}>
            <div className="font-semibold">{n.title}</div>
            {n.body && <div className="text-sm text-muted-foreground mt-1">{n.body}</div>}
            <div className="text-xs text-muted-foreground mt-2">{new Date(n.created_at).toLocaleString()}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}
