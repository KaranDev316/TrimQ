import { BOOKING_STATUS } from "../constants/status";
import { supabaseServer } from "../lib/supabase/server";

// Homepage must reflect live queue state on every request.
export const dynamic = "force-dynamic";

export default async function Home() {
  const { data: settings } = await supabaseServer
    .from("barber_settings")
    .select("accepting_customers")
    .limit(1)
    .maybeSingle();

  const acceptingCustomers = settings?.accepting_customers !== false;

  const { data: cuttingBooking } = await supabaseServer
    .from("bookings")
    .select("customers(name)")
    .eq("status", BOOKING_STATUS.CUTTING)
    .limit(1)
    .maybeSingle();

  const { count } = await supabaseServer
    .from("bookings")
    .select("id", { count: "exact", head: true })
    .eq("status", BOOKING_STATUS.WAITING);

  const cuttingFirstName =
    cuttingBooking?.customers?.name?.trim().split(/\s+/)[0] || null;
  const waitingCount = count ?? 0;

  return (
    <main className="min-h-screen bg-stone-50 text-zinc-950">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-5 py-10 sm:px-8">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            HairQueue
          </p>
          <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-6xl">
            A simple, fair queue for the barber chair.
          </h1>

          {acceptingCustomers ? (
            <>
              <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-5">
                <p className="text-lg font-medium">
                  {cuttingFirstName
                    ? `Currently cutting: ${cuttingFirstName}`
                    : "No one in the chair right now."}
                </p>
                <p className="mt-1 text-zinc-600">
                  {waitingCount === 1
                    ? "1 person waiting"
                    : `${waitingCount} people waiting`}
                </p>
              </div>
              <div className="mt-6">
                <a
                  href="/join"
                  className="inline-flex min-h-12 items-center justify-center rounded-md bg-zinc-950 px-6 text-sm font-semibold text-white transition hover:bg-zinc-800"
                >
                  Join Queue
                </a>
              </div>
            </>
          ) : (
            <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-5">
              <p className="text-lg font-medium">Queue closed</p>
              <p className="mt-1 text-zinc-600">
                The barber is not accepting new customers right now. Check back
                later.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
