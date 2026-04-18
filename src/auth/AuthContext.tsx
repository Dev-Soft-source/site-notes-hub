import { createContext, useContext } from "react";
import { Session, User } from "@supabase/supabase-js";

interface AuthCtx {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

export const AuthContext = createContext<AuthCtx>({ session: null, user: null, loading: true });

export const useAuth = () => useContext(AuthContext);
