import { createContext, useContext } from "react";
import type { User } from "firebase/auth";

interface AuthCtx {
  user: User | null;
  loading: boolean;
}

export const AuthContext = createContext<AuthCtx>({ user: null, loading: true });

export const useAuth = () => useContext(AuthContext);
