"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import PhoneInput, {
  isValidPhoneNumber,
} from "../../../components/shared/PhoneInput";

function formatWait(minutes) {
  if (minutes <= 0) return "No wait";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours > 0 && mins > 0) return `~${hours} hr ${mins} min`;
  if (hours > 0) return `~${hours} hr`;
  return `~${mins} min`;
}

export default function BookingPage() {
  const { bookingNumber } = useParams();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const [showCancelInput, setShowCancelInput] = useState(false);
  const [cancelPhone, setCancelPhone] = useState("");
  const [cancelError, setCancelError] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const loadBooking = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    setLoadError(false);

    try {
      const response = await fetch(`/api/queue/${bookingNumber}`);

      if (response.status === 404) {
        setNotFound(true);
        setBooking(null);
        return;
      }

      if (!response.ok) {
        setLoadError(true);
        setBooking(null);
        return;
      }

      const data = await response.json();
      setBooking(data);
    } catch {
      setLoadError(true);
      setBooking(null);
    } finally {
      setLoading(false);
    }
  }, [bookingNumber]);

  useEffect(() => {
    loadBooking();
  }, [loadBooking]);

  async function handleCancel(event) {
    event.preventDefault();
    setCancelError(null);

    if (!isValidPhoneNumber(cancelPhone)) {
      setCancelError("Enter a valid phone number");
      return;
    }

    setCancelling(true);

    try {
      const response = await fetch(`/api/queue/${bookingNumber}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cancelPhone }),
      });

      const body = await response.json().catch(() => ({}));

      if (response.status === 200) {
        setShowCancelInput(false);
        setCancelPhone("");
        await loadBooking();
      } else if (response.status === 403) {
        setCancelError("That phone number doesn't match this booking.");
      } else if (response.status === 400) {
        setCancelError(body.error || "Booking can no longer be cancelled.");
      } else {
        setCancelError("Something went wrong. Please try again.");
      }
    } catch {
      setCancelError("Something went wrong. Please try again.");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-5 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-md">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            HairQueue
          </p>
          <h1 className="mt-3 text-3xl font-bold leading-tight">Your booking</h1>

          {loading ? (
            <p className="mt-8 text-zinc-500">Loading…</p>
          ) : notFound ? (
            <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-5">
              <p className="text-lg font-medium">Booking not found</p>
              <p className="mt-1 text-zinc-600">
                We couldn&apos;t find a booking with that number.
              </p>
            </div>
          ) : loadError ? (
            <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-5">
              <p className="text-lg font-medium">Something went wrong</p>
              <p className="mt-1 text-zinc-600">Please refresh and try again.</p>
            </div>
          ) : (
            <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-5">
              <p className="text-sm text-zinc-500">Booking number</p>
              <p className="font-mono text-lg font-semibold">
                {booking.booking_number}
              </p>

              <dl className="mt-4 space-y-3">
                <div>
                  <dt className="text-sm text-zinc-500">Name</dt>
                  <dd className="font-medium">{booking.name}</dd>
                </div>

                <div>
                  <dt className="text-sm text-zinc-500">Status</dt>
                  <dd className="font-medium capitalize">{booking.status}</dd>
                </div>

                {booking.position != null && (
                  <div>
                    <dt className="text-sm text-zinc-500">Position</dt>
                    <dd className="font-medium">#{booking.position}</dd>
                  </div>
                )}

                {booking.estimated_wait_minutes != null && (
                  <div>
                    <dt className="text-sm text-zinc-500">Estimated wait</dt>
                    <dd className="font-medium">
                      {formatWait(booking.estimated_wait_minutes)}
                    </dd>
                    <dd className="text-xs text-zinc-500">
                      Estimated — actual time may vary
                    </dd>
                  </div>
                )}

                <div>
                  <dt className="text-sm text-zinc-500">Location</dt>
                  <dd className="font-medium">{booking.location}</dd>
                </div>
              </dl>

              {booking.status === "waiting" && (
                <div className="mt-5 border-t border-zinc-200 pt-5">
                  {!showCancelInput ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowCancelInput(true);
                        setCancelError(null);
                      }}
                      className="w-full rounded-md border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                    >
                      Cancel booking
                    </button>
                  ) : (
                    <form onSubmit={handleCancel} className="space-y-3">
                      <label
                        htmlFor="cancel-phone"
                        className="block text-sm font-medium text-zinc-700"
                      >
                        Enter your phone number to confirm cancellation
                      </label>
                      <PhoneInput
                        value={cancelPhone}
                        onChange={setCancelPhone}
                        placeholder="Phone number"
                      />
                      {cancelError && (
                        <p className="text-sm text-red-600">{cancelError}</p>
                      )}
                      <div className="flex gap-3">
                        <button
                          type="submit"
                          disabled={cancelling}
                          className="flex-1 rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
                        >
                          {cancelling ? "Cancelling…" : "Confirm cancel"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowCancelInput(false);
                            setCancelError(null);
                          }}
                          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
                        >
                          Back
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
