"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ensureFirebaseAnonymousSession, getFirebaseAuth } from "@/integrations/firebase/client";
import { ensureProjectMember, findProjectByQrToken } from "@/lib/firestore-db";
import { toast } from "sonner";

export default function QrLanding() {
  const params = useParams<{ token: string }>();
  const token = typeof params.token === "string" ? params.token : params.token?.[0];
  const router = useRouter();

  useEffect(() => {
    const go = async () => {
      if (!token) return;
      await ensureFirebaseAnonymousSession();
      const auth = getFirebaseAuth();
      const uid = auth?.currentUser?.uid;
      if (!uid) {
        toast.error("Could not start session.");
        router.replace("/");
        return;
      }
      const proj = await findProjectByQrToken(token);
      if (!proj) {
        toast.error("You don't have access to this project. Ask the owner to invite you.");
        router.replace("/");
        return;
      }
      await ensureProjectMember(proj.id, uid, "member");
      router.replace(`/projects/${proj.id}`);
    };
    go();
  }, [token, router]);

  return <div className="min-h-screen grid place-items-center text-muted-foreground">Opening project…</div>;
}
