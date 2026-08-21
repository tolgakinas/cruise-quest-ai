import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Shore Hopper — Shore Excursions, Considered" },
      {
        name: "description",
        content:
          "Shore Hopper helps cruise passengers track their sailing, read every port call and book excursions that fit the hours ashore.",
      },
      { property: "og:title", content: "About Shore Hopper" },
      {
        property: "og:description",
        content: "Track your sailing, read every port call, book excursions that fit.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-20">
      <p className="eyebrow text-brass">Our purpose</p>
      <h1 className="mt-3 text-4xl">Shore time, considered</h1>
      <div className="mt-6 space-y-5 text-lg leading-relaxed text-muted-foreground">
        <p>
          A cruise gives you a handful of hours in each city. Shore Hopper exists to make those
          hours count: find your sailing, read the timetable as the bridge reads it, and choose a
          tour that returns you to the gangway with time to spare.
        </p>
        <p>
          Every excursion we list is matched to a real port call, with arrival and departure times
          shown beside it. No guesswork, no missed ships.
        </p>
      </div>
    </div>
  );
}
