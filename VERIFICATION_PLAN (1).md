# VERIFICATION_PLAN.md — HairQueue V1, Slice 1

**Scope:** Verifies exactly the acceptance criteria in `VERTICAL_SLICE.md` §6 — nothing more, nothing less. This is the checklist run before Slice 1 is considered "done" and before moving to the Prompt Chain for Slice 2.

Run these in order. Each test case maps to one or more acceptance criteria (AC#) from `VERTICAL_SLICE.md`.

---

## 0. Setup

- Fresh Supabase project (or a reset local dev DB) with the Slice 1 migration + seed applied.
- `.env.local` populated with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- App running locally (`npm run dev`).
- Note the seeded `locations` row IDs (query `select id, name from locations;`) — needed for join requests below.
- Confirm `barber_settings.accepting_customers = true` before starting (default seed value).

---

## 1. Migration & build sanity

| ID | Steps | Expected | AC# |
|----|-------|----------|-----|
| T1.1 | Run the migration against a clean database. | Completes with no errors; `customers`, `locations`, `bookings`, `barber_settings` tables exist. | AC1 |
| T1.2 | `select * from locations;` | Returns exactly "Barber's Hostel", "NRI Hostel", "Customer Location", each `active=true`. | AC1 |
| T1.3 | `select * from barber_settings;` | Exactly one row, `accepting_customers=true`. | AC1 |
| T1.4 | `npm run build` | Completes with no errors. | AC8 |

---

## 2. Join flow — happy path

| ID | Steps | Expected | AC# |
|----|-------|----------|-----|
| T2.1 | Via `/join` UI, submit name="Daniel", phone="+911111111111", pick "Barber's Hostel". | Redirects to `/booking/HQ-####`. | AC2 |
| T2.2 | `select * from bookings where booking_number = 'HQ-####';` | `status='waiting'`, `joined_at` is set and close to the current DB server time (not something the browser could have sent — check it's within a second or two of your `select now();`). | AC2 |
| T2.3 | `curl -X POST http://localhost:3000/api/queue/join -H "Content-Type: application/json" -d '{"name":"Samuel","phone":"+912222222222","location_id":"<id>"}'` | `201`, JSON body `{ "booking_number": "HQ-####", "position": <n> }`. | AC2 |

---

## 3. Duplicate booking prevention

| ID | Steps | Expected | AC# |
|----|-------|----------|-----|
| T3.1 | Immediately after T2.1, submit `/join` again with the **same phone** ("+911111111111"), status of first booking still `waiting`. | `409`, `{ "error": "You already have a booking" }`. No new row in `bookings` for this customer. | AC3 |
| T3.2 | `select count(*) from bookings where customer_id = (select id from customers where phone='+911111111111');` | Count is `1`. | AC3 |

---

## 4. Position calculation

| ID | Steps | Expected | AC# |
|----|-------|----------|-----|
| T4.1 | With Daniel (T2.1) and Samuel (T2.3) both `waiting`, load `/booking/<Samuel's booking number>`. | Shows `position: 2` (Daniel joined first). | AC4 |
| T4.2 | Manually insert a third booking directly in Supabase with `joined_at` earlier than Daniel's (simulating a customer who joined before both), same `status='waiting'`. | Reload Samuel's `/booking/...` page — position is now `3`, with **no code change**. | AC5 |
| T4.3 | Reload Daniel's booking page after T4.2. | Daniel's position is now `2` (was `1`). | AC5 |

---

## 5. Cancellation

| ID | Steps | Expected | AC# |
|----|-------|----------|-----|
| T5.1 | On Daniel's `/booking/...` page, click "Cancel booking," enter phone "+911111111111". | `200`, UI shows `status: cancelled`. | AC6 |
| T5.2 | `select status from bookings where booking_number = '<Daniel's>';` | `status='cancelled'`. Row still exists (not deleted). | AC6 |
| T5.3 | Reload Samuel's `/booking/...` page. | Samuel's position drops by one (Daniel no longer counted as active). | AC6 |
| T5.4 | `curl -X PATCH http://localhost:3000/api/queue/<Samuel's booking_number> -H "Content-Type: application/json" -d '{"phone":"+19999999999"}'` (wrong phone) | `403`, `{ "error": "Not your booking" }`. Samuel's `status` unchanged in DB. | AC7 |

---

## 6. Queue closed toggle

| ID | Steps | Expected | AC# |
|----|-------|----------|-----|
| T6.1 | In Supabase, `update barber_settings set accepting_customers = false;` | — | AC8 |
| T6.2 | Reload `/`. | Join form/button is replaced with "queue closed" message; no way to reach `/join` form submission from the UI. | AC8 |
| T6.3 | `curl -X POST http://localhost:3000/api/queue/join -H "Content-Type: application/json" -d '{"name":"Michael","phone":"+913333333333","location_id":"<id>"}'` | `403`, `{ "error": "Queue is currently closed" }`. No booking created. | AC8 |
| T6.4 | `update barber_settings set accepting_customers = true;` (reset for further testing) | — | — |

---

## 7. RLS spot-check (anon key, bypassing the API)

Using the Supabase client with the **anon key only** (not the service role key), attempt each of the following directly against the DB — these confirm the backup RLS layer from `PRP.md` §4.2 actually holds, independent of the API route logic:

| ID | Steps | Expected |
|----|-------|----------|
| T7.1 | Attempt `update bookings set joined_at = now() - interval '1 day' where id = '<any id>';` as anon. | Rejected by RLS. |
| T7.2 | Attempt `update bookings set status = 'completed' where id = '<any id>';` as anon. | Rejected by RLS (anon may only set `status='cancelled'`, per policy). |
| T7.3 | Attempt `select * from bookings;` (all rows, no filter) as anon. | Either rejected or returns no rows unless a matching `booking_number`/`phone` filter is applied, per policy design. |

---

## 8. Sign-off

Slice 1 is verified and ready for the Prompt Chain phase when:

- [ ] All test cases in §1–§7 pass.
- [ ] No manual workaround was needed to make any test pass (if one was, it indicates a gap in the implementation, not the test).
- [ ] Every failure found during this pass has been fixed and re-tested, not just noted.

**Do not proceed to Slice 2 / Prompt Chain until this checklist is fully green.**
