import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Clock, MapPin, Ship, ShieldCheck, Anchor, Compass } from "lucide-react";
import heroImage from "@/assets/hero-port.jpg";
import medImage from "@/assets/region-mediterranean.jpg";
import northImage from "@/assets/region-northern.jpg";
import adriaticImage from "@/assets/region-adriatic.jpg";
import { getHomeShowcase } from "@/lib/catalog.functions";
import { Button } from "@/components/ui/button";
import { HomeSearchPanel } from "@/components/home-search-panel";

const showcaseQuery = queryOptions({
  queryKey: ["home-showcase"],
  queryFn: () => getHomeShowcase(),
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Shore Hopper — Shore Excursions for Every Cruise Port" },
      {
        name: "description",
        content:
          "Find your sailing by cruise line, ship or date, see every port call with arrival and departure times, then book curated shore excursions in minutes.",
      },
      { property: "og:title", content: "Shore Hopper — Shore Excursions for Every Cruise Port" },
      {
        property: "og:description",
        content:
          "Search your cruise, pick your port, book a vetted excursion that returns you to the gangway on time.",
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
    <div className="flex w-full flex-col items-center gap-20 px-4 pb-24 pt-8 md:px-8 lg:px-12">
      {/* Hero card with overlapping search */}
      <section className="w-full max-w-7xl">
        <div className="relative overflow-hidden rounded-3xl bg-navy-deep shadow-2xl">
          <img
            src={heroImage}
            alt="A cruise ship berthed beside a historic Mediterranean waterfront at golden hour"
            width={1920}
            height={1088}
            className="absolute inset-0 h-full w-full object-cover opacity-55"
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-navy-deep via-navy-deep/70 to-navy/30" />
          <div className="relative max-w-3xl px-7 py-16 md:px-14 md:py-24">
            <span className="eyebrow inline-flex items-center gap-2 rounded-full border border-aqua/40 bg-navy/40 px-3 py-1 text-aqua-soft">
              <Anchor className="size-3.5" /> Excursions only — never a cruise fare
            </span>
            <h1 className="mt-6 text-4xl leading-[1.08] text-navy-foreground md:text-6xl">
              Your ship calls.
              <br />
              <em className="italic text-brass-soft">We handle the shore.</em>
            </h1>
            <p className="mt-6 max-w-xl text-lg font-light leading-relaxed text-navy-foreground/80">
              Search your sailing, open its timetable port by port, and reserve a vetted tour that
              returns you to the gangway well before all-aboard.
            </p>
          </div>
        </div>

        <div className="relative z-10 mx-auto -mt-10 w-full max-w-6xl px-1 md:-mt-14">
          <HomeSearchPanel />
        </div>
      </section>

      {/* Popular ports strip */}
      <section className="w-full max-w-7xl">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="text-2xl md:text-3xl">Popular ports of call</h2>
          <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Tap a port to see its tours
          </p>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          {data.ports.map((port) => (
            <Link
              key={port.id}
              to="/ports/$slug"
              params={{ slug: port.slug }}
              className="group inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2.5 text-sm transition-colors hover:border-aqua hover:text-aqua-deep"
            >
              <MapPin className="size-3.5 text-aqua" />
              {port.name}
              <span className="text-muted-foreground group-hover:text-aqua-deep">{port.country}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured excursions */}
      <section className="w-full max-w-7xl">
        <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <h2 className="text-3xl md:text-4xl">Featured shore excursions</h2>
            <p className="text-sm font-light text-muted-foreground">
              Small groups, licensed guides, pier-timed durations.
            </p>
          </div>
          <div className="mx-10 hidden h-px flex-grow bg-border md:block" />
          <Link
            to="/cruises"
            search={{}}
            className="border-b border-aqua pb-2 text-xs font-semibold uppercase tracking-widest transition-colors hover:text-aqua-deep"
          >
            Browse all sailings
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {data.excursions.map((excursion) => (
            <article
              key={excursion.id}
              className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-lg"
            >
              <div className="aspect-[4/3] overflow-hidden bg-muted">
                <img
                  src={regionImage(excursion.ports.name)}
                  alt={`${excursion.ports.name} shore excursion`}
                  loading="lazy"
                  width={912}
                  height={684}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <div className="flex flex-1 flex-col gap-3 p-6">
                <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest text-aqua">
                  <MapPin className="size-3.5" />
                  {excursion.ports.name}, {excursion.ports.country}
                </p>
                <h3 className="text-xl leading-snug">{excursion.title}</h3>
                <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
                  {excursion.summary}
                </p>
                <div className="mt-auto flex items-center justify-between border-t border-border pt-4">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="size-3.5 text-brass" />
                    {Math.round(excursion.duration_minutes / 60)} hrs ashore
                  </span>
                  <span className="font-display text-lg">
                    {money(Number(excursion.price), excursion.currency)}
                  </span>
                </div>
                <Button
                  asChild
                  className="mt-2 bg-navy-deep text-navy-foreground hover:bg-navy"
                >
                  <Link to="/excursions/$slug" params={{ slug: excursion.slug }}>
                    View tour <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Sailings now open */}
      <section className="w-full max-w-7xl">
        <div className="mb-10 space-y-3">
          <h2 className="text-3xl md:text-4xl">Sailings now open</h2>
          <div className="h-1 w-16 bg-brass" />
        </div>
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {data.sailings.map((sailing) => (
            <article key={sailing.id} className="group space-y-5">
              <Link
                to="/cruises/$slug"
                params={{ slug: sailing.slug }}
                className="block overflow-hidden rounded-2xl bg-muted shadow-md"
              >
                <img
                  src={regionImage(sailing.region)}
                  alt={`${sailing.region} coastline`}
                  loading="lazy"
                  width={912}
                  height={684}
                  className="aspect-[4/3] w-full object-cover transition-transform duration-700 group-hover:scale-105"
                />
              </Link>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-aqua">
                    <Ship className="size-3.5" />
                    {sailing.nights} nights · {sailing.region}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(sailing.departure_date)}
                  </span>
                </div>
                <h3 className="text-2xl leading-tight transition-colors group-hover:text-aqua-deep">
                  <Link to="/cruises/$slug" params={{ slug: sailing.slug }}>
                    {sailing.name}
                  </Link>
                </h3>
                <p className="text-sm font-light text-muted-foreground">
                  {sailing.ships.cruise_lines.name} · {sailing.ships.name}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Trust band */}
      <section className="w-full max-w-7xl">
        <div className="grid gap-10 rounded-2xl border border-border bg-card p-8 md:grid-cols-3 md:p-12">
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
              <item.icon className="size-6 text-aqua" />
              <h3 className="text-xl">{item.title}</h3>
              <p className="text-sm font-light leading-relaxed text-muted-foreground">{item.copy}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
