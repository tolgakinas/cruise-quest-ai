import { Link } from "@tanstack/react-router";
import { Anchor, Clock, MoonStar, Ship, Sunrise, Sunset } from "lucide-react";
import { FreshnessInline } from "@/components/data-freshness";
import { formatDateLong, hoursAshore, shortTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type TimelineCall = {
  id: string;
  day_number: number;
  call_date: string;
  arrival_time: string | null;
  departure_time: string | null;
  is_sea_day: boolean | null;
  updated_at?: string | null;
  ports?: {
    id: string;
    name: string;
    slug: string;
    country: string | null;
  } | null;
};

export function SailingTimeline({
  calls,
  className,
}: {
  calls: TimelineCall[];
  className?: string;
}) {
  if (calls.length === 0) return null;
  const lastIndex = calls.length - 1;

  return (
    <ol className={cn("relative space-y-0", className)}>
      {calls.map((call, index) => {
        const isSea = Boolean(call.is_sea_day) || !call.ports;
        const window = hoursAshore(call.arrival_time, call.departure_time);
        const isFirst = index === 0;
        const isLast = index === lastIndex;
        const stage = isFirst ? "Embarkation" : isLast ? "Disembarkation" : null;

        return (
          <li key={call.id} className="relative flex gap-5 pb-8 last:pb-0">
            {/* Rail */}
            <div className="relative flex w-10 shrink-0 flex-col items-center">
              <span
                className={cn(
                  "z-10 flex size-10 items-center justify-center rounded-full border",
                  isSea
                    ? "border-border bg-muted text-muted-foreground"
                    : "border-brass bg-brass/10 text-brass",
                )}
                aria-hidden="true"
              >
                {isSea ? (
                  <MoonStar className="size-4" />
                ) : isFirst ? (
                  <Ship className="size-4" />
                ) : isLast ? (
                  <Anchor className="size-4" />
                ) : (
                  <Anchor className="size-4" />
                )}
              </span>
              {!isLast ? (
                <span className="absolute top-10 bottom-[-2rem] w-px bg-brass/25" aria-hidden="true" />
              ) : null}
            </div>

            {/* Content */}
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="eyebrow text-brass">Day {call.day_number}</span>
                <span className="text-xs text-muted-foreground">
                  {formatDateLong(call.call_date)}
                </span>
                {stage ? (
                  <span className="rounded-full border border-brass/40 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.14em] text-brass">
                    {stage}
                  </span>
                ) : null}
              </div>

              <h3 className="mt-1 font-display text-xl leading-snug">
                {isSea ? (
                  "At sea"
                ) : call.ports ? (
                  <Link
                    to="/ports/$slug"
                    params={{ slug: call.ports.slug }}
                    className="hover:text-brass"
                  >
                    {call.ports.name}
                  </Link>
                ) : (
                  "Port call"
                )}
                {!isSea && call.ports?.country ? (
                  <span className="ml-2 font-sans text-sm font-normal text-muted-foreground">
                    {call.ports.country}
                  </span>
                ) : null}
              </h3>

              {isSea ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  A full day cruising — no port calls scheduled.
                </p>
              ) : (
                <>
                  <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-md border border-border px-3 py-2">
                      <dt className="flex items-center gap-1.5 text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">
                        <Sunrise className="size-3.5 text-brass" /> Arrival
                      </dt>
                      <dd className="mt-0.5 font-display text-lg">
                        {shortTime(call.arrival_time)}
                      </dd>
                    </div>
                    <div className="rounded-md border border-border px-3 py-2">
                      <dt className="flex items-center gap-1.5 text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">
                        <Sunset className="size-3.5 text-brass" /> Departure
                      </dt>
                      <dd className="mt-0.5 font-display text-lg">
                        {shortTime(call.departure_time)}
                      </dd>
                    </div>
                    <div className="rounded-md border border-border px-3 py-2">
                      <dt className="flex items-center gap-1.5 text-[0.65rem] uppercase tracking-[0.14em] text-muted-foreground">
                        <Clock className="size-3.5 text-brass" /> Time ashore
                      </dt>
                      <dd className="mt-0.5 font-display text-lg">
                        {window ? `${window.toFixed(1)} h` : "—"}
                      </dd>
                    </div>
                  </dl>
                  <FreshnessInline className="mt-2" updatedAt={call.updated_at ?? null} />
                </>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
