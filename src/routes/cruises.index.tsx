import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Anchor, CalendarDays, Ship, Search } from "lucide-react";
import { getSailing, getSearchFacets, searchSailings } from "@/lib/catalog.functions";
import { SailingPortExplorer } from "@/components/sailing-port-explorer";
import { FreshnessBanner } from "@/components/data-freshness";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


export const Route = createFileRoute("/cruises/")({
  validateSearch: (search?: Record<string, unknown>): {
    line?: string | undefined;
    ship?: string | undefined;
    port?: string | undefined;
    from?: string | undefined;
  } => {
    const s = search ?? {};
    const str = (key: string) => (typeof s[key] === "string" ? (s[key] as string) : undefined);
    return { line: str("line"), ship: str("ship"), port: str("port"), from: str("from") };
  },
  head: () => ({
    meta: [
      { title: "Find Your Cruise — Shore Hopper" },
      {
        name: "description",
        content:
          "Find your sailing by cruise line, ship, port or date, then book shore excursions in every port of call.",
      },
      { property: "og:title", content: "Find Your Cruise — Shore Hopper" },
      {
        property: "og:description",
        content: "Find your sailing, then book shore excursions in every port of call.",
      },
    ],
  }),
  component: CruiseSearchPage,
});

const ANY = "__any";

function CruiseSearchPage() {
  const initial = Route.useSearch();
  const [cruiseLine, setCruiseLine] = useState(initial.line ?? ANY);
  const [ship, setShip] = useState(initial.ship ?? ANY);
  const [region, setRegion] = useState(ANY);
  const [port, setPort] = useState(initial.port ?? ANY);
  const [from, setFrom] = useState(initial.from ?? "");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState(0);

  const facets = useQuery({ queryKey: ["facets"], queryFn: () => getSearchFacets() });

  const filters = useMemo(
    () => ({
      q: q.trim() || null,
      cruiseLine: cruiseLine === ANY ? null : cruiseLine,
      ship: ship === ANY ? null : ship,
      region: region === ANY ? null : region,
      port: port === ANY ? null : port,
      from: from || null,
      to: to || null,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [applied],
  );

  const results = useQuery({
    queryKey: ["sailings", filters],
    queryFn: () => searchSailings({ data: filters }),
  });

  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const rows = results.data ?? [];

  useEffect(() => {
    if (rows.length === 0) {
      setSelectedSlug(null);
      return;
    }
    if (!selectedSlug || !rows.some((r) => r.slug === selectedSlug)) {
      setSelectedSlug(rows[0]?.slug ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results.data]);

  const detail = useQuery({
    queryKey: ["sailing", selectedSlug],
    queryFn: () => getSailing({ data: { slug: selectedSlug as string } }),
    enabled: !!selectedSlug,
  });

  const shipsForLine = (facets.data?.ships ?? []).filter((s) => {
    if (cruiseLine === ANY) return true;
    const line = (facets.data?.cruiseLines ?? []).find((l) => l.slug === cruiseLine);
    return line ? s.cruise_line_id === line.id : true;
  });


  return (
    <div className="bg-background">
      <section className="border-b border-brass/20 bg-navy-deep text-navy-foreground">
        <div className="mx-auto max-w-7xl px-5 py-16">
          <p className="eyebrow text-brass">Step one</p>
          <h1 className="mt-3 max-w-2xl text-4xl md:text-5xl">Find your cruise</h1>
          <p className="mt-4 max-w-xl text-navy-foreground/75">
            Shore Hopper does not sell cruises — we sell the shore excursions in the ports your ship
            calls at. Find your sailing to see its timetable and every tour ashore.
          </p>

          <div className="mt-10 rounded-lg border border-brass/25 bg-navy/60 p-6 backdrop-blur">
            <div className="grid gap-5 md:grid-cols-3 lg:grid-cols-4">
              <div>
                <Label className="eyebrow text-brass">Cruise line</Label>
                <Select
                  value={cruiseLine}
                  onValueChange={(v) => {
                    setCruiseLine(v);
                    setShip(ANY);
                  }}
                >
                  <SelectTrigger className="mt-2 border-brass/30 bg-transparent text-navy-foreground">
                    <SelectValue placeholder="Any line" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>Any line</SelectItem>
                    {(facets.data?.cruiseLines ?? []).map((l) => (
                      <SelectItem key={l.id} value={l.slug}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="eyebrow text-brass">Ship</Label>
                <Select value={ship} onValueChange={setShip}>
                  <SelectTrigger className="mt-2 border-brass/30 bg-transparent text-navy-foreground">
                    <SelectValue placeholder="Any ship" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>Any ship</SelectItem>
                    {shipsForLine.map((s) => (
                      <SelectItem key={s.id} value={s.slug}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="eyebrow text-brass">Region</Label>
                <Select value={region} onValueChange={setRegion}>
                  <SelectTrigger className="mt-2 border-brass/30 bg-transparent text-navy-foreground">
                    <SelectValue placeholder="Any region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>Any region</SelectItem>
                    {(facets.data?.regions ?? []).map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="eyebrow text-brass">Port of call</Label>
                <Select value={port} onValueChange={setPort}>
                  <SelectTrigger className="mt-2 border-brass/30 bg-transparent text-navy-foreground">
                    <SelectValue placeholder="Any port" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY}>Any port</SelectItem>
                    {(facets.data?.ports ?? []).map((p) => (
                      <SelectItem key={p.id} value={p.slug}>
                        {p.name}, {p.country}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="eyebrow text-brass">Sailing from</Label>
                <Input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="mt-2 border-brass/30 bg-transparent text-navy-foreground"
                />
              </div>

              <div>
                <Label className="eyebrow text-brass">Sailing to</Label>
                <Input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="mt-2 border-brass/30 bg-transparent text-navy-foreground"
                />
              </div>

              <div className="md:col-span-1">
                <Label className="eyebrow text-brass">Itinerary name</Label>
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="e.g. Western Mediterranean"
                  className="mt-2 border-brass/30 bg-transparent text-navy-foreground placeholder:text-navy-foreground/40"
                />
              </div>

              <div className="flex items-end">
                <Button
                  onClick={() => setApplied((n) => n + 1)}
                  className="w-full bg-brass text-brass-foreground hover:bg-brass-soft"
                >
                  <Search className="mr-2 size-4" /> Search sailings
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-16">
        {results.isLoading ? (
          <p className="text-muted-foreground">Reading the timetables…</p>
        ) : rows.length === 0 ? (
          <div className="rounded-lg border border-border p-10 text-center">
            <Anchor className="mx-auto size-8 text-brass" />
            <h2 className="mt-4 text-2xl">No sailings match those details</h2>
            <p className="mt-2 text-muted-foreground">
              Try widening the dates, or search by port of call instead of ship.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <h2 className="text-2xl">{rows.length} sailings found</h2>
              <p className="text-sm text-muted-foreground">Select a sailing to see its ports</p>
            </div>
            <div className="rule-brass mt-5" />
            <ul className="mt-8 divide-y divide-border">
              {rows.map((s) => {
                const active = s.slug === selectedSlug;
                return (
                  <li key={s.id} className="py-7">
                    <div className="flex flex-wrap items-start justify-between gap-6">
                      <div className="max-w-2xl">
                        <p className="eyebrow text-brass">
                          {s.ships.cruise_lines.name} · {s.region}
                        </p>
                        <h3 className="mt-2 text-2xl">
                          <button
                            type="button"
                            onClick={() => setSelectedSlug(s.slug)}
                            className="text-left hover:text-brass"
                          >
                            {s.name}
                          </button>
                        </h3>
                        <div className="mt-3 flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-2">
                            <Ship className="size-4 text-brass" /> {s.ships.name}
                          </span>
                          <span className="inline-flex items-center gap-2">
                            <CalendarDays className="size-4 text-brass" />
                            {formatDate(s.departure_date)} — {formatDate(s.arrival_date)}
                          </span>
                          <span>{s.nights} nights</span>
                        </div>
                      </div>
                      <Button
                        onClick={() => setSelectedSlug(s.slug)}
                        variant={active ? "outline" : "default"}
                        className={
                          active
                            ? "border-brass text-brass"
                            : "bg-brass text-brass-foreground hover:bg-brass-soft"
                        }
                      >
                        {active ? "Selected" : "View ports & tours"}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {selectedSlug ? (
        <section id="selected-sailing" className="border-t border-border bg-muted/20">
          <div className="mx-auto max-w-7xl px-5 py-14">
            {detail.isLoading || !detail.data ? (
              <p className="text-muted-foreground">Loading the itinerary…</p>
            ) : (
              <>
                <div className="flex flex-wrap items-end justify-between gap-5">
                  <div>
                    <p className="eyebrow text-brass">Selected cruise</p>
                    <h2 className="mt-2 text-3xl md:text-4xl">{detail.data.sailing.name}</h2>
                    <div className="mt-3 flex flex-wrap items-center gap-5 text-sm text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <Ship className="size-4 text-brass" />
                        {detail.data.sailing.ships.cruise_lines.name} ·{" "}
                        {detail.data.sailing.ships.name}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <CalendarDays className="size-4 text-brass" />
                        {formatDate(detail.data.sailing.departure_date)} —{" "}
                        {formatDate(detail.data.sailing.arrival_date)}
                      </span>
                      <span>{detail.data.sailing.nights} nights</span>
                    </div>
                  </div>
                  <Button asChild variant="outline" className="border-brass/50">
                    <Link to="/cruises/$slug" params={{ slug: detail.data.sailing.slug }}>
                      Full sailing page
                    </Link>
                  </Button>
                </div>
                <FreshnessBanner
                  className="mt-5"
                  updatedAt={detail.data.freshness?.updatedAt}
                  source={detail.data.freshness?.source}
                />
                <div className="rule-brass mt-6 mb-10" />
                <SailingPortExplorer
                  calls={detail.data.calls}
                  excursions={detail.data.excursions}
                />
              </>
            )}
          </div>
        </section>
      ) : null}

    </div>
  );
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
