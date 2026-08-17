"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "../../../lib/supabase/client";

export default function BarberLoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const { error: signInError } = await supabaseClient.auth.signInWithPassword(
        { email, password }
      );

      if (signInError) {
        setError("Invalid email or password");
      } else {
        router.push("/barber/dashboard");
        router.refresh();
      }
    } catch {
      setError("Invalid email or password");
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
          <h1 className="mt-3 text-3xl font-bold leading-tight">Barber login</h1>
          <p className="mt-2 text-zinc-600">
            Sign in to manage today&apos;s queue.
          </p>

          <form
            onSubmit={handleSubmit}
            className="mt-8 space-y-5 rounded-xl border border-zinc-200 bg-white p-5"
          >
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-zinc-700"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-950 focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-zinc-700"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-950 focus:outline-none"
              />
            </div>

            {error && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-zinc-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
            >
              {submitting ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
