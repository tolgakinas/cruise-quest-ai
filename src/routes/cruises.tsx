import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/cruises")({
  head: () => ({
    meta: [
      { title: "Find a Cruise — Shore Hopper" },
      {
        name: "description",
        content:
          "Search sailings by cruise line, ship, port, region and date, then explore every port call.",
      },
      { property: "og:title", content: "Find a Cruise — Shore Hopper" },
      {
        property: "og:description",
        content: "Search sailings by cruise line, ship, port, region and date.",
      },
    ],
  }),
  component: CruisesPage,
});

function CruisesPage() {
  return (
    <div className="mx-auto max-w-7xl px-5 py-20">
      <p className="eyebrow text-brass">Voyages</p>
      <h1 className="mt-3 text-4xl">Find a cruise</h1>
      <p className="mt-4 max-w-xl text-muted-foreground">
        Cruise search is being fitted out. It will arrive with filters for line, ship, port, region
        and dates.
      </p>
    </div>
  );
}
