import { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { HardHat } from "lucide-react";

export default function Auth() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();
  const loc = useLocation() as any;
  const from = loc.state?.from?.pathname || "/";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: fullName } },
        });
        if (error) throw error;
        toast.success("Account created. You're in!");
        nav(from, { replace: true });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav(from, { replace: true });
      }
    } catch (e: any) {
      toast.error(e.message || "Authentication failed");
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="gradient-primary px-6 pt-16 pb-12 safe-pt">
        <div className="flex items-center gap-3 text-primary-foreground">
          <div className="size-12 rounded-2xl bg-accent grid place-items-center shadow-accent-glow">
            <HardHat className="size-6 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">SiteSync</h1>
            <p className="text-sm opacity-80">On-site project workflows</p>
          </div>
        </div>
      </div>

      <main className="flex-1 px-6 pt-8">
        <h2 className="text-2xl font-semibold mb-1">
          {mode === "signin" ? "Welcome back" : "Create account"}
        </h2>
        <p className="text-muted-foreground mb-6 text-sm">
          {mode === "signin" ? "Sign in to access your projects" : "Quick start — only takes a moment"}
        </p>

        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} required className="h-12 text-base" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" className="h-12 text-base" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === "signin" ? "current-password" : "new-password"} className="h-12 text-base" />
          </div>
          <Button type="submit" disabled={loading} className="w-full h-12 text-base font-semibold mt-2">
            {loading ? "…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="w-full mt-6 text-sm text-muted-foreground"
        >
          {mode === "signin" ? "No account? " : "Already have an account? "}
          <span className="text-primary font-semibold underline">
            {mode === "signin" ? "Sign up" : "Sign in"}
          </span>
        </button>

        <p className="text-xs text-center text-muted-foreground mt-8">
          By continuing you agree to our terms.
          <br />
          <Link to="/" className="underline">Back home</Link>
        </p>
      </main>
    </div>
  );
}
