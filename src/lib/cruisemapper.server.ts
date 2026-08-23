import { slugify } from "./admin-guard";
import {
  firecrawlRequest,
  scrapeMarkdown,
  persistSailings,
  type ImportStats,
  type ParsedSailing,
} from "./import.server";

/**
 * CruiseMapper catalogue crawler.
 *
 * Discovery maps cruisemapper.com for every cruise line and ship page and
 * queues them in `import_sources`. Batch runs then scrape the queued pages,
 * enrich cruise lines / ships, and upsert the ship's sailing timetable.
 * Batching keeps each request inside the worker time budget while the
 * scheduled refresh grinds through the whole queue.
 */

const SOURCE = "cruisemapper";
const ROOT = "https://www.cruisemapper.com";

type QueueRow = {
  id: string;
  label: string;
  url: string;
  kind: string;
  ship_slug: string | null;
  cruise_line_slug: string | null;
};

export type DiscoveryResult = {
  mapped: number;
  shipsQueued: number;
  linesQueued: number;
  alreadyQueued: number;
};

export type BatchResult = {
  processed: number;
  failed: number;
  remaining: number;
  linesCreated: number;
  shipsCreated: number;
  sailingsCreated: number;
  sailingsUpdated: number;
  portCallsCreated: number;
  portCallsUpdated: number;
  pages: { label: string; ok: boolean; detail: string }[];
};

async function mapLinks(url: string, search: string, limit: number): Promise<string[]> {
  const response = await firecrawlRequest("/map", { url, search, limit });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Firecrawl map failed [${response.status}]: ${text.slice(0, 400)}`);
  }
  const payload = JSON.parse(text) as {
    links?: (string | { url?: string })[];
    data?: { links?: (string | { url?: string })[] };
  };
  return (payload.links ?? payload.data?.links ?? [])
    .map((l) => (typeof l === "string" ? l : l?.url ?? ""))
    .filter((l) => l.startsWith("http"));
}

const titleize = (segment: string) =>
  segment
    .replace(/-\d+$/, "")
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => (w.length <= 3 && w === w.toLowerCase() ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ")
    .trim();

/** Maps cruisemapper.com and queues every cruise line + ship page. */
export async function discoverCruisemapperCatalog(limit = 4000): Promise<DiscoveryResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const batches = await Promise.all([
    mapLinks(`${ROOT}/ships`, "cruise ship itinerary schedule", limit),
    mapLinks(`${ROOT}/cruise-lines`, "cruise line fleet ships", Math.min(limit, 1000)),
  ]);
  const links = [...new Set(batches.flat())];

  const ships = links.filter((l) => /cruisemapper\.com\/ships\/[^/?#]+$/i.test(l));
  const lines = links.filter((l) => /cruisemapper\.com\/cruise-lines\/[^/?#]+$/i.test(l));

  const rows = [
    ...lines.map((url) => {
      const slug = url.split("/").pop() ?? "";
      return {
        label: `CruiseMapper — ${titleize(slug)}`,
        url,
        parser: "cruisemapper",
        kind: "catalog",
        ship_slug: null as string | null,
        cruise_line_slug: titleize(slug),
        is_active: true,
      };
    }),
    ...ships.map((url) => {
      const slug = url.split("/").pop() ?? "";
      return {
        label: `CruiseMapper — ${titleize(slug)} schedule`,
        url,
        parser: "cruisemapper",
        kind: "timetable",
        ship_slug: slugify(titleize(slug)),
        cruise_line_slug: null as string | null,
        is_active: true,
      };
    }),
  ];

  let inserted = 0;
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    const { data, error } = await supabaseAdmin
      .from("import_sources")
      .upsert(chunk, { onConflict: "url", ignoreDuplicates: true })
      .select("id");
    if (error) throw new Error(error.message);
    inserted += data?.length ?? 0;
  }

  return {
    mapped: links.length,
    shipsQueued: ships.length,
    linesQueued: lines.length,
    alreadyQueued: Math.max(0, rows.length - inserted),
  };
}

const SHIP_SYSTEM = `You read a CruiseMapper ship or cruise line page and return STRICT JSON:
{"cruiseLine": {"name": string|null, "description": string|null},
 "ship": {"name": string|null, "capacity": number|null, "yearBuilt": number|null, "description": string|null},
 "sailings": [{"cruiseLine": string, "ship": string, "name": string, "region": string|null,
   "departureDate": "YYYY-MM-DD", "arrivalDate": "YYYY-MM-DD"|null, "nights": number|null,
   "description": string|null,
   "portCalls": [{"portName": string, "country": string|null, "dayNumber": number,
     "callDate": "YYYY-MM-DD"|null, "arrivalTime": "HH:MM"|null,
     "departureTime": "HH:MM"|null, "isSeaDay": boolean}]}]}
Rules:
- Only use facts present in the text. Never invent ships, dates or times.
- Times are 24h "HH:MM"; use null when not stated.
- Sea days: portName "At sea", isSeaDay true, times null.
- dayNumber starts at 1 on the embarkation day and increases by one per day.
- Include every itinerary/schedule entry you can read, each as one sailing.
- If the page lists no schedule, return "sailings": [].`;

type ExtractedPage = {
  cruiseLine?: { name?: string | null; description?: string | null } | null;
  ship?: {
    name?: string | null;
    capacity?: number | null;
    yearBuilt?: number | null;
    description?: string | null;
  } | null;
  sailings?: ParsedSailing[];
};

async function extractPage(markdown: string, url: string, hint: string | null): Promise<ExtractedPage> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SHIP_SYSTEM },
        {
          role: "user",
          content: `SOURCE URL: ${url}\nNAME HINT: ${hint || "(none)"}\n\nPAGE CONTENT:\n${markdown.slice(0, 60000)}`,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`AI extraction failed [${response.status}]: ${body.slice(0, 300)}`);
  }
  const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  try {
    return JSON.parse(payload.choices?.[0]?.message?.content ?? "{}") as ExtractedPage;
  } catch {
    throw new Error("The extractor returned an unreadable response");
  }
}

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** Creates or enriches a cruise line row and returns its id. */
async function upsertLine(name: string, description?: string | null) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const slug = slugify(name);
  const existing = await supabaseAdmin
    .from("cruise_lines")
    .select("id, description")
    .eq("slug", slug)
    .maybeSingle();

  if (existing.data?.id) {
    if (description && !existing.data.description) {
      await supabaseAdmin.from("cruise_lines").update({ description }).eq("id", existing.data.id);
    }
    return { id: existing.data.id, created: false };
  }
  const inserted = await supabaseAdmin
    .from("cruise_lines")
    .insert({ name, slug, description: description ?? null, source: SOURCE, external_id: slug })
    .select("id")
    .single();
  if (inserted.error) throw new Error(inserted.error.message);
  return { id: inserted.data.id, created: true };
}

/** Creates or enriches a ship row (capacity, build year, description). */
async function upsertShip(params: {
  name: string;
  lineId: string;
  capacity?: number | null;
  yearBuilt?: number | null;
  description?: string | null;
}) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const slug = slugify(params.name);
  const existing = await supabaseAdmin
    .from("ships")
    .select("id, capacity, year_built, description")
    .eq("slug", slug)
    .maybeSingle();

  if (existing.data?.id) {
    const patch: {
      capacity?: number;
      year_built?: number;
      description?: string;
    } = {};
    if (params.capacity && !existing.data.capacity) patch.capacity = params.capacity;
    if (params.yearBuilt && !existing.data.year_built) patch.year_built = params.yearBuilt;
    if (params.description && !existing.data.description) patch.description = params.description;
    if (Object.keys(patch).length) {
      await supabaseAdmin.from("ships").update(patch).eq("id", existing.data.id);
    }
    return { id: existing.data.id, created: false };
  }

  const inserted = await supabaseAdmin
    .from("ships")
    .insert({
      name: params.name,
      slug,
      cruise_line_id: params.lineId,
      capacity: params.capacity ?? null,
      year_built: params.yearBuilt ?? null,
      description: params.description ?? null,
      source: SOURCE,
      external_id: slug,
    })
    .select("id")
    .single();
  if (inserted.error) throw new Error(inserted.error.message);
  return { id: inserted.data.id, created: true };
}

const empty: BatchResult = {
  processed: 0,
  failed: 0,
  remaining: 0,
  linesCreated: 0,
  shipsCreated: 0,
  sailingsCreated: 0,
  sailingsUpdated: 0,
  portCallsCreated: 0,
  portCallsUpdated: 0,
  pages: [],
};

/** Processes the next `limit` queued CruiseMapper pages, oldest refresh first. */
export async function runCruisemapperBatch(params: {
  limit?: number;
  trigger: string;
}): Promise<BatchResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const limit = Math.min(Math.max(params.limit ?? 15, 1), 40);

  const { data: queue, error } = await supabaseAdmin
    .from("import_sources")
    .select("id, label, url, kind, ship_slug, cruise_line_slug")
    .eq("parser", "cruisemapper")
    .eq("is_active", true)
    .order("last_run_at", { ascending: true, nullsFirst: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  const result: BatchResult = { ...empty, pages: [] };
  const rows = (queue ?? []) as QueueRow[];

  for (const row of rows) {
    const run = await supabaseAdmin
      .from("import_runs")
      .insert({ source_id: row.id, trigger: params.trigger, status: "running" })
      .select("id")
      .maybeSingle();
    const runId = run.data?.id ?? null;

    try {
      const markdown = await scrapeMarkdown(row.url);
      const page = await extractPage(
        markdown,
        row.url,
        row.ship_slug ?? row.cruise_line_slug ?? row.label,
      );

      let lineName = page.cruiseLine?.name?.trim() || row.cruise_line_slug || "";
      const shipName = page.ship?.name?.trim() || "";
      if (!lineName && page.sailings?.[0]?.cruiseLine) lineName = page.sailings[0].cruiseLine;

      if (lineName) {
        const line = await upsertLine(lineName, page.cruiseLine?.description ?? null);
        if (line.created) result.linesCreated += 1;

        if (shipName) {
          const ship = await upsertShip({
            name: shipName,
            lineId: line.id,
            capacity: page.ship?.capacity ?? null,
            yearBuilt: page.ship?.yearBuilt ?? null,
            description: page.ship?.description ?? null,
          });
          if (ship.created) result.shipsCreated += 1;
        }
      }

      const sailings = (page.sailings ?? [])
        .map((s) => ({
          ...s,
          cruiseLine: s.cruiseLine?.trim() || lineName,
          ship: s.ship?.trim() || shipName,
        }))
        .filter((s) => s.name && s.ship && s.cruiseLine && isDate(s.departureDate));

      let stats: ImportStats | null = null;
      if (sailings.length) stats = await persistSailings(sailings, SOURCE);

      result.processed += 1;
      result.sailingsCreated += stats?.sailingsCreated ?? 0;
      result.sailingsUpdated += stats?.sailingsUpdated ?? 0;
      result.portCallsCreated += stats?.portCallsCreated ?? 0;
      result.portCallsUpdated += stats?.portCallsUpdated ?? 0;
      result.pages.push({
        label: row.label,
        ok: true,
        detail: sailings.length
          ? `${stats?.sailingsCreated ?? 0} new / ${stats?.sailingsUpdated ?? 0} updated sailings`
          : shipName || lineName
            ? "catalogue entry updated, no schedule listed"
            : "nothing readable on this page",
      });

      if (runId) {
        await supabaseAdmin
          .from("import_runs")
          .update({
            status: sailings.length ? "success" : "empty",
            sailings_created: stats?.sailingsCreated ?? 0,
            sailings_updated: stats?.sailingsUpdated ?? 0,
            port_calls_created: stats?.portCallsCreated ?? 0,
            port_calls_updated: stats?.portCallsUpdated ?? 0,
            finished_at: new Date().toISOString(),
          })
          .eq("id", runId);
      }
      await supabaseAdmin
        .from("import_sources")
        .update({ last_run_at: new Date().toISOString(), last_error: null })
        .eq("id", row.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Import failed";
      result.failed += 1;
      result.pages.push({ label: row.label, ok: false, detail: message.slice(0, 200) });
      if (runId) {
        await supabaseAdmin
          .from("import_runs")
          .update({ status: "error", error: message, finished_at: new Date().toISOString() })
          .eq("id", runId);
      }
      const attempts = await supabaseAdmin
        .from("import_sources")
        .select("attempts")
        .eq("id", row.id)
        .maybeSingle();
      const nextAttempts = (attempts.data?.attempts ?? 0) + 1;
      await supabaseAdmin
        .from("import_sources")
        .update({
          last_run_at: new Date().toISOString(),
          last_error: message.slice(0, 400),
          attempts: nextAttempts,
          // Give up on a page after repeated failures so the queue keeps moving.
          is_active: nextAttempts < 4,
        })
        .eq("id", row.id);
      // Credit exhaustion affects every page — stop the batch early.
      if (/\[402\]/.test(message)) break;
    }
  }

  const { count } = await supabaseAdmin
    .from("import_sources")
    .select("id", { count: "exact", head: true })
    .eq("parser", "cruisemapper")
    .eq("is_active", true)
    .is("last_run_at", null);
  result.remaining = count ?? 0;

  return result;
}
