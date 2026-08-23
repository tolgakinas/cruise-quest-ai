import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createStripeClient, getStripeErrorMessage, type StripeEnv } from "@/lib/stripe.server";

const EnvSchema = z.enum(["sandbox", "live"]);

const CheckoutInput = z.object({
  reference: z.string().trim().min(3).max(40),
  returnUrl: z.string().url().max(500),
  environment: EnvSchema,
});

type CheckoutResult = { clientSecret: string } | { error: string };

/** Signed in: start payment for one of my reserved bookings. */
export const createBookingCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CheckoutInput.parse(input))
  .handler(async ({ data, context }): Promise<CheckoutResult> => {
    const { supabase, userId } = context;

    const { data: booking } = await supabase
      .from("bookings")
      .select(
        "id, reference, user_id, status, total_amount, currency, party_size, tour_date, lead_passenger_email, excursions(title, ports(name))",
      )
      .eq("reference", data.reference)
      .maybeSingle();

    if (!booking) return { error: "Reservation not found." };
    if (booking.user_id !== userId) return { error: "You cannot pay for this reservation." };
    if (booking.status === "cancelled" || booking.status === "refunded") {
      return { error: "This reservation is closed." };
    }
    if (booking.status === "confirmed") return { error: "This reservation is already paid." };

    const amountInCents = Math.round(Number(booking.total_amount) * 100);
    if (amountInCents < 50) return { error: "This reservation total is too small to charge." };

    try {
      const stripe = createStripeClient(data.environment as StripeEnv);
      const name = `${booking.excursions?.title ?? "Shore excursion"} — ${booking.excursions?.ports?.name ?? ""}`.trim();

      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: (booking.currency ?? "usd").toLowerCase(),
              product_data: {
                name,
                description: `${booking.party_size} guest(s) · ${booking.tour_date} · Ref ${booking.reference}`,
              },
              unit_amount: amountInCents,
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer_email: booking.lead_passenger_email ?? undefined,
        payment_intent_data: { description: name },
        metadata: { userId, bookingId: booking.id, reference: booking.reference },
      });

      await supabase.from("payments").insert({
        booking_id: booking.id,
        user_id: userId,
        provider: "stripe",
        provider_session_id: session.id,
        amount: booking.total_amount,
        currency: booking.currency,
        status: "pending",
      });

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });

const ConfirmInput = z.object({
  sessionId: z.string().trim().min(10).max(200),
  environment: EnvSchema,
});

type ConfirmResult =
  | { status: "paid" | "pending" | "failed"; reference: string | null }
  | { error: string };

/** Signed in: verify a checkout session with Stripe and confirm the booking. */
export const confirmBookingPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ConfirmInput.parse(input))
  .handler(async ({ data, context }): Promise<ConfirmResult> => {
    const { supabase, userId } = context;

    try {
      const stripe = createStripeClient(data.environment as StripeEnv);
      const session = await stripe.checkout.sessions.retrieve(data.sessionId);

      if (session.metadata?.['userId'] !== userId) return { error: "This payment is not yours." };
      const reference = session.metadata?.['reference'] ?? null;
      const bookingId = session.metadata?.['bookingId'];
      if (!bookingId) return { error: "This payment is not linked to a reservation." };

      const paid = session.payment_status === "paid" || session.payment_status === "no_payment_required";
      if (!paid) {
        return { status: session.payment_status === "unpaid" ? "pending" : "failed", reference };
      }

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("bookings")
        .update({ status: "confirmed", expires_at: null })
        .eq("id", bookingId)
        .eq("user_id", userId);

      const { data: existing } = await supabaseAdmin
        .from("payments")
        .select("id")
        .eq("provider_session_id", session.id)
        .maybeSingle();

      if (existing) {
        await supabaseAdmin
          .from("payments")
          .update({
            status: "paid",
            provider_payment_intent:
              typeof session.payment_intent === "string" ? session.payment_intent : null,
          })
          .eq("id", existing.id);
      } else {
        const { data: booking } = await supabase
          .from("bookings")
          .select("total_amount, currency")
          .eq("id", bookingId)
          .maybeSingle();
        await supabaseAdmin.from("payments").insert({
          booking_id: bookingId,
          user_id: userId,
          provider: "stripe",
          provider_session_id: session.id,
          provider_payment_intent:
            typeof session.payment_intent === "string" ? session.payment_intent : null,
          amount: booking?.total_amount ?? 0,
          currency: booking?.currency ?? "USD",
          status: "paid",
        });
      }

      return { status: "paid", reference };
    } catch (error) {
      return { error: getStripeErrorMessage(error) };
    }
  });
