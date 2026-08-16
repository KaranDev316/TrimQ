# PRP.md — HairQueue V1

> This document is the single, self-contained implementation brief for HairQueue V1.
> It assumes `CONTEXT.md` as the source of truth for scope and stack decisions. Nothing here contradicts it — this document makes it executable.

---

## 1. Goal

Ship a working V1 where one barber can run his entire day from a mobile dashboard, and customers can join a fair, first-come-first-served digital queue instead of relying on WhatsApp or memory.

**Definition of done (from CONTEXT.md):** 10 customers arrive/book in a day, the system correctly shows positions #1→#N in join order, cancellations recalculate positions correctly, and the barber can operate the full day (add, start, complete, cancel) from the dashboard alone.

---

## 2. Why

The barber's current process (WhatsApp/memory) is unfair, error-prone, and gives customers zero visibility. HairQueue removes ambiguity about "who's next" by making the server — not any human or phone clock — the single authority on queue order.

---

## 3. What

### 3.1 User-visible behavior

**Customer**
- Lands on `/`, sees who's currently being served and how many people are waiting.
- Joins via `/join`: name, WhatsApp number, location.
- Gets a `booking_number` and can view live status at `/booking/[bookingNumber]`.
- Can cancel their own booking from that page.
- If the barber has queue intake turned off, sees a "queue closed" message instead of the join form.

**Barber**
- Logs in at `/barber/login` (Supabase Auth).
- Sees `/barber/dashboard`: who's cutting, who's next, full waiting list, completed/cancelled history.
- Can add a walk-in customer manually.
- Can start the next haircut (only one `cutting` at a time — enforced server-side).
- Can complete the current haircut (auto-promotes next waiting customer).
- Can cancel any booking.
- Can toggle "Accepting customers: ON/OFF."

### 3.2 Non-negotiable business rules (from blueprint)

1. **The server determines queue order.** Position is never sent by the client and never trusted from the client.
2. **`joined_at` is always server time.** Never derived from the customer's device.
3. Queue **position is calculated, not stored** — always derived via `ORDER BY joined_at ASC WHERE status IN ('waiting','cutting')`.
4. A customer cannot have two simultaneous active bookings (`waiting` or `cutting`).
5. Only one booking can be `cutting` at a time.
6. Bookings are **never deleted** — cancelled/completed bookings persist as history.
7. Status can only move forward through: `waiting → cutting → completed`, or `waiting → cancelled`. No other transition is valid.

---

## 4. Context

### 4.1 Data model (Supabase/PostgreSQL)

```sql
-- customers
id          UUID PRIMARY KEY DEFAULT gen_random_uuid()
name        TEXT NOT NULL
phone       TEXT NOT NULL
created_at  TIMESTAMPTZ NOT NULL DEFAULT now()

-- locations
id           UUID PRIMARY KEY DEFAULT gen_random_uuid()
name         TEXT NOT NULL
description  TEXT
active       BOOLEAN NOT NULL DEFAULT true
created_at   TIMESTAMPTZ NOT NULL DEFAULT now()

-- bookings
id               UUID PRIMARY KEY DEFAULT gen_random_uuid()
booking_number   TEXT NOT NULL UNIQUE          -- e.g. "HQ-1842"
customer_id      UUID NOT NULL REFERENCES customers(id)
location_id      UUID NOT NULL REFERENCES locations(id)
status           TEXT NOT NULL CHECK (status IN ('waiting','cutting','completed','cancelled'))
joined_at        TIMESTAMPTZ NOT NULL DEFAULT now()
started_at       TIMESTAMPTZ
completed_at     TIMESTAMPTZ
price            NUMERIC
notes            TEXT
created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()

-- barber_settings (single row, V1 has exactly one barber)
id                 UUID PRIMARY KEY DEFAULT gen_random_uuid()
accepting_customers BOOLEAN NOT NULL DEFAULT true
updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
```

**Seed data for `locations`:** "Barber's Hostel", "NRI Hostel", "Customer Location" (per CONTEXT.md — no maps/address validation logic).

### 4.2 Row Level Security (defense-in-depth)

RLS policies enforce the rules in CONTEXT.md §Security at the database layer:
- Customers: `INSERT` own booking, `SELECT`/`UPDATE (status='cancelled' only)` own booking by matching `phone` + `booking_number`. Cannot touch `joined_at`, `status` (other than to cancel), or any other customer's row.
- Barber (authenticated via Supabase Auth): full `SELECT`/`UPDATE`/`INSERT` on `bookings`, `customers`, `locations`, `barber_settings`.

**Important:** RLS is the *backup* layer. The primary authority is server-side logic in API routes (see §4.4), which run with the Supabase **service role key** so all business rules (position calculation, one-active-cutting-at-a-time, status transitions) are enforced in one place, in code, not scattered across policies.

### 4.3 Folder structure (locked in for this PRP)

Next.js **App Router**, organized **by type**:

```
/app
  /page.js                              → customer homepage
  /join
    /page.js                            → join queue form
  /booking
    /[bookingNumber]/page.js            → booking status + cancel
  /barber
    /login/page.js
    /dashboard/page.js
  /api
    /queue
      /join/route.js                    → POST: create booking
      /[bookingNumber]/route.js         → GET: status, PATCH: cancel (customer-owned)
    /barber
      /bookings/route.js                → GET: today's full queue
      /bookings/add/route.js            → POST: manual add
      /bookings/[id]/start/route.js     → POST
      /bookings/[id]/complete/route.js  → POST
      /bookings/[id]/cancel/route.js    → POST (barber-side cancel)
      /settings/route.js                → GET/PATCH accepting_customers

/components
  /customer/                            → HomeQueueStatus, JoinForm, BookingStatusCard
  /barber/                              → DashboardHeader, NowCutting, WaitingList, AddCustomerModal
  /shared/                              → Button, Card, StatusBadge, LoadingSpinner

/lib
  /supabase/client.js                   → browser client (anon key)
  /supabase/server.js                   → server client (service role key, server-only)
  /queue/position.js                    → position calculation helper
  /queue/waitTime.js                    → average-duration wait estimate helper
  /bookingNumber.js                     → HQ-#### generator

/constants
  /status.js                            → { WAITING, CUTTING, COMPLETED, CANCELLED }
```

**Environment variables (`.env.local`, never committed):**
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=      # used by browser client, constrained by RLS
SUPABASE_SERVICE_ROLE_KEY=          # server-only, used in /app/api/** route handlers
```

### 4.4 Key server logic (pseudocode)

**Join queue — `POST /api/queue/join`**
```
input: { name, phone, location_id }

1. find customer by phone, or create one
2. check bookings WHERE customer_id = X AND status IN ('waiting','cutting')
   → if found: return 409 "You already have a booking"
3. booking_number = next sequential HQ-#### (see bookingNumber.js)
4. insert booking: status='waiting', joined_at=now() [server clock, never client]
5. return { booking_number, position }
   position = count of bookings WHERE status IN ('waiting','cutting')
              AND joined_at <= this booking's joined_at
```

**Get position (used by both booking-status page and dashboard)**
```
active = SELECT * FROM bookings
         WHERE status IN ('waiting','cutting')
         ORDER BY joined_at ASC

position of booking X = 1-based index of X within `active`
```

**Start haircut — `POST /api/barber/bookings/[id]/start`**
```
1. check: no other booking has status='cutting'
   → if one exists: return 409 "Finish the current haircut first"
2. update booking: status='cutting', started_at=now()
```

**Complete haircut — `POST /api/barber/bookings/[id]/complete`**
```
1. update booking: status='completed', completed_at=now()
2. (no auto-start of next — barber explicitly taps START for the next customer,
    per blueprint: dashboard just surfaces who's NEXT)
```

**Cancel — `PATCH /api/queue/[bookingNumber]` (customer) or `POST /api/barber/bookings/[id]/cancel` (barber)**
```
1. update booking: status='cancelled'
2. booking row is kept, never deleted
```

**Wait-time estimate — `lib/queue/waitTime.js`**
```
avg_duration = AVERAGE(completed_at - started_at) over all status='completed' bookings
               (fallback default, e.g. 55 min, if fewer than N completed bookings exist)
people_ahead = count of active bookings with joined_at earlier than this one
estimate = people_ahead * avg_duration
display: "~X hr Y min" with label "Estimated — actual time may vary."
```

### 4.5 Status flow guard (applies to every status-changing endpoint)

Only these transitions are valid — anything else returns a 400:
```
waiting   → cutting
waiting   → cancelled
cutting   → completed
```

---

## 5. Implementation Blueprint — task order

Follow this order. Do not start a later step before the previous one is verified.

1. **Database**
   - Create `customers`, `locations`, `bookings`, `barber_settings` tables.
   - Seed `locations` with the 3 fixed values.
   - Write and apply RLS policies.
2. **Server logic layer (`/lib`)**
   - `bookingNumber.js`, `queue/position.js`, `queue/waitTime.js`, Supabase client/server helpers.
3. **Customer flow**
   - `/join` → `POST /api/queue/join`
   - `/booking/[bookingNumber]` → `GET`/`PATCH /api/queue/[bookingNumber]`
   - `/` homepage (currently-cutting + waiting count, respects `accepting_customers` toggle)
4. **Barber flow**
   - `/barber/login` (Supabase Auth)
   - `/barber/dashboard` + all `/api/barber/**` routes (list, add, start, complete, cancel, settings toggle)
5. **Queue logic verification**
   - Manually test: duplicate booking prevention, cancellation mid-queue recalculating positions, only-one-cutting enforcement, invalid status transitions rejected.
6. **Mobile polish**
   - Tailwind mobile-first pass on both customer and barber views.
7. **Real-world test**
   - Hand to the barber for 5–10 real customers before any public launch.

---

## 6. Validation Gates

A step is not "done" until these pass:

- [ ] `npm run build` completes with no errors.
- [ ] SQL: two bookings with the same `phone` and status `waiting` cannot both exist (enforced in code, verified manually).
- [ ] Cancel a middle-of-queue booking → remaining bookings' calculated positions shift correctly (no gaps, no stored `position` field involved).
- [ ] Attempting to `start` a second booking while one is already `cutting` returns an error and does not change state.
- [ ] A customer `PATCH` request cannot alter `joined_at`, `status` to anything but `cancelled`, or another customer's booking (test both via the API and by attempting a direct Supabase client call with the anon key).
- [ ] Turning `accepting_customers` off hides the join form and blocks `POST /api/queue/join` with a clear message.
- [ ] Full day simulation: 10 sequential joins via the API show positions #1–#10 in correct join order; introduce a cancellation mid-list and confirm positions recalculate correctly for everyone after it.

---

## 7. Anti-Patterns to Avoid

- ❌ Storing a `position` column on `bookings` — position must always be calculated, never persisted.
- ❌ Accepting `joined_at`, `status`, or `position` from client request bodies.
- ❌ Letting the browser decide whose turn it is — every ordering decision happens server-side.
- ❌ Deleting bookings on cancel/complete — history must be preserved.
- ❌ Adding anything from CONTEXT.md's "Out of Scope" list (payments, WhatsApp API, maps, appointments, multiple barbers, customer accounts, ratings, AI, `NO_SHOW`).
- ❌ Introducing TypeScript, a component library, or a different styling system than what's locked in CONTEXT.md.

---

## 8. Next Step

Proceed to the **Vertical Slice**: implement Step 1 (database) + Step 2 (customer join flow) end-to-end — from `/join` form submission through to a working `/booking/[bookingNumber]` status page — as the first testable, demoable slice.
