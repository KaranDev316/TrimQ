"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PhoneInput, {
  isValidPhoneNumber,
} from "../../components/shared/PhoneInput";

export default function CheckQueuePage() {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);

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
        router.push(`/booking/${body.booking_number}`);
        return;
      }

      if (response.status === 404) {
        setError(
          "We couldn't find an active booking for that phone number. Please check the number, then try again."
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
                WhatsApp Number
              </label>
              <div className="mt-1">
                <PhoneInput value={phone} onChange={setPhone} />
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

        </div>
      </section>
    </main>
  );
}
