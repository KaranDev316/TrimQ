import { BOOKING_STATUS } from "../../../../constants/status";
import { getPosition } from "../../../../lib/queue/position";
import { requireBarberSession } from "../../../../lib/supabase/authCheck";
import { supabaseServer } from "../../../../lib/supabase/server";

function jsonError(message, status) {
  return Response.json({ error: message }, { status });
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export async function GET(request) {
  try {
    const user = await requireBarberSession(request);

    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    // The single booking currently being cut (or null).
    const { data: cutting, error: cuttingError } = await supabaseServer
      .from("bookings")
      .select(
        "id, booking_number, customers(name), locations(name), started_at"
      )
      .eq("status", BOOKING_STATUS.CUTTING)
      .limit(1)
      .maybeSingle();

    if (cuttingError) {
      throw cuttingError;
    }

    // All waiting bookings, oldest first.
    const { data: waitingBookings, error: waitingError } = await supabaseServer
      .from("bookings")
      .select("id, booking_number, customers(name), locations(name), joined_at")
      .eq("status", BOOKING_STATUS.WAITING)
      .order("joined_at", { ascending: true });

    if (waitingError) {
      throw waitingError;
    }

    const waiting = [];

    for (const booking of waitingBookings ?? []) {
      const position = await getPosition(supabaseServer, booking.id);

      waiting.push({
        id: booking.id,
        booking_number: booking.booking_number,
        name: booking.customers?.name ?? null,
        location: booking.locations?.name ?? null,
        joined_at: booking.joined_at,
        position,
      });
    }

    const todayStart = startOfToday().toISOString();

    const { data: completedToday, error: completedError } = await supabaseServer
      .from("bookings")
      .select("booking_number, customers(name), completed_at")
      .eq("status", BOOKING_STATUS.COMPLETED)
      .gte("completed_at", todayStart)
      .order("completed_at", { ascending: false });

    if (completedError) {
      throw completedError;
    }

    const { data: cancelledToday, error: cancelledError } = await supabaseServer
      .from("bookings")
      .select("booking_number, customers(name), updated_at")
      .eq("status", BOOKING_STATUS.CANCELLED)
      .gte("updated_at", todayStart)
      .order("updated_at", { ascending: false });

    if (cancelledError) {
      throw cancelledError;
    }

    const { data: settings, error: settingsError } = await supabaseServer
      .from("barber_settings")
      .select("accepting_customers")
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      throw settingsError;
    }

    return Response.json(
      {
        cutting: cutting
          ? {
              id: cutting.id,
              booking_number: cutting.booking_number,
              name: cutting.customers?.name ?? null,
              location: cutting.locations?.name ?? null,
              started_at: cutting.started_at,
            }
          : null,
        waiting,
        completed_today: (completedToday ?? []).map((booking) => ({
          booking_number: booking.booking_number,
          name: booking.customers?.name ?? null,
          completed_at: booking.completed_at,
        })),
        cancelled_today: (cancelledToday ?? []).map((booking) => ({
          booking_number: booking.booking_number,
          name: booking.customers?.name ?? null,
          cancelled_at: booking.updated_at,
        })),
        accepting_customers: settings?.accepting_customers ?? true,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to load barber bookings", error);
    return jsonError("Something went wrong", 500);
  }
}
