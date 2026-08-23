import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./admin-guard";

const uuid = z.string().uuid();

const ListInput = z.object({
  status: z.enum(["all", "reserved", "confirmed", "cancelled", "refunded"]).default("all"),
  q: z.string().trim().max(120).nullable().default(null),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  limit: z.number().int().min(1).max(500).default(200),
});

const SELECT =
  "id, reference, status, tour_date, party_size, total_amount, currency, lead_passenger_name, lead_passenger_email, lead_passenger_phone, cabin_number, notes, created_at, excursion_id, port_call_id, excursions(title, price, currency, ports(name, country)), sailings(name, slug), payments(status, amount, currency, provider), booking_addons(id, name, unit_price, quantity, line_total, currency, addon_id)";

export const listAdminBookings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let query = context.supabase
      .from("bookings")
      .select(SELECT)
      .order("created_at", { ascending: false })
      .limit(data.limit);

    if (data.status !== "all") query = query.eq("status", data.status);
    if (data.from) query = query.gte("tour_date", data.from);
    if (data.to) query = query.lte("tour_date", data.to);
    if (data.q) {
      query = query.or(
        `reference.ilike.%${data.q}%,lead_passenger_name.ilike.%${data.q}%,lead_passenger_email.ilike.%${data.q}%`,
      );
    }

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const setBookingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: uuid,
        status: z.enum(["reserved", "confirmed", "cancelled", "refunded"]),
        note: z.string().trim().max(400).optional().or(z.literal("")),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: current } = await context.supabase
      .from("bookings")
      .select("id, status")
      .eq("id", data.id)
      .maybeSingle();
    if (!current) throw new Error("Reservation not found.");

    const { error } = await context.supabase
      .from("bookings")
      .update({ status: data.status, expires_at: null })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    await context.supabase.from("booking_modifications").insert({
      booking_id: data.id,
      changed_by: context.userId,
      field: "status",
      old_value: current.status,
      new_value: data.status,
      note: data.note || "Changed by admin",
    });

    return { ok: true };
  });

const UpdateInput = z.object({
  id: uuid,
  partySize: z.number().int().min(1).max(40),
  tourDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  leadName: z.string().trim().min(2).max(120),
  leadEmail: z.string().trim().email().max(160),
  leadPhone: z.string().trim().max(40).optional().or(z.literal("")),
  cabinNumber: z.string().trim().max(20).optional().or(z.literal("")),
  notes: z.string().trim().max(600).optional().or(z.literal("")),
});

/** Admin: correct a reservation. Totals are always recomputed server-side. */
export const adminUpdateBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const supabase = context.supabase;

    const { data: booking, error: bookingError } = await supabase
      .from("bookings")
      .select(
        "id, party_size, tour_date, total_amount, currency, excursion_id, lead_passenger_name, lead_passenger_email, lead_passenger_phone, cabin_number, notes, excursions(price, currency, capacity)",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (bookingError) throw new Error(bookingError.message);
    if (!booking) throw new Error("Reservation not found.");

    const { data: addons } = await supabase
      .from("booking_addons")
      .select("id, unit_price, quantity, addon_id, excursion_addons(per_guest)")
      .eq("booking_id", data.id);

    let addonTotal = 0;
    for (const addon of addons ?? []) {
      const perGuest = addon.excursion_addons?.per_guest ?? false;
      const quantity = perGuest ? data.partySize : addon.quantity;
      const lineTotal = Number(addon.unit_price) * quantity;
      addonTotal += lineTotal;
      await supabase
        .from("booking_addons")
        .update({ quantity, line_total: lineTotal })
        .eq("id", addon.id);
    }

    const unit = Number(booking.excursions?.price ?? 0);
    const total = unit * data.partySize + addonTotal;

    const { error } = await supabase
      .from("bookings")
      .update({
        party_size: data.partySize,
        tour_date: data.tourDate,
        total_amount: total,
        lead_passenger_name: data.leadName,
        lead_passenger_email: data.leadEmail,
        lead_passenger_phone: data.leadPhone || null,
        cabin_number: data.cabinNumber || null,
        notes: data.notes || null,
      })
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    const changes: { field: string; old_value: string; new_value: string }[] = [];
    if (booking.party_size !== data.partySize) {
      changes.push({
        field: "party_size",
        old_value: String(booking.party_size),
        new_value: String(data.partySize),
      });
    }
    if (booking.tour_date !== data.tourDate) {
      changes.push({ field: "tour_date", old_value: booking.tour_date, new_value: data.tourDate });
    }
    if (Number(booking.total_amount) !== total) {
      changes.push({
        field: "total_amount",
        old_value: String(booking.total_amount),
        new_value: String(total),
      });
    }
    if (changes.length > 0) {
      await supabase.from("booking_modifications").insert(
        changes.map((c) => ({
          booking_id: data.id,
          changed_by: context.userId,
          field: c.field,
          old_value: c.old_value,
          new_value: c.new_value,
          note: "Adjusted by admin",
        })),
      );
    }

    return { ok: true, total, currency: booking.currency };
  });

export const exportBookingsCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    let query = context.supabase
      .from("bookings")
      .select(
        "reference, status, tour_date, party_size, total_amount, currency, lead_passenger_name, lead_passenger_email, cabin_number, created_at, excursions(title, ports(name, country))",
      )
      .order("created_at", { ascending: false })
      .limit(1000);
    if (data.status !== "all") query = query.eq("status", data.status);
    if (data.from) query = query.gte("tour_date", data.from);
    if (data.to) query = query.lte("tour_date", data.to);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    const header = [
      "Reference",
      "Status",
      "Tour date",
      "Guests",
      "Total",
      "Currency",
      "Lead passenger",
      "Email",
      "Cabin",
      "Excursion",
      "Port",
      "Booked at",
    ];
    const escape = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const lines = [header.join(",")];
    for (const r of rows ?? []) {
      lines.push(
        [
          r.reference,
          r.status,
          r.tour_date,
          r.party_size,
          r.total_amount,
          r.currency,
          r.lead_passenger_name,
          r.lead_passenger_email,
          r.cabin_number,
          r.excursions?.title,
          r.excursions?.ports?.name,
          r.created_at,
        ]
          .map(escape)
          .join(","),
      );
    }
    return { csv: lines.join("\n"), rows: (rows ?? []).length };
  });
