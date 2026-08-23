import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled timetable refresh. Called by pg_cron with the project anon key in
 * the `apikey` header; runs every active import source in turn.
 */
export const Route = createFileRoute("/api/public/import-timetables")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey") ?? "";
        const expected =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";
        if (!expected || key !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { runImportForUrl } = await import("@/lib/import.server");

        const { data: sources, error } = await supabaseAdmin
          .from("import_sources")
          .select("id, label, url, cruise_line_slug")
          .eq("is_active", true);
        if (error) return new Response(error.message, { status: 500 });

        const results: { label: string; ok: boolean; detail: string }[] = [];
        for (const source of sources ?? []) {
          try {
            const stats = await runImportForUrl({
              url: source.url,
              sourceId: source.id,
              trigger: "cron",
              cruiseLineHint: source.cruise_line_slug ?? source.label,
            });
            results.push({
              label: source.label,
              ok: true,
              detail: `+${stats.sailingsCreated} new / ${stats.sailingsUpdated} updated sailings`,
            });
          } catch (err) {
            results.push({
              label: source.label,
              ok: false,
              detail: err instanceof Error ? err.message : "failed",
            });
          }
        }

        return Response.json({ ran: results.length, results });
      },
    },
  },
});
