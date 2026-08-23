import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Anchor, CheckCircle2, Clock, MapPin, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate, formatDuration, formatMoney, hoursAshore, shortTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type Port = {
  id: string;
  name: string;
  slug: string;
  country: string | null;
} | null;

export type PortCall = {
  id: string;
  day_number: number;
  call_date: string;
  arrival_time: string | null;
  departure_time: string | null;
  is_sea_day: boolean | null;
  ports: Port;
};

export type ExcursionCard = {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  duration_minutes: number;
  price: number;
  currency: string;
  category: string | null;
  difficulty: string | null;
  port_id: string;
  image_url?: string | null;
};


export function SailingPortExplorer({
  calls,
  excursions,
}: {
  calls: PortCall[];
  excursions: ExcursionCard[];
}) {
  const portCalls = calls.filter((c) => !c.is_sea_day && c.ports);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(portCalls[0]?.id ?? null);

  useEffect(() => {
    setSelectedCallId(portCalls[0]?.id ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portCalls[0]?.id]);

  const selected = portCalls.find((c) => c.id === selectedCallId) ?? portCalls[0];
  const portExcursions = selected ? excursions.filter((e) => e.port_id === selected.ports?.id) : [];
  const window = selected ? hoursAshore(selected.arrival_time, selected.departure_time) : null;

  return (
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
                  disabled={!!isSea}
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
                  <p className="mt-1 font-display text-lg">{isSea ? "At sea" : call.ports?.name}</p>
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
                <h2 className="mt-2 text-3xl">Shore excursions in {selected.ports?.name}</h2>
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
                      className="flex flex-col overflow-hidden rounded-lg border border-border transition-colors hover:border-brass/60"
                    >
                      {ex.image_url ? (
                        <img
                          src={ex.image_url}
                          alt={ex.title}
                          loading="lazy"
                          width={1200}
                          height={800}
                          className="h-44 w-full object-cover"
                        />
                      ) : null}
                      <div className="flex flex-1 flex-col p-6">
                      <div className="flex items-center justify-between gap-3">
                        <p className="eyebrow text-brass">{ex.category ?? "Excursion"}</p>
                        <p className="font-display text-xl">{formatMoney(ex.price, ex.currency)}</p>
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
  );
}
