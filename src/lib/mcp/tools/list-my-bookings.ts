import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_my_bookings",
  title: "List my excursion bookings",
  description:
    "List the signed-in passenger's own shore excursion bookings with reference, status, tour date, party size and total price.",
  inputSchema: {
    status: z
      .enum(["pending", "confirmed", "cancelled", "completed", "refunded"])
      .optional()
      .describe("Optional booking status filter."),
    limit: z.number().int().min(1).max(50).default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ status, limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated." }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let q = supabase
      .from("bookings")
      .select(
        "reference, status, tour_date, party_size, total_amount, currency, cabin_number, excursions(title, slug, duration_minutes, meeting_point, ports(name, country)), sailings(name, slug)",
      )
      .order("tour_date", { ascending: true })
      .limit(limit ?? 20);
    if (status) q = q.eq("status", status);

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const bookings = data ?? [];
    return {
      content: [{ type: "text", text: JSON.stringify(bookings, null, 2) }],
      structuredContent: { bookings },
    };
  },
});
