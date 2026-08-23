import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createPublicClient } from "./supabase-public.server";
import type { Tables } from "@/integrations/supabase/types";

const RESERVATION_MINUTES = 30;

/** Public: excursion + the sailing dates it can be taken on, with remaining seats. */
export const getExcursionOffer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const supabase = createPublicClient();
    const { data: excursion } = await supabase
      .from("excursions")
      .select(
        "id, title, slug, summary, description, duration_minutes, price, currency, capacity, meeting_point, category, difficulty, includes, excludes, wheelchair_accessible, image_url, ports!inner(id, name, slug, country, region, description)",
      )
      .eq("slug", data.slug)
      .eq("is_published", true)
      .maybeSingle();
    if (!excursion) return null;

    const { data: calls } = await supabase
      .from("sailing_port_calls")
      .select(
        "id, call_date, arrival_time, departure_time, day_number, sailings!inner(id, name, slug, is_published, ships!inner(name, cruise_lines!inner(name)))",
      )
      .eq("port_id", excursion.ports.id)
      .gte("call_date", new Date().toISOString().slice(0, 10))
      .order("call_date");

    const published = (calls ?? []).filter((c) => c.sailings?.is_published);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: taken } = await supabaseAdmin
      .from("bookings")
      .select("tour_date, party_size, status, expires_at")
      .eq("excursion_id", excursion.id)
      .in("status", ["reserved", "confirmed"]);

    const now = Date.now();
    const seatsByDate = new Map<string, number>();
    for (const b of taken ?? []) {
      if (b.status === "reserved" && b.expires_at && new Date(b.expires_at).getTime() < now) continue;
      seatsByDate.set(b.tour_date, (seatsByDate.get(b.tour_date) ?? 0) + b.party_size);
    }

    const { data: addons } = await supabase
      .from("excursion_addons")
      .select("id, name, description, price, currency, per_guest, sort_order")
      .eq("excursion_id", excursion.id)
      .eq("is_active", true)
      .order("sort_order");

    return {
      excursion,
      addons: addons ?? [],
      dates: published.map((c) => ({
        portCallId: c.id,
        date: c.call_date,
        arrival: c.arrival_time,
        departure: c.departure_time,
        dayNumber: c.day_number,
        sailingName: c.sailings.name,
        sailingSlug: c.sailings.slug,
        shipName: c.sailings.ships.name,
        cruiseLine: c.sailings.ships.cruise_lines.name,
        seatsLeft: Math.max(0, excursion.capacity - (seatsByDate.get(c.call_date) ?? 0)),
      })),
    };
  });

const ReserveInput = z.object({
  excursionId: z.string().uuid(),
  portCallId: z.string().uuid(),
  partySize: z.number().int().min(1).max(20),
  leadName: z.string().trim().min(2).max(120),
  leadEmail: z.string().trim().email().max(160),
  leadPhone: z.string().trim().max(40).optional().or(z.literal("")),
  cabinNumber: z.string().trim().max(20).optional().or(z.literal("")),
  notes: z.string().trim().max(600).optional().or(z.literal("")),
  addonIds: z.array(z.string().uuid()).max(10).default([]),
});

/** Signed in: create a reserved (unpaid) booking. Price and capacity computed server-side. */
export const reserveExcursion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReserveInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;


    const { data: excursion, error: exErr } = await supabase
      .from("excursions")
      .select("id, title, price, currency, capacity, port_id, is_published")
      .eq("id", data.excursionId)
      .maybeSingle();
    if (exErr) throw new Error(exErr.message);
    if (!excursion || !excursion.is_published) throw new Error("This excursion is not available.");

    const { data: call } = await supabase
      .from("sailing_port_calls")
      .select("id, sailing_id, port_id, call_date, arrival_time, departure_time")
      .eq("id", data.portCallId)
      .maybeSingle();
    if (!call) throw new Error("That port call could not be found.");
    if (call.port_id !== excursion.port_id) {
      throw new Error("This excursion is not offered at that port call.");
    }
    if (call.call_date < new Date().toISOString().slice(0, 10)) {
      throw new Error("That sailing date has already passed.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: taken } = await supabaseAdmin
      .from("bookings")
      .select("party_size, status, expires_at")
      .eq("excursion_id", excursion.id)
      .eq("tour_date", call.call_date)
      .in("status", ["reserved", "confirmed"]);

    const now = Date.now();
    const used = (taken ?? []).reduce((sum, b) => {
      if (b.status === "reserved" && b.expires_at && new Date(b.expires_at).getTime() < now) return sum;
      return sum + b.party_size;
    }, 0);
    const seatsLeft = excursion.capacity - used;
    if (data.partySize > seatsLeft) {
      throw new Error(
        seatsLeft > 0 ? `Only ${seatsLeft} place(s) left on that date.` : "That date is fully booked.",
      );
    }

    // Add-on prices are always taken from the database, never from the client.
    const chosenAddons: {
      addon_id: string;
      name: string;
      unit_price: number;
      quantity: number;
      line_total: number;
      currency: string;
    }[] = [];
    if (data.addonIds.length) {
      const { data: addons } = await supabase
        .from("excursion_addons")
        .select("id, name, price, currency, per_guest")
        .eq("excursion_id", excursion.id)
        .eq("is_active", true)
        .in("id", [...new Set(data.addonIds)]);
      for (const addon of addons ?? []) {
        const quantity = addon.per_guest ? data.partySize : 1;
        chosenAddons.push({
          addon_id: addon.id,
          name: addon.name,
          unit_price: Number(addon.price),
          quantity,
          line_total: Number(addon.price) * quantity,
          currency: addon.currency,
        });
      }
    }

    const addonTotal = chosenAddons.reduce((sum, a) => sum + a.line_total, 0);
    const total = Number(excursion.price) * data.partySize + addonTotal;

    const { data: booking, error } = await supabase
      .from("bookings")
      .insert({
        user_id: userId,
        excursion_id: excursion.id,
        sailing_id: call.sailing_id,
        port_call_id: call.id,
        tour_date: call.call_date,
        party_size: data.partySize,
        total_amount: total,
        currency: excursion.currency,
        lead_passenger_name: data.leadName,
        lead_passenger_email: data.leadEmail,
        lead_passenger_phone: data.leadPhone || null,
        cabin_number: data.cabinNumber || null,
        notes: data.notes || null,
        expires_at: new Date(now + RESERVATION_MINUTES * 60_000).toISOString(),
      })
      .select("id, reference, total_amount, currency, tour_date, party_size")
      .single();
    if (error) throw new Error(error.message);

    if (chosenAddons.length) {
      await supabase
        .from("booking_addons")
        .insert(chosenAddons.map((a) => ({ ...a, booking_id: booking.id })));
    }

    return booking;
  });

/** Signed in: all of my reservations. */
export const getMyBookings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("bookings")
      .select(
        "id, reference, tour_date, party_size, total_amount, currency, status, lead_passenger_name, lead_passenger_email, cabin_number, created_at, excursions(id, title, slug, duration_minutes, meeting_point, ports(name, country, slug)), sailings(name, slug), payments(status, amount, currency, created_at), booking_addons(id, name, quantity, unit_price, line_total, currency), refund_requests(id, status, created_at)",
      )
      .order("tour_date", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Signed in: one reservation plus the dates it could be moved to. */
export const getMyBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ reference: z.string().min(3) }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: booking, error } = await context.supabase
      .from("bookings")
      .select(
        "id, reference, tour_date, party_size, total_amount, currency, status, lead_passenger_name, lead_passenger_email, lead_passenger_phone, cabin_number, notes, port_call_id, created_at, excursion_id, excursions(id, title, slug, price, currency, capacity, duration_minutes, meeting_point, port_id, ports(name, country, slug)), sailings(name, slug), booking_addons(id, name, quantity, unit_price, line_total, currency)",
      )
      .eq("reference", data.reference)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!booking) return null;

    const [{ data: history }, { data: calls }, { data: refunds }] = await Promise.all([
      context.supabase
        .from("booking_modifications")
        .select("id, field, old_value, new_value, note, created_at")
        .eq("booking_id", booking.id)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("sailing_port_calls")
        .select("id, call_date, arrival_time, departure_time, sailings!inner(name, slug)")
        .eq("port_id", booking.excursions?.port_id ?? "")
        .gte("call_date", new Date().toISOString().slice(0, 10))
        .order("call_date"),
      context.supabase
        .from("refund_requests")
        .select("id, status, reason, amount, currency, admin_note, created_at, reviewed_at")
        .eq("booking_id", booking.id)
        .order("created_at", { ascending: false }),
    ]);

    return {
      booking,
      history: history ?? [],
      alternatives: calls ?? [],
      refundRequests: refunds ?? [],
    };
  });

const ModifyInput = z.object({
  reference: z.string().min(3),
  partySize: z.number().int().min(1).max(20).optional(),
  portCallId: z.string().uuid().optional(),
  leadName: z.string().trim().min(2).max(120).optional(),
  leadEmail: z.string().trim().email().max(160).optional(),
  leadPhone: z.string().trim().max(40).optional(),
  cabinNumber: z.string().trim().max(20).optional(),
  notes: z.string().trim().max(600).optional(),
});

/** Signed in: change my own reservation. Capacity and price re-checked server-side. */
export const modifyMyBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ModifyInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: booking } = await supabase
      .from("bookings")
      .select(
        "id, reference, user_id, status, tour_date, party_size, port_call_id, excursion_id, lead_passenger_name, lead_passenger_email, lead_passenger_phone, cabin_number, notes, excursions(price, currency, capacity, port_id)",
      )
      .eq("reference", data.reference)
      .maybeSingle();
    if (!booking) throw new Error("Reservation not found.");
    if (booking.user_id !== userId) throw new Error("You cannot change this reservation.");
    if (booking.status === "cancelled" || booking.status === "refunded") {
      throw new Error("This reservation is closed and can no longer be changed.");
    }

    const changes: { field: string; old_value: string | null; new_value: string | null }[] = [];
    const update: Partial<Tables<"bookings">> = {};

    let tourDate = booking.tour_date;
    if (data.portCallId && data.portCallId !== booking.port_call_id) {
      const { data: call } = await supabase
        .from("sailing_port_calls")
        .select("id, sailing_id, port_id, call_date")
        .eq("id", data.portCallId)
        .maybeSingle();
      if (!call) throw new Error("That date is no longer available.");
      if (call.port_id !== booking.excursions?.port_id) {
        throw new Error("That date is at a different port.");
      }
      if (call.call_date < new Date().toISOString().slice(0, 10)) {
        throw new Error("That date has already passed.");
      }
      changes.push({ field: "tour_date", old_value: booking.tour_date, new_value: call.call_date });
      update["port_call_id"] = call.id;
      update["sailing_id"] = call.sailing_id;
      update["tour_date"] = call.call_date;
      tourDate = call.call_date;
    }

    const partySize = data.partySize ?? booking.party_size;
    if (data.partySize && data.partySize !== booking.party_size) {
      changes.push({
        field: "party_size",
        old_value: String(booking.party_size),
        new_value: String(data.partySize),
      });
      update["party_size"] = data.partySize;
    }

    if (update["tour_date"] || update["party_size"]) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: taken } = await supabaseAdmin
        .from("bookings")
        .select("id, party_size, status, expires_at")
        .eq("excursion_id", booking.excursion_id)
        .eq("tour_date", tourDate)
        .in("status", ["reserved", "confirmed"]);
      const now = Date.now();
      const used = (taken ?? []).reduce((sum, b) => {
        if (b.id === booking.id) return sum;
        if (b.status === "reserved" && b.expires_at && new Date(b.expires_at).getTime() < now) return sum;
        return sum + b.party_size;
      }, 0);
      const capacity = booking.excursions?.capacity ?? 0;
      if (used + partySize > capacity) {
        throw new Error(`Only ${Math.max(0, capacity - used)} place(s) left on that date.`);
      }
      update["total_amount"] = Number(booking.excursions?.price ?? 0) * partySize;
      changes.push({
        field: "total_amount",
        old_value: null,
        new_value: String(update["total_amount"]),
      });
    }

    const contactFields: [
      keyof typeof data,
      "lead_passenger_name" | "lead_passenger_email" | "lead_passenger_phone" | "cabin_number" | "notes",
      string | null,
    ][] = [
      ["leadName", "lead_passenger_name", booking.lead_passenger_name],
      ["leadEmail", "lead_passenger_email", booking.lead_passenger_email],
      ["leadPhone", "lead_passenger_phone", booking.lead_passenger_phone],
      ["cabinNumber", "cabin_number", booking.cabin_number],
      ["notes", "notes", booking.notes],
    ];
    for (const [key, column, current] of contactFields) {
      const next = data[key] as string | undefined;
      if (next === undefined) continue;
      const normalised = next === "" ? null : next;
      if (normalised === current) continue;
      update[column] = normalised as never;
      changes.push({ field: column, old_value: current, new_value: normalised });
    }

    if (Object.keys(update).length === 0) return { reference: booking.reference, changed: false };

    const { error } = await supabase.from("bookings").update(update).eq("id", booking.id);
    if (error) throw new Error(error.message);

    if (changes.length) {
      await supabase.from("booking_modifications").insert(
        changes.map((c) => ({ ...c, booking_id: booking.id, changed_by: userId, note: "Changed by passenger" })),
      );
    }

    return { reference: booking.reference, changed: true };
  });

/** Signed in: cancel my own reservation. */
export const cancelMyBooking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ reference: z.string().min(3), reason: z.string().trim().max(400).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: booking } = await supabase
      .from("bookings")
      .select("id, user_id, status")
      .eq("reference", data.reference)
      .maybeSingle();
    if (!booking) throw new Error("Reservation not found.");
    if (booking.user_id !== userId) throw new Error("You cannot cancel this reservation.");
    if (booking.status === "cancelled") return { ok: true };

    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled" })
      .eq("id", booking.id);
    if (error) throw new Error(error.message);

    await supabase.from("booking_modifications").insert({
      booking_id: booking.id,
      changed_by: userId,
      field: "status",
      old_value: booking.status,
      new_value: "cancelled",
      note: data.reason ? `Passenger cancellation: ${data.reason}` : "Cancelled by passenger",
    });

    return { ok: true };
  });
