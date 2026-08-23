import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createStripeClient, getStripeErrorMessage, type StripeEnv } from "@/lib/stripe.server";

const EnvSchema = z.enum(["sandbox", "live"]);

async function assertAdmin(context: unknown) {
  const { supabase, userId } = context as {
    supabase: {
      from: (t: string) => {
        select: (c: string) => {
          eq: (
            c: string,
            v: string,
          ) => {
            eq: (c: string, v: string) => { maybeSingle: () => Promise<{ data: unknown }> };
          };
        };
      };
    };
    userId: string;
  };
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Forbidden: admin access required");
}

/** Admin: every refund request, newest first, with the booking it belongs to. */
export const listRefundRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ status: z.enum(["pending", "approved", "declined", "all"]).default("pending") })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);

    let query = context.supabase
      .from("refund_requests")
      .select(
        "id, status, reason, amount, currency, admin_note, created_at, reviewed_at, bookings(id, reference, tour_date, party_size, total_amount, currency, status, lead_passenger_name, lead_passenger_email, excursions(title, ports(name, country)))",
      )
      .order("created_at", { ascending: false })
      .limit(200);
    if (data.status !== "all") query = query.eq("status", data.status);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const requests = rows ?? [];
    return {
      requests,
      stats: {
        pending: requests.filter((r) => r.status === "pending").length,
        approved: requests.filter((r) => r.status === "approved").length,
        declined: requests.filter((r) => r.status === "declined").length,
      },
    };
  });

const DecideInput = z.object({
  requestId: z.string().uuid(),
  decision: z.enum(["approve", "decline"]),
  note: z.string().trim().max(500).optional(),
  environment: EnvSchema,
});

type DecideResult = { ok: true; refunded: boolean } | { error: string };

/** Admin: approve (and issue the Stripe refund) or decline a refund request. */
export const decideRefundRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DecideInput.parse(input))
  .handler(async ({ data, context }): Promise<DecideResult> => {
    await assertAdmin(context);

    const { data: request } = await context.supabase
      .from("refund_requests")
      .select("id, status, booking_id, amount, currency")
      .eq("id", data.requestId)
      .maybeSingle();
    if (!request) return { error: "Refund request not found." };
    if (request.status !== "pending") return { error: "This request has already been reviewed." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.decision === "decline") {
      await supabaseAdmin
        .from("refund_requests")
        .update({
          status: "declined",
          admin_note: data.note || null,
          reviewed_by: context.userId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", request.id);
      return { ok: true, refunded: false };
    }

    const { data: payment } = await supabaseAdmin
      .from("payments")
      .select("id, provider_payment_intent, amount, currency, status")
      .eq("booking_id", request.booking_id)
      .eq("status", "paid")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let refunded = false;
    if (payment?.provider_payment_intent) {
      try {
        const stripe = createStripeClient(data.environment as StripeEnv);
        await stripe.refunds.create({ payment_intent: payment.provider_payment_intent });
        refunded = true;
      } catch (error) {
        return { error: getStripeErrorMessage(error) };
      }
    }

    if (payment) {
      await supabaseAdmin.from("payments").update({ status: "refunded" }).eq("id", payment.id);
    }

    await supabaseAdmin
      .from("bookings")
      .update({ status: "refunded" })
      .eq("id", request.booking_id);

    await supabaseAdmin
      .from("refund_requests")
      .update({
        status: "approved",
        admin_note: data.note || null,
        reviewed_by: context.userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", request.id);

    await supabaseAdmin.from("booking_modifications").insert({
      booking_id: request.booking_id,
      changed_by: context.userId,
      field: "status",
      old_value: "cancelled",
      new_value: "refunded",
      note: data.note ? `Refund approved: ${data.note}` : "Refund approved by admin",
    });

    return { ok: true, refunded };
  });
