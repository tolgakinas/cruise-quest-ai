import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Clock, MapPin } from "lucide-react";
import { getPort } from "@/lib/catalog.functions";
import { Button } from "@/components/ui/button";
import { FreshnessInline } from "@/components/data-freshness";
import { formatDate, formatDuration, formatMoney, shortTime } from "@/lib/format";

const portQuery = (slug: string) =>
  queryOptions({ queryKey: ["port", slug], queryFn: () => getPort({ data: { slug } }) });

export const Route = createFileRoute("/ports/$slug")({
  loader: async ({ params, context }) => {
    const data = await context.queryClient.ensureQueryData(portQuery(params.slug));
    if (!data) throw notFound();
    return { name: data.port.name, country: data.port.country };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.name ?? "Port"} Shore Excursions — Shore Hopper` },
      {
        name: "description",
        content: `Shore excursions and tours in ${loaderData?.name ?? "port"}${loaderData?.country ? `, ${loaderData.country}` : ""}, with the cruise ships calling there.`,
      },
      { property: "og:title", content: `${loaderData?.name ?? "Port"} Shore Excursions` },
      {
        property: "og:description",
        content: `Curated tours ashore in ${loaderData?.name ?? "this port"} timed to your ship's hours in port.`,
      },
    ],
  }),
  component: PortPage,
  errorComponent: () => (
    <div className="mx-auto max-w-3xl px-5 py-24 text-center">
      <h1 className="text-3xl">This port didn't load</h1>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-3xl px-5 py-24 text-center">
      <h1 className="text-3xl">Port not found</h1>
      <Button asChild className="mt-6 bg-brass text-brass-foreground hover:bg-brass-soft">
        <Link to="/cruises" search={{}}>Back to cruise search</Link>
      </Button>
    </div>
  ),
});

function PortPage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(portQuery(slug));
  if (!data) return null;
  const { port, excursions, calls } = data;

  return (
    <div className="bg-background">
      <section className="border-b border-brass/20 bg-navy-deep text-navy-foreground">
        <div className="mx-auto max-w-7xl px-5 py-14">
          <p className="eyebrow text-brass">
            {port.country}
            {port.region ? ` · ${port.region}` : ""}
          </p>
          <h1 className="mt-3 text-4xl md:text-5xl">{port.name}</h1>
          {port.description ? (
            <p className="mt-5 max-w-2xl text-navy-foreground/75">{port.description}</p>
          ) : null}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14">
        <div className="grid gap-12 lg:grid-cols-[1fr_20rem]">
          <div>
            <h2 className="text-3xl">Tours ashore</h2>
            <div className="rule-brass mt-5" />
            {excursions.length === 0 ? (
              <p className="mt-8 text-muted-foreground">
                No tours are published in this port yet.
              </p>
            ) : (
              <ul className="mt-8 grid gap-6 md:grid-cols-2">
                {excursions.map((ex) => (
                  <li key={ex.id} className="overflow-hidden rounded-lg border border-border">
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
                    <div className="p-6">
                    <div className="flex items-center justify-between gap-3">
                      <p className="eyebrow text-brass">{ex.category ?? "Excursion"}</p>
                      <p className="font-display text-xl">{formatMoney(ex.price, ex.currency)}</p>
                    </div>
                    <h3 className="mt-3 font-display text-xl">{ex.title}</h3>

                    <p className="mt-2 text-sm text-muted-foreground">{ex.summary}</p>
                    <p className="mt-4 inline-flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="size-3.5 text-brass" />
                      {formatDuration(ex.duration_minutes)}
                      {ex.difficulty ? ` · ${ex.difficulty}` : ""}
                    </p>
                    <Button
                      asChild
                      className="mt-5 w-full bg-brass text-brass-foreground hover:bg-brass-soft"
                    >
                      <Link to="/excursions/$slug" params={{ slug: ex.slug }}>
                        View & book
                      </Link>
                    </Button>
                    </div>
                  </li>

                ))}
              </ul>
            )}
          </div>

          <aside>
            <h2 className="font-display text-2xl">Ships calling here</h2>
            <div className="rule-brass mt-4" />
            {calls.length === 0 ? (
              <p className="mt-5 text-sm text-muted-foreground">No scheduled calls on file.</p>
            ) : (
              <ul className="mt-5 space-y-4">
                {calls.slice(0, 12).map((call) => (
                  <li key={call.id} className="border-b border-border pb-4">
                    <p className="text-xs text-muted-foreground">{formatDate(call.call_date)}</p>
                    <Link
                      to="/cruises/$slug"
                      params={{ slug: call.sailings.slug }}
                      className="mt-1 block font-display text-lg hover:text-brass"
                    >
                      {call.sailings.name}
                    </Link>
                    <p className="mt-1 inline-flex items-center gap-2 text-xs text-muted-foreground">
                      <MapPin className="size-3.5 text-brass" />
                      {shortTime(call.arrival_time)} – {shortTime(call.departure_time)}
                    </p>
                    <FreshnessInline className="mt-1.5 block" updatedAt={call.updated_at} />
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}
