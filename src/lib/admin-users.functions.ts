import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./admin-guard";

/** Admin: every profile with its roles and reservation count. */
export const listAppUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ q: z.string().trim().max(120).nullable().default(null) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const supabase = context.supabase;

    let query = supabase
      .from("profiles")
      .select("id, full_name, email, phone, cabin_number, created_at")
      .order("created_at", { ascending: false })
      .limit(300);
    if (data.q) query = query.or(`email.ilike.%${data.q}%,full_name.ilike.%${data.q}%`);

    const { data: profiles, error } = await query;
    if (error) throw new Error(error.message);

    const [{ data: roles }, { data: bookings }] = await Promise.all([
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("bookings").select("user_id, status").limit(1000),
    ]);

    const roleMap = new Map<string, string[]>();
    for (const r of roles ?? []) {
      roleMap.set(r.user_id, [...(roleMap.get(r.user_id) ?? []), r.role]);
    }
    const bookingMap = new Map<string, number>();
    for (const b of bookings ?? []) {
      bookingMap.set(b.user_id, (bookingMap.get(b.user_id) ?? 0) + 1);
    }

    return (profiles ?? []).map((p) => ({
      ...p,
      roles: roleMap.get(p.id) ?? [],
      bookingCount: bookingMap.get(p.id) ?? 0,
    }));
  });

/** Admin: grant or revoke a role. Uses the privileged client after verifying the caller. */
export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        userId: z.string().uuid(),
        role: z.enum(["admin", "passenger"]),
        grant: z.boolean(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId && data.role === "admin" && !data.grant) {
      throw new Error("You cannot remove your own admin role.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.grant) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: data.role }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", data.role);
      if (error) throw new Error(error.message);
    }

    return { ok: true };
  });
