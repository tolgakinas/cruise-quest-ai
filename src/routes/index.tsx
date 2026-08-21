import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Clock, MapPin, Ship } from "lucide-react";
import heroImage from "@/assets/hero-liner.jpg";
import { getHomeShowcase } from "@/lib/catalog.functions";
import { Button } from "@/components/ui/button";

const showcaseQuery = queryOptions({
  queryKey: ["home-showcase"],
  queryFn: () => getHomeShowcase(),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shore Hopper — Cruise Itineraries & Shore Excursions" },
      {
        name: "description",
        content:
          "Find your sailing by line, ship, port or date. See every port call with arrival and departure times, then book curated shore excursions.",
      },
      { property: "og:title", content: "Shore Hopper — Cruise Itineraries & Shore Excursions" },
      {
        property: "og:description",
        content:
          "Find your sailing, see every port call, book curated shore excursions that fit your hours ashore.",
      },
    ],
  }),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(showcaseQuery);
  },
  component: HomePage,
});

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function money(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function HomePage() {
  const { data } = useSuspenseQuery(showcaseQuery);

  return (
    <div>
      {/* Hero */}
      <section className="relative isolate">
        <img
          src={heroImage}
          alt="A luxury cruise ship anchored off a Mediterranean coastline at golden hour"
          className="absolute inset-0 -z-10 h-full w-full object-cover"
        />
        <div className="absolute inset-0 -z-10 bg-navy-deep/70" />
        <div className="mx-auto flex max-w-4xl flex-col items-center px-5 py-32 text-center text-navy-foreground md:py-44">
          <p className="eyebrow text-brass">Ports, timed to the hour</p>
          <h1 className="mt-6 text-4xl leading-tight md:text-6xl">
            Every hour ashore, spent beautifully
          </h1>
          <div className="rule-brass mt-8 w-40" />
          <p className="mt-8 max-w-2xl text-lg leading-relaxed text-navy-foreground/80">
            Find your sailing by line, ship, port or date. Read the itinerary as the bridge reads
            it, then reserve excursions that return you to the gangway with time to spare.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button asChild size="lg" className="bg-brass text-brass-foreground hover:bg-brass-soft">
              <Link to="/cruises">
                Find your cruise <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Featured sailings */}
      <section className="mx-auto max-w-7xl px-5 py-24">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="eyebrow text-brass">Upcoming voyages</p>
            <h2 className="mt-3 text-3xl md:text-4xl">Sailings now open</h2>
          </div>
          <Link
            to="/cruises"
            className="text-sm tracking-wide text-muted-foreground underline-offset-4 transition-colors hover:text-brass hover:underline"
          >
            View all sailings
          </Link>
        </div>
        <div className="rule-brass mt-8" />

        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {data.sailings.map((sailing) => (
            <article key={sailing.id} className="flex flex-col border border-border bg-card p-7">
              <p className="eyebrow text-brass">{sailing.region}</p>
              <h3 className="mt-4 text-2xl leading-snug">{sailing.name}</h3>
              <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                <Ship className="size-4 text-brass" />
                {sailing.ships.cruise_lines.name} · {sailing.ships.name}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {formatDate(sailing.departure_date)} — {formatDate(sailing.arrival_date)} ·{" "}
                {sailing.nights} nights
              </p>
              <p className="mt-5 flex-1 text-sm leading-relaxed text-muted-foreground">
                {sailing.description}
              </p>
              <p className="mt-6 font-display text-xl">
                {money(Number(sailing.starting_price))}
                <span className="ml-2 text-xs uppercase tracking-widest text-muted-foreground">
                  from
                </span>
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* Excursions */}
      <section className="bg-ivory-deep">
        <div className="mx-auto max-w-7xl px-5 py-24">
          <p className="eyebrow text-brass">Signature shore excursions</p>
          <h2 className="mt-3 text-3xl md:text-4xl">Chosen for the hours you have</h2>
          <div className="rule-brass mt-8" />

          <div className="mt-12 grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {data.excursions.map((excursion) => (
              <article key={excursion.id} className="border-t border-brass/30 pt-6">
                <p className="flex items-center gap-2 text-xs uppercase tracking-widest text-muted-foreground">
                  <MapPin className="size-3.5 text-brass" />
                  {excursion.ports.name}, {excursion.ports.country}
                </p>
                <h3 className="mt-3 text-xl leading-snug">{excursion.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                  {excursion.summary}
                </p>
                <p className="mt-4 flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="size-3.5 text-brass" />
                    {Math.round(excursion.duration_minutes / 60)} hrs
                  </span>
                  <span className="font-display">
                    {money(Number(excursion.price), excursion.currency)}
                  </span>
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Ports */}
      <section className="mx-auto max-w-7xl px-5 py-24">
        <p className="eyebrow text-brass">Ports of call</p>
        <h2 className="mt-3 text-3xl md:text-4xl">Where the gangway lands</h2>
        <div className="rule-brass mt-8" />
        <ul className="mt-10 grid gap-x-10 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
          {data.ports.map((port) => (
            <li key={port.id} className="border-b border-border pb-4">
              <p className="font-display text-lg">{port.name}</p>
              <p className="text-sm text-muted-foreground">
                {port.country} · {port.region}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
