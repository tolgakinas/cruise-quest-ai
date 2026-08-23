import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createPublicClient } from "./supabase-public.server";

const SearchInput = z.object({
  q: z.string().nullable().default(null),
  cruiseLine: z.string().nullable().default(null),
  ship: z.string().nullable().default(null),
  region: z.string().nullable().default(null),
  port: z.string().nullable().default(null),
  from: z.string().nullable().default(null),
  to: z.string().nullable().default(null),
});

export type SailingSearchInput = z.infer<typeof SearchInput>;

export const searchSailings = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => SearchInput.parse(input ?? {}))
  .handler(async ({ data }) => {
    const supabase = createPublicClient();

    let portSailingIds: string[] | null = null;
    if (data.port) {
      const { data: calls } = await supabase
        .from("sailing_port_calls")
        .select("sailing_id, ports!inner(slug)")
        .eq("ports.slug", data.port);
      portSailingIds = [...new Set((calls ?? []).map((c) => c.sailing_id))];
      if (portSailingIds.length === 0) return [];
    }

    let query = supabase
      .from("sailings")
      .select(
        "id, name, slug, region, departure_date, arrival_date, nights, starting_price, description, ships!inner(id, name, slug, cruise_lines!inner(id, name, slug))",
      )
      .eq("is_published", true)
      .order("departure_date", { ascending: true });

    if (data.region) query = query.eq("region", data.region);
    if (data.from) query = query.gte("departure_date", data.from);
    if (data.to) query = query.lte("departure_date", data.to);
    if (data.ship) query = query.eq("ships.slug", data.ship);
    if (data.cruiseLine) query = query.eq("ships.cruise_lines.slug", data.cruiseLine);
    if (portSailingIds) query = query.in("id", portSailingIds);
    if (data.q) query = query.ilike("name", `%${data.q}%`);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getSearchFacets = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createPublicClient();
  const [lines, ships, ports, sailings] = await Promise.all([
    supabase.from("cruise_lines").select("id, name, slug").order("name"),
    supabase.from("ships").select("id, name, slug, cruise_line_id").order("name"),
    supabase.from("ports").select("id, name, slug, country, region").order("name"),
    supabase.from("sailings").select("region").eq("is_published", true),
  ]);
  const regions = [...new Set((sailings.data ?? []).map((s) => s.region))].sort();
  return {
    cruiseLines: lines.data ?? [],
    ships: ships.data ?? [],
    ports: ports.data ?? [],
    regions,
  };
});

export const getSailing = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ slug: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const supabase = createPublicClient();
    const { data: sailing, error } = await supabase
      .from("sailings")
      .select(
        "id, name, slug, region, departure_date, arrival_date, nights, starting_price, description, ships!inner(id, name, slug, capacity, year_built, description, cruise_lines!inner(id, name, slug, description))",
      )
      .eq("slug", data.slug)
      .eq("is_published", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!sailing) return null;

    const { data: calls } = await supabase
      .from("sailing_port_calls")
      .select(
        "id, day_number, call_date, arrival_time, departure_time, is_sea_day, notes, ports(id, name, slug, country, region, description)",
      )
      .eq("sailing_id", sailing.id)
      .order("day_number");

    const portIds = [...new Set((calls ?? []).map((c) => c.ports?.id).filter(Boolean))] as string[];
    const { data: excursions } = portIds.length
      ? await supabase
          .from("excursions")
          .select(
            "id, title, slug, summary, duration_minutes, price, currency, category, difficulty, port_id, image_url",
          )
          .in("port_id", portIds)
          .eq("is_published", true)
          .order("price")
      : { data: [] };

    return { sailing, calls: calls ?? [], excursions: excursions ?? [] };
  });

export const getPort = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ slug: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const supabase = createPublicClient();
    const { data: port } = await supabase
      .from("ports")
      .select("id, name, slug, country, region, description")
      .eq("slug", data.slug)
      .maybeSingle();
    if (!port) return null;

    const [{ data: excursions }, { data: calls }] = await Promise.all([
      supabase
        .from("excursions")
        .select(
          "id, title, slug, summary, duration_minutes, price, currency, category, difficulty, capacity, image_url",
        )
        .eq("port_id", port.id)
        .eq("is_published", true)
        .order("price"),
      supabase
        .from("sailing_port_calls")
        .select(
          "id, day_number, call_date, arrival_time, departure_time, sailings!inner(id, name, slug, region, is_published)",
        )
        .eq("port_id", port.id)
        .order("call_date"),
    ]);

    return {
      port,
      excursions: excursions ?? [],
      calls: (calls ?? []).filter((c) => c.sailings?.is_published),
    };
  });

export const getExcursion = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ slug: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const supabase = createPublicClient();
    const { data: excursion } = await supabase
      .from("excursions")
      .select(
        "id, title, slug, summary, description, duration_minutes, price, currency, capacity, meeting_point, category, difficulty, image_url, ports!inner(id, name, slug, country, region, description)",
      )
      .eq("slug", data.slug)
      .eq("is_published", true)
      .maybeSingle();
    if (!excursion) return null;

    const { data: calls } = await supabase
      .from("sailing_port_calls")
      .select(
        "id, call_date, arrival_time, departure_time, day_number, sailings!inner(id, name, slug, is_published)",
      )
      .eq("port_id", excursion.ports.id)
      .order("call_date");

    return { excursion, calls: (calls ?? []).filter((c) => c.sailings?.is_published) };
  });

export const getHomeShowcase = createServerFn({ method: "GET" }).handler(async () => {
  const supabase = createPublicClient();
  const [sailings, excursions, ports] = await Promise.all([
    supabase
      .from("sailings")
      .select(
        "id, name, slug, region, departure_date, arrival_date, nights, starting_price, description, ships!inner(name, slug, cruise_lines!inner(name, slug))",
      )
      .eq("is_published", true)
      .order("departure_date")
      .limit(3),
    supabase
      .from("excursions")
      .select(
        "id, title, slug, summary, price, currency, duration_minutes, category, image_url, ports!inner(name, slug, country)",
      )
      .eq("is_published", true)
      .order("price", { ascending: false })
      .limit(6),
    supabase.from("ports").select("id, name, slug, country, region").order("name").limit(8),
  ]);
  return {
    sailings: sailings.data ?? [],
    excursions: excursions.data ?? [],
    ports: ports.data ?? [],
  };
});
