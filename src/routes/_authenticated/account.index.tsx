import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getMyBookings } from "@/lib/booking.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/account/")({
  head: () => ({
    meta: [
      { title: "My Voyage — Shore Hopper" },
      { name: "description", content: "Your Shore Hopper reservations, extras and profile in one place." },
      { property: "og:title", content: "My Voyage — Shore Hopper" },
      { property: "og:description", content: "Your reservations, extras and profile." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AccountOverviewPage,
});

function AccountOverviewPage() {
  const bookings = useQuery({ queryKey: ["my-bookings"], queryFn: () => getMyBookings() });
  const rows = bookings.data ?? [];
  const upcoming = rows.filter(
    (b) => b.tour_date >= new Date().toISOString().slice(0, 10) && b.status !== "cancelled",
  );

  return (
    <div>
      <p className="eyebrow text-brass">Passenger</p>
      <h1 className="mt-2 text-4xl">Overview</h1>
      <div className="rule-brass mt-6" />

      {bookings.isLoading ? (
        <Skeleton className="mt-8 h-64 w-full" />
      ) : (
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-border p-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Reservations</p>
              <p className="mt-3 font-display text-2xl">{rows.length}</p>
            </div>
            <div className="rounded-lg border border-border p-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Upcoming</p>
              <p className="mt-3 font-display text-2xl">{upcoming.length}</p>
            </div>
            <div className="rounded-lg border border-border p-5">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Confirmed</p>
              <p className="mt-3 font-display text-2xl">
                {rows.filter((b) => b.status === "confirmed").length}
              </p>
            </div>
          </div>

          <h2 className="mt-12 font-display text-2xl">Next ashore</h2>
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
            {upcoming.length === 0 ? (
              <li className="p-6 text-muted-foreground">
                No upcoming excursions yet — find your sailing and pick a tour.
              </li>
            ) : (
              upcoming.slice(0, 5).map((b) => (
                <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-display text-lg">{b.excursions?.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(b.tour_date)} · {b.party_size} guests ·{" "}
                      {formatMoney(b.total_amount, b.currency)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className={b.status === "confirmed" ? "border-brass/60 text-brass" : ""}>
                      {b.status}
                    </Badge>
                    <Link
                      to="/account/bookings/$reference"
                      params={{ reference: b.reference }}
                      className="text-sm text-brass hover:underline"
                    >
                      Manage
                    </Link>
                  </div>
                </li>
              ))
            )}
          </ul>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild className="bg-brass text-brass-foreground hover:bg-brass-soft">
              <Link to="/account/bookings">All reservations</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/cruises" search={{}}>
                Find a cruise
              </Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
