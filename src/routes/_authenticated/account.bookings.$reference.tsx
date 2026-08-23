import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";
import {
  cancelMyBooking,
  getBookingChangeOptions,
  getMyBooking,
  modifyMyBooking,
} from "@/lib/booking.functions";
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
        content:
          "Change the port, tour, time or party size of your shore excursion, follow its status or cancel it.",
      },
      { property: "og:title", content: "Manage Reservation — Shore Hopper" },
      { property: "og:description", content: "Change or cancel your shore excursion reservation." },
    ],
  }),
  component: ManageBookingPage,
});

/** Plain-language meaning of every reservation state the guest can land in. */
function statusMeta(status: string, pendingRefund: boolean) {
  if (status === "reserved") {
    return {
      label: "Awaiting payment",
      tone: "border-brass/50 bg-brass/10",
      note: "Your places are held for a short while. Complete payment to confirm them.",
    };
  }
  if (status === "confirmed") {
    return {
      label: "Confirmed",
      tone: "border-emerald-600/40 bg-emerald-600/10",
      note: "Paid and secured. You can still change the port, tour, time or party size below.",
    };
  }
  if (status === "cancelled") {
    return {
      label: pendingRefund ? "Cancelled — refund pending" : "Cancelled",
      tone: "border-destructive/40 bg-destructive/10",
      note: pendingRefund
        ? "Cancelled. Your refund request is with our reservations team for review."
        : "This reservation is cancelled and can no longer be changed.",
    };
  }
  if (status === "refunded") {
    return {
      label: "Refunded",
      tone: "border-border bg-muted",
      note: "The payment has been returned to your original payment method.",
    };
  }
  return { label: status, tone: "border-border bg-muted", note: "" };
}

function ManageBookingPage() {
  const { reference } = Route.useParams();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["my-booking", reference],
    queryFn: () => getMyBooking({ data: { reference } }),
  });
  const optionsQuery = useQuery({
    queryKey: ["my-booking-options", reference],
    queryFn: () => getBookingChangeOptions({ data: { reference } }),
  });

  const booking = query.data?.booking;
  const options = optionsQuery.data;

  const [form, setForm] = useState({
    portId: "",
    excursionId: "",
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
    setForm((prev) => ({
      ...prev,
      portCallId: booking.port_call_id ?? "",
      excursionId: booking.excursion_id,
      partySize: booking.party_size,
      leadName: booking.lead_passenger_name,
      leadEmail: booking.lead_passenger_email,
      leadPhone: booking.lead_passenger_phone ?? "",
      cabinNumber: booking.cabin_number ?? "",
      notes: booking.notes ?? "",
    }));
  }, [booking?.id]);

  // Once the itinerary options arrive, anchor the port selector on the current port call.
  useEffect(() => {
    if (!options || !booking) return;
    const currentCall = options.calls.find((c) => c.id === booking.port_call_id);
    const fallbackPort = options.ports[0]?.id ?? "";
    setForm((prev) => ({ ...prev, portId: prev.portId || currentCall?.port_id || fallbackPort }));
  }, [options, booking?.id]);

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
  const extras = booking.booking_addons ?? [];
  const refundRequests = query.data?.refundRequests ?? [];
  const pendingRefund = Boolean(refundRequests.find((r) => r.status === "pending"));
  const status = statusMeta(booking.status, pendingRefund);

  const portExcursions = (options?.excursions ?? []).filter((e) => e.port_id === form.portId);
  const portCalls = (options?.calls ?? []).filter((c) => c.port_id === form.portId);
  const selectedExcursion =
    portExcursions.find((e) => e.id === form.excursionId) ?? portExcursions[0];
  const excursionChanged = selectedExcursion ? selectedExcursion.id !== booking.excursion_id : false;

  const unitPrice = Number(selectedExcursion?.price ?? booking.excursions?.price ?? 0);
  const currency = selectedExcursion?.currency ?? booking.currency;
  // Per-guest extras follow the guest count; per-booking extras are charged once.
  // Swapping to another tour drops the extras, so they no longer count.
  const extrasTotalForParty = excursionChanged
    ? 0
    : extras.reduce((sum, extra) => {
        const perGuest = extra.excursion_addons?.per_guest ?? false;
        return sum + Number(extra.unit_price) * (perGuest ? form.partySize : 1);
      }, 0);
  const newTotal = unitPrice * form.partySize + extrasTotalForParty;

  function seatsFor(excursionId: string, date: string) {
    return options?.seats[`${excursionId}|${date}`];
  }

  function pickPort(portId: string) {
    const firstExcursion = (options?.excursions ?? []).find((e) => e.port_id === portId);
    const firstCall = (options?.calls ?? []).find((c) => c.port_id === portId);
    setForm((prev) => ({
      ...prev,
      portId,
      excursionId: firstExcursion?.id ?? "",
      portCallId: firstCall?.id ?? "",
    }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form.portCallId) {
      toast.error("Please choose a tour date first.");
      return;
    }
    setBusy(true);
    try {
      await modifyMyBooking({
        data: {
          reference,
          partySize: form.partySize,
          portCallId: form.portCallId,
          excursionId: selectedExcursion?.id,
          leadName: form.leadName,
          leadEmail: form.leadEmail,
          leadPhone: form.leadPhone,
          cabinNumber: form.cabinNumber,
          notes: form.notes,
        },
      });
      await queryClient.invalidateQueries({ queryKey: ["my-booking", reference] });
      await queryClient.invalidateQueries({ queryKey: ["my-booking-options", reference] });
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
      const result = await cancelMyBooking({ data: { reference } });
      await queryClient.invalidateQueries({ queryKey: ["my-booking", reference] });
      await queryClient.invalidateQueries({ queryKey: ["my-bookings"] });
      toast.success(
        result?.refundRequested
          ? "Reservation cancelled. Your refund request is with our team for review."
          : "Your reservation has been cancelled.",
      );
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
        <Badge variant="outline">{status.label}</Badge>
      </div>
      <p className="mt-3 text-muted-foreground">
        {booking.excursions?.ports?.name} · {formatDate(booking.tour_date)} ·{" "}
        {formatMoney(booking.total_amount, booking.currency)} · {booking.party_size} guest(s)
      </p>
      <div className="rule-brass mt-6" />

      <div className={`mt-8 rounded-lg border p-5 ${status.tone}`}>
        <p className="eyebrow text-brass">Status — {status.label}</p>
        <p className="mt-2 text-sm">{status.note}</p>
      </div>

      {clientSecret ? (
        <div className="mt-8 rounded-lg border border-border p-4">
          <EmbeddedCheckoutProvider stripe={getStripe()} options={{ clientSecret }}>
            <EmbeddedCheckout />
          </EmbeddedCheckoutProvider>
        </div>
      ) : booking.status === "reserved" ? (
        <div className="mt-6">
          <Button
            onClick={pay}
            disabled={busy}
            className="bg-brass text-brass-foreground hover:bg-brass-soft"
          >
            Pay now
          </Button>
        </div>
      ) : null}

      {extras.length ? (
        <div className="mt-10">
          <h2 className="font-display text-2xl">Extras on this reservation</h2>
          <div className="rule-brass mt-4" />
          <ul className="mt-5 space-y-3 text-sm">
            {extras.map((extra) => (
              <li key={extra.id} className="flex justify-between gap-4 border-b border-border pb-3">
                <span>
                  {extra.name}
                  {extra.quantity > 1 ? ` × ${extra.quantity}` : ""}
                </span>
                <span>{formatMoney(extra.line_total, extra.currency)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {refundRequests.length ? (
        <div className="mt-10 rounded-lg border border-brass/40 bg-ivory/60 p-5">
          <p className="eyebrow text-brass">Refund requests</p>
          <ul className="mt-4 space-y-3 text-sm">
            {refundRequests.map((request) => (
              <li key={request.id} className="flex flex-wrap items-baseline justify-between gap-3">
                <span>
                  {formatDate(request.created_at)} ·{" "}
                  {formatMoney(request.amount ?? booking.total_amount, request.currency)}
                  {request.admin_note ? ` — ${request.admin_note}` : ""}
                </span>
                <Badge variant="outline">
                  {request.status === "pending"
                    ? "Pending review"
                    : request.status === "approved"
                      ? "Approved"
                      : "Declined"}
                </Badge>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <form onSubmit={save} className="mt-12 space-y-8">
        <div>
          <h2 className="font-display text-2xl">Change your excursion</h2>
          <div className="rule-brass mt-4" />
          <p className="mt-3 text-sm text-muted-foreground">
            Pick a port your ship calls at, then a tour in that port, then the day and time. Prices
            and remaining seats are recalculated when you save.
          </p>
        </div>

        {optionsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading your itinerary…</p>
        ) : (
          <>
            {/* Step 1 — port */}
            <div>
              <p className="eyebrow text-brass">Step 1 — Port</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(options?.ports ?? []).map((port) => (
                  <button
                    key={port.id}
                    type="button"
                    disabled={closed}
                    onClick={() => pickPort(port.id)}
                    className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                      form.portId === port.id
                        ? "border-brass bg-brass text-brass-foreground"
                        : "border-border hover:border-brass hover:text-brass"
                    }`}
                  >
                    {port.name}
                    <span className="ml-2 text-xs opacity-70">{port.country}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 2 — tour */}
            <div>
              <p className="eyebrow text-brass">Step 2 — Tour</p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {portExcursions.map((excursion) => (
                  <button
                    key={excursion.id}
                    type="button"
                    disabled={closed}
                    onClick={() => setForm((prev) => ({ ...prev, excursionId: excursion.id }))}
                    className={`rounded-lg border p-4 text-left transition-colors ${
                      selectedExcursion?.id === excursion.id
                        ? "border-brass bg-brass/10"
                        : "border-border hover:border-brass/60"
                    }`}
                  >
                    <p className="font-display text-lg leading-tight">{excursion.title}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {Math.round(excursion.duration_minutes / 60)} h ·{" "}
                      {formatMoney(excursion.price, excursion.currency)} per guest
                      {excursion.id === booking.excursion_id ? " · current tour" : ""}
                    </p>
                  </button>
                ))}
                {!portExcursions.length ? (
                  <p className="text-sm text-muted-foreground">
                    No published tours in this port yet.
                  </p>
                ) : null}
              </div>
            </div>

            {/* Step 3 — day and time */}
            <div>
              <p className="eyebrow text-brass">Step 3 — Day &amp; time</p>
              <div className="mt-3 space-y-2">
                {portCalls.map((call) => {
                  const seats = selectedExcursion
                    ? seatsFor(selectedExcursion.id, call.call_date)
                    : undefined;
                  const soldOut = typeof seats === "number" && seats < form.partySize;
                  return (
                    <button
                      key={call.id}
                      type="button"
                      disabled={closed || soldOut}
                      onClick={() => setForm((prev) => ({ ...prev, portCallId: call.id }))}
                      className={`flex w-full flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-sm transition-colors disabled:opacity-50 ${
                        form.portCallId === call.id
                          ? "border-brass bg-brass/10"
                          : "border-border hover:border-brass/60"
                      }`}
                    >
                      <span>
                        {formatDate(call.call_date)} · in port {shortTime(call.arrival_time)} –{" "}
                        {shortTime(call.departure_time)}
                        {call.sailings?.name ? ` · ${call.sailings.name}` : ""}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {typeof seats === "number"
                          ? soldOut
                            ? "Not enough places"
                            : `${seats} place(s) left`
                          : ""}
                      </span>
                    </button>
                  );
                })}
                {!portCalls.length ? (
                  <p className="text-sm text-muted-foreground">
                    No upcoming calls at this port on your sailing.
                  </p>
                ) : null}
              </div>
            </div>
          </>
        )}

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
              New total: {formatMoney(newTotal, currency)}
              {excursionChanged
                ? " — switching tour removes the previously booked extras"
                : extras.length
                  ? " (extras included)"
                  : ""}
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
                {formatDate(h.created_at)} — {h.field.replace(/_/g, " ")}: {h.old_value ?? "—"} →{" "}
                {h.new_value ?? "—"}
                {h.note ? ` (${h.note})` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
