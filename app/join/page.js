"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import PhoneInput, {
  isValidPhoneNumber,
} from "../../components/shared/PhoneInput";
import { isCustomerLocation } from "../../lib/locations";

export default function JoinPage() {
  const router = useRouter();

  const [locations, setLocations] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locationsError, setLocationsError] = useState(false);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [locationId, setLocationId] = useState("");
  const [address, setAddress] = useState("");
  const [confirmation, setConfirmation] = useState(null);

  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadLocations() {
      try {
        const response = await fetch("/api/locations");
        const body = await response.json().catch(() => ({}));

        if (!response.ok) {
          setLocationsError(true);
        } else {
          setLocations(body.locations ?? []);
        }
      } catch {
        setLocationsError(true);
      } finally {
        setLocationsLoading(false);
      }
    }

    loadLocations();
  }, []);

  const selectedLocation = locations.find((location) => location.id === locationId);
  const showAddressField = Boolean(
    selectedLocation && isCustomerLocation(selectedLocation.name)
  );

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

    if (!isValidPhoneNumber(phone)) {
      setError("Enter a valid phone number");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/queue/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          location_id: locationId,
          address: showAddressField ? address : "",
        }),
      });

      const body = await response.json().catch(() => ({}));

      if (response.status === 201) {
        setConfirmation({ bookingNumber: body.booking_number });
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

          {!confirmation ? (
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
                  WhatsApp Number
                </label>
                <div className="mt-1">
                  <PhoneInput value={phone} onChange={setPhone} />
                </div>
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
                    onChange={(event) => {
                      const nextLocationId = event.target.value;
                      const nextLocation = locations.find(
                        (location) => location.id === nextLocationId
                      );

                      setLocationId(nextLocationId);

                      if (!nextLocation || !isCustomerLocation(nextLocation.name)) {
                        setAddress("");
                      }
                    }}
                    required
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-950 focus:outline-none"
                  >
                    <option value="" disabled>
                      Select a location
                    </option>
                    {locations.map((location) => (
                      <option key={location.id} value={location.id}>
                        {location.customer_name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {showAddressField && (
                <div>
                  <label
                    htmlFor="address"
                    className="block text-sm font-medium text-zinc-700"
                  >
                    Apartment name
                  </label>
                  <input
                    id="address"
                    type="text"
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    required
                    placeholder="Enter apartment name"
                    className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-950 focus:outline-none"
                  />
                </div>
              )}

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
          ) : (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#f5f1eb]/70 px-4 backdrop-blur-[1px]">
              <div className="relative w-full max-w-xl rounded-[2rem] bg-[#f5f1eb] px-6 py-10 text-center shadow-[0_25px_60px_rgba(0,0,0,0.08)] sm:px-10">
                <div className="flex justify-center">
                  <div className="flex h-28 w-28 items-center justify-center rounded-full bg-[#6ecf6f] shadow-[0_0_28px_rgba(110,207,111,0.8)]">
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="h-14 w-14 fill-none stroke-white stroke-[3]"
                    >
                      <path d="M5 12.5 9.2 16.7 19 6.9" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>

                <h2 className="mt-8 text-3xl font-black tracking-[-0.05em] text-zinc-900 sm:text-4xl">
                  Booking Confirmed!
                </h2>

                <p className="mt-8 text-lg leading-relaxed text-zinc-800 sm:text-2xl">
                  Your booking has been placed successfully.
                </p>

                <p className="mt-6 text-base font-medium text-zinc-700 sm:text-xl">
                  Booking ID : #{confirmation.bookingNumber}
                </p>

                <p className="mt-8 text-2xl font-black tracking-[-0.05em] text-zinc-900 sm:text-3xl">
                  Thank you for your booking!
                </p>

                <button
                  type="button"
                  onClick={() => router.push("/check")}
                  className="mt-10 w-full rounded-xl bg-[#7a907d] px-5 py-4 text-xl font-black text-[#f4f1ec] transition hover:bg-[#6d7f6f] sm:text-2xl sm:py-5"
                >
                  Check status
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
