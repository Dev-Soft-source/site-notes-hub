"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut as firebaseSignOut } from "firebase/auth";
import { getFirebaseAuth } from "@/integrations/firebase/client";
import { useAuth } from "@/auth/AuthContext";
import type { ProjectDoc } from "@/lib/firestore-db";
import {
  countUnreadNotifications,
  listProjectsForUser,
  subscribeUserNotifications,
} from "@/lib/firestore-db";
import { Button } from "@/components/ui/button";
import { Plus, QrCode, LogOut, HardHat, MapPin, Bell } from "lucide-react";
import { toast } from "sonner";

export default function Projects() {
  const { user } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<ProjectDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
    const uid = user.uid;

    const load = async () => {
      try {
        const list = await listProjectsForUser(uid);
        setProjects(list);
        setUnread(await countUnreadNotifications(uid));
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Failed to load projects");
      } finally {
        setLoading(false);
      }
    };
    load();

    const unsub = subscribeUserNotifications(
      uid,
      async () => {
        try {
          setUnread(await countUnreadNotifications(uid));
        } catch {
          /* ignore */
        }
      },
      (title, body) => toast(title, { description: body }),
    );

    return () => unsub();
  }, [user]);

  const signOut = async () => {
    const auth = getFirebaseAuth();
    if (auth) {
      try {
        await firebaseSignOut(auth);
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Sign out failed");
        return;
      }
    }
    router.push("/login");
  };

  const firstName = user?.displayName?.trim().split(/\s+/)[0];

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
            <Link href="/notifications" className="relative size-10 rounded-full bg-white/10 grid place-items-center active:bg-white/20">
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
        <h1 className="text-2xl font-semibold">Hello{firstName ? `, ${firstName}` : ""}</h1>
        <p className="opacity-80 text-sm mt-1">Your active projects</p>
        {user?.isAnonymous && (
          <p className="mt-4 rounded-xl bg-white/10 px-3 py-2 text-sm leading-snug">
            You&apos;re on a guest session.{" "}
            <Link href="/login?redirect=/" className="font-semibold underline underline-offset-2">
              Sign in or create an account
            </Link>{" "}
            to keep access across devices.
          </p>
        )}
      </header>

      <div className="px-5 mt-5 grid grid-cols-2 gap-3">
        <Link href="/projects/new" className="rounded-2xl bg-card shadow-card p-4 flex flex-col gap-2 active:scale-[0.98] transition">
          <div className="size-10 rounded-xl gradient-accent grid place-items-center shadow-accent-glow">
            <Plus className="size-5 text-accent-foreground" />
          </div>
          <div>
            <div className="font-semibold">New project</div>
            <div className="text-xs text-muted-foreground">Set up a job</div>
          </div>
        </Link>
        <Link href="/scan" className="rounded-2xl bg-card shadow-card p-4 flex flex-col gap-2 active:scale-[0.98] transition">
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
            <Button asChild>
              <Link href="/projects/new">Create your first project</Link>
            </Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {projects.map((p) => (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`} className="block rounded-2xl bg-card shadow-card p-4 active:scale-[0.99] transition">
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
