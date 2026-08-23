import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ChatInput = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(2000),
      }),
    )
    .min(1)
    .max(20),
});

/** Public concierge: grounded in the published catalogue only. */
export const askConcierge = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => ChatInput.parse(input))
  .handler(async ({ data }) => {
    const { askGateway } = await import("./concierge.server");
    return askGateway({ messages: data.messages });
  });

/** Signed in: same concierge, plus the guest's own reservations and schedules. */
export const askConciergeAsGuest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ChatInput.parse(input))
  .handler(async ({ data, context }) => {
    const { askGateway } = await import("./concierge.server");

    const { data: bookings } = await context.supabase
      .from("bookings")
      .select(
        "reference, tour_date, party_size, total_amount, currency, status, excursions(title, slug, meeting_point, ports(name, slug)), sailings(name, slug), refund_requests(status)",
      )
      .order("tour_date", { ascending: true })
      .limit(25);

    const bookingsBlock = (bookings ?? [])
      .map((b) => {
        const refund = (b.refund_requests ?? []).map((r) => r.status).join("/");
        return `RESERVATION | ref ${b.reference} | ${b.excursions?.title ?? "tour"} at ${b.excursions?.ports?.name ?? "port"} | ${b.tour_date} | ${b.party_size} guest(s) | ${b.total_amount} ${b.currency} | status: ${b.status}${refund ? ` | refund request: ${refund}` : ""} | sailing: ${b.sailings?.name ?? "—"} | /account/bookings/${b.reference}`;
      })
      .join("\n");

    return askGateway({ messages: data.messages, bookingsBlock });
  });
