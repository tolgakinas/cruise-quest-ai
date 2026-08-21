import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Shore Hopper" },
      {
        name: "description",
        content: "Reach the Shore Hopper voyage desk about bookings, excursions and port timings.",
      },
      { property: "og:title", content: "Contact Shore Hopper" },
      {
        property: "og:description",
        content: "Reach the voyage desk about bookings, excursions and port timings.",
      },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-20">
      <p className="eyebrow text-brass">Voyage desk</p>
      <h1 className="mt-3 text-4xl">Contact</h1>
      <div className="mt-8 space-y-4 text-muted-foreground">
        <p>
          Email <span className="text-foreground">desk@shorehopper.com</span>
        </p>
        <p>
          Telephone <span className="text-foreground">+1 305 555 0148</span>
        </p>
        <p>Open 24 hours while ships are at sea.</p>
      </div>
    </div>
  );
}
