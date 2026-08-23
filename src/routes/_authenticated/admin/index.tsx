import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getAdminOverview } from "@/lib/admin-stats.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Admin Overview — Shore Hopper" },
      {
        name: "description",
        content: "Reservations, revenue, pending refunds and upcoming departures at a glance.",
      },
      { property: "og:title", content: "Admin Overview — Shore Hopper" },
      { property: "og:description", content: "Shore Hopper operations dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminOverviewPage,
});

function AdminOverviewPage() {
  const query = useQuery({ queryKey: ["admin-overview"], queryFn: () => getAdminOverview() });
  const data = query.data;

  return (
    <div>
      <p className="eyebrow text-brass">Operations</p>
      <h1 className="mt-2 text-4xl">Overview</h1>
      <div className="rule-brass mt-6" />

      {query.isLoading || !data ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Reservations" value={String(data.bookings.total)} hint={`${data.bookings.upcoming} upcoming`} />
            <Stat
              label="Revenue (paid)"
              value={formatMoney(data.revenue.amount, data.revenue.currency)}
              hint={`${data.pendingPayments} payments pending`}
            />
            <Stat label="Confirmed" value={String(data.bookings.confirmed)} hint={`${data.bookings.reserved} awaiting payment`} />
            <Stat label="Refund queue" value={String(data.pendingRefunds)} hint="pending decisions" />
            <Stat
              label="Excursions"
              value={`${data.excursions.published}/${data.excursions.total}`}
              hint="published / total"
            />
            <Stat label="Cancelled" value={String(data.bookings.cancelled)} hint="all time" />
            <Stat label="Refunded" value={String(data.bookings.refunded)} hint="all time" />
            <Stat label="Next sailings" value={String(data.upcomingSailings.length)} hint="departing soon" />
          </div>

          <h2 className="mt-14 font-display text-2xl">Upcoming departures</h2>
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
            {data.upcomingSailings.length === 0 ? (
              <li className="p-6 text-muted-foreground">No future sailings scheduled yet.</li>
            ) : (
              data.upcomingSailings.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-display text-lg">{s.name}</p>
                    <p className="text-sm text-muted-foreground">{formatDate(s.departure_date)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={s.is_published ? "border-brass/60 text-brass" : ""}>
                      {s.is_published ? "Published" : "Draft"}
                    </Badge>
                    <Link to="/admin/sailings" className="text-sm text-brass hover:underline">
                      Manage
                    </Link>
                  </div>
                </li>
              ))
            )}
          </ul>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-border p-5">
      <p className="text-xs uppercase tracking-widest text-muted-foreground">{label}</p>
      <p className="mt-3 font-display text-2xl">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
