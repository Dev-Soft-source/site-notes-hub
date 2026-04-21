import { useEffect } from "react";
import { useAuth } from "@/auth/AuthContext";
import { supabase } from "@/integrations/supabase/client";

// Module-level guard so we only ever fire one anonymous sign-in
// across the whole app session, even if RequireAuth remounts.
let anonSignInPromise: Promise<unknown> | null = null;

export const RequireAuth = ({ children }: { children: JSX.Element }) => {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading || user) return;
    if (!anonSignInPromise) {
      anonSignInPromise = supabase.auth.signInAnonymously().catch((e) => {
        console.error("Anonymous sign-in failed:", e);
        // Allow a retry later (e.g., after rate-limit cool-off)
        setTimeout(() => { anonSignInPromise = null; }, 30_000);
      });
    }
  }, [loading, user]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }
  return children;
};
