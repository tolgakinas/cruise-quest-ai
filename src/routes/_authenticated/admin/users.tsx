import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listAppUsers, setUserRole } from "@/lib/admin-users.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({
    meta: [
      { title: "Users & Roles — Shore Hopper Admin" },
      { name: "description", content: "Review passenger accounts and grant or revoke admin access." },
      { property: "og:title", content: "Users & Roles — Shore Hopper Admin" },
      { property: "og:description", content: "Passenger accounts and role management." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");

  const list = useQuery({
    queryKey: ["admin-users", q],
    queryFn: () => listAppUsers({ data: { q: q || null } }),
  });

  const role = useMutation({
    mutationFn: (v: { userId: string; role: "admin" | "passenger"; grant: boolean }) =>
      setUserRole({ data: v }),
    onSuccess: async () => {
      toast.success("Role updated");
      await queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div>
      <p className="eyebrow text-brass">Access</p>
      <h1 className="mt-2 text-4xl">Users & roles</h1>
      <div className="rule-brass mt-6" />

      <Input
        className="mt-8 max-w-sm"
        placeholder="Search name or email…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />

      {list.isLoading ? (
        <Skeleton className="mt-8 h-72 w-full" />
      ) : (
        <ul className="mt-6 divide-y divide-border rounded-lg border border-border">
          {(list.data ?? []).length === 0 ? (
            <li className="p-6 text-muted-foreground">No accounts found.</li>
          ) : (
            (list.data ?? []).map((u) => {
              const isAdmin = u.roles.includes("admin");
              return (
                <li key={u.id} className="flex flex-wrap items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="font-display text-lg">{u.full_name ?? "Unnamed passenger"}</p>
                    <p className="text-sm text-muted-foreground">
                      {u.email ?? "—"}
                      {u.cabin_number ? ` · cabin ${u.cabin_number}` : ""} · {u.bookingCount} reservations
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {u.roles.map((r) => (
                      <Badge key={r} variant="outline" className={r === "admin" ? "border-brass/60 text-brass" : ""}>
                        {r}
                      </Badge>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={role.isPending}
                      onClick={() => role.mutate({ userId: u.id, role: "admin", grant: !isAdmin })}
                    >
                      {isAdmin ? "Revoke admin" : "Make admin"}
                    </Button>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}
