import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./admin-guard";

/** The signed-in passenger's notification feed with an unread counter. */
export const listMyNotifications = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("notifications")
      .select("id, type, title, body, href, read_at, created_at")
      .order("created_at", { ascending: false })
      .limit(30);
    if (error) throw new Error(error.message);
    const items = data ?? [];
    return { items, unread: items.filter((n) => !n.read_at).length };
  });

export const markNotificationsRead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ ids: z.array(z.string().uuid()).max(50).optional() })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null);
    if (data.ids?.length) query = query.in("id", data.ids);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Admin view of the reservation email queue. */
export const listEmailOutbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ status: z.enum(["all", "pending", "sent", "failed"]).default("all") })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let query = context.supabase
      .from("email_outbox")
      .select("id, to_email, subject, body, status, error, sent_at, created_at, bookings(reference)")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.status !== "all") query = query.eq("status", data.status);
    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    const items = rows ?? [];
    return {
      items,
      counts: {
        pending: items.filter((i) => i.status === "pending").length,
        sent: items.filter((i) => i.status === "sent").length,
        failed: items.filter((i) => i.status === "failed").length,
      },
    };
  });
