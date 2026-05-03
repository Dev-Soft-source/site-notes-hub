"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/auth/AuthContext";
import { getFirebaseAuth } from "@/integrations/firebase/client";

export const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth || loading || user) return;
    const redirect = pathname && pathname.startsWith("/") && !pathname.startsWith("//") ? pathname : "/";
    const q = new URLSearchParams({ redirect });
    router.replace(`/login?${q.toString()}`);
  }, [loading, user, router, pathname]);

  if (!getFirebaseAuth()) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-muted-foreground">
        Set NEXT_PUBLIC_FIREBASE_* environment variables to use SiteSync.
      </div>
    );
  }

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  return children;
};
