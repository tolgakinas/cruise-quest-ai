import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth_/reset")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Choose a New Password — Shore Hopper" },
      {
        name: "description",
        content: "Set a new password for your Shore Hopper passenger account and get back to your voyage.",
      },
      { property: "og:title", content: "Choose a New Password — Shore Hopper" },
      { property: "og:description", content: "Set a new Shore Hopper account password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirm) {
      toast.error("The two passwords don't match.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Your password has been updated.");
    navigate({ to: "/account" });
  };

  return (
    <div className="mx-auto max-w-md px-5 py-20">
      <p className="eyebrow text-center text-brass">Shore Hopper</p>
      <h1 className="mt-3 text-center text-3xl">Choose a new password</h1>
      <div className="rule-brass mt-8" />

      {!ready ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Open this page from the reset link in your email. If the link has expired,{" "}
          <Link to="/auth" className="text-brass underline">
            request a new one
          </Link>
          .
        </p>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">Repeat password</Label>
            <Input
              id="confirm-password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
            />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>
            Save new password
          </Button>
        </form>
      )}
    </div>
  );
}
