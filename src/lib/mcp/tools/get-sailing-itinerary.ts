import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon } from "../supabase";

export default defineTool({
  name: "get_sailing_itinerary",
  title: "Get sailing itinerary",
  description:
    "Return the port-by-port itinerary for one sailing (by slug), including day numbers, call dates, arrival and departure times, and sea days.",
  inputSchema: { slug: z.string().trim().min(1).describe("Sailing slug from search_sailings.") },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ slug }) => {
    const supabase = supabaseAnon();
    const { data: sailing, error } = await supabase
      .from("sailings")
      .select("id, name, slug, region, departure_date, arrival_date, nights")
      .eq("slug", slug)
      .eq("is_published", true)
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!sailing) return { content: [{ type: "text", text: `No published sailing found for slug "${slug}".` }], isError: true };

    const { data: calls, error: callsError } = await supabase
      .from("sailing_port_calls")
      .select("day_number, call_date, arrival_time, departure_time, is_sea_day, notes, ports(name, slug, country, region)")
      .eq("sailing_id", sailing.id)
      .order("day_number", { ascending: true });
    if (callsError) return { content: [{ type: "text", text: callsError.message }], isError: true };

    const itinerary = (calls ?? []).map((c) => {
      const raw = c as unknown as { ports?: any };
      const port = Array.isArray(raw.ports) ? raw.ports[0] : raw.ports;
      return {
        day: c.day_number,
        date: c.call_date,
        arrival: c.arrival_time,
        departure: c.departure_time,
        sea_day: c.is_sea_day,
        notes: c.notes,
        port: port ? { name: port.name, slug: port.slug, country: port.country } : null,
      };
    });

    const payload = { sailing, itinerary };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
