# PAGES.md — HairQueue V1

This reconciles the original "5 screens" sketch against what's actually scoped and built across Slice 1 (`VERTICAL_SLICE.md`) and Slice 2 (`VERTICAL_SLICE_2.md`). A few screens from the sketch were merged or dropped because they don't match what we actually locked in — noted below each entry.

---

## Final page list (5 pages)

### 1. Customer Home — `/`

Shows who's currently being served and how many people are waiting. Entry point to `/join`. If the barber has toggled `accepting_customers` off, shows a "queue closed" message instead of the join link.

**Changed from the original sketch:** the "Already joined? [CHECK MY POSITION]" button is **not included**. There's no search-by-phone or search-by-booking-number lookup built in V1 — customers reach `/booking/[bookingNumber]` only via the direct link they're given right after joining (redirect on submit) or by keeping the URL. Adding a lookup screen would be new scope beyond what `VERTICAL_SLICE.md` §5/§8 defined.

---

### 2. Join Queue — `/join`

Name, WhatsApp number, and a location select (populated from the `locations` table: Barber's Hostel, NRI Hostel, Customer Location).

**Changed from the original sketch:** the sketch describes "My location" as a free-text address entry. What's actually built is a fixed dropdown of the three seeded locations — no free-text address capture field exists in the schema or the form. If you want customers to be able to type an actual address for "Customer Location," that's a small addition worth deciding on explicitly rather than assuming.

---

### 3. Booking Status — `/booking/[bookingNumber]`

Shows status, position (if `waiting`/`cutting`), estimated wait time, location, and a cancel button (while `waiting`).

**Changed from the original sketch:** this single page **replaces both** the sketch's "3. Confirmation" and "4. My Position" screens. There's no separate one-time confirmation screen after joining — the customer is redirected straight here, and this same page is what they'd reload later to check their live position. Keeping two near-identical screens (one static "you joined!" view, one live "your position" view) would have meant building and maintaining duplicate logic for no real benefit, so `VERTICAL_SLICE.md` collapsed them into one.

**Also not included:** the "We'll notify you when you're next" line from the sketch's "My Position" screen. There's no notification system in V1 (no WhatsApp API, per `CONTEXT.md`'s out-of-scope list) — the customer has to check this page themselves.

---

### 4. Barber Login — `/barber/login`

Email + password, signs in via Supabase Auth.

**Not in the original sketch at all** — the sketch jumped straight to the dashboard. This page exists because `CONTEXT.md`/blueprint §17 requires a "protected login" for the barber, and `VERTICAL_SLICE_2.md` built that out as its own step.

---

### 5. Barber Dashboard — `/barber/dashboard`

Now-cutting card with complete button, waiting list with start/cancel per row, add-customer form, accepting-customers toggle, and a secondary completed/cancelled history section.

**Matches the original sketch closely**, with two additions the sketch didn't show but `VERTICAL_SLICE_2.md` scoped in: the accepting-customers ON/OFF toggle (blueprint §19) and the completed/cancelled history section (blueprint §16, PRP §3.1).

---

## Explicitly excluded from V1

These appeared in the surrounding product discussion but are not pages in this build, per `CONTEXT.md`'s out-of-scope list — listed here so no future session assumes they're missing by accident:

- Any notification/alert screen (no WhatsApp API integration)
- A booking lookup/search screen (see Page 1 above)
- Exact-appointment-time screens (V1 only shows estimated wait ranges)
- Multiple-barber selection screens (single barber only)
- Payment screens
