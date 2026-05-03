"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "firebase/auth";
import { useAuth } from "@/auth/AuthContext";
import { getFirebaseAuth, isFirebaseConfigured } from "@/integrations/firebase/client";
import { upsertOwnProfile } from "@/lib/firestore-db";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HardHat } from "lucide-react";
import { toast } from "sonner";

/**
 * This route is not the app default: `/` is protected home. You only land here when
 * redirected (no session), you open `/login` directly, or you sign out.
 * Firebase also restores persisted sessions (including anonymous), so the home page
 * can load without ever visiting this screen unless you sign out or browse here.
 */
function safeRedirectPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  return raw;
}

function authErrorMessage(code: string): string {
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "Invalid email or password.";
    case "auth/user-not-found":
      return "No account found for that email.";
    case "auth/invalid-email":
      return "Invalid email address.";
    case "auth/email-already-in-use":
      return "An account already exists for this email.";
    case "auth/weak-password":
      return "Use at least 6 characters for the password.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again later.";
    case "auth/operation-not-allowed":
      return "Email/password sign-in is not enabled for this project (Firebase Console → Authentication).";
    default:
      return "Something went wrong. Try again.";
  }
}

type LoginProps = {
  /** From `/login?redirect=/path` (passed by server `page.tsx`). */
  initialRedirect?: string;
};

export default function Login({ initialRedirect }: LoginProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const redirect = safeRedirectPath(initialRedirect ?? null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user && !user.isAnonymous) {
      router.replace(redirect);
    }
  }, [loading, user, router, redirect]);

  if (!isFirebaseConfigured() || !getFirebaseAuth()) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-muted-foreground">
        Set NEXT_PUBLIC_FIREBASE_* in your environment to use SiteSync.
      </div>
    );
  }

  if (!loading && user && !user.isAnonymous) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">Redirecting…</div>
    );
  }

  const authCode = (err: unknown) =>
    err && typeof err === "object" && "code" in err ? String((err as { code: string }).code) : "";

  const syncProfile = async (uid: string, mail: string | null, name: string | null) => {
    try {
      await upsertOwnProfile(uid, { email: mail?.toLowerCase() ?? null, full_name: name });
    } catch (e) {
      console.error(e);
      toast.error("Could not save your profile. You may still be signed in.");
    }
  };

  const onSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const auth = getFirebaseAuth()!;
    setBusy(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      await syncProfile(cred.user.uid, cred.user.email, cred.user.displayName);
      router.replace(redirect);
    } catch (err: unknown) {
      toast.error(authErrorMessage(authCode(err)));
    } finally {
      setBusy(false);
    }
  };

  const onSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const auth = getFirebaseAuth()!;
    setBusy(true);
    try {
      if (auth.currentUser) {
        await signOut(auth);
      }
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const name = displayName.trim() || null;
      if (name) {
        await updateProfile(cred.user, { displayName: name });
      }
      await syncProfile(cred.user.uid, cred.user.email, name);
      toast.success("Account created");
      router.replace(redirect);
    } catch (err: unknown) {
      toast.error(authErrorMessage(authCode(err)));
    } finally {
      setBusy(false);
    }
  };

  const onGuest = async () => {
    const auth = getFirebaseAuth()!;
    setBusy(true);
    try {
      if (auth.currentUser?.isAnonymous) {
        router.replace(redirect);
        return;
      }
      if (auth.currentUser) {
        await signOut(auth);
      }
      await signInAnonymously(auth);
      router.replace(redirect);
    } catch (err: unknown) {
      toast.error(authErrorMessage(authCode(err)));
    } finally {
      setBusy(false);
    }
  };

  const onForgot = async () => {
    const auth = getFirebaseAuth()!;
    const mail = email.trim();
    if (!mail) {
      toast.error("Enter your email first.");
      return;
    }
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, mail);
      toast.success("Check your inbox for a reset link.");
    } catch (err: unknown) {
      toast.error(authErrorMessage(authCode(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 safe-pt safe-pb">
      <div className="w-full max-w-md space-y-6">
        <div className="flex items-center justify-center gap-2 text-primary">
          <div className="size-11 rounded-xl bg-accent grid place-items-center shadow-accent-glow">
            <HardHat className="size-6 text-accent-foreground" />
          </div>
          <span className="font-bold text-xl tracking-tight">SiteSync</span>
        </div>

        <Card className="shadow-elevated border-border/80">
          <CardHeader className="space-y-1">
            <CardTitle>Sign in</CardTitle>
            <CardDescription>Use your email or continue as a guest for quick QR access.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Create account</TabsTrigger>
              </TabsList>
              <TabsContent value="signin" className="space-y-4 pt-4">
                <form onSubmit={onSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">Email</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(ev) => setEmail(ev.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signin-password">Password</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(ev) => setPassword(ev.target.value)}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? "Please wait…" : "Sign in"}
                  </Button>
                  <button
                    type="button"
                    onClick={onForgot}
                    className="text-sm text-muted-foreground underline-offset-4 hover:underline w-full text-center"
                    disabled={busy}
                  >
                    Forgot password?
                  </button>
                </form>
              </TabsContent>
              <TabsContent value="signup" className="space-y-4 pt-4">
                <form onSubmit={onSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Display name (optional)</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      autoComplete="name"
                      value={displayName}
                      onChange={(ev) => setDisplayName(ev.target.value)}
                      placeholder="e.g. Alex Chen"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(ev) => setEmail(ev.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(ev) => setPassword(ev.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                  <Button type="submit" className="w-full" disabled={busy}>
                    {busy ? "Please wait…" : "Create account"}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <Button type="button" variant="outline" className="w-full" onClick={onGuest} disabled={busy}>
              Continue as guest
            </Button>
            <p className="text-xs text-muted-foreground text-center leading-relaxed">
              Guests get a temporary account (good for scanning site QR codes). Enable{" "}
              <strong>Email/Password</strong> under Firebase Authentication if sign-in fails.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
