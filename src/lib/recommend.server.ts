import { createPublicClient } from "./supabase-public.server";
import type {
  Recommendation,
  RecommendationInput,
  RecommendationResult,
} from "./recommend.types";


type Candidate = Recommendation & { key: number };

/**
 * Builds the concrete port-call × excursion candidates the model may choose
 * from. Availability, pricing and identifiers are computed here so the model
 * never invents a bookable combination.
 */
async function loadCandidates(input: RecommendationInput): Promise<Candidate[]> {
  const supabase = createPublicClient();
  const today = new Date().toISOString().slice(0, 10);
  const from = input.from && input.from > today ? input.from : today;

  let callQuery = supabase
    .from("sailing_port_calls")
    .select(
      "id, call_date, arrival_time, departure_time, port_id, ports!inner(name, slug), sailings!inner(name, slug, is_published)",
    )
    .eq("is_sea_day", false)
    .eq("sailings.is_published", true)
    .gte("call_date", from)
    .order("call_date")
    .limit(60);

  if (input.to) callQuery = callQuery.lte("call_date", input.to);
  if (input.sailingSlug) callQuery = callQuery.eq("sailings.slug", input.sailingSlug);
  if (input.portSlug) callQuery = callQuery.eq("ports.slug", input.portSlug);

  const { data: calls } = await callQuery;
  const portCalls = (calls ?? []).filter((c) => c.port_id);
  if (!portCalls.length) return [];

  const portIds = [...new Set(portCalls.map((c) => c.port_id as string))];
  const { data: excursions } = await supabase
    .from("excursions")
    .select(
      "id, title, slug, summary, category, difficulty, duration_minutes, price, currency, capacity, image_url, port_id, wheelchair_accessible",
    )
    .eq("is_published", true)
    .in("port_id", portIds)
    .limit(240);

  const tours = excursions ?? [];
  if (!tours.length) return [];

  // Remaining seats per excursion + date, ignoring expired holds.
  const { data: booked } = await supabase
    .from("bookings")
    .select("excursion_id, tour_date, party_size, status, expires_at")
    .in(
      "excursion_id",
      tours.map((t) => t.id),
    )
    .in("status", ["reserved", "confirmed"])
    .gte("tour_date", from);

  const now = Date.now();
  const taken = new Map<string, number>();
  for (const row of booked ?? []) {
    if (row.status === "reserved" && row.expires_at && new Date(row.expires_at).getTime() < now) {
      continue;
    }
    const key = `${row.excursion_id}|${row.tour_date}`;
    taken.set(key, (taken.get(key) ?? 0) + row.party_size);
  }

  const candidates: Candidate[] = [];
  let key = 1;
  for (const call of portCalls) {
    const portTours = tours.filter((t) => t.port_id === call.port_id).slice(0, 8);
    for (const tour of portTours) {
      const seatsLeft = tour.capacity - (taken.get(`${tour.id}|${call.call_date}`) ?? 0);
      if (seatsLeft < input.party) continue;
      candidates.push({
        key: key++,
        reason: "",
        excursionTitle: tour.title,
        excursionSlug: tour.slug,
        portName: call.ports.name,
        sailingName: call.sailings.name,
        sailingSlug: call.sailings.slug,
        date: call.call_date,
        arrivalTime: call.arrival_time,
        departureTime: call.departure_time,
        durationMinutes: tour.duration_minutes,
        price: Number(tour.price),
        currency: tour.currency,
        imageUrl: tour.image_url,
        seatsLeft,
        bookHref: `/booking/${tour.slug}?portCall=${call.id}&party=${input.party}`,
      });
      if (candidates.length >= 90) return candidates;
    }
  }
  return candidates;
}

function candidateLine(c: Candidate, extra: string): string {
  return `#${c.key} | ${c.excursionTitle} | port: ${c.portName} | day: ${c.date}${
    c.arrivalTime || c.departureTime
      ? ` (ashore ${c.arrivalTime?.slice(0, 5) ?? "—"}–${c.departureTime?.slice(0, 5) ?? "—"})`
      : ""
  } | ${Math.round(c.durationMinutes / 60)}h | ${c.price} ${c.currency} per guest | seats left: ${c.seatsLeft} | sailing: ${c.sailingName}${extra}`;
}

const SYSTEM = `You are the Shore Hopper Concierge planning shore excursions for a cruise passenger.
You are given the guest's goals and a numbered list of REAL, currently bookable options (port call day × tour).
Choose the 3 best-fitting options — favour variety of ports/days, respect stated interests, pace, mobility and budget, and never choose an option that is not in the list.
Return STRICT JSON: {"intro": string, "picks": [{"key": number, "reason": string}]}.
"intro" is one warm sentence (max 30 words). Each "reason" is max 25 words, concrete, referencing why it matches the goals and the time ashore. Plain text only.`;

export async function recommendFromGoals(
  input: RecommendationInput,
): Promise<RecommendationResult> {
  const candidates = await loadCandidates(input);
  if (!candidates.length) {
    return {
      intro:
        "I couldn't find bookable tours for that combination yet — try a different sailing, port or date range.",
      suggestions: [],
    };
  }

  const apiKey = process.env["LOVABLE_API_KEY"];
  const fallback = (intro: string): RecommendationResult => ({
    intro,
    suggestions: candidates.slice(0, 3).map((c) => ({
      ...c,
      reason: `${Math.round(c.durationMinutes / 60)} hours ashore in ${c.portName}, with ${c.seatsLeft} places still open.`,
    })),
  });

  if (!apiKey) return fallback("Here are three tours that fit your dates.");

  const list = candidates.map((c) => candidateLine(c, "")).join("\n");
  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM },
        {
          role: "user",
          content: `GUEST GOALS: ${input.goals}\nPARTY SIZE: ${input.party}\n\nOPTIONS:\n${list}`,
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) return fallback("Here are three tours that fit your dates.");

  const payload = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  try {
    const parsed = JSON.parse(payload.choices?.[0]?.message?.content ?? "") as {
      intro?: string;
      picks?: { key?: number; reason?: string }[];
    };
    const picks = (parsed.picks ?? [])
      .map((p) => {
        const match = candidates.find((c) => c.key === p.key);
        return match ? { ...match, reason: p.reason?.trim() || "" } : null;
      })
      .filter((p): p is Candidate => Boolean(p))
      .slice(0, 3);
    if (!picks.length) return fallback(parsed.intro || "Here are three tours that fit your dates.");
    return { intro: parsed.intro || "Here is what I would book for you.", suggestions: picks };
  } catch {
    return fallback("Here are three tours that fit your dates.");
  }
}
