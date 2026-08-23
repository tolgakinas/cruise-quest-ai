import { slugify } from "./admin-guard";

/**
 * Cruise timetable importer.
 *
 * Firecrawl scrapes a cruise line / itinerary page, the Lovable AI gateway
 * turns the markdown into structured sailings + port calls (dates, arrival and
 * departure times), and the result is upserted into the catalogue keyed by
 * (source, external_id) so repeated runs update instead of duplicating.
 */

export type ParsedPortCall = {
  portName: string;
  country?: string | null;
  dayNumber: number;
  callDate?: string | null;
  arrivalTime?: string | null;
  departureTime?: string | null;
  isSeaDay?: boolean;
};

export type ParsedSailing = {
  cruiseLine: string;
  ship: string;
  name: string;
  region?: string | null;
  departureDate: string;
  arrivalDate?: string | null;
  nights?: number | null;
  description?: string | null;
  portCalls: ParsedPortCall[];
};

export type ImportStats = {
  sailingsCreated: number;
  sailingsUpdated: number;
  portCallsCreated: number;
  portCallsUpdated: number;
  linesTouched: string[];
  shipsTouched: string[];
  portsTouched: string[];
  sailings: { name: string; ship: string; line: string; departureDate: string; calls: number }[];
};

const GATEWAY = "https://connector-gateway.lovable.dev/firecrawl/v2";
const DIRECT = "https://api.firecrawl.dev/v2";

function firecrawlRequest(path: string, body: unknown) {
  const key = process.env["FIRECRAWL_API_KEY"];
  if (!key) throw new Error("FIRECRAWL_API_KEY is not configured");

  if (key.startsWith("fc-")) {
    return fetch(`${DIRECT}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  const lovableKey = process.env["LOVABLE_API_KEY"];
  if (!lovableKey) throw new Error("LOVABLE_API_KEY is not configured");
  return fetch(`${GATEWAY}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

/** Scrapes a page to markdown. Throws with the provider status/body on failure. */
export async function scrapeMarkdown(url: string): Promise<string> {
  const response = await firecrawlRequest("/scrape", {
    url,
    formats: ["markdown"],
    onlyMainContent: true,
    waitFor: 1500,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Firecrawl scrape failed [${response.status}]: ${text.slice(0, 400)}`);
  }
  const payload = JSON.parse(text) as {
    markdown?: string;
    data?: { markdown?: string };
  };
  const markdown = payload.markdown ?? payload.data?.markdown ?? "";
  if (!markdown.trim()) throw new Error("Firecrawl returned no readable content for this page");
  return markdown;
}

/** Finds candidate itinerary/timetable URLs on a cruise site. */
export async function discoverTimetableUrls(url: string, limit = 25): Promise<string[]> {
  const response = await firecrawlRequest("/map", {
    url,
    search: "itinerary schedule timetable cruise dates",
    limit,
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Firecrawl map failed [${response.status}]: ${text.slice(0, 400)}`);
  }
  const payload = JSON.parse(text) as {
    links?: (string | { url?: string })[];
    data?: { links?: (string | { url?: string })[] };
  };
  const links = payload.links ?? payload.data?.links ?? [];
  return links
    .map((l) => (typeof l === "string" ? l : l?.url ?? ""))
    .filter((l) => l.startsWith("http"))
    .slice(0, limit);
}

const EXTRACT_SYSTEM = `You extract cruise timetables from web page text.
Return STRICT JSON: {"sailings":[{
  "cruiseLine": string, "ship": string, "name": string, "region": string|null,
  "departureDate": "YYYY-MM-DD", "arrivalDate": "YYYY-MM-DD"|null, "nights": number|null,
  "description": string|null,
  "portCalls": [{"portName": string, "country": string|null, "dayNumber": number,
    "callDate": "YYYY-MM-DD"|null, "arrivalTime": "HH:MM"|null,
    "departureTime": "HH:MM"|null, "isSeaDay": boolean}]
}]}
Rules:
- Only use facts present in the text. Never invent ships, dates or times.
- Times must be 24h "HH:MM". Use null when a time is not stated.
- Sea days: portName "At sea", isSeaDay true, times null.
- dayNumber starts at 1 for the embarkation day and increases by one per day.
- If the page has no cruise timetable, return {"sailings":[]}.`;

export async function extractSailings(params: {
  markdown: string;
  sourceUrl: string;
  cruiseLineHint?: string | null;
}): Promise<ParsedSailing[]> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("LOVABLE_API_KEY is not configured");

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: EXTRACT_SYSTEM },
        {
          role: "user",
          content: `SOURCE URL: ${params.sourceUrl}\nCRUISE LINE HINT: ${
            params.cruiseLineHint || "(none)"
          }\n\nPAGE CONTENT:\n${params.markdown.slice(0, 60000)}`,
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
  const raw = payload.choices?.[0]?.message?.content ?? "{}";
  let parsed: { sailings?: ParsedSailing[] };
  try {
    parsed = JSON.parse(raw) as { sailings?: ParsedSailing[] };
  } catch {
    throw new Error("The extractor returned an unreadable response");
  }
  return (parsed.sailings ?? []).filter(
    (s) => s && s.name && s.ship && s.cruiseLine && isDate(s.departureDate),
  );
}

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const timeOrNull = (v: unknown) =>
  typeof v === "string" && /^\d{1,2}:\d{2}$/.test(v.trim()) ? `${v.trim().padStart(5, "0")}:00` : null;

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function guessRegion(sailing: ParsedSailing): string {
  if (sailing.region?.trim()) return sailing.region.trim();
  const text = `${sailing.name} ${sailing.portCalls.map((c) => c.portName).join(" ")}`.toLowerCase();
  if (/norway|iceland|baltic|bergen|reykjav|copenhagen|stockholm/.test(text)) return "Northern Europe";
  if (/caribbean|bahamas|jamaica|cozumel/.test(text)) return "Caribbean";
  if (/alaska|juneau|ketchikan/.test(text)) return "Alaska";
  if (/dubrovnik|split|kotor|venice|adriatic/.test(text)) return "Adriatic";
  return "Mediterranean";
}

/** Upserts parsed sailings + port calls with the service-role client. */
export async function persistSailings(
  sailings: ParsedSailing[],
  source: string,
): Promise<ImportStats> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const stats: ImportStats = {
    sailingsCreated: 0,
    sailingsUpdated: 0,
    portCallsCreated: 0,
    portCallsUpdated: 0,
    linesTouched: [],
    shipsTouched: [],
    portsTouched: [],
    sailings: [],
  };

  const lineIds = new Map<string, string>();
  const shipIds = new Map<string, string>();
  const portIds = new Map<string, string>();

  const ensureLine = async (name: string) => {
    const slug = slugify(name);
    if (lineIds.has(slug)) return lineIds.get(slug)!;
    const existing = await supabaseAdmin.from("cruise_lines").select("id").eq("slug", slug).maybeSingle();
    let id = existing.data?.id as string | undefined;
    if (!id) {
      const inserted = await supabaseAdmin
        .from("cruise_lines")
        .insert({ name, slug, source, external_id: slug })
        .select("id")
        .single();
      if (inserted.error) throw new Error(inserted.error.message);
      id = inserted.data.id;
      stats.linesTouched.push(name);
    }
    lineIds.set(slug, id!);
    return id!;
  };

  const ensureShip = async (name: string, lineId: string) => {
    const slug = slugify(name);
    if (shipIds.has(slug)) return shipIds.get(slug)!;
    const existing = await supabaseAdmin.from("ships").select("id").eq("slug", slug).maybeSingle();
    let id = existing.data?.id as string | undefined;
    if (!id) {
      const inserted = await supabaseAdmin
        .from("ships")
        .insert({ name, slug, cruise_line_id: lineId, source, external_id: slug })
        .select("id")
        .single();
      if (inserted.error) throw new Error(inserted.error.message);
      id = inserted.data.id;
      stats.shipsTouched.push(name);
    }
    shipIds.set(slug, id!);
    return id!;
  };

  const ensurePort = async (name: string, country?: string | null) => {
    const slug = slugify(name);
    if (portIds.has(slug)) return portIds.get(slug)!;
    const existing = await supabaseAdmin.from("ports").select("id").eq("slug", slug).maybeSingle();
    let id = existing.data?.id as string | undefined;
    if (!id) {
      const inserted = await supabaseAdmin
        .from("ports")
        .insert({ name, slug, country: country?.trim() || "Unknown", source, external_id: slug })
        .select("id")
        .single();
      if (inserted.error) throw new Error(inserted.error.message);
      id = inserted.data.id;
      stats.portsTouched.push(name);
    }
    portIds.set(slug, id!);
    return id!;
  };

  for (const sailing of sailings) {
    const lineId = await ensureLine(sailing.cruiseLine.trim());
    const shipId = await ensureShip(sailing.ship.trim(), lineId);

    const calls = [...(sailing.portCalls ?? [])]
      .filter((c) => c && c.portName)
      .sort((a, b) => (a.dayNumber ?? 0) - (b.dayNumber ?? 0));

    const nights =
      sailing.nights && sailing.nights > 0
        ? sailing.nights
        : Math.max(1, (calls.at(-1)?.dayNumber ?? 1) - 1);
    const arrivalDate = isDate(sailing.arrivalDate) ? sailing.arrivalDate! : addDays(sailing.departureDate, nights);
    const externalId = `${slugify(sailing.ship)}-${sailing.departureDate}`;
    const slug = slugify(`${sailing.ship} ${sailing.name} ${sailing.departureDate}`);

    const existing = await supabaseAdmin
      .from("sailings")
      .select("id")
      .eq("source", source)
      .eq("external_id", externalId)
      .maybeSingle();

    const row = {
      ship_id: shipId,
      name: sailing.name.trim().slice(0, 160),
      region: guessRegion(sailing),
      departure_date: sailing.departureDate,
      arrival_date: arrivalDate,
      nights,
      description: sailing.description?.trim() || null,
      source,
      external_id: externalId,
    };

    let sailingId: string;
    if (existing.data?.id) {
      const updated = await supabaseAdmin
        .from("sailings")
        .update(row)
        .eq("id", existing.data.id)
        .select("id")
        .single();
      if (updated.error) throw new Error(updated.error.message);
      sailingId = updated.data.id;
      stats.sailingsUpdated += 1;
    } else {
      const inserted = await supabaseAdmin
        .from("sailings")
        .insert({ ...row, slug, is_published: true })
        .select("id")
        .single();
      if (inserted.error) throw new Error(inserted.error.message);
      sailingId = inserted.data.id;
      stats.sailingsCreated += 1;
    }

    let dayCursor = 0;
    for (const call of calls) {
      dayCursor = call.dayNumber && call.dayNumber > 0 ? call.dayNumber : dayCursor + 1;
      const isSeaDay = Boolean(call.isSeaDay) || /^(at sea|sea day|cruising)/i.test(call.portName);
      const portId = isSeaDay ? null : await ensurePort(call.portName.trim(), call.country);
      const callRow = {
        sailing_id: sailingId,
        port_id: portId,
        day_number: dayCursor,
        call_date: isDate(call.callDate) ? call.callDate! : addDays(sailing.departureDate, dayCursor - 1),
        arrival_time: isSeaDay ? null : timeOrNull(call.arrivalTime),
        departure_time: isSeaDay ? null : timeOrNull(call.departureTime),
        is_sea_day: isSeaDay,
      };

      const existingCall = await supabaseAdmin
        .from("sailing_port_calls")
        .select("id")
        .eq("sailing_id", sailingId)
        .eq("day_number", dayCursor)
        .maybeSingle();

      if (existingCall.data?.id) {
        const res = await supabaseAdmin
          .from("sailing_port_calls")
          .update(callRow)
          .eq("id", existingCall.data.id);
        if (res.error) throw new Error(res.error.message);
        stats.portCallsUpdated += 1;
      } else {
        const res = await supabaseAdmin.from("sailing_port_calls").insert(callRow);
        if (res.error) throw new Error(res.error.message);
        stats.portCallsCreated += 1;
      }
    }

    stats.sailings.push({
      name: row.name,
      ship: sailing.ship,
      line: sailing.cruiseLine,
      departureDate: sailing.departureDate,
      calls: calls.length,
    });
  }

  return stats;
}

/** Scrape → extract → persist for a single URL, recording an import run. */
export async function runImportForUrl(params: {
  url: string;
  sourceId?: string | null;
  trigger: string;
  cruiseLineHint?: string | null;
  sourceLabel?: string;
}): Promise<ImportStats & { runId: string | null }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const run = await supabaseAdmin
    .from("import_runs")
    .insert({
      source_id: params.sourceId ?? null,
      trigger: params.trigger,
      status: "running",
    })
    .select("id")
    .maybeSingle();
  const runId = run.data?.id ?? null;

  try {
    const markdown = await scrapeMarkdown(params.url);
    const sailings = await extractSailings({
      markdown,
      sourceUrl: params.url,
      cruiseLineHint: params.cruiseLineHint ?? null,
    });
    const stats = await persistSailings(sailings, params.sourceLabel || "firecrawl");

    if (runId) {
      await supabaseAdmin
        .from("import_runs")
        .update({
          status: sailings.length ? "success" : "empty",
          sailings_created: stats.sailingsCreated,
          sailings_updated: stats.sailingsUpdated,
          port_calls_created: stats.portCallsCreated,
          port_calls_updated: stats.portCallsUpdated,
          finished_at: new Date().toISOString(),
        })
        .eq("id", runId);
    }
    if (params.sourceId) {
      await supabaseAdmin
        .from("import_sources")
        .update({ last_run_at: new Date().toISOString() })
        .eq("id", params.sourceId);
    }

    return { ...stats, runId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Import failed";
    if (runId) {
      await supabaseAdmin
        .from("import_runs")
        .update({ status: "error", error: message, finished_at: new Date().toISOString() })
        .eq("id", runId);
    }
    throw new Error(message);
  }
}
