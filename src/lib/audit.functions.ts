import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AuditQuery = z.object({
  action: z.string().nullable().default(null),
  entityType: z.string().nullable().default(null),
  q: z.string().nullable().default(null),
  limit: z.number().int().min(1).max(200).default(100),
});

export type AuditQueryInput = z.infer<typeof AuditQuery>;

export const isCurrentUserAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdmin: Boolean(data) };
  });

export const getAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AuditQuery.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { data: role } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!role) throw new Error("Forbidden: admin access required");

    let query = context.supabase
      .from("audit_logs")
      .select(
        "id, created_at, action, entity_type, entity_id, summary, metadata, actor_email, actor_name",
      )
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.action) query = query.eq("action", data.action);
    if (data.entityType) query = query.eq("entity_type", data.entityType);
    if (data.q) query = query.or(`summary.ilike.%${data.q}%,actor_email.ilike.%${data.q}%`);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const entries = rows ?? [];
    const stats = {
      total: entries.length,
      published: entries.filter((e) => e.action.endsWith(".published")).length,
      created: entries.filter((e) => e.action.endsWith(".created")).length,
      refunded: entries.filter((e) => e.action.endsWith(".refunded")).length,
    };

    return { entries, stats };
  });
