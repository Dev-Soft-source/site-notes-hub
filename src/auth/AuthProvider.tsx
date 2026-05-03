"use client";

import { useEffect, useState, ReactNode } from "react";
<<<<<<< HEAD
import { flushSync } from "react-dom";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
=======
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { getFirebaseAuth } from "@/integrations/firebase/client";
>>>>>>> d89448cad0d86c4bb0be03c01a40f9546a8d9493
import { AuthContext } from "./AuthContext";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
<<<<<<< HEAD
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      // Commit before callers (e.g. signIn) continue so route guards see the new user.
      flushSync(() => {
        setSession(s);
        setUser(s?.user ?? null);
      });
    });
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
=======
    const auth = getFirebaseAuth();
    if (!auth) {
>>>>>>> d89448cad0d86c4bb0be03c01a40f9546a8d9493
      setLoading(false);
      return;
    }

    const unsub = onAuthStateChanged(auth, setUser);
    void auth.authStateReady().finally(() => setLoading(false));

    return () => unsub();
  }, []);

  return <AuthContext.Provider value={{ user, loading }}>{children}</AuthContext.Provider>;
};
