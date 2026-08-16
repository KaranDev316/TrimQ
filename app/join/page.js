"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "../../lib/supabase/client";

export default function JoinPage() {
  const router = useRouter();

  const [locations, setLocations] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locationsError, setLocationsError] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [locationId, setLocationId] = useState("");

  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadLocations() {
      try {
        const { data, error } = await supabaseClient
          .from("locations")
          .select("id, name")
          .eq("active", true)
          .order("name");

        if (error) {
          setLocationsError(true);
        } else {
          setLocations(data ?? []);
        }
      } catch {
        setLocationsError(true);
      } finally {
        setLocationsLoading(false);
      }
    }

    loadLocations();
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const response = await fetch("/api/queue/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, location_id: locationId }),
      });

      const body = await response.json().catch(() => ({}));

      if (response.status === 201) {
        router.push(`/booking/${body.booking_number}`);
        return;
      }

      if (response.status === 409) {
        setError(
          "You already have a booking. If you have your booking number, use the link you were given to check its status."
        );
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-5 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-md">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            HairQueue
          </p>
          <h1 className="mt-3 text-3xl font-bold leading-tight">Join the queue</h1>
          <p className="mt-2 text-zinc-600">
            Enter your details to reserve your place in line.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-8 space-y-5 rounded-xl border border-zinc-200 bg-white p-5"
          >
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-zinc-700">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                placeholder="Your name"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-950 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-zinc-700">
                Phone
              </label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
                placeholder="+91…"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-950 focus:outline-none"
              />
            </div>

            <div>
              <label htmlFor="location" className="block text-sm font-medium text-zinc-700">
                Location
              </label>
              {locationsLoading ? (
                <p className="mt-1 text-sm text-zinc-500">Loading locations…</p>
              ) : locationsError ? (
                <p className="mt-1 text-sm text-red-600">
                  Couldn&apos;t load locations. Please refresh and try again.
                </p>
              ) : locations.length === 0 ? (
                <p className="mt-1 text-sm text-zinc-500">No locations available.</p>
              ) : (
                <select
                  id="location"
                  value={locationId}
                  onChange={(event) => setLocationId(event.target.value)}
                  required
                  className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-950 focus:outline-none"
                >
                  <option value="" disabled>
                    Select a location
                  </option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>
                      {location.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting || !locationId}
              className="w-full rounded-md bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
            >
              {submitting ? "Joining…" : "Join queue"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
