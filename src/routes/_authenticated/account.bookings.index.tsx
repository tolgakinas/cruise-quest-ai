import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { getMyBookings } from "@/lib/booking.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatMoney } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/account/bookings/")({
  head: () => ({
    meta: [
      { title: "My Reservations — Shore Hopper" },
      {
        name: "description",
        content: "View, modify or cancel your booked shore excursions and see payment status.",
      },
      { property: "og:title", content: "My Reservations — Shore Hopper" },
      { property: "og:description", content: "Your booked shore excursions and payment status." },
    ],
  }),
  component: BookingsPage,
});

const statusTone: Record<string, string> = {
  confirmed: "border-brass/60 text-brass",
  reserved: "border-border text-muted-foreground",
  cancelled: "border-destructive/50 text-destructive",
  refunded: "border-destructive/50 text-destructive",
};

function BookingsPage() {
  const bookings = useQuery({ queryKey: ["my-bookings"], queryFn: () => getMyBookings() });

  return (
    <div className="mx-auto max-w-5xl px-5 py-16">
      <p className="eyebrow text-brass">Passenger</p>
      <h1 className="mt-3 text-4xl">My reservations</h1>
      <div className="rule-brass mt-6" />

      {bookings.isLoading ? (
        <p className="mt-10 text-muted-foreground">Loading your reservations…</p>
      ) : (bookings.data ?? []).length === 0 ? (
        <div className="mt-10">
          <p className="text-muted-foreground">You haven't booked a shore excursion yet.</p>
          <Button asChild className="mt-6 bg-brass text-brass-foreground hover:bg-brass-soft">
            <Link to="/cruises">Find your cruise</Link>
          </Button>
        </div>
      ) : (
        <ul className="mt-10 space-y-5">
          {(bookings.data ?? []).map((b) => (
            <li key={b.id} className="rounded-lg border border-border p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="eyebrow text-brass">Ref {b.reference}</p>
                  <h2 className="mt-2 font-display text-2xl">{b.excursions?.title}</h2>
                  <div className="mt-3 flex flex-wrap gap-5 text-sm text-muted-foreground">
                    <span className="inline-flex items-center gap-2">
                      <CalendarDays className="size-4 text-brass" /> {formatDate(b.tour_date)}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <MapPin className="size-4 text-brass" /> {b.excursions?.ports?.name}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Users className="size-4 text-brass" /> {b.party_size} guest(s)
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <Badge variant="outline" className={statusTone[b.status] ?? ""}>
                    {b.status}
                  </Badge>
                  <p className="mt-3 font-display text-xl">
                    {formatMoney(b.total_amount, b.currency)}
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button asChild variant="outline">
                  <Link to="/account/bookings/$reference" params={{ reference: b.reference }}>
                    Manage reservation
                  </Link>
                </Button>
                {b.excursions?.slug ? (
                  <Button asChild variant="ghost">
                    <Link to="/excursions/$slug" params={{ slug: b.excursions.slug }}>
                      View tour
                    </Link>
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
