import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { toast } from "sonner";
import { getExcursionOffer, reserveExcursion } from "@/lib/booking.functions";
import { createBookingCheckout } from "@/lib/payments.functions";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { formatDate, formatMoney, shortTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/booking/$slug")({
  validateSearch: z.object({
    portCall: z.string(),
    party: z.coerce.number().int().min(1).max(20).default(1),
  }),
  head: () => ({
    meta: [
      { title: "Complete Your Booking — Shore Hopper" },
      {
        name: "description",
        content: "Confirm your passenger details and pay securely to reserve your shore excursion.",
      },
      { property: "og:title", content: "Complete Your Booking — Shore Hopper" },
      { property: "og:description", content: "Confirm details and pay for your shore excursion." },
    ],
  }),
  component: BookingPage,
});

function BookingPage() {
  const { slug } = Route.useParams();
  const { portCall, party } = Route.useSearch();
  const { user } = useAuth();
  const navigate = useNavigate();

  const offer = useQuery({
    queryKey: ["excursion-offer", slug],
    queryFn: () => getExcursionOffer({ data: { slug } }),
  });

  const [form, setForm] = useState({
    leadName: "",
    leadEmail: "",
    leadPhone: "",
    cabinNumber: "",
    notes: "",
  });
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [selectedAddons, setSelectedAddons] = useState<string[]>([]);

  const excursion = offer.data?.excursion;
  const date = offer.data?.dates.find((d) => d.portCallId === portCall);
  const addons = offer.data?.addons ?? [];
  const excursionTotal = excursion ? Number(excursion.price) * party : 0;
  const addonLines = addons
    .filter((a) => selectedAddons.includes(a.id))
    .map((a) => ({
      id: a.id,
      name: a.name,
      quantity: a.per_guest ? party : 1,
      total: Number(a.price) * (a.per_guest ? party : 1),
    }));
  const addonTotal = addonLines.reduce((sum, l) => sum + l.total, 0);
  const total = excursionTotal + addonTotal;

  function toggleAddon(id: string) {
    setSelectedAddons((current) =>
      current.includes(id) ? current.filter((a) => a !== id) : [...current, id],
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!excursion || !date) return;
    setSubmitting(true);
    try {
      const booking = await reserveExcursion({
        data: {
          excursionId: excursion.id,
          portCallId: date.portCallId,
          partySize: party,
          leadName: form.leadName,
          leadEmail: form.leadEmail || user?.email || "",
          leadPhone: form.leadPhone,
          cabinNumber: form.cabinNumber,
          notes: form.notes,
          addonIds: selectedAddons,
        },
      });

      const result = await createBookingCheckout({
        data: {
          reference: booking.reference,
          returnUrl: `${window.location.origin}/booking/return?session_id={CHECKOUT_SESSION_ID}`,
          environment: getStripeEnvironment(),
        },
      });
      if ("error" in result) throw new Error(result.error);
      setClientSecret(result.clientSecret);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We couldn't start your booking.");
    } finally {
      setSubmitting(false);
    }
  }

  if (offer.isLoading) {
    return <div className="mx-auto max-w-5xl px-5 py-24 text-muted-foreground">Loading…</div>;
  }

  if (!excursion || !date) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-24 text-center">
        <h1 className="text-3xl">That tour date is no longer available</h1>
        <Button asChild className="mt-6 bg-brass text-brass-foreground hover:bg-brass-soft">
          <Link to="/excursions/$slug" params={{ slug }}>
            Choose another date
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      <PaymentTestModeBanner />
      <div className="mx-auto max-w-6xl px-5 py-16">
        <p className="eyebrow text-brass">Reservation</p>
        <h1 className="mt-3 text-4xl">Complete your booking</h1>
        <div className="rule-brass mt-6" />

        <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_22rem]">
          <div>
            {clientSecret ? (
              <div className="rounded-lg border border-border p-4">
                <EmbeddedCheckoutProvider stripe={getStripe()} options={{ clientSecret }}>
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="leadName">Lead passenger name</Label>
                  <Input
                    id="leadName"
                    required
                    minLength={2}
                    value={form.leadName}
                    onChange={(e) => setForm({ ...form, leadName: e.target.value })}
                    className="mt-2"
                  />
                </div>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="leadEmail">Email</Label>
                    <Input
                      id="leadEmail"
                      type="email"
                      required
                      value={form.leadEmail || user?.email || ""}
                      onChange={(e) => setForm({ ...form, leadEmail: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                  <div>
                    <Label htmlFor="leadPhone">Phone (optional)</Label>
                    <Input
                      id="leadPhone"
                      value={form.leadPhone}
                      onChange={(e) => setForm({ ...form, leadPhone: e.target.value })}
                      className="mt-2"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="cabinNumber">Cabin number (optional)</Label>
                  <Input
                    id="cabinNumber"
                    value={form.cabinNumber}
                    onChange={(e) => setForm({ ...form, cabinNumber: e.target.value })}
                    className="mt-2 max-w-40"
                  />
                </div>
                <div>
                  <Label htmlFor="notes">Anything we should know? (optional)</Label>
                  <Textarea
                    id="notes"
                    rows={4}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    className="mt-2"
                  />
                </div>

                {addons.length ? (
                  <div>
                    <div className="rule-brass mb-6" />
                    <p className="eyebrow text-brass">Add to your day ashore</p>
                    <div className="mt-4 space-y-3">
                      {addons.map((addon) => {
                        const quantity = addon.per_guest ? party : 1;
                        const lineTotal = Number(addon.price) * quantity;
                        const checked = selectedAddons.includes(addon.id);
                        return (
                          <label
                            key={addon.id}
                            className={`flex cursor-pointer items-start gap-4 rounded-lg border p-4 transition-colors ${
                              checked ? "border-brass bg-brass/10" : "border-border hover:border-brass/50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleAddon(addon.id)}
                              className="mt-1 h-4 w-4 accent-brass"
                            />
                            <span className="flex-1">
                              <span className="flex flex-wrap items-baseline justify-between gap-2">
                                <span className="font-medium">{addon.name}</span>
                                <span className="font-display">
                                  {formatMoney(lineTotal, addon.currency)}
                                </span>
                              </span>
                              {addon.description ? (
                                <span className="mt-1 block text-sm text-muted-foreground">
                                  {addon.description}
                                </span>
                              ) : null}
                              <span className="mt-1 block text-xs text-muted-foreground">
                                {addon.per_guest
                                  ? `${formatMoney(addon.price, addon.currency)} per guest`
                                  : "Per booking"}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-brass text-brass-foreground hover:bg-brass-soft"
                >
                  {submitting ? "Reserving…" : "Continue to payment"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  We hold your places for 30 minutes while you pay.
                </p>
              </form>
            )}
          </div>

          <aside className="lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-lg border border-brass/30 bg-ivory/60 p-6">
              <p className="eyebrow text-brass">{excursion.ports.name}</p>
              <h2 className="mt-2 font-display text-2xl">{excursion.title}</h2>
              <div className="rule-brass my-5" />
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Date</dt>
                  <dd>{formatDate(date.date)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Ship</dt>
                  <dd className="text-right">{date.shipName}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">In port</dt>
                  <dd>
                    {shortTime(date.arrival)} – {shortTime(date.departure)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Guests</dt>
                  <dd>{party}</dd>
                </div>
              </dl>
              <div className="rule-brass my-5" />
              <div className="flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Total due</span>
                <span className="font-display text-2xl">
                  {formatMoney(total, excursion.currency)}
                </span>
              </div>
              {!clientSecret ? (
                <Button
                  variant="outline"
                  className="mt-6 w-full"
                  onClick={() =>
                    navigate({ to: "/excursions/$slug", params: { slug }, search: { portCall } })
                  }
                >
                  Change date or guests
                </Button>
              ) : null}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
