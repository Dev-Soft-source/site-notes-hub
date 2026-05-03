"use client";

import { RequireAuth } from "@/auth/RequireAuth";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}
