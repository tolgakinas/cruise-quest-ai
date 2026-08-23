import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const RecommendInput = z.object({
  goals: z.string().trim().min(3).max(600),
  party: z.number().int().min(1).max(20).default(2),
  sailingSlug: z.string().trim().max(120).optional(),
  portSlug: z.string().trim().max(120).optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

/** Upcoming published sailings, for the planner's sailing picker. */
export const listPlanningSailings = createServerFn({ method: "GET" }).handler(async () => {
  const { createPublicClient } = await import("./supabase-public.server");
  const supabase = createPublicClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("sailings")
    .select("name, slug, departure_date, nights, ships!inner(name)")
    .eq("is_published", true)
    .gte("departure_date", today)
    .order("departure_date")
    .limit(60);
  return (data ?? []).map((s) => ({
    slug: s.slug,
    label: `${s.name} · ${s.ships.name} · ${s.departure_date}`,
  }));
});

/** Public planner: goals in, real bookable port/tour/day picks out. */
export const recommendExcursions = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => RecommendInput.parse(input))
  .handler(async ({ data }) => {
    const { recommendFromGoals } = await import("./recommend.server");
    return recommendFromGoals(data);
  });

/** Signed in: falls back to the sailing of the guest's own next reservation. */
export const recommendForMyVoyage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RecommendInput.parse(input))
  .handler(async ({ data, context }) => {
    const { recommendFromGoals } = await import("./recommend.server");
    let sailingSlug = data.sailingSlug;

    if (!sailingSlug) {
      const { data: booking } = await context.supabase
        .from("bookings")
        .select("tour_date, status, sailings(slug)")
        .in("status", ["reserved", "confirmed"])
        .gte("tour_date", new Date().toISOString().slice(0, 10))
        .order("tour_date", { ascending: true })
        .limit(1)
        .maybeSingle();
      sailingSlug = booking?.sailings?.slug ?? undefined;
    }

    return recommendFromGoals({ ...data, sailingSlug });
  });
