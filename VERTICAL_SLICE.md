# VERTICAL_SLICE.md — HairQueue V1, Slice 1

**Scope:** PRP Step 1 (Database) + PRP Step 2 (Customer Join Flow), end-to-end.
**Purpose of this slice:** Prove the golden rule — the server, not the client, decides queue order — works correctly from a real form submission through to a live status view. This is the smallest possible piece of HairQueue that is actually demoable to the barber's real customers.

Nothing in this document introduces anything beyond what PRP.md already defined. It narrows PRP.md to exactly what gets built first.

---

## 1. In scope for this slice

- Database: `customers`, `locations`, `bookings`, `barber_settings` tables + RLS policies + seed data.
- `lib/supabase/client.js`, `lib/supabase/server.js`
- `lib/bookingNumber.js`
- `lib/queue/position.js`
- `lib/queue/waitTime.js` (fallback-average version only — see §4)
- `constants/status.js`
- `/app/page.js` — minimal customer homepage
- `/app/join/page.js` — join form
- `/app/api/queue/join/route.js`
- `/app/booking/[bookingNumber]/page.js` — status view
- `/app/api/queue/[bookingNumber]/route.js` — `GET` status, `PATCH` cancel

## 2. Explicitly out of scope for this slice

(Deferred to the next slice per PRP Step 3 — do not build now)

- Barber login, dashboard, or any `/api/barber/**` route
- Manual add-customer, start, complete, barber-side cancel
- UI to toggle `accepting_customers` (the column exists and is respected by the join API, but there's no barber UI to flip it yet — it stays `true` by default, set manually in Supabase if you need to test the "closed" state)
- Dynamic wait-time averaging from real `completed_at` data (no completed bookings will exist yet — see §4)
- Mobile polish pass beyond basic Tailwind responsive layout
- Any styling/UX refinement beyond "functionally correct and readable"

## 3. Database — exact schema for this slice

```sql
create table customers (
  id UUID primary key default gen_random_uuid(),
  name TEXT not null,
  phone TEXT not null,
  created_at TIMESTAMPTZ not null default now()
);

create table locations (
  id UUID primary key default gen_random_uuid(),
  name TEXT not null,
  description TEXT,
  active BOOLEAN not null default true,
  created_at TIMESTAMPTZ not null default now()
);

create table bookings (
  id UUID primary key default gen_random_uuid(),
  booking_number TEXT not null unique,
  customer_id UUID not null references customers(id),
  location_id UUID not null references locations(id),
  status TEXT not null check (status in ('waiting','cutting','completed','cancelled')),
  joined_at TIMESTAMPTZ not null default now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  price NUMERIC,
  notes TEXT,
  created_at TIMESTAMPTZ not null default now(),
  updated_at TIMESTAMPTZ not null default now()
);

create table barber_settings (
  id UUID primary key default gen_random_uuid(),
  accepting_customers BOOLEAN not null default true,
  updated_at TIMESTAMPTZ not null default now()
);

-- seed
insert into locations (name) values
  ('Barber''s Hostel'), ('NRI Hostel'), ('Customer Location');

insert into barber_settings (accepting_customers) values (true);
```

**RLS (defense-in-depth for this slice):**
- `customers`: insert allowed (anon); no update/delete allowed (anon).
- `locations`: select allowed (anon); no write (anon).
- `barber_settings`: select allowed (anon); no write (anon) — since no barber UI exists yet, all writes happen manually in the Supabase dashboard during this slice.
- `bookings`: insert allowed (anon); select/update allowed only where the request matches on `booking_number` + the customer's `phone` (via a Postgres function or matching policy), and update is restricted to setting `status = 'cancelled'` only — no other column may change under the anon role.

> Note: as agreed in PRP §4.2, this RLS is a backup layer. The actual `/api/**` route handlers use the service role key and are the real enforcement point for this slice's business rules.

## 4. API contracts

### `POST /api/queue/join`

Request:
```json
{ "name": "Emmanuel", "phone": "+919876543210", "location_id": "uuid" }
```

Server logic (per PRP §4.4):
1. If `barber_settings.accepting_customers = false` → `403 { "error": "Queue is currently closed" }`
2. Find or create `customers` row by `phone`.
3. If an existing booking for this customer has `status IN ('waiting','cutting')` → `409 { "error": "You already have a booking" }`
4. Generate `booking_number` (format `HQ-####`, sequential).
5. Insert booking: `status='waiting'`, `joined_at=now()` (DB server clock).
6. Compute position (see `lib/queue/position.js`: count of active bookings with `joined_at <=` this one).

Response `201`:
```json
{ "booking_number": "HQ-1842", "position": 4 }
```

### `GET /api/queue/[bookingNumber]`

Response `200`:
```json
{
  "booking_number": "HQ-1842",
  "name": "Emmanuel",
  "location": "Barber's Hostel",
  "status": "waiting",
  "position": 3,
  "estimated_wait_minutes": 110
}
```
`404` if booking number doesn't exist.

### `PATCH /api/queue/[bookingNumber]` (cancel)

Request: `{ "phone": "+919876543210" }` (must match the booking's customer, or request is rejected — this is the check that stands in for "auth" on the customer side).

- If `phone` doesn't match → `403 { "error": "Not your booking" }`
- If `status` is not `waiting` → `400 { "error": "Booking can no longer be cancelled" }`
- Else → `status='cancelled'`, `200 { "status": "cancelled" }`

### `lib/queue/waitTime.js` — this slice's version

No `completed` bookings will exist yet in a fresh install, so:
```
FALLBACK_AVERAGE_MINUTES = 55   // per blueprint §12
estimated_wait = people_ahead * FALLBACK_AVERAGE_MINUTES
```
The dynamic "average of real completed haircuts" version described in PRP/blueprint §13 is deferred until the barber flow (next slice) produces real `completed_at` data.

## 5. UI behavior for this slice

**`/` (homepage)**
- Shows currently-cutting customer's first name if one exists, else "No one in the chair right now."
- Shows count of people `waiting`.
- "Join Queue" button → `/join`. If `accepting_customers=false`, button is replaced with "Queue closed" message and no form is reachable.

**`/join`**
- Fields: name, phone, location (select from `locations` where `active=true`).
- On submit → `POST /api/queue/join`. On success, redirect to `/booking/[booking_number]`. On `409`, show the "you already have a booking" message with a link to look it up.

**`/booking/[bookingNumber]`**
- Shows status, position (if `waiting`/`cutting`), estimated wait, and a "Cancel booking" button (prompts for phone number to confirm ownership per the `PATCH` contract) — only shown if `status='waiting'`.

## 6. Acceptance criteria (must all pass before this slice is considered done)

- [ ] Fresh DB migration + seed runs cleanly.
- [ ] Submitting `/join` creates a `customers` row (or reuses existing by phone) and a `bookings` row with `status='waiting'` and `joined_at` set by the DB, not the client.
- [ ] Submitting `/join` twice with the same phone while the first booking is still `waiting` returns the `409` "already have a booking" error and does not create a second row.
- [ ] `/booking/[bookingNumber]` shows the correct position, matching `ORDER BY joined_at ASC` over all `waiting`/`cutting` bookings.
- [ ] Manually inserting a second booking with an earlier `joined_at` (simulating another customer) shifts the first customer's displayed position up by one, with no code change required — proving position is calculated, not stored.
- [ ] Cancelling via `/booking/[bookingNumber]` sets `status='cancelled'`, the row is **not** deleted, and the booking disappears from position calculations for everyone else.
- [ ] Attempting to cancel with a phone number that doesn't match the booking returns `403` and the booking is untouched.
- [ ] Setting `barber_settings.accepting_customers=false` directly in Supabase hides the join form on `/` and causes `POST /api/queue/join` to return `403`.
- [ ] `npm run build` completes with no errors.

## 7. Next step after this slice

Once all acceptance criteria pass, move to the **Verification Plan** for this slice (formal test script / checklist to run before merging), then the **Prompt Chain** that breaks §1's file list into individually implementable, ordered prompts for the coding session.
