import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s['next'] === "string" && (s['next'] as string).startsWith("/") ? (s['next'] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign In — Shore Hopper" },
      {
        name: "description",
        content:
          "Sign in or create a Shore Hopper account to book shore excursions and keep your voyage in one place.",
      },
      { property: "og:title", content: "Sign In — Shore Hopper" },
      { property: "og:description", content: "Sign in to book and manage shore excursions." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const returnTo = () => (next ? `${window.location.origin}${next}` : window.location.origin);
  const goHome = () => {
    if (next) {
      window.location.href = `${window.location.origin}${next}`;
      return;
    }
    navigate({ to: "/account" });
  };
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"credentials" | "forgot">("credentials");
  const [resetEmail, setResetEmail] = useState("");

  const sendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/auth/reset`,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("We've sent you a password reset link. Check your inbox.");
    setMode("credentials");
  };


  const social = async (provider: "google" | "apple") => {
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: returnTo(),
    });
    if (result.error) {
      toast.error("Sign-in failed. Please try again.");
      return;
    }
    if (result.redirected) return;
    goHome();
  };

  const signIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    goHome();
  };

  const signUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: returnTo(), data: { full_name: fullName } },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) {
      toast.success("Check your email to confirm your account.");
      return;
    }
    goHome();
  };

  return (
    <div className="mx-auto max-w-md px-5 py-20">
      <p className="eyebrow text-center text-brass">Shore Hopper</p>
      <h1 className="mt-3 text-center text-3xl">Your voyage account</h1>
      <div className="rule-brass mt-8" />

      <div className="mt-8 space-y-3">
        <Button
          variant="outline"
          className="w-full"
          onClick={() => social("google")}
          type="button"
        >
          Continue with Google
        </Button>
        <Button variant="outline" className="w-full" onClick={() => social("apple")} type="button">
          Continue with Apple
        </Button>
      </div>

      <div className="my-8 flex items-center gap-4 text-xs uppercase tracking-widest text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or email <span className="h-px flex-1 bg-border" />
      </div>

      {mode === "forgot" ? (
        <form onSubmit={sendReset} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter the email address on your account and we'll send you a secure link to choose a new
            password.
          </p>
          <div className="space-y-2">
            <Label htmlFor="reset-email">Email</Label>
            <Input
              id="reset-email"
              type="email"
              required
              autoComplete="email"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            Send reset link
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => setMode("credentials")}
          >
            Back to sign in
          </Button>
        </form>
      ) : (
      <Tabs defaultValue="signin">

        <TabsList className="w-full">
          <TabsTrigger value="signin" className="flex-1">
            Sign in
          </TabsTrigger>
          <TabsTrigger value="signup" className="flex-1">
            Create account
          </TabsTrigger>
        </TabsList>

        <TabsContent value="signin">
          <form onSubmit={signIn} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              Sign in
            </Button>
            <button
              type="button"
              onClick={() => {
                setResetEmail(email);
                setMode("forgot");
              }}
              className="w-full text-center text-xs text-muted-foreground underline hover:text-brass"
            >
              Forgot your password?
            </button>
          </form>

        </TabsContent>

        <TabsContent value="signup">
          <form onSubmit={signUp} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email2">Email</Label>
              <Input id="email2" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password2">Password</Label>
              <Input
                id="password2"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              Create account
            </Button>
          </form>
        </TabsContent>
      </Tabs>
      )}

    </div>
  );
}
