import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Mail, MailCheck, MailWarning } from "lucide-react";
import { listEmailOutbox } from "@/lib/notifications.functions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  component: AdminNotifications,
  head: () => ({
    meta: [
      { title: "Reservation notifications | Shore Hopper Admin" },
      {
        name: "description",
        content:
          "Monitor guest reservation emails and in-app alerts queued by Shore Hopper booking status changes.",
      },
      { property: "og:title", content: "Reservation notifications | Shore Hopper Admin" },
      {
        property: "og:description",
        content: "Track queued, sent and failed reservation notifications.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const FILTERS = ["all", "pending", "sent", "failed"] as const;

function AdminNotifications() {
  const [status, setStatus] = useState<(typeof FILTERS)[number]>("all");
  const query = useQuery({
    queryKey: ["admin-email-outbox", status],
    queryFn: () => listEmailOutbox({ data: { status } }),
  });

  const counts = query.data?.counts;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-brass">Guest communications</p>
        <h1 className="font-display text-3xl">Reservation notifications</h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Every booking status change fans out an in-app alert plus an email. This queue shows what
          has been dispatched to guests.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Queued", value: counts?.pending ?? 0, icon: Mail },
          { label: "Sent", value: counts?.sent ?? 0, icon: MailCheck },
          { label: "Failed", value: counts?.failed ?? 0, icon: MailWarning },
        ].map((card) => (
          <div key={card.label} className="rounded-xl border border-border bg-ivory/40 p-5">
            <card.icon className="h-4 w-4 text-brass" />
            <p className="mt-3 font-display text-2xl">{card.value}</p>
            <p className="text-xs uppercase tracking-widest text-muted-foreground">{card.label}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <Button
            key={filter}
            size="sm"
            variant={status === filter ? "default" : "outline"}
            onClick={() => setStatus(filter)}
            className={status === filter ? "bg-navy-deep text-navy-foreground" : ""}
          >
            {filter[0]!.toUpperCase() + filter.slice(1)}
          </Button>
        ))}
      </div>

      {query.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : query.data && query.data.items.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="bg-ivory/60 text-left text-xs uppercase tracking-widest text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Guest</th>
                <th className="px-4 py-3">Subject</th>
                <th className="px-4 py-3">Booking</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {query.data.items.map((row) => (
                <tr key={row.id} className="border-t border-border align-top">
                  <td className="px-4 py-3">{row.to_email}</td>
                  <td className="px-4 py-3">
                    <p>{row.subject}</p>
                    {row.error ? (
                      <p className="mt-1 text-xs text-destructive">{row.error}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs uppercase tracking-widest text-brass">
                    {row.bookings?.reference ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-xs uppercase tracking-widest">{row.status}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDate(row.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No notifications in this view yet.
        </p>
      )}
    </div>
  );
}
