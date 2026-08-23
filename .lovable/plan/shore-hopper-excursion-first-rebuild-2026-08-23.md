# Shore Hopper — Excursion-First Rebuild

Shore Hopper does not sell cruises. It sells shore excursions in the ports a cruise visits. The site is rebuilt around one flow: find your sailing → pick a port from its timetable → choose an excursion → enter details → pay → manage the reservation.

## Main passenger flow

1. **Home / search** — "Find your cruise": cruise line, ship, departure port, sail date. Results list matching sailings with ship, dates and night count.
2. **Sailing page — two-column layout** (the reference-site pattern)
   - Left: the itinerary as a port list (day, date, port, arrival/departure time, sea days greyed out). Selecting a port highlights it.
   - Right: excursions available in the selected port — image, duration, difficulty, price per person, and a "fits the port window" indicator comparing tour duration to arrival/departure times.
   - Mobile: ports become a horizontal day strip above the excursion list.
3. **Excursion detail** — full description, what's included, meeting point, duration, capacity, price; date is pre-filled from the port call.
4. **Booking form** — tour date (from the port call), party size, lead passenger name/email/phone, cabin number, notes. Capacity checked server-side.
5. **Payment** — Stripe Checkout. On payment confirmation the reservation becomes `confirmed` with a reference code and a voucher view.

## Passenger panel (own login)

- `/account` — profile, cabin, linked sailing ("my cruise" so the itinerary personalises).
- `/account/bookings` — all reservations with status, payment state, reference and voucher.
- `/account/bookings/$reference` — modify: change tour date (only to dates where that port is called and capacity allows), change party size (price recalculated; difference handled as a new payment or noted as a credit), update contact details, request cancellation.
- Sign in with Google, Apple, or email + password with reset.

## Admin panel

`/admin` with its own sidebar layout, admin-role only:

- **Overview** — reservations, revenue, upcoming departures, sync health.
- **Cruise data** — cruise lines, ships, sailings, and the port-call timetable editor; shows which rows came from the scraper vs. manual entry.
- **Ports** — port cities, descriptions, images.
- **Excursions** — create/edit, pricing, capacity, duration, port assignment, publish/unpublish.
- **Reservations** — view, confirm, modify, cancel, refund-flag, CSV export.
- **Users** — role management (admin / passenger).
- **Audit log** — existing dashboard, kept.
- **Sync** — run the cruise-timetable scrape on demand, see last run, imported rows and errors.

## Cruise timetable via scraping

Cruise schedules are pulled from the web with Firecrawl rather than typed in by hand:

- A **sources** table holds the pages to scrape (cruise line / port schedule pages) with a parser key per source.
- A scheduled job scrapes each source, parses sailings and port calls, and **upserts** on `source` + `external_id`, so re-runs update instead of duplicating and never overwrite admin-entered rows.
- Admin sees each run's result and can trigger a run manually; failures are recorded, not silent.
- Admin can still add or correct a sailing by hand; manual rows are protected from the importer.

Firecrawl needs to be connected — I'll open the connect card during the build.

## Technical notes

- Public reads (search, sailing, port, excursion) stay in `createServerFn` with the publishable-key client and published-only RLS. Booking, modification and admin reads use `requireSupabaseAuth`.
- New tables: `excursion_availability` (date + remaining capacity per excursion), `import_sources`, `import_runs`. `bookings` gains a modification history and `port_call_id` becomes required for the timing check. All with explicit GRANTs and RLS.
- Booking capacity, price and date validity are computed server-side only; the client never sets the amount.
- Stripe Checkout via the Lovable Stripe integration; webhook at `/api/public/webhooks/stripe` verifies the signature before confirming a reservation. Unpaid reservations expire so capacity is released.
- Scraper runs as a server route under `/api/public/cron/sync-sailings` guarded by a secret, plus an admin-triggered server function.
- Admin routes live under the `_authenticated` layout behind a `has_role` check; the AI concierge stays and is grounded in the same sailing/port/excursion data.

## Build order

1. Sailing search + two-column sailing page (ports left, excursions right) with the port-window fit indicator.
2. Excursion detail + booking form with server-side capacity and pricing.
3. Stripe Checkout + webhook + voucher.
4. Passenger panel with reservation modify/cancel.
5. Admin panel: catalogue, excursions, reservations, users, sync.
6. Firecrawl timetable importer + scheduled sync + admin sync screen.
