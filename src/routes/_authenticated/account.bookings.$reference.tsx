import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import { cancelMyBooking, getMyBooking, modifyMyBooking } from "@/lib/booking.functions";
import { createBookingCheckout } from "@/lib/payments.functions";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatMoney, shortTime } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/account/bookings/$reference")({
  head: () => ({
    meta: [
      { title: "Manage Reservation — Shore Hopper" },
      {
        name: "description",
        content: "Change your excursion date, party size or contact details, or cancel your reservation.",
      },
      { property: "og:title", content: "Manage Reservation — Shore Hopper" },
      { property: "og:description", content: "Change or cancel your shore excursion reservation." },
    ],
  }),
  component: ManageBookingPage,
});

function ManageBookingPage() {
  const { reference } = Route.useParams();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["my-booking", reference],
    queryFn: () => getMyBooking({ data: { reference } }),
  });

  const booking = query.data?.booking;
  const [form, setForm] = useState({
    portCallId: "",
    partySize: 1,
    leadName: "",
    leadEmail: "",
    leadPhone: "",
    cabinNumber: "",
    notes: "",
  });
  const [busy, setBusy] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  useEffect(() => {
    if (!booking) return;
    setForm({
      portCallId: booking.port_call_id ?? "",
      partySize: booking.party_size,
      leadName: booking.lead_passenger_name,
      leadEmail: booking.lead_passenger_email,
      leadPhone: booking.lead_passenger_phone ?? "",
      cabinNumber: booking.cabin_number ?? "",
      notes: booking.notes ?? "",
    });
  }, [booking?.id]);

  if (query.isLoading) {
    return <div className="mx-auto max-w-4xl px-5 py-24 text-muted-foreground">Loading…</div>;
  }
  if (!booking) {
    return (
      <div className="mx-auto max-w-3xl px-5 py-24 text-center">
        <h1 className="text-3xl">Reservation not found</h1>
        <Button asChild className="mt-6 bg-brass text-brass-foreground hover:bg-brass-soft">
          <Link to="/account/bookings">Back to my reservations</Link>
        </Button>
      </div>
    );
  }

  const closed = booking.status === "cancelled" || booking.status === "refunded";
  const unitPrice = Number(booking.excursions?.price ?? 0);
  const extras = booking.booking_addons ?? [];
  const refundRequests = query.data?.refundRequests ?? [];
  const pendingRefund = refundRequests.find((r) => r.status === "pending");
  // Per-guest extras follow the guest count; per-booking extras are charged once.
  const extrasTotalForParty = extras.reduce((sum, extra) => {
    const perGuest = extra.quantity > 1 || extra.quantity === booking.party_size;
    return sum + Number(extra.unit_price) * (perGuest ? form.partySize : 1);
  }, 0);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await modifyMyBooking({
        data: {
          reference,
          partySize: form.partySize,
          portCallId: form.portCallId || undefined,
          leadName: form.leadName,
          leadEmail: form.leadEmail,
          leadPhone: form.leadPhone,
          cabinNumber: form.cabinNumber,
          notes: form.notes,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["my-booking", reference] });
      await queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      toast.success("Your reservation has been updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We couldn't update your reservation.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      await cancelMyBooking({ data: { reference } });
      await queryClient.invalidateQueries({ queryKey: ["my-booking", reference] });
      await queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      toast.success("Your reservation has been cancelled.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We couldn't cancel your reservation.");
    } finally {
      setBusy(false);
    }
  }

  async function pay() {
    setBusy(true);
    try {
      const result = await createBookingCheckout({
        data: {
          reference,
          returnUrl: `${window.location.origin}/booking/return?session_id={CHECKOUT_SESSION_ID}`,
          environment: getStripeEnvironment(),
        },
      });
      if ("error" in result) throw new Error(result.error);
      setClientSecret(result.clientSecret);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We couldn't start the payment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-16">
      <p className="eyebrow text-brass">Ref {booking.reference}</p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-4xl">{booking.excursions?.title}</h1>
        <Badge variant="outline">{booking.status}</Badge>
      </div>
      <p className="mt-3 text-muted-foreground">
        {booking.excursions?.ports?.name} · {formatDate(booking.tour_date)} ·{" "}
        {formatMoney(booking.total_amount, booking.currency)}
      </p>
      <div className="rule-brass mt-6" />

      {clientSecret ? (
        <div className="mt-8 rounded-lg border border-border p-4">
          <EmbeddedCheckoutProvider stripe={getStripe()} options={{ clientSecret }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      ) : booking.status === "reserved" ? (
        <div className="mt-8 rounded-lg border border-brass/40 bg-brass/10 p-5">
          <p className="text-sm">
            This reservation is not paid yet. Complete payment to secure your places.
          </p>
          <Button
            onClick={pay}
            disabled={busy}
            className="mt-4 bg-brass text-brass-foreground hover:bg-brass-soft"
          >
            Pay now
          </Button>
        </div>
      ) : null}

      <form onSubmit={save} className="mt-10 space-y-6">
        <div>
          <Label htmlFor="portCallId">Tour date</Label>
          <select
            id="portCallId"
            disabled={closed}
            value={form.portCallId}
            onChange={(e) => setForm({ ...form, portCallId: e.target.value })}
            className="mt-2 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {(query.data?.alternatives ?? []).map((call) => (
              <option key={call.id} value={call.id}>
                {formatDate(call.call_date)} — {call.sailings?.name} ({shortTime(call.arrival_time)}{" "}
                – {shortTime(call.departure_time)})
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <Label htmlFor="partySize">Guests</Label>
            <Input
              id="partySize"
              type="number"
              min={1}
              max={20}
              disabled={closed}
              value={form.partySize}
              onChange={(e) => setForm({ ...form, partySize: Number(e.target.value) })}
              className="mt-2"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              New total: {formatMoney(unitPrice * form.partySize, booking.currency)}
            </p>
          </div>
          <div>
            <Label htmlFor="cabinNumber">Cabin number</Label>
            <Input
              id="cabinNumber"
              disabled={closed}
              value={form.cabinNumber}
              onChange={(e) => setForm({ ...form, cabinNumber: e.target.value })}
              className="mt-2"
            />
          </div>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <Label htmlFor="leadName">Lead passenger</Label>
            <Input
              id="leadName"
              disabled={closed}
              value={form.leadName}
              onChange={(e) => setForm({ ...form, leadName: e.target.value })}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="leadEmail">Email</Label>
            <Input
              id="leadEmail"
              type="email"
              disabled={closed}
              value={form.leadEmail}
              onChange={(e) => setForm({ ...form, leadEmail: e.target.value })}
              className="mt-2"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="leadPhone">Phone</Label>
          <Input
            id="leadPhone"
            disabled={closed}
            value={form.leadPhone}
            onChange={(e) => setForm({ ...form, leadPhone: e.target.value })}
            className="mt-2 max-w-64"
          />
        </div>

        <div>
          <Label htmlFor="notes">Notes for the operator</Label>
          <Textarea
            id="notes"
            rows={4}
            disabled={closed}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="mt-2"
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button
            type="submit"
            disabled={busy || closed}
            className="bg-brass text-brass-foreground hover:bg-brass-soft"
          >
            Save changes
          </Button>
          <Button type="button" variant="outline" disabled={busy || closed} onClick={cancel}>
            Cancel reservation
          </Button>
          <Button asChild variant="ghost">
            <Link to="/account/bookings">Back</Link>
          </Button>
        </div>
      </form>

      {(query.data?.history ?? []).length > 0 ? (
        <div className="mt-14">
          <h2 className="font-display text-2xl">Change history</h2>
          <div className="rule-brass mt-4" />
          <ul className="mt-5 space-y-3 text-sm text-muted-foreground">
            {(query.data?.history ?? []).map((h) => (
              <li key={h.id} className="border-b border-border pb-3">
                {formatDate(h.created_at)} — {h.field.replace(/_/g, " ")}:{" "}
                {h.old_value ?? "—"} → {h.new_value ?? "—"}
                {h.note ? ` (${h.note})` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
