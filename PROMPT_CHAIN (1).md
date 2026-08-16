# PROMPT_CHAIN.md — HairQueue V1, Slice 1

Each numbered block below is a **self-contained prompt** meant to be run one at a time in an implementation session (e.g. Claude Code), in order. Do not skip ahead or combine steps — each one assumes only the previous steps exist.

Every prompt already encodes the locked decisions from `CONTEXT.md` / `PRP.md` / `VERTICAL_SLICE.md`: JavaScript (no TypeScript), Next.js App Router, Tailwind CSS, folder-structure-by-type, service-role key for API routes, anon key + RLS as backup only. Do not deviate from these inside any individual prompt.

After each step, run the matching section of `VERIFICATION_PLAN.md` before moving to the next prompt.

---

### Prompt 1 — Database migration + seed

```
Create a Supabase SQL migration file at /supabase/migrations/0001_init.sql implementing
exactly this schema (no additional columns, no additional tables):

- customers(id, name, phone, created_at)
- locations(id, name, description, active, created_at)
- bookings(id, booking_number, customer_id, location_id, status, joined_at,
  started_at, completed_at, price, notes, created_at, updated_at)
  with status constrained to ('waiting','cutting','completed','cancelled')
- barber_settings(id, accepting_customers, updated_at)

Use gen_random_uuid() for all primary keys and now() as defaults where specified
in VERTICAL_SLICE.md §3.

In the same file, seed:
- locations: 'Barber''s Hostel', 'NRI Hostel', 'Customer Location' (all active=true)
- barber_settings: one row with accepting_customers=true

Do not add indexes, triggers, or columns beyond what's listed. Do not add a
NO_SHOW status. Reference: VERTICAL_SLICE.md §3 for exact DDL.
```
**Enables:** T1.1–T1.3.

---

### Prompt 2 — Row Level Security policies

```
Create a second migration file at /supabase/migrations/0002_rls.sql that enables
RLS on customers, locations, bookings, and barber_settings, and adds these
policies exactly as specified in VERTICAL_SLICE.md §3 "RLS" note and PRP.md §4.2:

- customers: anon can INSERT; no anon UPDATE/DELETE; no anon SELECT beyond what's
  needed to support the bookings policies below.
- locations: anon can SELECT where active=true; no anon writes.
- barber_settings: anon can SELECT; no anon writes.
- bookings: anon can INSERT. Anon can SELECT and UPDATE a row only when the
  request's phone matches the row's linked customer's phone AND the booking_number
  matches. When anon UPDATEs, only status may change, and only to 'cancelled'
  (never to any other value, never any other column).

Do not add a barber/authenticated-role policy yet — that comes in a later slice
when Supabase Auth for the barber is implemented. For this slice, all barber-side
data access goes through the service role key in API routes, which bypasses RLS
by design (per PRP.md §4.2).

Write this as plain SQL using Postgres RLS syntax (CREATE POLICY ...).
```
**Enables:** T7.1–T7.3.

---

### Prompt 3 — Supabase client helpers

```
Create two files:

/lib/supabase/client.js — exports a Supabase client for browser/client-component
use, initialized with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.

/lib/supabase/server.js — exports a Supabase client for use only inside
/app/api/** route handlers, initialized with NEXT_PUBLIC_SUPABASE_URL and
SUPABASE_SERVICE_ROLE_KEY. Add a comment warning this file must never be
imported into any client component.

Plain JavaScript, no TypeScript. Use the @supabase/supabase-js package.
```
**Enables:** dependency for Prompts 6–9.

---

### Prompt 4 — Status constants

```
Create /constants/status.js exporting a single object:

export const BOOKING_STATUS = {
  WAITING: 'waiting',
  CUTTING: 'cutting',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

No other exports. This will be imported by API routes and UI components instead
of hardcoding status strings.
```
**Enables:** dependency for Prompts 8–12.

---

### Prompt 5 — Booking number generator + position/wait-time helpers

```
Create three files in /lib/queue/ and /lib/:

1. /lib/bookingNumber.js — exports an async function generateBookingNumber(supabaseServerClient)
   that returns the next sequential booking number in the format "HQ-####"
   (e.g. HQ-1842), based on the highest existing numeric suffix in the bookings
   table's booking_number column. Handle the case where no bookings exist yet
   (start at HQ-1001, an arbitrary starting point — pick one and note it as
   configurable via a constant, not baked into the logic).

2. /lib/queue/position.js — exports an async function getPosition(supabaseServerClient, bookingId)
   that implements exactly the algorithm in PRP.md §4.4 "Get position": select all
   bookings with status IN ('waiting','cutting') ordered by joined_at ASC, and
   return the 1-based index of the given bookingId within that list. Return null
   if the booking isn't in that active set (e.g. it's completed/cancelled).

3. /lib/queue/waitTime.js — exports a function estimateWaitMinutes(peopleAhead)
   that returns peopleAhead * 55 (the fallback average from blueprint §12, per
   VERTICAL_SLICE.md §4 "this slice's version" — do NOT implement the dynamic
   averaging from real completed_at data; that's explicitly deferred).

Plain JavaScript, async/await style, no TypeScript.
```
**Enables:** dependency for Prompts 6–7; T4.1–T4.3 rely on position.js correctness.

---

### Prompt 6 — POST /api/queue/join

```
Create /app/api/queue/join/route.js implementing POST exactly per PRP.md §4.4
"Join queue" and VERTICAL_SLICE.md §4 "POST /api/queue/join":

1. Parse { name, phone, location_id } from the request body.
2. Using the service-role Supabase client (/lib/supabase/server.js), check
   barber_settings.accepting_customers. If false, return 403 with
   { error: "Queue is currently closed" }.
3. Find a customers row by phone; if none exists, create one with the given name
   and phone.
4. Check for an existing booking for this customer_id with status IN
   ('waiting','cutting'). If found, return 409 with
   { error: "You already have a booking" }.
5. Generate a booking_number via generateBookingNumber().
6. Insert a bookings row: status = BOOKING_STATUS.WAITING, joined_at defaults to
   the database's now() — do not set joined_at from any request data.
7. Compute position via getPosition().
8. Return 201 with { booking_number, position }.

Use the BOOKING_STATUS constants, not string literals. Validate that name, phone,
and location_id are present and non-empty before doing anything else — return 400
if not. Do not add any fields to the request/response shape beyond what's shown
above.
```
**Enables:** T2.1–T2.3, T3.1–T3.2.

---

### Prompt 7 — GET / PATCH /api/queue/[bookingNumber]

```
Create /app/api/queue/[bookingNumber]/route.js implementing GET and PATCH exactly
per PRP.md §4.4 and VERTICAL_SLICE.md §4:

GET:
1. Look up the booking by booking_number, joined with customers (for name) and
   locations (for location name).
2. If not found, return 404.
3. If status is 'waiting' or 'cutting', compute position via getPosition() and
   estimated_wait_minutes via estimateWaitMinutes(position - 1). If status is
   'completed' or 'cancelled', omit position and estimated_wait_minutes (or set
   them null — pick one and be consistent).
4. Return 200 with:
   { booking_number, name, location, status, position, estimated_wait_minutes }

PATCH (cancel):
1. Parse { phone } from the request body.
2. Look up the booking by booking_number. If not found, return 404.
3. If the booking's linked customer's phone doesn't match the request's phone,
   return 403 with { error: "Not your booking" }.
4. If the booking's status is not 'waiting', return 400 with
   { error: "Booking can no longer be cancelled" }.
5. Update status to BOOKING_STATUS.CANCELLED. Do not touch any other column.
6. Return 200 with { status: "cancelled" }.

Use the service-role client. Use BOOKING_STATUS constants throughout.
```
**Enables:** T4.1, T5.1–T5.4.

---

### Prompt 8 — Homepage `/app/page.js`

```
Create /app/page.js (Server Component) implementing the homepage described in
VERTICAL_SLICE.md §5:

- Query barber_settings.accepting_customers, the current 'cutting' booking (if
  any, with the customer's first name), and a count of 'waiting' bookings —
  using the service-role client is fine here since this is a server component,
  not a client-exposed API route.
- If accepting_customers is true: show "Currently cutting: <name>" or "No one in
  the chair right now," show "<n> people waiting," and a "Join Queue" link to
  /join.
- If accepting_customers is false: show a "Queue closed" message and no link to
  /join.

Style with Tailwind, mobile-first, matching the tone in blueprint §15 (simple,
not overwhelming). Do not add a "Check Booking" search box yet — that's not in
this slice's scope (customers reach /booking/[bookingNumber] via the link they
were given after joining).
```
**Enables:** T6.2.

---

### Prompt 9 — Join form `/app/join/page.js`

```
Create /app/join/page.js as a Client Component implementing the join form
described in VERTICAL_SLICE.md §5:

- Fields: name (text), phone (text), location (select, populated from GET on
  locations where active=true — fetch this via the anon client since it's
  client-side and locations are readable by anon per the RLS policy).
- On submit, POST to /api/queue/join with { name, phone, location_id }.
- On success (201), redirect to /booking/<booking_number>.
- On 409, show the "You already have a booking" message inline, with a note
  that they can check their existing booking status if they have their booking
  number.
- On other errors (400, 403, 500), show a generic inline error message.

Style with Tailwind, mobile-first. Plain JavaScript, no TypeScript.
```
**Enables:** T2.1, T3.1.

---

### Prompt 10 — Booking status page `/app/booking/[bookingNumber]/page.js`

```
Create /app/booking/[bookingNumber]/page.js implementing the status view
described in VERTICAL_SLICE.md §5:

- Fetch GET /api/queue/[bookingNumber] on load (server component fetch is fine,
  or client-side — your choice, but keep it simple).
- Display status, position (if waiting/cutting), estimated wait time with the
  label "Estimated — actual time may vary" (per blueprint §12), and location.
- If status is 'waiting', show a "Cancel booking" button that, when clicked,
  prompts for a phone number (simple input, not a modal library) and calls
  PATCH /api/queue/[bookingNumber] with { phone }. On success, refresh the view
  to show status: cancelled. On 403, show "That phone number doesn't match this
  booking." On 400, show the returned error message.
- If status is 'completed' or 'cancelled', don't show the cancel button.
- If the booking number doesn't exist (404 from the API), show a clear
  "Booking not found" message.

Style with Tailwind, mobile-first. Plain JavaScript, no TypeScript.
```
**Enables:** T4.1, T5.1, T5.3, T5.4.

---

### Prompt 11 — Final integration pass

```
Run `npm run build` and fix any errors without changing scope — do not add,
remove, or modify any feature beyond what's specified in Prompts 1–10 and
VERTICAL_SLICE.md. If a build error reveals a genuine gap in an earlier prompt's
spec (e.g. a missing import), fix only that gap.

Then run through VERIFICATION_PLAN.md §1–§7 in full and report which test cases
pass and which fail. Do not mark this slice done until every case passes.
```
**Enables:** T1.4, sign-off in VERIFICATION_PLAN.md §8.

---

## After this chain completes

Do not start Slice 2 (barber flow) until `VERIFICATION_PLAN.md` §8 sign-off is fully checked. At that point, the next phase is **Implementation** of Slice 2 — which will need its own Vertical Slice / Verification Plan / Prompt Chain documents, following this same pattern, before any barber-side code is written.
