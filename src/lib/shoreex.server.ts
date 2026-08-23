import { slugify } from "./admin-guard";

/**
 * Shore Excursions Group timetable importer.
 *
 * The cruise finder on shoreexcursionsgroup.com exposes every cruise line,
 * ship and sail date, and each sailing has a server-rendered itinerary page at
 * `/results/?line=..&shipId=..&arrival=..&nights=..` listing the port-by-port
 * schedule with arrival and departure times.
 *
 * Sailings are seeded with their finder ids, then this module drains the
 * `shoreex_itinerary_queue` in batches: fetch the itinerary page, parse the day
 * rows, upsert ports + `sailing_port_calls`, and refine the sailing itself
 * (name, region, embark/disembark ports). No AI extraction needed — the markup
 * is deterministic — so it is cheap enough to keep refreshing hourly.
 */

const SOURCE = "shoreexcursionsgroup";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export type ParsedDay = {
  dayNumber: number;
  callDate: string | null;
  portName: string;
  country: string | null;
  arrivalTime: string | null;
  departureTime: string | null;
  isSeaDay: boolean;
};

export type ShoreexBatchResult = {
  processed: number;
  failed: number;
  remaining: number;
  portsCreated: number;
  portCallsCreated: number;
  portCallsUpdated: number;
  sailings: { label: string; ok: boolean; detail: string }[];
};

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

function decode(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#0?39;|&apos;|&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function to24h(raw: string): string | null {
  const match = raw.trim().toLowerCase().match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2]);
  if (Number.isNaN(hour) || Number.isNaN(minute) || minute > 59) return null;
  if (match[3] === "pm" && hour < 12) hour += 12;
  if (match[3] === "am" && hour === 12) hour = 0;
  if (hour > 23) return null;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function isoDate(monthLabel: string, day: number, startDate: string): string | null {
  const month = MONTHS[monthLabel.slice(0, 3).toLowerCase()];
  if (!month || !day) return null;
  const startYear = Number(startDate.slice(0, 4));
  const startMonth = Number(startDate.slice(5, 7));
  // Itineraries can roll over into the next year (Dec -> Jan).
  const year = month < startMonth ? startYear + 1 : startYear;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Extracts the day-by-day itinerary from a Shore Excursions Group results page. */
export function parseItineraryHtml(html: string, departureDate: string): ParsedDay[] {
  const text = decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, "\n"),
  );
  // Normalised stream looks like: "Aug 19 Sydney, Australia Arrive: 12:00 am Depart: 3:30 pm"
  const pattern =
    /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{1,2})\s+(?:(At Sea)|([^|]{2,80}?)\s+Arrive:\s*([\d:]{3,5}\s*[ap]m)\s*Depart:\s*([\d:]{3,5}\s*[ap]m))(?=\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}\s|\s+View Excursions|\s+Post|\s+Share Page|\s+My Itinerary|$)/gi;

  const days: ParsedDay[] = [];
  for (const match of text.matchAll(pattern)) {
    const callDate = isoDate(match[1]!, Number(match[2]), departureDate);
    if (match[3]) {
      days.push({
        dayNumber: days.length + 1,
        callDate,
        portName: "At Sea",
        country: null,
        arrivalTime: null,
        departureTime: null,
        isSeaDay: true,
      });
      continue;
    }
    const label = (match[4] ?? "").trim();
    if (!label || /excursion|itinerary|cruise line|sail date/i.test(label)) continue;
    const bits = label.split(",").map((b) => b.trim()).filter(Boolean);
    const country = bits.length > 1 ? bits[bits.length - 1]! : null;
    const portName = bits.length > 1 ? bits.slice(0, -1).join(", ") : label;
    days.push({
      dayNumber: days.length + 1,
      callDate,
      portName,
      country,
      arrivalTime: to24h(match[5] ?? ""),
      departureTime: to24h(match[6] ?? ""),
      isSeaDay: false,
    });
  }
  return days;
}

function regionFor(days: ParsedDay[]): string | null {
  const countries = days
    .map((d) => (d.country ?? "").toLowerCase())
    .filter(Boolean)
    .join(" ");
  const rules: [RegExp, string][] = [
    [/alaska|juneau|ketchikan|skagway/, "Alaska"],
    [/bahamas|jamaica|barbados|st\.? |aruba|cayman|antigua|lucia|maarten|kitts|dominica|curacao/, "Caribbean"],
    [/mexico|belize|honduras|costa rica|panama/, "Mexican Riviera & Central America"],
    [/norway|iceland|denmark|sweden|finland|estonia|latvia|germany/, "Northern Europe"],
    [/greece|italy|spain|turkey|croatia|malta|france|portugal|montenegro|cyprus/, "Mediterranean"],
    [/japan|china|korea|vietnam|thailand|singapore|malaysia|philippines|taiwan/, "Asia"],
    [/australia|new zealand|vanuatu|caledonia|fiji|samoa|tahiti|polynesia/, "Australia, New Zealand & South Pacific"],
    [/united arab|emirates|oman|qatar|saudi|bahrain/, "Arabian Gulf"],
    [/canada|united states|usa|bermuda/, "Canada, New England & USA"],
    [/brazil|argentina|chile|peru|uruguay|colombia|ecuador/, "South America"],
    [/south africa|namibia|morocco|senegal|kenya|tanzania|egypt/, "Africa"],
  ];
  for (const [pattern, region] of rules) if (pattern.test(countries)) return region;
  return null;
}

type QueueRow = { id: string; sailing_id: string; url: string; attempts: number };

/** Fetches + persists the itinerary for a batch of queued sailings. */
export async function runShoreexBatch(params: {
  limit?: number;
  trigger?: string;
}): Promise<ShoreexBatchResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const limit = Math.min(Math.max(params.limit ?? 15, 1), 60);

  const { data: queue, error } = await supabaseAdmin
    .from("shoreex_itinerary_queue")
    .select("id, sailing_id, url, attempts")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);

  const result: ShoreexBatchResult = {
    processed: 0,
    failed: 0,
    remaining: 0,
    portsCreated: 0,
    portCallsCreated: 0,
    portCallsUpdated: 0,
    sailings: [],
  };

  const portIds = new Map<string, string>();
  const ensurePort = async (name: string, country: string | null) => {
    const slug = slugify(name);
    if (portIds.has(slug)) return portIds.get(slug)!;
    const existing = await supabaseAdmin.from("ports").select("id").eq("slug", slug).maybeSingle();
    let id = existing.data?.id as string | undefined;
    if (!id) {
      const inserted = await supabaseAdmin
        .from("ports")
        .insert({
          name,
          slug,
          country: country?.trim() || "Unknown",
          source: SOURCE,
          external_id: `seg-${slug}`,
        })
        .select("id")
        .single();
      if (inserted.error) throw new Error(inserted.error.message);
      id = inserted.data.id as string;
      result.portsCreated += 1;
    }
    portIds.set(slug, id);
    return id;
  };

  for (const row of (queue ?? []) as QueueRow[]) {
    try {
      const sailing = await supabaseAdmin
        .from("sailings")
        .select("id, name, departure_date, nights, region, ships(name)")
        .eq("id", row.sailing_id)
        .maybeSingle();
      if (sailing.error) throw new Error(sailing.error.message);
      if (!sailing.data) throw new Error("sailing no longer exists");

      const response = await fetch(row.url, { headers: { "User-Agent": UA } });
      if (!response.ok) throw new Error(`itinerary fetch failed [${response.status}]`);
      const html = await response.text();
      const days = parseItineraryHtml(html, sailing.data.departure_date as string);
      if (!days.length) throw new Error("no itinerary rows on this page");

      let firstPortId: string | null = null;
      let lastPortId: string | null = null;
      for (const day of days) {
        const portId = day.isSeaDay ? null : await ensurePort(day.portName, day.country);
        if (portId) {
          if (!firstPortId) firstPortId = portId;
          lastPortId = portId;
        }
        const callRow = {
          sailing_id: row.sailing_id,
          port_id: portId,
          day_number: day.dayNumber,
          call_date: day.callDate ?? (sailing.data.departure_date as string),
          arrival_time: day.arrivalTime,
          departure_time: day.departureTime,
          is_sea_day: day.isSeaDay,
        };
        const existingCall = await supabaseAdmin
          .from("sailing_port_calls")
          .select("id")
          .eq("sailing_id", row.sailing_id)
          .eq("day_number", day.dayNumber)
          .maybeSingle();
        if (existingCall.data?.id) {
          const res = await supabaseAdmin
            .from("sailing_port_calls")
            .update(callRow)
            .eq("id", existingCall.data.id);
          if (res.error) throw new Error(res.error.message);
          result.portCallsUpdated += 1;
        } else {
          const res = await supabaseAdmin.from("sailing_port_calls").insert(callRow);
          if (res.error) throw new Error(res.error.message);
          result.portCallsCreated += 1;
        }
      }

      const named = days.filter((d) => !d.isSeaDay);
      const shipName = (sailing.data as { ships?: { name?: string } }).ships?.name ?? "";
      const nights = (sailing.data.nights as number) ?? days.length - 1;
      const name = named.length
        ? `${nights}-Night ${named[0]!.portName} to ${named[named.length - 1]!.portName}`
        : (sailing.data.name as string);
      const region = regionFor(days);

      const update = await supabaseAdmin
        .from("sailings")
        .update({
          name: name.slice(0, 160),
          ...(region ? { region } : {}),
          departure_port_id: firstPortId,
          arrival_port_id: lastPortId,
        })
        .eq("id", row.sailing_id);
      if (update.error) throw new Error(update.error.message);

      await supabaseAdmin
        .from("shoreex_itinerary_queue")
        .update({ status: "done", fetched_at: new Date().toISOString(), last_error: null })
        .eq("id", row.id);

      result.processed += 1;
      result.sailings.push({
        label: `${shipName} ${sailing.data.departure_date}`,
        ok: true,
        detail: `${days.length} days, ${named.length} port calls`,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "itinerary import failed";
      const attempts = row.attempts + 1;
      await supabaseAdmin
        .from("shoreex_itinerary_queue")
        .update({
          attempts,
          last_error: message.slice(0, 400),
          fetched_at: new Date().toISOString(),
          // Stop retrying a stubborn page so the queue keeps moving.
          status: attempts >= 4 ? "failed" : "pending",
        })
        .eq("id", row.id);
      result.failed += 1;
      result.sailings.push({ label: row.url, ok: false, detail: message.slice(0, 200) });
    }
  }

  const { count } = await supabaseAdmin
    .from("shoreex_itinerary_queue")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  result.remaining = count ?? 0;

  return result;
}

/* ------------------------------------------------------------------ *
 * Catalogue discovery: cruise lines, ships and sail dates
 * ------------------------------------------------------------------ */

const SELECT_URL = "https://www.shoreexcursionsgroup.com/select";

export type ShoreexCatalog = {
  lines: { id: string; name: string }[];
  ships: { id: string; lineId: string; name: string }[];
  itineraries: Record<string, string[]>;
};

function jsVar(script: string, name: string): unknown {
  const match = new RegExp(`var\\s+${name}\\s*=\\s*("(?:\\\\.|[^"\\\\])*")\\s*;`).exec(script);
  if (!match) throw new Error(`could not find "${name}" in the cruise finder page`);
  // The page double-encodes the payload and uses \' inside it, which JSON rejects.
  const outer = JSON.parse(match[1]!.replace(/\\'/g, "'")) as string;
  return JSON.parse(outer);
}

/** Downloads the cruise finder page and parses its embedded catalogue. */
export async function fetchShoreexCatalog(): Promise<ShoreexCatalog> {
  const response = await fetch(SELECT_URL, { headers: { "User-Agent": UA } });
  if (!response.ok) throw new Error(`cruise finder fetch failed [${response.status}]`);
  const html = await response.text();

  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map((m) => m[1] ?? "");
  const script = scripts.sort((a, b) => b.length - a.length)[0] ?? "";

  const lineSelect = /<select[^>]*name="line"[\s\S]*?<\/select>/i.exec(html)?.[0] ?? "";
  const lines = [...lineSelect.matchAll(/<option value="(\d+)"[^>]*>([^<]+)<\/option>/gi)]
    .map((m) => ({ id: m[1]!, name: decode(m[2]!) }))
    .filter((l) => l.name && !/^my /i.test(l.name));

  const shipsByLine = jsVar(script, "ships") as Record<string, Record<string, string>>;
  const shipItin = jsVar(script, "shipItin") as Record<string, Record<string, string>>;

  const ships: { id: string; lineId: string; name: string }[] = [];
  for (const [lineId, entries] of Object.entries(shipsByLine)) {
    for (const [rawId, rawName] of Object.entries(entries)) {
      const name = decode(rawName);
      if (name) ships.push({ id: rawId.replace(/^_/, ""), lineId, name });
    }
  }

  const itineraries: Record<string, string[]> = {};
  for (const [rawId, dates] of Object.entries(shipItin)) {
    itineraries[rawId.replace(/^_/, "")] = Object.keys(dates);
  }

  return { lines, ships, itineraries };
}

export type CatalogSyncResult = {
  linesUpserted: number;
  shipsProcessed: number;
  shipsTotal: number;
  sailingsCreated: number;
  queued: number;
  nextOffset: number | null;
};

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Upserts cruise lines plus a slice of ships and their sail dates for the given
 * years, queuing every new sailing for itinerary fetching. Sliced so each
 * request stays inside the worker time budget; call repeatedly with
 * `nextOffset` until it returns null.
 */
export async function syncShoreexCatalog(params: {
  years?: number[];
  offset?: number;
  limit?: number;
}): Promise<CatalogSyncResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const years = params.years?.length ? params.years : [2026, 2027, 2028];
  const offset = Math.max(params.offset ?? 0, 0);
  const limit = Math.min(Math.max(params.limit ?? 8, 1), 40);

  const catalog = await fetchShoreexCatalog();
  const lineNames = new Map(catalog.lines.map((l) => [l.id, l.name]));

  const result: CatalogSyncResult = {
    linesUpserted: 0,
    shipsProcessed: 0,
    shipsTotal: catalog.ships.length,
    sailingsCreated: 0,
    queued: 0,
    nextOffset: null,
  };

  if (offset === 0) {
    const rows = catalog.lines.map((l) => ({
      name: l.name,
      slug: slugify(l.name),
      source: SOURCE,
      external_id: `seg-line-${l.id}`,
    }));
    const res = await supabaseAdmin.from("cruise_lines").upsert(rows, { onConflict: "slug" });
    if (res.error) throw new Error(res.error.message);
    result.linesUpserted = rows.length;
  }

  const lineIds = new Map<string, string>();
  const { data: lineRows } = await supabaseAdmin.from("cruise_lines").select("id, slug");
  for (const row of lineRows ?? []) lineIds.set(row.slug as string, row.id as string);

  const slice = catalog.ships
    .filter((s) => lineNames.has(s.lineId))
    .slice(offset, offset + limit);

  for (const ship of slice) {
    const lineName = lineNames.get(ship.lineId)!;
    const lineId = lineIds.get(slugify(lineName));
    if (!lineId) continue;

    const shipSlug = slugify(ship.name);
    const upserted = await supabaseAdmin
      .from("ships")
      .upsert(
        {
          name: ship.name,
          slug: shipSlug,
          cruise_line_id: lineId,
          source: SOURCE,
          external_id: `seg-ship-${ship.lineId}-${ship.id}`,
        },
        { onConflict: "slug" },
      )
      .select("id")
      .maybeSingle();
    if (upserted.error) throw new Error(upserted.error.message);
    const shipId = upserted.data?.id as string | undefined;
    if (!shipId) continue;

    const sailingRows: Record<string, unknown>[] = [];
    for (const key of catalog.itineraries[ship.id] ?? []) {
      const match = /^(\d{4})-(\d{2})-(\d{2})-(\d+)$/.exec(key);
      if (!match) continue;
      const year = Number(match[1]);
      const nights = Number(match[4]);
      if (!years.includes(year) || !nights) continue;
      const departure = `${match[1]}-${match[2]}-${match[3]}`;
      sailingRows.push({
        ship_id: shipId,
        name: `${nights}-Night Cruise`,
        slug: slugify(`${ship.name}-${departure}-${nights}n`),
        region: "Worldwide",
        departure_date: departure,
        arrival_date: addDays(departure, nights),
        nights,
        source: SOURCE,
        external_id: `seg-${ship.lineId}-${ship.id}-${departure}-${nights}`,
        is_published: true,
      });
    }

    for (let i = 0; i < sailingRows.length; i += 200) {
      const chunk = sailingRows.slice(i, i + 200);
      const inserted = await supabaseAdmin
        .from("sailings")
        .upsert(chunk as never, { onConflict: "slug", ignoreDuplicates: true })
        .select("id, external_id");
      if (inserted.error) throw new Error(inserted.error.message);
      const created = inserted.data ?? [];
      result.sailingsCreated += created.length;

      const queueRows = created
        .map((row) => {
          const ext = String((row as { external_id: string }).external_id);
          const parts = ext.replace(/^seg-/, "").split("-");
          const [line, shipRef, y, m, d, nights] = parts;
          return {
            sailing_id: (row as { id: string }).id,
            url: `https://www.shoreexcursionsgroup.com/results/?line=${line}&shipId=${shipRef}&arrival=${y}-${m}-${d}&nights=${nights}`,
          };
        })
        .filter((r) => r.url.includes("nights="));
      if (queueRows.length) {
        const queued = await supabaseAdmin
          .from("shoreex_itinerary_queue")
          .upsert(queueRows as never, { onConflict: "sailing_id", ignoreDuplicates: true });
        if (queued.error) throw new Error(queued.error.message);
        result.queued += queueRows.length;
      }
    }

    result.shipsProcessed += 1;
  }

  const consumed = offset + slice.length;
  const eligible = catalog.ships.filter((s) => lineNames.has(s.lineId)).length;
  result.nextOffset = consumed < eligible ? consumed : null;
  return result;
}
