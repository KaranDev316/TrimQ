# PROMPT_CHAIN.md — HairQueue V1, Slice 2

Same rules as Slice 1's chain: run these one at a time, in order, in an implementation session with real network access (Claude Code or your own local setup) against your already-provisioned Supabase project. Run the matching section of `VERIFICATION_PLAN_2.md` after each step before moving on.

All locked decisions still apply: JavaScript, App Router, Tailwind, folder-structure-by-type, secret-key client for privileged server work, publishable-key client for anything browser-facing.

---

### Prompt 1 — RLS policies for the authenticated (barber) role

```
Create /supabase/migrations/0003_barber_rls.sql implementing exactly the four
policies in VERTICAL_SLICE_2.md §5 — full access for the authenticated role on
customers, locations, bookings, and barber_settings. Do not modify or remove any
existing anon policies from migration 0002. Do not add anything beyond these
four CREATE POLICY statements.
```
**Enables:** T2.1 (indirectly — needed if any barber-side code ever uses the publishable client + session instead of secret key).

---

### Prompt 2 — Auth-check helper

```
Create /lib/supabase/authCheck.js exporting an async function
requireBarberSession(request) that:

1. Uses @supabase/ssr's route-handler client to read the Supabase Auth session
   from the incoming request's cookies.
2. If there is no valid session, returns null.
3. If there is a valid session, returns the session's user object.

This will be called at the top of every /app/api/barber/** route handler. Do not
implement any role/permission distinction beyond "is there a logged-in Supabase
Auth user" — there is exactly one barber account in this system (per
VERTICAL_SLICE_2.md §1, no signup UI).

Plain JavaScript, no TypeScript. Install @supabase/ssr if it isn't already a
dependency.
```
**Enables:** dependency for Prompts 4–8.

---

### Prompt 3 — Shared booking-creation logic (refactor)

```
Create /lib/queue/createBooking.js exporting an async function
createBooking(supabaseServerClient, { name, phone, location_id, price }) that
contains exactly the logic currently duplicated in
/app/api/queue/join/route.js: find-or-create customer by phone, check for an
existing active booking (status waiting/cutting) and throw/return a distinguishable
"duplicate" result if found, generate a booking number via
generateBookingNumber(), insert the booking with status='waiting' and
joined_at defaulting to the database's now(), and return the created booking
plus its computed position via getPosition().

Then refactor /app/api/queue/join/route.js to call this new function instead of
containing the logic inline. Confirm its request/response contract (from
VERTICAL_SLICE.md §4) is unchanged — this is a pure refactor, not a behavior
change. price is optional and only used by the barber-side add flow (Slice 1's
join endpoint never sends it).
```
**Enables:** T3.1–T3.4, T7.1–T7.2 (regression check).

---

### Prompt 4 — GET /api/barber/bookings

```
Create /app/api/barber/bookings/route.js implementing GET exactly per
VERTICAL_SLICE_2.md §6 "GET /api/barber/bookings":

1. Call requireBarberSession(request). If null, return 401.
2. Using the secret-key client, fetch: the single booking with status='cutting'
   (or null), all bookings with status='waiting' ordered by joined_at ASC (each
   with its computed position via getPosition()), all bookings with
   status='completed' whose completed_at is today (server date), all bookings
   with status='cancelled' whose updated_at is today, and the current
   barber_settings.accepting_customers value.
3. Return the exact JSON shape shown in VERTICAL_SLICE_2.md §6.

Use BOOKING_STATUS constants throughout, not string literals.
```
**Enables:** T1.4 (partially), T2.1.

---

### Prompt 5 — POST /api/barber/bookings/add

```
Create /app/api/barber/bookings/add/route.js implementing POST exactly per
VERTICAL_SLICE_2.md §6 "POST /api/barber/bookings/add":

1. Call requireBarberSession(request). If null, return 401.
2. Parse { name, phone, location_id, price } from the body (price optional).
3. Call createBooking() from /lib/queue/createBooking.js.
4. If it signals a duplicate active booking, return 409 with
   { error: "You already have a booking" } (same message as the customer-facing
   endpoint, for consistency).
5. Otherwise return 201 with { booking_number, position }.

This route does NOT check accepting_customers — the barber can always add a
walk-in regardless of that setting, per VERTICAL_SLICE_2.md §6.
```
**Enables:** T3.1–T3.4.

---

### Prompt 6 — start / complete / cancel routes

```
Create three files:

/app/api/barber/bookings/[id]/start/route.js
/app/api/barber/bookings/[id]/complete/route.js
/app/api/barber/bookings/[id]/cancel/route.js

Each implements POST exactly per VERTICAL_SLICE_2.md §6:

start: requireBarberSession check (401 if none) → if any booking already has
status='cutting', return 409 with { error: "Finish the current haircut first" }
→ else update the target booking to status='cutting', started_at=now() → return
200 with the updated booking.

complete: requireBarberSession check → update target booking to
status='completed', completed_at=now() → return 200. Do not auto-start the next
booking.

cancel: requireBarberSession check → if target booking's status is 'completed'
or already 'cancelled', return 400 → else update to status='cancelled' → return
200. Do not delete the row.

Use BOOKING_STATUS constants throughout. Use the secret-key client for all
writes, after the auth check passes.
```
**Enables:** T4.1–T4.6.

---

### Prompt 7 — GET/PATCH /api/barber/settings

```
Create /app/api/barber/settings/route.js implementing GET and PATCH exactly per
VERTICAL_SLICE_2.md §6:

GET: requireBarberSession check (401 if none) → return
{ accepting_customers: <current value> }.

PATCH: requireBarberSession check → parse { accepting_customers } from the body
(must be boolean) → update the single barber_settings row → return the new
value in the same shape as GET.
```
**Enables:** T5.1, T5.4.

---

### Prompt 8 — Barber login page

```
Create /app/barber/login/page.js as a Client Component:

- Email + password fields, a submit button.
- On submit, call Supabase Auth's sign-in-with-password using the
  publishable-key client (/lib/supabase/client.js).
- On success, redirect to /barber/dashboard.
- On failure, show a generic "Invalid email or password" message — do not
  reveal whether the email exists.

Style with Tailwind, mobile-first. Plain JavaScript, no TypeScript.
```
**Enables:** T1.1, T1.2.

---

### Prompt 9 — Barber dashboard page

```
Create /app/barber/dashboard/page.js implementing the layout described in
VERTICAL_SLICE_2.md §8:

- On load, check for a valid session (client-side check via the publishable
  client, or a server component check — your choice); if none, redirect to
  /barber/login.
- Fetch GET /api/barber/bookings and render:
  - Header: today's date, "N Cutting" (0 or 1) + "N Waiting" count.
  - "Now cutting" card with name, started time, and a [Complete] button
    (calls POST .../complete). If no one is cutting, show "No one in the
    chair."
  - "Next" list: each waiting booking with position, name, location, joined
    time, a [Start] button (disabled if someone is already cutting, calls
    POST .../start) and a [Cancel] button (calls POST .../cancel).
  - [+ Add Customer] button opening a simple form (name, phone, location
    select populated from locations, optional price) that posts to
    /api/barber/bookings/add.
  - "Accepting customers: ON/OFF" toggle calling PATCH /api/barber/settings.
  - A secondary, visually de-emphasized section listing today's completed and
    cancelled bookings.
- Refetch or optimistically update the queue view after every action (start,
  complete, cancel, add, settings toggle) so the dashboard stays in sync
  without a manual page reload.

Style with Tailwind, mobile-first, matching the information hierarchy in
blueprint §16 (now cutting → next → add customer). Plain JavaScript, no
TypeScript.
```
**Enables:** T1.3, T2.1, T3.1, T4.1–T4.6, T5.1–T5.4.

---

### Prompt 10 — Final integration pass

```
Run `npm run build` and fix any errors without changing scope — do not add,
remove, or modify any feature beyond what's specified in Prompts 1–9 and
VERTICAL_SLICE_2.md. If a build error reveals a genuine gap in an earlier
prompt's spec, fix only that gap.

Then run through VERIFICATION_PLAN_2.md §1–§7 in full, including the Slice 1
regression checks in §7, and report which test cases pass and which fail. Do
not mark this slice done until every case passes.
```
**Enables:** T6.1, sign-off in VERIFICATION_PLAN_2.md §8.

---

## After this chain completes

Per `VERTICAL_SLICE_2.md` §10, this completes HairQueue V1 functionally. What remains — PRP.md Step 5 (mobile polish) and Step 6 (real-world test with the actual barber) — are refinement and validation passes against the existing two slices, not new vertical slices, and don't need their own PRP/Vertical-Slice/Verification-Plan/Prompt-Chain documents.
