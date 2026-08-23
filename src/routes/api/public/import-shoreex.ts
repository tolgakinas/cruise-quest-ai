import { createFileRoute } from "@tanstack/react-router";

/**
 * Shore Excursions Group itinerary queue drainer. Called by pg_cron (and
 * manually) with the project publishable key in the `apikey` header. Each
 * request fetches one batch of queued sailing itineraries so the port-by-port
 * timetables fill in progressively and then stay refreshed.
 */
export const Route = createFileRoute("/api/public/import-shoreex")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey") ?? "";
        const expected =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";
        if (!expected || key !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        let limit = 20;
        try {
          const body = (await request.json()) as { limit?: number } | null;
          if (body && typeof body.limit === "number") limit = body.limit;
        } catch {
          // no body — use the default batch size
        }

        try {
          const { runShoreexBatch } = await import("@/lib/shoreex.server");
          const result = await runShoreexBatch({ limit, trigger: "cron" });
          return Response.json(result);
        } catch (err) {
          return new Response(err instanceof Error ? err.message : "batch failed", { status: 500 });
        }
      },
    },
  },
});
