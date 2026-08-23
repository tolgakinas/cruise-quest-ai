import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./admin-guard";

/** Admin: headline numbers for the dashboard overview. */
export const getAdminOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const supabase = context.supabase;
    const today = new Date().toISOString().slice(0, 10);

    const [bookings, payments, refunds, sailings, excursions] = await Promise.all([
      supabase
        .from("bookings")
        .select("id, status, total_amount, currency, tour_date, created_at")
        .order("created_at", { ascending: false })
        .limit(500),
      supabase.from("payments").select("amount, currency, status").limit(1000),
      supabase.from("refund_requests").select("id, status").limit(500),
      supabase
        .from("sailings")
        .select("id, name, slug, departure_date, is_published")
        .gte("departure_date", today)
        .order("departure_date")
        .limit(6),
      supabase.from("excursions").select("id, is_published").limit(1000),
    ]);

    const rows = bookings.data ?? [];
    const paid = (payments.data ?? []).filter((p) => p.status === "paid");
    const revenue = paid.reduce((sum, p) => sum + Number(p.amount), 0);
    const currency = paid[0]?.currency ?? rows[0]?.currency ?? "EUR";

    return {
      bookings: {
        total: rows.length,
        reserved: rows.filter((b) => b.status === "reserved").length,
        confirmed: rows.filter((b) => b.status === "confirmed").length,
        cancelled: rows.filter((b) => b.status === "cancelled").length,
        refunded: rows.filter((b) => b.status === "refunded").length,
        upcoming: rows.filter((b) => b.tour_date >= today && b.status !== "cancelled").length,
      },
      revenue: { amount: revenue, currency },
      pendingPayments: (payments.data ?? []).filter((p) => p.status === "pending").length,
      pendingRefunds: (refunds.data ?? []).filter((r) => r.status === "pending").length,
      excursions: {
        total: (excursions.data ?? []).length,
        published: (excursions.data ?? []).filter((e) => e.is_published).length,
      },
      upcomingSailings: sailings.data ?? [],
    };
  });
