"use client";

import { useState } from "react";
import PhoneInput, {
  isValidPhoneNumber,
} from "../../components/shared/PhoneInput";

export default function CheckQueuePage() {
  const [phone, setPhone] = useState("");
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setStatus(null);

    if (!isValidPhoneNumber(phone)) {
      setError("Enter a valid phone number");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/queue/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });

      const body = await response.json().catch(() => ({}));

      if (response.status === 200) {
        setStatus(body);
      } else if (response.status === 404) {
        setError(
          "We couldn't find an active booking for that phone number. If you just joined, use the link you were given."
        );
      } else if (response.status === 400) {
        setError(body.error || "Please enter your phone number.");
      } else {
        setError("Something went wrong. Please try again.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const isCutting = status?.status === "cutting";

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-5 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-md">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            HairQueue
          </p>
          <h1 className="mt-3 text-3xl font-bold leading-tight">
            Check my queue
          </h1>
          <p className="mt-2 text-zinc-600">
            Enter the phone number you used to book.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-8 space-y-5 rounded-xl border border-zinc-200 bg-white p-5"
          >
            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-zinc-700"
              >
                Phone
              </label>
              <div className="mt-1">
                <PhoneInput
                  value={phone}
                  onChange={setPhone}
                  placeholder="Phone number"
                />
              </div>
            </div>

            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
            >
              {loading ? "Checking…" : "Check status"}
            </button>
          </form>

          {status && (
            <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Your queue status
              </h2>
              <p className="mt-3 text-2xl font-bold">{status.booking_number}</p>

              <div className="mt-4 space-y-2 text-sm">
                <p className="flex items-center gap-2">
                  <span aria-hidden="true">👤</span>
                  <span className="font-medium">{status.name}</span>
                </p>
                <p className="flex items-center gap-2">
                  <span aria-hidden="true">📍</span>
                  <span>{status.location}</span>
                </p>
                <p>
                  <span className="text-zinc-500">Position:</span>{" "}
                  <span className="font-medium">#{status.position}</span>
                </p>
                {isCutting ? (
                  <p>
                    <span className="text-zinc-500">Currently serving:</span>{" "}
                    <span className="font-medium">
                      You&apos;re in the chair
                    </span>
                  </p>
                ) : (
                  <>
                    <p>
                      <span className="text-zinc-500">Currently serving:</span>{" "}
                      <span className="font-medium">
                        {status.currently_serving ?? "—"}
                      </span>
                    </p>
                    <p>
                      <span className="text-zinc-500">Ahead of you:</span>{" "}
                      <span className="font-medium">
                        {status.people_ahead === 0
                          ? "You're next"
                          : `${status.people_ahead} ${
                              status.people_ahead === 1 ? "person" : "people"
                            }`}
                      </span>
                    </p>
                    <p>
                      <span className="text-zinc-500">Estimated wait:</span>{" "}
                      <span className="font-medium">may vary</span>
                    </p>
                  </>
                )}
                <p>
                  <span className="text-zinc-500">Status:</span>{" "}
                  <span className="font-medium">
                    {isCutting ? "In the chair" : "Waiting"}
                  </span>
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
