import { createFileRoute } from "@tanstack/react-router";

/**
 * CruiseMapper queue drainer. Called by pg_cron (and manually) with the project
 * publishable key in the `apikey` header. Processes one batch of queued
 * CruiseMapper cruise line / ship pages per request so the full catalogue and
 * its timetables fill in progressively and then stay refreshed.
 */
export const Route = createFileRoute("/api/public/import-cruisemapper")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey") ?? "";
        const expected =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";
        if (!expected || key !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        let limit = 12;
        try {
          const body = (await request.json()) as { limit?: number } | null;
          if (body && typeof body.limit === "number") limit = body.limit;
        } catch {
          // no body — use the default batch size
        }

        try {
          const { runCruisemapperBatch } = await import("@/lib/cruisemapper.server");
          const result = await runCruisemapperBatch({ limit, trigger: "cron" });
          return Response.json(result);
        } catch (err) {
          return new Response(err instanceof Error ? err.message : "batch failed", { status: 500 });
        }
      },
    },
  },
});
