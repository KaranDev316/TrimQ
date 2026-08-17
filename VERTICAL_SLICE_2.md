# VERTICAL_SLICE.md — HairQueue V1, Slice 2

**Scope:** PRP Step 3 (Barber flow), building directly on top of Slice 1 (database + customer join flow, already verified and signed off).
**Purpose of this slice:** Let the barber actually run a real day — log in, see the live queue Slice 1 produces, add walk-ins, and move bookings through `waiting → cutting → completed`, with `cancel` available at any point before `completed`.

Nothing here contradicts `CONTEXT.md` or `PRP.md`. It narrows PRP.md to exactly what gets built next, the same way `VERTICAL_SLICE.md` (Slice 1) did.

---

## 1. In scope for this slice

- Supabase Auth: one barber account, created manually in the Supabase dashboard (no in-app signup — there's exactly one barber, per CONTEXT.md's out-of-scope list excluding multi-barber support).
- RLS: `authenticated` role policies granting the barber full access to `bookings`, `customers`, `locations`, `barber_settings` (backup layer, per PRP.md §4.2).
- `/app/barber/login/page.js`
- `/app/barber/dashboard/page.js`
- `/app/api/barber/bookings/route.js` — `GET` today's full queue
- `/app/api/barber/bookings/add/route.js` — `POST` manual add
- `/app/api/barber/bookings/[id]/start/route.js` — `POST`
- `/app/api/barber/bookings/[id]/complete/route.js` — `POST`
- `/app/api/barber/bookings/[id]/cancel/route.js` — `POST`
- `/app/api/barber/settings/route.js` — `GET`/`PATCH` `accepting_customers`
- Auth-check helper used by every `/api/barber/**` route (new — see §4.1)

## 2. Explicitly out of scope for this slice

- Barber self-signup or password reset UI (create the one account manually in Supabase dashboard for now)
- `NO_SHOW` status (still deferred to V2, per CONTEXT.md)
- Dynamic wait-time averaging from real `completed_at` data — **this slice is what finally produces that data**, but wiring `lib/queue/waitTime.js` to use it is a separate, later change so Slice 2 stays scoped to the barber-side CRUD. The fallback constant (55 min) from Slice 1 keeps running unchanged.
- Any of CONTEXT.md's permanent out-of-scope items (payments, WhatsApp API, maps, appointments, multiple barbers, customer accounts, ratings, AI)

## 3. Architecture decision for this slice (stated explicitly, not assumed silently)

**How barber API routes verify the caller is actually logged in:**
Every `/app/api/barber/**` route handler first checks the caller's Supabase Auth session using `@supabase/ssr`'s route-handler client (reads the session cookie set at login). If there's no valid session, the route returns `401` immediately and performs no database operation. Only after that check passes does the route use the secret-key client (`/lib/supabase/server.js`) to perform the actual read/write — consistent with PRP.md §4.2's rule that server-side code, not RLS alone, is the primary enforcement point.

This is a new file: `/lib/supabase/authCheck.js`, exporting a function that returns the authenticated user or throws/returns null. It's a sensible-default implementation of "protected login" from blueprint §17 — flag if you'd rather use a different session-handling approach before Prompt 1 of this slice's chain runs.

## 4. Database — no new tables

Slice 2 uses the exact schema from Slice 1 (`customers`, `locations`, `bookings`, `barber_settings`). Only new RLS policies are added (see §5).

## 5. RLS — new policies for the `authenticated` role

```sql
-- authenticated (barber) has full access — anon policies from Slice 1 are untouched
create policy "barber full access customers" on customers
  for all to authenticated using (true) with check (true);

create policy "barber full access locations" on locations
  for all to authenticated using (true) with check (true);

create policy "barber full access bookings" on bookings
  for all to authenticated using (true) with check (true);

create policy "barber full access settings" on barber_settings
  for all to authenticated using (true) with check (true);
```

This is a backup layer only — as in Slice 1, the real enforcement is in the API route code (§3), which additionally uses the secret-key client that bypasses RLS entirely. These policies matter if barber-side code ever queries with the publishable key + a user session instead of the secret key.

## 6. API contracts

### `GET /api/barber/bookings`

Auth required (§3). Returns everything needed to render the dashboard in one call:

```json
{
  "cutting": { "id": "...", "booking_number": "HQ-1840", "name": "Daniel", "location": "Barber's Hostel", "started_at": "..." } | null,
  "waiting": [
    { "id": "...", "booking_number": "HQ-1841", "name": "Samuel", "location": "NRI Hostel", "joined_at": "...", "position": 1 },
    { "id": "...", "booking_number": "HQ-1842", "name": "Emmanuel", "location": "Barber's Hostel", "joined_at": "...", "position": 2 }
  ],
  "completed_today": [ { "booking_number": "HQ-1839", "name": "Michael", "completed_at": "..." } ],
  "cancelled_today": [ { "booking_number": "HQ-1838", "name": "Peter", "cancelled_at": "..." } ],
  "accepting_customers": true
}
```
`position` is computed with the same `lib/queue/position.js` helper from Slice 1 — no duplicate logic.
"Today" = bookings whose relevant timestamp (`completed_at`/`updated_at` for cancelled) falls on the current server-local date.

### `POST /api/barber/bookings/add`

Request:
```json
{ "name": "Michael", "phone": "+913333333333", "location_id": "uuid", "price": 150 }
```
Same core logic as `POST /api/queue/join` (PRP.md §4.4) — find-or-create customer, reject if an active booking already exists (`409`), create booking with `status='waiting'`, `joined_at=now()`. Reuses the exact same duplicate-check and booking-number-generation logic; does **not** duplicate that code — both routes call the same shared function (see §7 refactor note).
Response `201`: `{ "booking_number": "HQ-1843", "position": 3 }`.
Does **not** check `accepting_customers` — the barber can always add a walk-in even if online intake is paused.

### `POST /api/barber/bookings/[id]/start`

1. Auth check.
2. If any booking already has `status='cutting'`, return `409 { "error": "Finish the current haircut first" }`.
3. Else update the target booking: `status='cutting'`, `started_at=now()`.
4. Return `200` with the updated booking.

### `POST /api/barber/bookings/[id]/complete`

1. Auth check.
2. Update: `status='completed'`, `completed_at=now()`. No auto-start of the next booking (barber explicitly taps start next, per blueprint §10).
3. Return `200`.

### `POST /api/barber/bookings/[id]/cancel`

1. Auth check.
2. If `status` is `completed` or already `cancelled`, return `400`.
3. Else update `status='cancelled'`.
4. Return `200`.

### `GET` / `PATCH /api/barber/settings`

`GET`: returns `{ "accepting_customers": true }`.
`PATCH`: body `{ "accepting_customers": false }` → updates the single `barber_settings` row, returns the new value. Auth required on both.

## 7. Refactor note (small, in-scope)

`POST /api/queue/join` (Slice 1) and `POST /api/barber/bookings/add` (this slice) share identical "find-or-create customer → reject duplicate active booking → create booking" logic. Extract this into `/lib/queue/createBooking.js` and have both routes call it, rather than duplicating the logic. This is a refactor of existing Slice 1 code, not a scope addition — call it out explicitly in the Prompt Chain so it isn't skipped or done inconsistently.

## 8. UI behavior for this slice

**`/barber/login`**
- Email + password form. Submits to Supabase Auth's sign-in (client-side, via the publishable-key client). On success, redirect to `/barber/dashboard`. On failure, show a generic "invalid credentials" message.

**`/barber/dashboard`**
- Protected: if there's no valid session, redirect to `/barber/login`.
- Header: today's date, count cutting (0 or 1) + count waiting.
- "Now cutting" card: name, started time, `[Complete]` button. If no one is cutting: "No one in the chair" + nothing to complete.
- "Next" list: each waiting booking with position, name, location, joined time, and per-row `[Start]` (disabled/hidden if someone is already cutting) and `[Cancel]` buttons.
- `[+ Add Customer]` button opens a small form (name, phone, location, optional price) that posts to the add endpoint.
- "Accepting customers: ON/OFF" toggle, calling `PATCH /api/barber/settings`.
- A collapsed/secondary section listing today's completed and cancelled bookings (per blueprint §10/§16), not the main focus of the screen.

Mobile-first Tailwind styling, matching blueprint §16's dashboard layout intent (not pixel-exact, but same information hierarchy: now cutting → next → add customer).

## 9. Acceptance criteria

- [ ] The one barber account (created manually in Supabase Auth) can log in at `/barber/login` and reach `/barber/dashboard`.
- [ ] Visiting `/barber/dashboard` without a session redirects to `/barber/login`.
- [ ] Every `/api/barber/**` route returns `401` when called without a valid session (test with a plain `curl`, no auth cookie).
- [ ] Dashboard shows the exact `waiting` list and positions produced by Slice 1's `lib/queue/position.js`, cross-checked against `/booking/[bookingNumber]` for the same bookings.
- [ ] Adding a walk-in via the dashboard creates a `waiting` booking with server-set `joined_at`, and it appears in the correct position relative to existing customer-joined bookings (interleaved by time, per blueprint §8's Daniel/Emmanuel/Samuel example).
- [ ] Adding a walk-in with a phone number that already has an active booking returns `409` and does not create a duplicate, exactly like the customer-facing join flow.
- [ ] Starting a haircut while another is already `cutting` returns `409` and changes nothing.
- [ ] Completing a haircut sets `completed_at`, and the completed booking moves out of the "waiting"/"cutting" view into the completed history — it no longer counts toward anyone's position on `/booking/[bookingNumber]`.
- [ ] Cancelling a `waiting` booking from the dashboard removes it from the queue and correctly shifts remaining positions (same recalculation as Slice 1's customer-side cancel).
- [ ] Toggling "Accepting customers" off from the dashboard is immediately reflected on `/` and blocks `POST /api/queue/join`, without needing to touch Supabase directly anymore (this replaces Slice 1's manual-SQL workaround for that test).
- [ ] `npm run build` completes with no errors.

## 10. Next step after this slice

Once all acceptance criteria pass, this is functionally a complete V1 per CONTEXT.md/blueprint. Remaining PRP steps (Step 5 — Mobile polish, Step 6 — Real-world test) are refinement/testing passes on the existing slices, not new vertical slices, and don't need their own PRP-style documents — they're tracked directly against `VERTICAL_SLICE.md` §6 and `VERTICAL_SLICE_2.md` §9's criteria plus real-world usage feedback.
