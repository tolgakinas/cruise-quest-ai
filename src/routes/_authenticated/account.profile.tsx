import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getMyProfile, updateMyProfile } from "@/lib/profile.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/account/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — Shore Hopper" },
      { name: "description", content: "Update your name, phone number and cabin details." },
      { property: "og:title", content: "My Profile — Shore Hopper" },
      { property: "og:description", content: "Keep your passenger details up to date." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const queryClient = useQueryClient();
  const profile = useQuery({ queryKey: ["my-profile"], queryFn: () => getMyProfile() });

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [cabinNumber, setCabinNumber] = useState("");

  useEffect(() => {
    if (!profile.data) return;
    setFullName(profile.data.full_name ?? "");
    setPhone(profile.data.phone ?? "");
    setCabinNumber(profile.data.cabin_number ?? "");
  }, [profile.data]);

  const save = useMutation({
    mutationFn: () => updateMyProfile({ data: { fullName, phone, cabinNumber } }),
    onSuccess: async () => {
      toast.success("Profile saved");
      await queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-xl">
      <p className="eyebrow text-brass">Passenger</p>
      <h1 className="mt-2 text-4xl">Profile</h1>
      <div className="rule-brass mt-6" />

      {profile.isLoading ? (
        <Skeleton className="mt-8 h-64 w-full" />
      ) : (
        <form
          className="mt-8 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate();
          }}
        >
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={profile.data?.email ?? ""} disabled />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Full name</Label>
            <Input id="name" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cabin">Cabin number</Label>
            <Input id="cabin" value={cabinNumber} onChange={(e) => setCabinNumber(e.target.value)} />
          </div>
          <Button
            type="submit"
            className="bg-brass text-brass-foreground hover:bg-brass-soft"
            disabled={save.isPending}
          >
            Save profile
          </Button>
        </form>
      )}
    </div>
  );
}
