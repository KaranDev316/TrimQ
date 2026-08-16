# CONTEXT.md

## Project Specifications

- **Name:** HairQueue
- **Purpose:** Give one barber a reliable, fair, first-come-first-served digital queue so customers always know their position and the barber never has to rely on WhatsApp or memory.
- **Target User:** A single independent barber and his walk-in/booked customers (initially one specific barber for real-world testing).
- **Core Problem:** The barber currently manages his customer queue manually (e.g. via WhatsApp/memory), which is unfair, error-prone, and gives customers no visibility into their position or wait time.

---

## Core Features (MVP only)

**Customer can:**
- Open the website (no account required)
- Join the queue by entering name + WhatsApp number + choosing a location
- Receive a queue position and booking number
- View their current position
- See an estimated waiting time
- Cancel their own booking

**Barber can:**
- Log into a protected dashboard
- See today's queue
- Add a customer manually (for face-to-face customers)
- Start the next haircut (only one "cutting" at a time)
- Complete a haircut
- Cancel a booking
- See completed/cancelled bookings
- Toggle "Accepting customers: ON/OFF" to close the queue

**System automatically:**
- Assigns queue positions (calculated by order, not stored permanently)
- Records exact `joined_at` using server time (never client time)
- Prevents duplicate active bookings per customer (no double-joining while `waiting`/`cutting`)
- Recalculates positions when someone cancels
- Calculates an approximate wait time (based on average haircut duration)

---

## Out of Scope (for now)

- Payments
- WhatsApp API integration (customers reach the link manually)
- Maps / geolocation (locations are plain text)
- Exact scheduled appointments (strictly first-come-first-served)
- Multiple barbers
- Customer accounts (customers use booking number + phone instead)
- Ratings / reviews
- AI features of any kind
- `NO_SHOW` status (deferred to V2 — V1 only uses `waiting`, `cutting`, `completed`, `cancelled`)

---

## Stack & Architecture Decisions

- **Frontend:** Next.js (JavaScript) — reason: sensible default choice for a small team-friendly app with fast iteration, pairs natively with Vercel deployment.
- **Backend:** Next.js API routes — reason: no need for a separate backend service at this scale; API routes call Supabase directly and keep the project as a single deployable unit.
- **Database:** Supabase (PostgreSQL) — reason: managed Postgres with built-in authentication and Row Level Security, a good fit for the relational booking/queue model (`customers`, `locations`, `bookings`).
- **Auth:** Supabase Auth, barber-only — reason: customers should have zero friction (no accounts); the barber dashboard is the only part that needs a protected login. Customers instead access their booking via booking number + phone number.
- **AI Layer:** None — explicitly not needed for this product.
- **Styling:** Tailwind CSS — reason: utility-first, fast to build with, and well suited to the mobile-first design the barber dashboard requires.
- **Deployment:** Vercel — reason: native, zero-config fit for a Next.js application.

---

## Coding Standards

- **Language:** JavaScript (no TypeScript).
- **Async style:** `async/await` throughout; avoid raw `.then()` chains.
- **Naming conventions:** `snake_case` for database columns/fields (matches Postgres schema exactly — `joined_at`, `booking_number`, etc.); `camelCase` for JS variables and functions; `PascalCase` for React components.
- **Error handling:** API routes validate all input and return a consistent JSON error shape. The server is always the source of truth — it computes `joined_at`, queue position, and status transitions. Client-supplied values for these fields must never be trusted or accepted.
- **Styling approach:** Tailwind utility classes; mobile-first breakpoints, since the barber will primarily operate from his phone.
- **Component rules:** Functional components only; one component per file; keep customer-facing views and barber dashboard views clearly separated.
- **Security rules (Supabase Row Level Security):**
  - Customer **can**: create a booking, view their own booking, cancel their own booking.
  - Customer **cannot**: change `joined_at`, change their queue position, mark themselves as completed, view or modify another customer's booking.
  - Barber **can**: view all bookings, add customers, start, complete, and cancel bookings.
  - Bookings are never deleted (cancelled bookings are kept as history).

---

## Folder Structure Rules

- **Components location:** To be defined in the PRP phase (not yet specified).
- **API layer location:** Next.js API routes (exact routing convention — `pages/api` vs. `app/api` — to be confirmed in the PRP phase).
- **Constants location:** To be defined in the PRP phase.
- **Environment variables:** Supabase URL and keys must be stored in environment variables (never hardcoded); exact `.env` naming convention to be confirmed in the PRP phase.
- **Additional structure rules:** None defined yet — to be resolved before implementation begins.

---

## Current State

- **Status:** Pre-implementation. Technical blueprint and this CONTEXT.md are complete; no code has been written yet.
- **What's working:** N/A — nothing built yet.
- **Next step:** Move to the PRP (Product Requirements Prompt) phase — define the exact folder structure, API route conventions, and the first vertical slice (likely: database schema + "join queue" flow end-to-end).
