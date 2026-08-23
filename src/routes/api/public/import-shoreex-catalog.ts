import { createFileRoute } from "@tanstack/react-router";

/**
 * Shore Excursions Group catalogue sync. Reads the cruise finder's embedded
 * cruise line / ship / sail-date catalogue and upserts a slice of ships with
 * their sailings, queueing each new sailing for itinerary fetching. Called with
 * the project publishable key in the `apikey` header; repeat with the returned
 * `nextOffset` until it is null.
 */
export const Route = createFileRoute("/api/public/import-shoreex-catalog")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey") ?? "";
        const expected =
          process.env["SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_ANON_KEY"] ?? "";
        if (!expected || key !== expected) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: { offset?: number; limit?: number; years?: number[] } = {};
        try {
          body = ((await request.json()) as typeof body) ?? {};
        } catch {
          // no body — use defaults
        }

        try {
          const { syncShoreexCatalog } = await import("@/lib/shoreex.server");
          const result = await syncShoreexCatalog({
            ...(typeof body.offset === "number" ? { offset: body.offset } : {}),
            ...(typeof body.limit === "number" ? { limit: body.limit } : {}),
            ...(Array.isArray(body.years) ? { years: body.years } : {}),
          });
          return Response.json(result);
        } catch (err) {
          return new Response(err instanceof Error ? err.message : "sync failed", { status: 500 });
        }
      },
    },
  },
});
