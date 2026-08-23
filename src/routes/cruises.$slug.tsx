import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { Anchor, Clock, MapPin, Ship, TriangleAlert, CheckCircle2 } from "lucide-react";
import { getSailing } from "@/lib/catalog.functions";
import { Button } from "@/components/ui/button";
import {
  formatDate,
  formatDuration,
  formatMoney,
  hoursAshore,
  shortTime,
} from "@/lib/format";
import { cn } from "@/lib/utils";

const sailingQuery = (slug: string) =>
  queryOptions({
    queryKey: ["sailing", slug],
    queryFn: () => getSailing({ data: { slug } }),
  });

export const Route = createFileRoute("/cruises/$slug")({
  loader: async ({ params, context }) => {
    const data = await context.queryClient.ensureQueryData(sailingQuery(params.slug));
    if (!data) throw notFound();
    return { name: data.sailing.name, region: data.sailing.region };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.name ?? "Sailing"} — Ports & Shore Excursions | Shore Hopper` },
      {
        name: "description",
        content: `Day-by-day port calls for ${loaderData?.name ?? "this sailing"} with arrival and departure times and shore excursions in each port.`,
      },
      { property: "og:title", content: `${loaderData?.name ?? "Sailing"} — Ports & Excursions` },
      {
        property: "og:description",
        content: `Port calls, times ashore and curated excursions for this ${loaderData?.region ?? "cruise"} sailing.`,
      },
    ],
  }),
  component: SailingPage,
  errorComponent: () => (
    <div className="mx-auto max-w-3xl px-5 py-24 text-center">
      <h1 className="text-3xl">This sailing didn't load</h1>
      <p className="mt-3 text-muted-foreground">Please try again in a moment.</p>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-5 py-24 text-center">
      <h1 className="text-3xl">Sailing not found</h1>
      <Button asChild className="mt-6 bg-brass text-brass-foreground hover:bg-brass-soft">
        <Link to="/cruises" search={{}}>Back to cruise search</Link>
      </Button>
    </div>
  ),
});

function SailingPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(sailingQuery(slug));
  const calls = data?.calls ?? [];
  const portCalls = calls.filter((c) => !c.is_sea_day && c.ports);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(portCalls[0]?.id ?? null);

  if (!data) return null;
  const { sailing, excursions } = data;
  const selected = portCalls.find((c) => c.id === selectedCallId) ?? portCalls[0];
  const portExcursions = selected
    ? excursions.filter((e) => e.port_id === selected.ports?.id)
    : [];
  const window = selected ? hoursAshore(selected.arrival_time, selected.departure_time) : null;

  return (
    <div className="bg-background">
      <section className="border-b border-brass/20 bg-navy-deep text-navy-foreground">
        <div className="mx-auto max-w-7xl px-5 py-14">
          <p className="eyebrow text-brass">
            {sailing.ships.cruise_lines.name} · {sailing.region}
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl md:text-5xl">{sailing.name}</h1>
          <div className="mt-5 flex flex-wrap items-center gap-6 text-sm text-navy-foreground/75">
            <span className="inline-flex items-center gap-2">
              <Ship className="size-4 text-brass" /> {sailing.ships.name}
            </span>
            <span>
              {formatDate(sailing.departure_date)} — {formatDate(sailing.arrival_date)}
            </span>
            <span>{sailing.nights} nights</span>
            <span>{portCalls.length} ports of call</span>
          </div>
          <FreshnessBanner
            className="mt-6 max-w-3xl"
            tone="dark"
            updatedAt={data.freshness?.updatedAt}
            source={data.freshness?.source}
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-12">
        <div className="grid gap-10 lg:grid-cols-[22rem_1fr]">
          {/* Ports: left column */}
          <aside>
            <h2 className="font-display text-2xl">Your itinerary</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Select a port to see the tours available there.
            </p>
            <div className="rule-brass mt-4" />
            <ul className="mt-4 space-y-1">
              {calls.map((call) => {
                const isSea = call.is_sea_day || !call.ports;
                const active = call.id === selected?.id;
                return (
                  <li key={call.id}>
                    <button
                      type="button"
                      disabled={isSea}
                      onClick={() => setSelectedCallId(call.id)}
                      className={cn(
                        "w-full rounded-md border px-4 py-3 text-left transition-colors",
                        isSea
                          ? "cursor-default border-transparent bg-muted/40 text-muted-foreground"
                          : active
                            ? "border-brass bg-brass/10"
                            : "border-border hover:border-brass/60",
                      )}
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="eyebrow text-brass">Day {call.day_number}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(call.call_date)}
                        </span>
                      </div>
                      <p className="mt-1 font-display text-lg">
                        {isSea ? "At sea" : call.ports?.name}
                      </p>
                      {!isSea ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {call.ports?.country}
                          {call.arrival_time || call.departure_time
                            ? ` · ${shortTime(call.arrival_time)} – ${shortTime(call.departure_time)}`
                            : ""}
                        </p>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          {/* Excursions: right column */}
          <div>
            {selected ? (
              <>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="eyebrow text-brass">Day {selected.day_number} ashore</p>
                    <h2 className="mt-2 text-3xl">
                      Shore excursions in {selected.ports?.name}
                    </h2>
                    <p className="mt-2 inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="size-4 text-brass" />
                      In port {shortTime(selected.arrival_time)} – {shortTime(selected.departure_time)}
                      {window ? ` · ${window.toFixed(1)} hours ashore` : ""}
                    </p>
                  </div>
                  {selected.ports ? (
                    <Button asChild variant="outline" className="border-brass/50">
                      <Link to="/ports/$slug" params={{ slug: selected.ports.slug }}>
                        About {selected.ports.name}
                      </Link>
                    </Button>
                  ) : null}
                </div>
                <div className="rule-brass mt-5" />

                {portExcursions.length === 0 ? (
                  <div className="mt-10 rounded-lg border border-border p-10 text-center">
                    <Anchor className="mx-auto size-7 text-brass" />
                    <p className="mt-4 text-muted-foreground">
                      No tours are published in this port yet. Our team is curating them now.
                    </p>
                  </div>
                ) : (
                  <ul className="mt-8 grid gap-6 md:grid-cols-2">
                    {portExcursions.map((ex) => {
                      const fits = window === null || ex.duration_minutes / 60 + 1 <= window;
                      return (
                        <li
                          key={ex.id}
                          className="flex flex-col rounded-lg border border-border p-6 transition-colors hover:border-brass/60"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="eyebrow text-brass">{ex.category ?? "Excursion"}</p>
                            <p className="font-display text-xl">
                              {formatMoney(ex.price, ex.currency)}
                            </p>
                          </div>
                          <h3 className="mt-3 font-display text-xl leading-snug">
                            <Link
                              to="/excursions/$slug"
                              params={{ slug: ex.slug }}
                              className="hover:text-brass"
                            >
                              {ex.title}
                            </Link>
                          </h3>
                          <p className="mt-2 flex-1 text-sm text-muted-foreground">{ex.summary}</p>
                          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                            <span className="inline-flex items-center gap-1.5">
                              <Clock className="size-3.5 text-brass" />
                              {formatDuration(ex.duration_minutes)}
                            </span>
                            {ex.difficulty ? <span>{ex.difficulty}</span> : null}
                          </div>
                          <p
                            className={cn(
                              "mt-4 inline-flex items-center gap-2 text-xs",
                              fits ? "text-sea" : "text-destructive",
                            )}
                          >
                            {fits ? (
                              <CheckCircle2 className="size-3.5" />
                            ) : (
                              <TriangleAlert className="size-3.5" />
                            )}
                            {fits
                              ? "Comfortably back before all-aboard"
                              : "Tight against your all-aboard time"}
                          </p>
                          <Button
                            asChild
                            className="mt-5 bg-brass text-brass-foreground hover:bg-brass-soft"
                          >
                            <Link to="/excursions/$slug" params={{ slug: ex.slug }}>
                              View & book
                            </Link>
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            ) : (
              <div className="rounded-lg border border-border p-10 text-center">
                <MapPin className="mx-auto size-7 text-brass" />
                <p className="mt-4 text-muted-foreground">
                  This sailing has no port calls published yet.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}



