# Shore Hopper — Cruise & Shore Excursion Platform

An elegant, luxury-liner web app where cruise passengers find their sailing, explore each port call, and book shore excursions — with an AI concierge, passenger accounts, and an admin back office.

## Brand

Taken from the logo: deep navy ground, brass gold accents, ivory white.

- Navy `#141B34` / `#0E1428` (surfaces), Brass `#B99B5A` (accents, dividers, CTAs), Ivory `#F4F1EA` (text on navy), Sea slate `#3B5470` (secondary).
- Headings: Libre Baskerville. Body/UI: IBM Plex Sans.
- Voice: composed, refined, low-noise. Thin gold hairline rules echoing the logo, generous whitespace, no gradients-on-white, restrained motion.
- Logo used in the header and footer; favicon derived from the anchor mark.

## Pages

Public
- `/` — hero over ocean imagery, cruise search bar, featured sailings, featured port excursions.
- `/cruises` — search and filter by cruise line, ship, departure port, region/route, date range; results as elegant cards.
- `/cruises/$id` — sailing detail: ship, line, dates, day-by-day itinerary with each port, arrival/departure times, sea days; excursions offered at each port.
- `/ports/$id` — port city page: overview, arrival window, all excursions there.
- `/excursions/$id` — excursion detail: description, duration, meeting point, price, capacity, availability by date, "Book" CTA.
- `/about`, `/contact`.

Auth
- `/auth` — sign in / sign up with Google, Apple, and email. Password reset at `/reset-password`.

Passenger panel (signed in)
- `/account` — profile, upcoming voyage.
- `/account/bookings` — bookings with status, payment state, voucher/reference; cancel request.
- `/account/voyages` — link a sailing to "my cruise" so the itinerary and excursions personalise.

Admin panel (admin role only)
- `/admin` — overview: bookings, revenue, upcoming departures.
- `/admin/cruise-lines`, `/admin/ships`, `/admin/sailings` (with port-call editor: port, arrival, departure, day number).
- `/admin/ports`, `/admin/excursions` (pricing, capacity, port assignment, publish/unpublish).
- `/admin/bookings` — view, confirm, refund-flag, export.
- `/admin/users` — role management.

AI concierge
- Floating gold anchor button on every page opening a slide-over chat panel.
- Streaming assistant that answers questions about sailings, ports, excursion options, timing feasibility (does the tour fit the port window), booking and payment questions, and can link to the relevant excursion or sailing page.

## Booking and payment

1. Pick excursion + date + party size → availability and capacity checked server-side.
2. Passenger details form (lead passenger, cabin number, contact).
3. Stripe Checkout for card payment.
4. On payment confirmation the booking becomes `confirmed` with a reference code; shown in `/account/bookings` and in admin.
5. Reserved-but-unpaid bookings expire so capacity is released.

## Technical notes

- Lovable Cloud (Postgres + auth + storage) as the backend. Tables: `profiles`, `user_roles` (separate table, `has_role()` security-definer function), `cruise_lines`, `ships`, `ports`, `sailings`, `sailing_port_calls`, `excursions`, `excursion_departures`, `bookings`, `booking_passengers`, `payments`, `ai_conversations` + `ai_messages`.
- RLS on everything: public read on published catalogue rows (`TO anon`), owner-scoped read/write on bookings and profiles, admin-wide access via `has_role(auth.uid(), 'admin')`. Explicit GRANTs per table.
- Schema designed for a later cruise data feed: every catalogue table carries `source` and `external_id` with unique constraints so an import can upsert without duplicating admin-entered rows.
- Reads via TanStack Start server functions (`createServerFn`); public catalogue reads use the publishable-key server client, passenger/admin reads use `requireSupabaseAuth`. Admin panel under the `_authenticated` layout with a role check.
- Google and Apple sign-in through the Lovable auth broker; email/password also enabled with reset flow.
- AI concierge: streaming chat server route using Lovable AI (`openai/gpt-5.6-sol`) with tools that query sailings, port calls and excursions so answers are grounded in real data. Gateway errors surfaced in the UI.
- Stripe Checkout via Lovable's Stripe integration; webhook at `/api/public/webhooks/stripe` verifies signature before confirming bookings.
- Seeded demo data: several cruise lines, ships, Mediterranean and Caribbean sailings with full port-call timetables, and excursions per port, so every screen is populated on first load.

## Build order

1. Brand tokens, logo, favicon, shell (header/footer/nav) and home page.
2. Cloud backend: schema, RLS, seed data, auth with Google/Apple/email.
3. Cruise search, sailing detail with itinerary, port and excursion pages.
4. Booking flow + Stripe checkout + webhook + passenger bookings panel.
5. Admin panel across catalogue, bookings, users.
6. AI concierge with data-grounded tools.
