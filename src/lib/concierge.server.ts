import { createPublicClient } from "./supabase-public.server";

export type ConciergeLink = { label: string; href: string };
export type ConciergeAnswer = { answer: string; links: ConciergeLink[] };
export type ChatMessage = { role: "user" | "assistant"; content: string };

/** Compact, link-annotated snapshot of the live catalogue the assistant may cite. */
export async function loadCatalogueContext() {
  const supabase = createPublicClient();
  const today = new Date().toISOString().slice(0, 10);

  const [{ data: sailings }, { data: ports }, { data: excursions }] = await Promise.all([
    supabase
      .from("sailings")
      .select(
        "name, slug, region, departure_date, arrival_date, nights, ships!inner(name, cruise_lines!inner(name))",
      )
      .eq("is_published", true)
      .gte("departure_date", today)
      .order("departure_date")
      .limit(40),
    supabase.from("ports").select("name, slug, country, region").order("name").limit(60),
    supabase
      .from("excursions")
      .select(
        "title, slug, price, currency, duration_minutes, category, difficulty, ports!inner(name, slug)",
      )
      .eq("is_published", true)
      .order("title")
      .limit(160),
  ]);

  const sailingLines = (sailings ?? []).map(
    (s) =>
      `SAILING | ${s.name} | ${s.ships.cruise_lines.name} · ${s.ships.name} | ${s.region} | ${s.departure_date} → ${s.arrival_date} (${s.nights} nights) | /cruises/${s.slug}`,
  );
  const portLines = (ports ?? []).map(
    (p) => `PORT | ${p.name}, ${p.country}${p.region ? ` (${p.region})` : ""} | /ports/${p.slug}`,
  );
  const excursionLines = (excursions ?? []).map(
    (e) =>
      `TOUR | ${e.title} | port: ${e.ports.name} | ${e.price} ${e.currency} | ${e.duration_minutes} min${e.category ? ` | ${e.category}` : ""} | /excursions/${e.slug}`,
  );

  return [...sailingLines, ...portLines, ...excursionLines].join("\n");
}

const SYSTEM = `You are the Shore Hopper Concierge, an elegant and precise assistant for cruise passengers.
Shore Hopper does NOT sell cruises; it sells shore excursions in the ports the cruises call at.

Rules:
- Answer ONLY from the CATALOGUE and MY RESERVATIONS blocks below. If something is not there, say you cannot see it and suggest the closest option that is.
- Keep answers short (max ~120 words), warm and premium in tone. Plain text, no markdown links.
- Always surface the relevant pages in "links", using ONLY paths that appear verbatim in the blocks (e.g. /excursions/xyz, /ports/xyz, /cruises/xyz). For a passenger's own reservation use /account/bookings/<REFERENCE>.
- Reservation statuses: "reserved" = awaiting payment (hold expires), "confirmed" = paid and secured, "cancelled" = cancelled, "refunded" = money returned. Refund requests are reviewed by our team.
- Return STRICT JSON: {"answer": string, "links": [{"label": string, "href": string}]} with at most 4 links.`;

export async function askGateway(params: {
  messages: ChatMessage[];
  bookingsBlock?: string;
}): Promise<ConciergeAnswer> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) return { answer: "The concierge is unavailable right now.", links: [] };

  const catalogue = await loadCatalogueContext();
  const context = `CATALOGUE:\n${catalogue}\n\nMY RESERVATIONS:\n${params.bookingsBlock || "(the guest is not signed in or has no reservations)"}`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "system", content: context },
        ...params.messages.slice(-8),
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    if (response.status === 429) {
      return { answer: "The concierge is busy at the moment — please try again shortly.", links: [] };
    }
    return { answer: "The concierge could not answer just now. Please try again.", links: [] };
  }

  const payload = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const raw = payload.choices?.[0]?.message?.content ?? "";
  try {
    const parsed = JSON.parse(raw) as ConciergeAnswer;
    const links = (parsed.links ?? [])
      .filter((l) => typeof l?.href === "string" && l.href.startsWith("/"))
      .slice(0, 4);
    return { answer: parsed.answer || "I'm not sure how to help with that yet.", links };
  } catch {
    return { answer: raw || "I'm not sure how to help with that yet.", links: [] };
  }
}
