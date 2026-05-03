"use client";

import { useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useAuth } from "@/auth/AuthContext";
import { addProjectInvite, ensureProjectMember, findProfileByEmail } from "@/lib/firestore-db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const inviteSchema = z.string().trim().email("Invalid email").max(255);

export default function Invite() {
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : params.id?.[0];
  const router = useRouter();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !user) return;
    const parsed = inviteSchema.safeParse(email);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0].message);
      return;
    }
    setLoading(true);
    try {
      const existing = await findProfileByEmail(parsed.data.toLowerCase());
      if (existing) {
        await ensureProjectMember(id, existing.user_id, "member");
        toast.success("Member added");
        router.back();
        return;
      }
      await addProjectInvite(id, parsed.data.toLowerCase(), user.uid);
      toast.success("Invite saved — they'll join when they sign up with this email");
      router.back();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Invite failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background safe-pt">
      <header className="px-5 pt-4 pb-3 flex items-center gap-2">
        <button onClick={() => router.back()} className="size-10 -ml-2 grid place-items-center rounded-full active:bg-secondary">
          <ChevronLeft className="size-6" />
        </button>
        <h1 className="text-xl font-bold">Invite to project</h1>
      </header>
      <main className="px-5 pt-2">
        <p className="text-sm text-muted-foreground mb-5">
          Enter an email. If they already have an account, they'll be added immediately. Otherwise they'll join automatically when they sign up.
        </p>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-12 text-base" autoComplete="email" />
          </div>
          <Button type="submit" disabled={loading || !email} className="w-full h-12 text-base font-semibold">
            {loading ? "Sending…" : "Send invite"}
          </Button>
        </form>
      </main>
    </div>
  );
}
