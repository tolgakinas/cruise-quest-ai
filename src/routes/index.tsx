import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Clock, MapPin, Ship, ShieldCheck, Anchor, Compass } from "lucide-react";
import heroImage from "@/assets/hero-liner.jpg";
import medImage from "@/assets/region-mediterranean.jpg";
import northImage from "@/assets/region-northern.jpg";
import adriaticImage from "@/assets/region-adriatic.jpg";
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

function regionImage(region: string) {
  const key = region.toLowerCase();
  if (key.includes("north") || key.includes("baltic") || key.includes("fjord")) return northImage;
  if (key.includes("adriatic") || key.includes("aegean") || key.includes("greek")) return adriaticImage;
  return medImage;
}


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
    <div className="flex w-full flex-col items-center gap-24 px-4 py-12 md:px-8 lg:px-12">
      {/* Hero */}
      <section className="relative w-full max-w-7xl overflow-hidden rounded-[2rem] bg-navy-deep shadow-2xl">
        <img
          src={heroImage}
          alt="A luxury liner at anchor off a Mediterranean coastline at golden hour"
          className="absolute inset-0 h-full w-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-deep via-navy-deep/50 to-transparent" />
        <div className="relative flex min-h-[560px] max-w-4xl flex-col justify-end p-10 md:min-h-[650px] lg:p-20">
          <div className="mb-6 border-l-2 border-brass pl-4">
            <span className="eyebrow text-brass">Ports, timed to the hour</span>
          </div>
          <h1 className="mb-8 text-4xl leading-[1.1] text-navy-foreground md:text-6xl">
            The art of the
            <br />
            <em className="italic text-brass-soft">coastal escape</em>
          </h1>
          <p className="mb-10 max-w-xl text-lg font-light leading-relaxed text-navy-foreground/75">
            Find your sailing by line, ship, port or date. Read the itinerary as the bridge reads it,
            then reserve excursions that return you to the gangway with time to spare.
          </p>
          <div className="flex flex-wrap gap-4">
            <Button asChild size="lg" className="bg-brass text-brass-foreground hover:bg-brass-soft">
              <Link to="/cruises">
                Find your cruise <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-navy-foreground/25 bg-transparent text-navy-foreground backdrop-blur-md hover:bg-navy-foreground/10 hover:text-navy-foreground"
            >
              <Link to="/about">Why Shore Hopper</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Featured sailings */}
      <section className="w-full max-w-7xl">
        <div className="mb-14 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <h2 className="text-3xl md:text-5xl">Sailings now open</h2>
            <p className="text-sm font-light uppercase tracking-wide text-muted-foreground">
              Exclusive departures for the discerning voyager
            </p>
          </div>
          <div className="mx-12 hidden h-px flex-grow bg-border md:block" />
          <Link
            to="/cruises"
            className="border-b border-brass pb-2 text-xs font-semibold uppercase tracking-widest transition-colors hover:text-brass"
          >
            View all voyages
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          {data.sailings.map((sailing, index) => (
            <article key={sailing.id} className="group space-y-6">
              <div className="relative aspect-[4/5] overflow-hidden rounded-lg bg-muted shadow-lg">
                <img
                  src={regionImages[index % regionImages.length]}
                  alt={`${sailing.region} coastline`}
                  loading="lazy"
                  width={912}
                  height={1136}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
                <div className="absolute left-6 top-6">
                  <span className="bg-card/90 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-foreground backdrop-blur-sm">
                    {sailing.region}
                  </span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-brass">
                    <Ship className="size-3.5" />
                    {sailing.nights} nights
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(sailing.departure_date)}
                  </span>
                </div>
                <h3 className="text-2xl leading-tight transition-colors group-hover:text-brass">
                  {sailing.name}
                </h3>
                <p className="text-sm font-light text-muted-foreground">
                  {sailing.ships.cruise_lines.name} · {sailing.ships.name}
                </p>
                <p className="pt-2 text-sm font-medium">
                  From {money(Number(sailing.starting_price))} per guest
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Excursions */}
      <section className="w-full max-w-5xl rounded-3xl border border-border bg-secondary p-8 md:p-16">
        <div className="mb-14 space-y-4 text-center">
          <h2 className="text-3xl md:text-4xl">Curated shore experiences</h2>
          <div className="mx-auto h-1 w-16 bg-brass" />
        </div>

        <div className="space-y-6">
          {data.excursions.map((excursion) => (
            <article
              key={excursion.id}
              className="group flex flex-col items-center gap-8 rounded-xl border border-border bg-card p-6 shadow-sm transition-shadow hover:shadow-md sm:flex-row"
            >
              <div className="flex-grow text-center sm:text-left">
                <p className="mb-2 flex items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-brass sm:justify-start">
                  <MapPin className="size-3.5" />
                  {excursion.ports.name}, {excursion.ports.country}
                </p>
                <h3 className="mb-2 text-xl">{excursion.title}</h3>
                <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
                  {excursion.summary}
                </p>
              </div>
              <div className="flex min-w-[130px] flex-col items-center gap-2 sm:items-end">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Clock className="size-3.5 text-brass" />
                  {Math.round(excursion.duration_minutes / 60)} hrs ashore
                </span>
                <span className="font-display text-lg">
                  {money(Number(excursion.price), excursion.currency)}
                </span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Trust band */}
      <section className="w-full max-w-7xl">
        <div className="grid gap-10 border-y border-border py-14 md:grid-cols-3">
          {[
            {
              icon: ShieldCheck,
              title: "Secure payment",
              copy: "Every reservation is taken through encrypted checkout, with written confirmation on the spot.",
            },
            {
              icon: Compass,
              title: "Curated operators",
              copy: "Each excursion is vetted for guiding quality, group size and punctual return to the pier.",
            },
            {
              icon: Anchor,
              title: "Gangway-safe timing",
              copy: "Durations are measured against your ship's posted all-aboard time, never against the clock ashore.",
            },
          ].map((item) => (
            <div key={item.title} className="space-y-3">
              <item.icon className="size-6 text-brass" />
              <h3 className="text-xl">{item.title}</h3>
              <p className="text-sm font-light leading-relaxed text-muted-foreground">{item.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Ports */}
      <section className="w-full max-w-7xl">
        <div className="mb-10 space-y-3">
          <h2 className="text-3xl md:text-4xl">Where the gangway lands</h2>
          <div className="h-1 w-16 bg-brass" />
        </div>
        <ul className="grid gap-x-10 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
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
