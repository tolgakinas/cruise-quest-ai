import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, slugify } from "./admin-guard";

const uuid = z.string().uuid();
const optionalText = z.string().trim().max(2000).optional().or(z.literal(""));

/** Admin: everything needed by the cruise-data screens in one round trip. */
export const getAdminCatalog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const supabase = context.supabase;

    const [lines, ships, sailings, ports] = await Promise.all([
      supabase.from("cruise_lines").select("id, name, slug, description, logo_url, source").order("name"),
      supabase
        .from("ships")
        .select("id, name, slug, capacity, year_built, cruise_line_id, source, cruise_lines(name)")
        .order("name"),
      supabase
        .from("sailings")
        .select(
          "id, name, slug, region, departure_date, arrival_date, nights, starting_price, is_published, source, ship_id, departure_port_id, arrival_port_id, ships(name, cruise_lines(name))",
        )
        .order("departure_date", { ascending: false })
        .limit(300),
      supabase.from("ports").select("id, name, slug, country, region, description, image_url, source").order("name"),
    ]);

    return {
      cruiseLines: lines.data ?? [],
      ships: ships.data ?? [],
      sailings: sailings.data ?? [],
      ports: ports.data ?? [],
    };
  });

const CruiseLineInput = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(2).max(120),
  description: optionalText,
  logo_url: optionalText,
});

export const upsertCruiseLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CruiseLineInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const row = {
      name: data.name,
      slug: slugify(data.name),
      description: data.description || null,
      logo_url: data.logo_url || null,
      source: "manual",
    };
    const query = data.id
      ? context.supabase.from("cruise_lines").update(row).eq("id", data.id)
      : context.supabase.from("cruise_lines").insert(row);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const ShipInput = z.object({
  id: uuid.optional(),
  cruise_line_id: uuid,
  name: z.string().trim().min(2).max(120),
  capacity: z.number().int().min(0).max(10000).nullable().default(null),
  year_built: z.number().int().min(1900).max(2100).nullable().default(null),
  description: optionalText,
});

export const upsertShip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ShipInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const row = {
      cruise_line_id: data.cruise_line_id,
      name: data.name,
      slug: slugify(data.name),
      capacity: data.capacity,
      year_built: data.year_built,
      description: data.description || null,
      source: "manual",
    };
    const query = data.id
      ? context.supabase.from("ships").update(row).eq("id", data.id)
      : context.supabase.from("ships").insert(row);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const PortInput = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(2).max(120),
  country: z.string().trim().min(2).max(80),
  region: optionalText,
  description: optionalText,
  image_url: optionalText,
});

export const upsertPort = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PortInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const row = {
      name: data.name,
      slug: slugify(data.name),
      country: data.country,
      region: data.region || null,
      description: data.description || null,
      image_url: data.image_url || null,
      source: "manual",
    };
    const query = data.id
      ? context.supabase.from("ports").update(row).eq("id", data.id)
      : context.supabase.from("ports").insert(row);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePort = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("ports").delete().eq("id", data.id);
    if (error) throw new Error("This port is still used by sailings or excursions.");
    return { ok: true };
  });

const SailingInput = z.object({
  id: uuid.optional(),
  ship_id: uuid,
  name: z.string().trim().min(2).max(160),
  region: z.string().trim().min(2).max(80),
  departure_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  arrival_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  departure_port_id: uuid.nullable().default(null),
  arrival_port_id: uuid.nullable().default(null),
  starting_price: z.number().min(0).max(1000000).nullable().default(null),
  description: optionalText,
  hero_image_url: optionalText,
  is_published: z.boolean().default(false),
});

export const upsertSailing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SailingInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.arrival_date < data.departure_date) {
      throw new Error("Arrival date cannot be before the departure date.");
    }
    const nights = Math.max(
      0,
      Math.round(
        (new Date(data.arrival_date).getTime() - new Date(data.departure_date).getTime()) / 86400000,
      ),
    );
    const row = {
      ship_id: data.ship_id,
      name: data.name,
      slug: slugify(data.name),
      region: data.region,
      departure_date: data.departure_date,
      arrival_date: data.arrival_date,
      departure_port_id: data.departure_port_id,
      arrival_port_id: data.arrival_port_id,
      nights,
      starting_price: data.starting_price,
      description: data.description || null,
      hero_image_url: data.hero_image_url || null,
      is_published: data.is_published,
      source: "manual",
    };
    const query = data.id
      ? context.supabase.from("sailings").update(row).eq("id", data.id)
      : context.supabase.from("sailings").insert(row);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setSailingPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: uuid, is_published: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("sailings")
      .update({ is_published: data.is_published })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteSailing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("sailings").delete().eq("id", data.id);
    if (error) throw new Error("This sailing still has bookings or port calls attached.");
    return { ok: true };
  });

export const listPortCalls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ sailingId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: calls, error } = await context.supabase
      .from("sailing_port_calls")
      .select(
        "id, sailing_id, port_id, day_number, call_date, arrival_time, departure_time, is_sea_day, notes, ports(name, country)",
      )
      .eq("sailing_id", data.sailingId)
      .order("day_number");
    if (error) throw new Error(error.message);
    return calls ?? [];
  });

const PortCallInput = z.object({
  id: uuid.optional(),
  sailing_id: uuid,
  port_id: uuid.nullable().default(null),
  day_number: z.number().int().min(1).max(60),
  call_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  arrival_time: z.string().optional().or(z.literal("")),
  departure_time: z.string().optional().or(z.literal("")),
  is_sea_day: z.boolean().default(false),
  notes: optionalText,
});

export const upsertPortCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => PortCallInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!data.is_sea_day && !data.port_id) throw new Error("Pick a port or mark the day as a sea day.");
    const row = {
      sailing_id: data.sailing_id,
      port_id: data.is_sea_day ? null : data.port_id,
      day_number: data.day_number,
      call_date: data.call_date,
      arrival_time: data.arrival_time || null,
      departure_time: data.departure_time || null,
      is_sea_day: data.is_sea_day,
      notes: data.notes || null,
    };
    const query = data.id
      ? context.supabase.from("sailing_port_calls").update(row).eq("id", data.id)
      : context.supabase.from("sailing_port_calls").insert(row);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deletePortCall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("sailing_port_calls").delete().eq("id", data.id);
    if (error) throw new Error("This port call still has bookings attached.");
    return { ok: true };
  });
