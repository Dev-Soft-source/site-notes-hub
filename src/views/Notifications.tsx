"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/auth/AuthContext";
import type { NotificationDoc } from "@/lib/firestore-db";
import { markNotificationsRead, subscribeNotificationsList } from "@/lib/firestore-db";
import { ChevronLeft } from "lucide-react";

export default function Notifications() {
  const { user } = useAuth();
  const router = useRouter();
  const [items, setItems] = useState<NotificationDoc[]>([]);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;

    return subscribeNotificationsList(uid, (list) => {
      setItems(list);
      const unread = list.filter((n) => !n.read_at);
      if (unread.length) {
        markNotificationsRead(unread.map((n) => n.id)).catch(() => {});
      }
    });
  }, [user]);

  return (
    <div className="min-h-screen bg-background safe-pt pb-10">
      <header className="px-5 pt-4 pb-3 flex items-center gap-2">
        <button onClick={() => router.back()} className="size-10 -ml-2 grid place-items-center rounded-full active:bg-secondary">
          <ChevronLeft className="size-6" />
        </button>
        <h1 className="text-xl font-bold">Notifications</h1>
      </header>
      <div className="px-5 mt-2 space-y-3">
        {items.length === 0 ? (
          <div className="text-sm text-muted-foreground text-center py-12">No notifications yet</div>
        ) : (
          items.map((n) => (
            <Link
              href={n.project_id ? `/projects/${n.project_id}` : "#"}
              key={n.id}
              className={`block rounded-2xl bg-card shadow-card p-4 ${!n.read_at ? "border-l-4 border-accent" : ""}`}
            >
              <div className="font-semibold">{n.title}</div>
              {n.body && <div className="text-sm text-muted-foreground mt-1">{n.body}</div>}
              <div className="text-xs text-muted-foreground mt-2">{new Date(n.created_at).toLocaleString()}</div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
