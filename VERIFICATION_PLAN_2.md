# VERIFICATION_PLAN.md — HairQueue V1, Slice 2

**Scope:** Verifies exactly `VERTICAL_SLICE_2.md` §9. Assumes Slice 1's verification plan is already fully green — this plan does not re-test Slice 1's customer-side behavior except where Slice 2 changes it (§7 below).

---

## 0. Setup

- Slice 1 fully implemented and verified (`VERIFICATION_PLAN.md` §8 signed off).
- One barber user created manually in Supabase Auth (Dashboard → Authentication → Users → Add user), with a known email/password for testing.
- RLS policies from `VERTICAL_SLICE_2.md` §5 applied.
- App running locally.

---

## 1. Auth

| ID | Steps | Expected | AC# |
|----|-------|----------|-----|
| T1.1 | Go to `/barber/login`, enter the correct email/password. | Redirects to `/barber/dashboard`. | AC1 |
| T1.2 | Go to `/barber/login`, enter a wrong password. | Generic "invalid credentials" message; stays on login page. | — |
| T1.3 | In an incognito/private window (no session), go directly to `/barber/dashboard`. | Redirects to `/barber/login`. | AC2 |
| T1.4 | `curl http://localhost:3000/api/barber/bookings` (no auth cookie/header). | `401`. | AC3 |
| T1.5 | Repeat T1.4 for `add`, `start`, `complete`, `cancel`, and `settings` endpoints, all without auth. | All return `401`, none perform any write (verify via `select` in Supabase after each). | AC3 |

---

## 2. Dashboard read consistency

| ID | Steps | Expected | AC# |
|----|-------|----------|-----|
| T2.1 | With 2–3 active bookings from Slice 1 testing still in the DB (or create fresh ones via `/join`), log in and load `/barber/dashboard`. | Waiting list order and positions match what `/booking/[bookingNumber]` shows for the same bookings. | AC4 |

---

## 3. Manual add (walk-in)

| ID | Steps | Expected | AC# |
|----|-------|----------|-----|
| T3.1 | From the dashboard, add a customer: name="Michael", phone="+913333333333", location="Barber's Hostel". | `201`, appears in the waiting list at the correct position relative to existing bookings' `joined_at`. | AC5 |
| T3.2 | `select joined_at from bookings where booking_number = '<Michael's>';` | Set by the DB server clock at the moment of the add, not client-supplied. | AC5 |
| T3.3 | Add another walk-in using the **same phone** as an existing active booking (e.g. re-use Michael's phone while his booking is still `waiting`). | `409`, `{ "error": "You already have a booking" }`. No duplicate row. | AC6 |
| T3.4 | `select count(*) from bookings where customer_id = (select id from customers where phone = '+913333333333');` | Count is `1`. | AC6 |

---

## 4. Start / complete / cancel

| ID | Steps | Expected | AC# |
|----|-------|----------|-----|
| T4.1 | With no one `cutting`, click `[Start]` on the top of the waiting list. | Booking moves to `cutting`, `started_at` set, dashboard shows "Now cutting." | — |
| T4.2 | While someone is `cutting`, attempt to start a second booking (e.g. via `curl -X POST .../start` with a valid session cookie on a different booking id). | `409 { "error": "Finish the current haircut first" }`; original `cutting` booking unchanged. | AC7 |
| T4.3 | Click `[Complete]` on the currently cutting booking. | `status='completed'`, `completed_at` set, booking disappears from the waiting/cutting view into completed history. | AC8 |
| T4.4 | Load `/booking/[bookingNumber]` for the just-completed booking. | Status shows `completed`; it is no longer counted in anyone else's position. | AC8 |
| T4.5 | Click `[Cancel]` on a `waiting` booking that has at least one booking after it in the queue. | That row moves to cancelled history; **not deleted** (`select` confirms row still exists). | AC9 |
| T4.6 | Check the booking that was behind the cancelled one, via its `/booking/[bookingNumber]` page. | Its position has shifted up by one. | AC9 |

---

## 5. Accepting-customers toggle (now via dashboard, not manual SQL)

| ID | Steps | Expected | AC# |
|----|-------|----------|-----|
| T5.1 | On the dashboard, toggle "Accepting customers" to OFF. | `PATCH /api/barber/settings` succeeds; toggle reflects OFF. | AC10 |
| T5.2 | Load `/` in another tab. | Shows "queue closed," no join form. | AC10 |
| T5.3 | `curl -X POST .../api/queue/join` with a valid new customer payload. | `403 { "error": "Queue is currently closed" }`. | AC10 |
| T5.4 | Toggle back ON from the dashboard. | `/` shows the join flow again immediately. | AC10 |

---

## 6. Build

| ID | Steps | Expected | AC# |
|----|-------|----------|-----|
| T6.1 | `npm run build` | No errors. | AC11 |

---

## 7. Regression check against Slice 1

Since Slice 2 refactors the shared "create booking" logic (§7 of `VERTICAL_SLICE_2.md`) and both routes now call the same function, re-run these specific Slice 1 cases to confirm nothing broke:

| ID | Steps | Expected |
|----|-------|----------|
| T7.1 | Re-run `VERIFICATION_PLAN.md` T2.1–T2.3 (customer join happy path). | Still passes, unchanged behavior. |
| T7.2 | Re-run `VERIFICATION_PLAN.md` T3.1–T3.2 (duplicate booking prevention). | Still passes, unchanged behavior. |

---

## 8. Sign-off

Slice 2 — and functionally, HairQueue V1 as scoped in CONTEXT.md — is verified and ready for real-world testing (blueprint §24 Step 6) when:

- [ ] All test cases in §1–§7 pass.
- [ ] No manual Supabase-dashboard workaround is needed anywhere in the barber's daily flow — everything the barber needs is reachable from `/barber/dashboard`.
- [ ] Every failure found during this pass has been fixed and re-tested.

**After sign-off:** move to PRP.md Step 5 (mobile polish pass) and Step 6 (hand to the real barber for 5–10 real customers) — both refinement passes against the existing slices, not new features.
