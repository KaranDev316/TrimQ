export default function Home() {
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
          <p className="mt-5 max-w-xl text-lg leading-8 text-zinc-700">
            Customers can join the queue without an account, and the barber can
            manage the day from one protected dashboard.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a
              href="/join"
              className="inline-flex min-h-12 items-center justify-center rounded-md bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              Join queue
            </a>
            <a
              href="/barber"
              className="inline-flex min-h-12 items-center justify-center rounded-md border border-zinc-300 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-white"
            >
              Barber dashboard
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
