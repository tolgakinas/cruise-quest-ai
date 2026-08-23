import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./admin-guard";

/** Admin: timetable import sources + recent run history. */
export const getImportOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const supabase = context.supabase;

    const [sources, runs, counts] = await Promise.all([
      supabase
        .from("import_sources")
        .select("id, label, url, parser, cruise_line_slug, is_active, last_run_at")
        .order("label"),
      supabase
        .from("import_runs")
        .select(
          "id, source_id, trigger, status, sailings_created, sailings_updated, port_calls_created, port_calls_updated, error, started_at, finished_at",
        )
        .order("started_at", { ascending: false })
        .limit(25),
      supabase
        .from("sailings")
        .select("id, source", { count: "exact", head: true })
        .neq("source", "manual"),
    ]);

    return {
      sources: sources.data ?? [],
      runs: runs.data ?? [],
      importedSailings: counts.count ?? 0,
    };
  });

const SourceInput = z.object({
  id: z.string().uuid().optional(),
  label: z.string().trim().min(2).max(120),
  url: z.string().trim().url(),
  cruise_line_slug: z.string().trim().max(120).optional().or(z.literal("")),
  is_active: z.boolean().default(true),
});

export const upsertImportSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SourceInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const row = {
      label: data.label,
      url: data.url,
      parser: "firecrawl-ai",
      cruise_line_slug: data.cruise_line_slug || null,
      is_active: data.is_active,
    };
    const query = data.id
      ? context.supabase.from("import_sources").update(row).eq("id", data.id)
      : context.supabase.from("import_sources").insert(row);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteImportSource = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("import_sources").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Scrapes + imports a single source (or an ad-hoc URL) right now. */
export const runTimetableImport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        sourceId: z.string().uuid().optional(),
        url: z.string().trim().url().optional(),
        cruiseLineHint: z.string().trim().max(120).optional(),
      })
      .refine((v) => Boolean(v.sourceId || v.url), { message: "A source or URL is required" })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { runImportForUrl } = await import("./import.server");

    let url = data.url ?? "";
    let hint = data.cruiseLineHint ?? null;
    let label = "firecrawl";

    if (data.sourceId) {
      const { data: source, error } = await context.supabase
        .from("import_sources")
        .select("id, label, url, cruise_line_slug")
        .eq("id", data.sourceId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!source) throw new Error("Import source not found");
      url = source.url;
      hint = source.cruise_line_slug ?? source.label;
      label = "firecrawl";
    }

    const stats = await runImportForUrl({
      url,
      sourceId: data.sourceId ?? null,
      trigger: "admin",
      cruiseLineHint: hint,
      sourceLabel: label,
    });

    return stats;
  });

/** Finds itinerary/timetable pages on a cruise site so admins can add them as sources. */
export const discoverImportUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ url: z.string().trim().url() }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { discoverTimetableUrls } = await import("./import.server");
    const urls = await discoverTimetableUrls(data.url, 25);
    return { urls };
  });

/** Admin: maps cruisemapper.com and queues every cruise line + ship page. */
export const discoverCruisemapper = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { discoverCruisemapperCatalog } = await import("./cruisemapper.server");
    return discoverCruisemapperCatalog();
  });

/** Admin: processes the next batch of queued CruiseMapper pages. */
export const runCruisemapperCatalogBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(40).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { runCruisemapperBatch } = await import("./cruisemapper.server");
    return runCruisemapperBatch({ limit: data.limit ?? 15, trigger: "admin" });
  });

/** Admin: CruiseMapper queue progress + catalogue size. */
export const getCruisemapperStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const s = context.supabase;
    const [queued, pending, failed, lines, ships, sailings] = await Promise.all([
      s.from("import_sources").select("id", { count: "exact", head: true }).eq("parser", "cruisemapper"),
      s
        .from("import_sources")
        .select("id", { count: "exact", head: true })
        .eq("parser", "cruisemapper")
        .eq("is_active", true)
        .is("last_run_at", null),
      s
        .from("import_sources")
        .select("id", { count: "exact", head: true })
        .eq("parser", "cruisemapper")
        .eq("is_active", false),
      s.from("cruise_lines").select("id", { count: "exact", head: true }),
      s.from("ships").select("id", { count: "exact", head: true }),
      s.from("sailings").select("id", { count: "exact", head: true }),
    ]);
    return {
      queued: queued.count ?? 0,
      pending: pending.count ?? 0,
      givenUp: failed.count ?? 0,
      lines: lines.count ?? 0,
      ships: ships.count ?? 0,
      sailings: sailings.count ?? 0,
    };
  });
