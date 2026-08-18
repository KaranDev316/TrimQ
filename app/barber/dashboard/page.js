"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "../../../lib/supabase/client";
import PhoneInput, {
  isValidPhoneNumber,
} from "../../../components/shared/PhoneInput";

function formatTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function todayLabel() {
  return new Date().toLocaleDateString([], {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BarberDashboardPage() {
  const router = useRouter();

  const [authChecked, setAuthChecked] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const [actionError, setActionError] = useState(null);
  const [busyAction, setBusyAction] = useState(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addName, setAddName] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addLocationId, setAddLocationId] = useState("");
  const [addPrice, setAddPrice] = useState("");
  const [locations, setLocations] = useState([]);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [addError, setAddError] = useState(null);
  const [addSubmitting, setAddSubmitting] = useState(false);

  const [savingSettings, setSavingSettings] = useState(false);

  const loadDashboard = useCallback(
    async (options = {}) => {
      const { silent = false } = options;

      if (!silent) setLoading(true);
      setLoadError(false);

      try {
        const response = await fetch("/api/barber/bookings");

        if (response.status === 401) {
          router.replace("/barber/login");
          return;
        }

        if (!response.ok) {
          if (silent) setActionError("Could not refresh the queue.");
          else setLoadError(true);
          return;
        }

        const body = await response.json();
        setData(body);
      } catch {
        if (silent) setActionError("Could not refresh the queue.");
        else setLoadError(true);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [router]
  );

  useEffect(() => {
    async function checkAuth() {
      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      if (!session) {
        router.replace("/barber/login");
        return;
      }

      setAuthChecked(true);
    }

    checkAuth();
  }, [router]);

  useEffect(() => {
    if (!authChecked) return;
    loadDashboard();
  }, [authChecked, loadDashboard]);

  useEffect(() => {
    if (!showAddForm) return;

    setLocationsLoading(true);

    async function loadLocations() {
      try {
        const response = await fetch("/api/locations");
        const body = await response.json().catch(() => ({}));

        if (!response.ok) {
          setLocations([]);
        } else {
          setLocations(body.locations ?? []);
        }
      } catch {
        setLocations([]);
      } finally {
        setLocationsLoading(false);
      }
    }

    loadLocations();
  }, [showAddForm]);

  async function handleComplete(id) {
    setActionError(null);
    setBusyAction({ type: "complete", id });

    try {
      const response = await fetch(`/api/barber/bookings/${id}/complete`, {
        method: "POST",
      });

      if (response.status === 401) {
        router.replace("/barber/login");
        return;
      }

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setActionError(body.error || "Could not complete this booking.");
        return;
      }

      await loadDashboard({ silent: true });
    } catch {
      setActionError("Something went wrong. Please try again.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleStart(id) {
    setActionError(null);
    setBusyAction({ type: "start", id });

    try {
      const response = await fetch(`/api/barber/bookings/${id}/start`, {
        method: "POST",
      });

      if (response.status === 401) {
        router.replace("/barber/login");
        return;
      }

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setActionError(body.error || "Could not start this booking.");
        return;
      }

      await loadDashboard({ silent: true });
    } catch {
      setActionError("Something went wrong. Please try again.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCancel(id) {
    setActionError(null);
    setBusyAction({ type: "cancel", id });

    try {
      const response = await fetch(`/api/barber/bookings/${id}/cancel`, {
        method: "POST",
      });

      if (response.status === 401) {
        router.replace("/barber/login");
        return;
      }

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        setActionError(body.error || "Could not cancel this booking.");
        return;
      }

      await loadDashboard({ silent: true });
    } catch {
      setActionError("Something went wrong. Please try again.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleAddSubmit(event) {
    event.preventDefault();
    setAddError(null);

    if (!isValidPhoneNumber(addPhone)) {
      setAddError("Enter a valid phone number");
      return;
    }

    setAddSubmitting(true);

    try {
      const response = await fetch("/api/barber/bookings/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: addName,
          phone: addPhone,
          location_id: addLocationId,
          price: addPrice ? Number(addPrice) : undefined,
        }),
      });

      if (response.status === 401) {
        router.replace("/barber/login");
        return;
      }

      const body = await response.json().catch(() => ({}));

      if (response.status === 409) {
        setAddError("You already have a booking");
        return;
      }

      if (!response.ok) {
        setAddError(body.error || "Could not add this customer.");
        return;
      }

      setShowAddForm(false);
      setAddName("");
      setAddPhone("");
      setAddLocationId("");
      setAddPrice("");
      setActionError(null);
      await loadDashboard({ silent: true });
    } catch {
      setAddError("Something went wrong. Please try again.");
    } finally {
      setAddSubmitting(false);
    }
  }

  async function handleToggleSettings() {
    setActionError(null);
    setSavingSettings(true);

    const next = !data.accepting_customers;

    try {
      const response = await fetch("/api/barber/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accepting_customers: next }),
      });

      if (response.status === 401) {
        router.replace("/barber/login");
        return;
      }

      if (!response.ok) {
        setActionError("Could not update the accepting-customers setting.");
        return;
      }

      await loadDashboard({ silent: true });
    } catch {
      setActionError("Something went wrong. Please try again.");
    } finally {
      setSavingSettings(false);
    }
  }

  if (!authChecked) {
    return (
      <main className="min-h-screen bg-stone-50 text-zinc-950">
        <section className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-5 py-10 sm:px-8">
          <p className="text-zinc-500">Checking session…</p>
        </section>
      </main>
    );
  }

  const cuttingCount = data?.cutting ? 1 : 0;
  const waitingCount = data?.waiting?.length ?? 0;

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <section className="mx-auto w-full max-w-2xl px-5 py-10 sm:px-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              HairQueue
            </p>
            <h1 className="mt-1 text-2xl font-bold">Barber dashboard</h1>
            <p className="mt-1 text-sm text-zinc-600">{todayLabel()}</p>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-right text-sm">
            <p className="font-semibold">{cuttingCount} cutting</p>
            <p className="text-zinc-600">{waitingCount} waiting</p>
          </div>
        </header>

        {actionError && (
          <p className="mt-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {actionError}
          </p>
        )}

        {loading && !data ? (
          <p className="mt-8 text-zinc-500">Loading…</p>
        ) : loadError && !data ? (
          <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-5">
            <p className="text-red-600">Couldn&apos;t load the queue.</p>
            <button
              type="button"
              onClick={() => loadDashboard()}
              className="mt-3 rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Retry
            </button>
          </div>
        ) : data ? (
          <>
            {/* Now cutting */}
            <section className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Now cutting
              </h2>
              {data.cutting ? (
                <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
                  <p className="text-lg font-semibold">{data.cutting.name}</p>
                  <p className="mt-1 text-sm text-zinc-600">
                    Started at {formatTime(data.cutting.started_at)}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleComplete(data.cutting.id)}
                    disabled={busyAction?.type === "complete"}
                    className="mt-4 w-full rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
                  >
                    {busyAction?.type === "complete" ? "Completing…" : "Complete"}
                  </button>
                </div>
              ) : (
                <div className="mt-2 rounded-xl border border-zinc-200 bg-white p-5">
                  <p className="text-zinc-600">No one in the chair.</p>
                </div>
              )}
            </section>

            {/* Next in line */}
            <section className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                Next in line
              </h2>
              {waitingCount === 0 ? (
                <div className="mt-2 rounded-xl border border-zinc-200 bg-white p-5">
                  <p className="text-zinc-600">No one waiting.</p>
                </div>
              ) : (
                <ul className="mt-2 space-y-3">
                  {data.waiting.map((booking) => (
                    <li
                      key={booking.id}
                      className="rounded-xl border border-zinc-200 bg-white p-4"
                    >
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-xs font-bold text-white">
                          {booking.position}
                        </span>
                        <div>
                          <p className="font-semibold">{booking.name}</p>
                          <p className="mt-0.5 text-sm text-zinc-600">
                            {booking.location} · joined{" "}
                            {formatTime(booking.joined_at)}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleStart(booking.id)}
                          disabled={Boolean(data.cutting) || busyAction?.type === "start"}
                          className="flex-1 rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-40"
                        >
                          {busyAction?.type === "start" &&
                          busyAction?.id === booking.id
                            ? "Starting…"
                            : "Start"}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCancel(booking.id)}
                          disabled={busyAction?.type === "cancel"}
                          className="rounded-md border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-40"
                        >
                          {busyAction?.type === "cancel" &&
                          busyAction?.id === booking.id
                            ? "Cancelling…"
                            : "Cancel"}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Add customer */}
            <section className="mt-8">
              {!showAddForm ? (
                <button
                  type="button"
                  onClick={() => setShowAddForm(true)}
                  className="w-full rounded-md border border-zinc-300 bg-white px-4 py-3 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-100"
                >
                  + Add Customer
                </button>
              ) : (
                <form
                  onSubmit={handleAddSubmit}
                  className="rounded-xl border border-zinc-200 bg-white p-5"
                >
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
                    Add customer
                  </h2>
                  <div className="mt-4 space-y-4">
                    <div>
                      <label
                        htmlFor="add-name"
                        className="block text-sm font-medium text-zinc-700"
                      >
                        Name
                      </label>
                      <input
                        id="add-name"
                        type="text"
                        value={addName}
                        onChange={(event) => setAddName(event.target.value)}
                        required
                        placeholder="Customer name"
                        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-950 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="add-phone"
                        className="block text-sm font-medium text-zinc-700"
                      >
                        WhatsApp Number
                      </label>
                      <div className="mt-1">
                        <PhoneInput
                          value={addPhone}
                          onChange={setAddPhone}
                          placeholder="Enter WhatsApp number"
                        />
                      </div>
                    </div>

                    <div>
                      <label
                        htmlFor="add-location"
                        className="block text-sm font-medium text-zinc-700"
                      >
                        Location
                      </label>
                      {locationsLoading ? (
                        <p className="mt-1 text-sm text-zinc-500">
                          Loading locations…
                        </p>
                      ) : (
                        <select
                          id="add-location"
                          value={addLocationId}
                          onChange={(event) => setAddLocationId(event.target.value)}
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

                    <div>
                      <label
                        htmlFor="add-price"
                        className="block text-sm font-medium text-zinc-700"
                      >
                        Price{" "}
                        <span className="text-zinc-400">(optional)</span>
                      </label>
                      <input
                        id="add-price"
                        type="number"
                        min="0"
                        step="0.01"
                        value={addPrice}
                        onChange={(event) => setAddPrice(event.target.value)}
                        placeholder="0.00"
                        className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm focus:border-zinc-950 focus:outline-none"
                      />
                    </div>
                  </div>

                  {addError && (
                    <p className="mt-3 text-sm text-red-600">{addError}</p>
                  )}

                  <div className="mt-4 flex gap-2">
                    <button
                      type="submit"
                      disabled={addSubmitting || !addLocationId}
                      className="flex-1 rounded-md bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-60"
                    >
                      {addSubmitting ? "Adding…" : "Add to queue"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-100"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </section>

            {/* Accepting customers toggle */}
            <section className="mt-8">
              <div className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4">
                <div>
                  <p className="text-sm font-medium">Accepting customers</p>
                  <p className="text-xs text-zinc-500">
                    {data.accepting_customers
                      ? "New customers can join online."
                      : "Online intake is paused."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleToggleSettings}
                  disabled={savingSettings}
                  aria-pressed={data.accepting_customers}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition ${
                    data.accepting_customers ? "bg-emerald-600" : "bg-zinc-300"
                  }`}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                      data.accepting_customers
                        ? "translate-x-5"
                        : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            </section>

            {/* History */}
            <section className="mt-8">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">
                Today&apos;s history
              </h2>
              <div className="mt-2 space-y-3 text-sm text-zinc-500">
                <div className="rounded-xl border border-zinc-200 bg-white p-4">
                  <p className="font-medium text-zinc-600">
                    Completed ({data.completed_today.length})
                  </p>
                  {data.completed_today.length === 0 ? (
                    <p className="mt-1 text-zinc-400">None yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-1">
                      {data.completed_today.map((booking) => (
                        <li
                          key={booking.booking_number}
                          className="flex justify-between gap-4"
                        >
                          <span>{booking.name}</span>
                          <span>{formatTime(booking.completed_at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-xl border border-zinc-200 bg-white p-4">
                  <p className="font-medium text-zinc-600">
                    Cancelled ({data.cancelled_today.length})
                  </p>
                  {data.cancelled_today.length === 0 ? (
                    <p className="mt-1 text-zinc-400">None yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-1">
                      {data.cancelled_today.map((booking) => (
                        <li
                          key={booking.booking_number}
                          className="flex justify-between gap-4"
                        >
                          <span>{booking.name}</span>
                          <span>{formatTime(booking.cancelled_at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          </>
        ) : null}
      </section>
    </main>
  );
}



