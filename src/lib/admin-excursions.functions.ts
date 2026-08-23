import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin, slugify } from "./admin-guard";

const uuid = z.string().uuid();
const optionalText = z.string().trim().max(4000).optional().or(z.literal(""));

export const listAdminExcursions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        q: z.string().trim().max(120).nullable().default(null),
        portId: uuid.nullable().default(null),
        published: z.enum(["all", "published", "draft"]).default("all"),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let query = context.supabase
      .from("excursions")
      .select(
        "id, title, slug, summary, description, duration_minutes, price, currency, capacity, meeting_point, category, difficulty, image_url, is_published, includes, excludes, wheelchair_accessible, port_id, source, ports(name, country)",
      )
      .order("title")
      .limit(400);

    if (data.q) query = query.ilike("title", `%${data.q}%`);
    if (data.portId) query = query.eq("port_id", data.portId);
    if (data.published !== "all") query = query.eq("is_published", data.published === "published");

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const ExcursionInput = z.object({
  id: uuid.optional(),
  port_id: uuid,
  title: z.string().trim().min(3).max(160),
  summary: optionalText,
  description: optionalText,
  duration_minutes: z.number().int().min(15).max(1440),
  price: z.number().min(0).max(100000),
  currency: z.string().trim().length(3).default("EUR"),
  capacity: z.number().int().min(1).max(500),
  meeting_point: optionalText,
  category: optionalText,
  difficulty: optionalText,
  image_url: optionalText,
  includes: z.array(z.string().trim().max(200)).max(30).default([]),
  excludes: z.array(z.string().trim().max(200)).max(30).default([]),
  wheelchair_accessible: z.boolean().default(false),
  is_published: z.boolean().default(false),
});

export const upsertExcursion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ExcursionInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const row = {
      port_id: data.port_id,
      title: data.title,
      slug: slugify(data.title),
      summary: data.summary || null,
      description: data.description || null,
      duration_minutes: data.duration_minutes,
      price: data.price,
      currency: data.currency.toUpperCase(),
      capacity: data.capacity,
      meeting_point: data.meeting_point || null,
      category: data.category || null,
      difficulty: data.difficulty || null,
      image_url: data.image_url || null,
      includes: data.includes.filter(Boolean),
      excludes: data.excludes.filter(Boolean),
      wheelchair_accessible: data.wheelchair_accessible,
      is_published: data.is_published,
      source: "manual",
    };
    const query = data.id
      ? context.supabase.from("excursions").update(row).eq("id", data.id)
      : context.supabase.from("excursions").insert(row);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setExcursionPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: uuid, is_published: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("excursions")
      .update({ is_published: data.is_published })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteExcursion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("excursions").delete().eq("id", data.id);
    if (error) throw new Error("This excursion has bookings, so it can only be unpublished.");
    return { ok: true };
  });

export const listExcursionAddons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ excursionId: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: rows, error } = await context.supabase
      .from("excursion_addons")
      .select("id, excursion_id, name, description, price, currency, per_guest, is_active, sort_order")
      .eq("excursion_id", data.excursionId)
      .order("sort_order");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const AddonInput = z.object({
  id: uuid.optional(),
  excursion_id: uuid,
  name: z.string().trim().min(2).max(120),
  description: optionalText,
  price: z.number().min(0).max(100000),
  currency: z.string().trim().length(3).default("EUR"),
  per_guest: z.boolean().default(false),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().min(0).max(100).default(0),
});

export const upsertExcursionAddon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AddonInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const row = {
      excursion_id: data.excursion_id,
      name: data.name,
      description: data.description || null,
      price: data.price,
      currency: data.currency.toUpperCase(),
      per_guest: data.per_guest,
      is_active: data.is_active,
      sort_order: data.sort_order,
    };
    const query = data.id
      ? context.supabase.from("excursion_addons").update(row).eq("id", data.id)
      : context.supabase.from("excursion_addons").insert(row);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteExcursionAddon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: uuid }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("excursion_addons").delete().eq("id", data.id);
    if (error) throw new Error("This add-on is attached to a reservation; deactivate it instead.");
    return { ok: true };
  });
