import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const inviteSchema = z.string().trim().email("Invalid email").max(255);

export default function Invite() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !user) return;
    const parsed = inviteSchema.safeParse(email);
    if (!parsed.success) { toast.error(parsed.error.errors[0].message); return; }
    setLoading(true);
    // Check if user already exists by email; if so, add as member directly
    const { data: existing } = await supabase.from("profiles").select("user_id").eq("email", parsed.data.toLowerCase()).maybeSingle();
    if (existing) {
      const { error } = await supabase.from("project_members").insert({ project_id: id, user_id: existing.user_id, role: "member" });
      setLoading(false);
      if (error && !error.message.includes("duplicate")) { toast.error(error.message); return; }
      toast.success("Member added");
      nav(-1);
      return;
    }
    const { error } = await supabase.from("project_invites").insert({
      project_id: id, email: parsed.data.toLowerCase(), invited_by: user.id,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Invite saved — they'll join when they sign up with this email");
    nav(-1);
  };

  return (
    <div className="min-h-screen bg-background safe-pt">
      <header className="px-5 pt-4 pb-3 flex items-center gap-2">
        <button onClick={() => nav(-1)} className="size-10 -ml-2 grid place-items-center rounded-full active:bg-secondary">
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
