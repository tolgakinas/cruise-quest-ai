import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon } from "../supabase";

export default defineTool({
  name: "search_sailings",
  title: "Search cruise sailings",
  description:
    "Search upcoming published cruise sailings by ship name, cruise line, region, or departure date window. Returns sailing slugs to use with get_sailing_itinerary.",
  inputSchema: {
    query: z.string().trim().optional().describe("Free text matched against sailing or ship name."),
    region: z.string().trim().optional().describe("Region name, e.g. Mediterranean."),
    departure_from: z.string().trim().optional().describe("Earliest departure date (YYYY-MM-DD)."),
    departure_to: z.string().trim().optional().describe("Latest departure date (YYYY-MM-DD)."),
    limit: z.number().int().min(1).max(50).default(15),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, region, departure_from, departure_to, limit }) => {
    const supabase = supabaseAnon();
    const today = new Date().toISOString().slice(0, 10);
    let q = supabase
      .from("sailings")
      .select(
        "name, slug, region, departure_date, arrival_date, nights, starting_price, ships(name, cruise_lines(name))",
      )
      .eq("is_published", true)
      .gte("departure_date", departure_from && departure_from > today ? departure_from : today)
      .order("departure_date", { ascending: true })
      .limit(limit ?? 15);

    if (query) q = q.ilike("name", `%${query}%`);
    if (region) q = q.ilike("region", `%${region}%`);
    if (departure_to) q = q.lte("departure_date", departure_to);

    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const sailings = (data ?? []).map((s) => ({
      name: s.name,
      slug: s.slug,
      region: s.region,
      departure_date: s.departure_date,
      arrival_date: s.arrival_date,
      nights: s.nights,
      starting_price: s.starting_price,
      ship: s.ships?.name ?? null,
      cruise_line: s.ships?.cruise_lines?.name ?? null,
    }));

    return {
      content: [{ type: "text", text: JSON.stringify(sailings, null, 2) }],
      structuredContent: { sailings },
    };
  },
});
