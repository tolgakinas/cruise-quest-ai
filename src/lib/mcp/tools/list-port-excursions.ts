import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseAnon } from "../supabase";

export default defineTool({
  name: "list_port_excursions",
  title: "List shore excursions in a port",
  description:
    "List published Shore Hopper shore excursions available in a port (by port slug or name), with price, duration, category and meeting point.",
  inputSchema: {
    port: z.string().trim().min(1).describe("Port slug or name, e.g. istanbul."),
    limit: z.number().int().min(1).max(50).default(20),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ port, limit }) => {
    const supabase = supabaseAnon();
    const { data: ports, error: portError } = await supabase
      .from("ports")
      .select("id, name, slug, country, region")
      .or(`slug.eq.${port},name.ilike.%${port}%`)
      .limit(1);
    if (portError) return { content: [{ type: "text", text: portError.message }], isError: true };
    const match = ports?.[0];
    if (!match) return { content: [{ type: "text", text: `No port found for "${port}".` }], isError: true };

    const { data, error } = await supabase
      .from("excursions")
      .select("title, slug, summary, price, currency, duration_minutes, category, difficulty, meeting_point, wheelchair_accessible")
      .eq("port_id", match.id)
      .eq("is_published", true)
      .order("price", { ascending: true })
      .limit(limit ?? 20);
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const payload = { port: match, excursions: data ?? [] };
    return {
      content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
      structuredContent: payload,
    };
  },
});
