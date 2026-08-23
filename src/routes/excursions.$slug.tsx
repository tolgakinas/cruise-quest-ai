import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Accessibility, Check, Clock, MapPin, Minus, Plus, Users, X } from "lucide-react";
import { z } from "zod";
import { getExcursionOffer } from "@/lib/booking.functions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate, formatDuration, formatMoney, hoursAshore, shortTime } from "@/lib/format";

const offerQuery = (slug: string) =>
  queryOptions({
    queryKey: ["excursion-offer", slug],
    queryFn: () => getExcursionOffer({ data: { slug } }),
  });

export const Route = createFileRoute("/excursions/$slug")({
  validateSearch: z.object({ portCall: z.string().optional() }),
  loader: async ({ params, context }) => {
    const data = await context.queryClient.ensureQueryData(offerQuery(params.slug));
    if (!data) throw notFound();
    return { title: data.excursion.title, port: data.excursion.ports.name };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.title ?? "Excursion"} — Shore Hopper` },
      {
        name: "description",
        content: `Book ${loaderData?.title ?? "this shore excursion"} in ${loaderData?.port ?? "port"} — timed to your ship's hours ashore, with instant confirmation.`,
      },
      { property: "og:title", content: `${loaderData?.title ?? "Excursion"} — Shore Hopper` },
      {
        property: "og:description",
        content: `A curated shore excursion in ${loaderData?.port ?? "port"}, timed to your ship's schedule.`,
      },
    ],
  }),
  component: ExcursionPage,
  errorComponent: () => (
    <div className="mx-auto max-w-3xl px-5 py-24 text-center">
      <h1 className="text-3xl">This tour didn't load</h1>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-5 py-24 text-center">
      <h1 className="text-3xl">Tour not found</h1>
      <Button asChild className="mt-6 bg-brass text-brass-foreground hover:bg-brass-soft">
        <Link to="/cruises" search={{}}>Find your cruise</Link>
      </Button>
    </div>
  ),
});

function ExcursionPage() {
  const { slug } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { data } = useSuspenseQuery(offerQuery(slug));

  const dates = data?.dates ?? [];
  const [portCallId, setPortCallId] = useState<string | null>(
    search.portCall ?? dates.find((d) => d.seatsLeft > 0)?.portCallId ?? null,
  );
  const [party, setParty] = useState(2);

  if (!data) return null;
  const ex = data.excursion;
  const selected = dates.find((d) => d.portCallId === portCallId) ?? null;
  const window = selected ? hoursAshore(selected.arrival, selected.departure) : null;
  const fits = window === null || ex.duration_minutes / 60 + 1 <= window;
  const maxParty = selected ? Math.min(20, Math.max(1, selected.seatsLeft)) : 20;

  return (
    <div className="bg-background">
      <section className="border-b border-brass/20 bg-navy-deep text-navy-foreground">
        <div className="mx-auto max-w-7xl px-5 py-14">
          <p className="eyebrow text-brass">
            {ex.ports.name}, {ex.ports.country}
            {ex.category ? ` · ${ex.category}` : ""}
          </p>
          <h1 className="mt-3 max-w-3xl text-4xl md:text-5xl">{ex.title}</h1>
          <div className="mt-5 flex flex-wrap items-center gap-6 text-sm text-navy-foreground/75">
            <span className="inline-flex items-center gap-2">
              <Clock className="size-4 text-brass" /> {formatDuration(ex.duration_minutes)}
            </span>
            {ex.difficulty ? <span>{ex.difficulty}</span> : null}
            <span className="inline-flex items-center gap-2">
              <Users className="size-4 text-brass" /> Max {ex.capacity} guests
            </span>
            {ex.wheelchair_accessible ? (
              <span className="inline-flex items-center gap-2">
                <Accessibility className="size-4 text-brass" /> Accessible
              </span>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14">
        <div className="grid gap-12 lg:grid-cols-[1fr_24rem]">
          <div>
            {ex.image_url ? (
              <img
                src={ex.image_url}
                alt={ex.title}
                width={1200}
                height={800}
                className="mb-8 aspect-[3/2] w-full rounded-2xl object-cover"
              />
            ) : null}
            <p className="text-lg leading-relaxed text-foreground/90">{ex.summary}</p>

            {ex.description ? (
              <p className="mt-6 whitespace-pre-line leading-relaxed text-muted-foreground">
                {ex.description}
              </p>
            ) : null}

            {ex.meeting_point ? (
              <div className="mt-10 rounded-lg border border-border p-6">
                <p className="eyebrow text-brass">Meeting point</p>
                <p className="mt-2 inline-flex items-start gap-2 text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-brass" /> {ex.meeting_point}
                </p>
              </div>
            ) : null}

            {(ex.includes?.length ?? 0) > 0 || (ex.excludes?.length ?? 0) > 0 ? (
              <div className="mt-10 grid gap-8 sm:grid-cols-2">
                {(ex.includes?.length ?? 0) > 0 ? (
                  <div>
                    <h2 className="font-display text-xl">What's included</h2>
                    <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                      {ex.includes.map((item) => (
                        <li key={item} className="flex gap-2">
                          <Check className="mt-0.5 size-4 shrink-0 text-brass" /> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {(ex.excludes?.length ?? 0) > 0 ? (
                  <div>
                    <h2 className="font-display text-xl">Not included</h2>
                    <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                      {ex.excludes.map((item) => (
                        <li key={item} className="flex gap-2">
                          <X className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* Booking panel */}
          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-lg border border-brass/30 bg-ivory/60 p-6">
              <p className="eyebrow text-brass">From</p>
              <p className="mt-1 font-display text-4xl">{formatMoney(ex.price, ex.currency)}</p>
              <p className="text-sm text-muted-foreground">per guest</p>

              <div className="rule-brass my-6" />

              <p className="eyebrow text-brass">Choose your sailing date</p>
              {dates.length === 0 ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  No ships are scheduled in this port at the moment. Please check back soon.
                </p>
              ) : (
                <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
                  {dates.map((d) => {
                    const active = d.portCallId === portCallId;
                    const soldOut = d.seatsLeft <= 0;
                    return (
                      <li key={d.portCallId}>
                        <button
                          type="button"
                          disabled={soldOut}
                          onClick={() => {
                            setPortCallId(d.portCallId);
                            setParty((p) => Math.min(p, Math.max(1, d.seatsLeft)));
                          }}
                          className={cn(
                            "w-full rounded-md border px-3 py-2 text-left text-sm transition-colors",
                            soldOut
                              ? "cursor-not-allowed border-border text-muted-foreground/60"
                              : active
                                ? "border-brass bg-brass/10"
                                : "border-border hover:border-brass/60",
                          )}
                        >
                          <span className="block font-medium">{formatDate(d.date)}</span>
                          <span className="block text-xs text-muted-foreground">
                            {d.shipName} · {shortTime(d.arrival)} – {shortTime(d.departure)} ·{" "}
                            {soldOut ? "Fully booked" : `${d.seatsLeft} places left`}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="mt-6">
                <p className="eyebrow text-brass">Guests</p>
                <div className="mt-2 flex items-center gap-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setParty((p) => Math.max(1, p - 1))}
                  >
                    <Minus className="size-4" />
                  </Button>
                  <span className="font-display text-2xl">{party}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setParty((p) => Math.min(maxParty, p + 1))}
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
              </div>

              {selected ? (
                <p
                  className={cn(
                    "mt-6 text-xs",
                    fits ? "text-muted-foreground" : "text-destructive",
                  )}
                >
                  {fits
                    ? `Your ship is in port ${shortTime(selected.arrival)} – ${shortTime(selected.departure)}. This tour returns with time to spare.`
                    : "This tour runs close to your all-aboard time — please review carefully before booking."}
                </p>
              ) : null}

              <div className="rule-brass my-6" />
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="font-display text-2xl">
                  {formatMoney(Number(ex.price) * party, ex.currency)}
                </span>
              </div>

              <Button
                className="mt-5 w-full bg-brass text-brass-foreground hover:bg-brass-soft"
                disabled={!selected}
                onClick={() =>
                  navigate({
                    to: "/booking/$slug",
                    params: { slug: ex.slug },
                    search: { portCall: selected!.portCallId, party },
                  })
                }
              >
                Continue to booking
              </Button>
              <p className="mt-3 text-center text-xs text-muted-foreground">
                You'll confirm passenger details and pay on the next step.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
