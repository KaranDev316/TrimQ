import { BOOKING_STATUS } from "../../../../constants/status";
import { getPosition } from "../../../../lib/queue/position";
import { supabaseServer } from "../../../../lib/supabase/server";

function jsonError(message, status) {
  return Response.json({ error: message }, { status });
}

// Privacy note: given only a phone number, this returns *only* the status of the
// booking tied to that phone. It never returns other customers' names, phone
// numbers, or a directory of the queue. A "not found" answer is identical for
// "no such phone" and "phone has no active booking", so it doesn't reveal
// whether a number is registered.
export async function POST(request) {
  try {
    const body = await request.json();
    const phone = body?.phone?.trim();

    if (!phone) {
      return jsonError("Missing phone", 400);
    }

    const { data: customer, error: customerError } = await supabaseServer
      .from("customers")
      .select("id, name")
      .eq("phone", phone)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (customerError) {
      throw customerError;
    }

    if (!customer) {
      return jsonError("No active booking found for this phone number", 404);
    }

    const { data: booking, error: bookingError } = await supabaseServer
      .from("bookings")
      .select("id, booking_number, status, locations(name)")
      .eq("customer_id", customer.id)
      .in("status", [BOOKING_STATUS.WAITING, BOOKING_STATUS.CUTTING])
      .order("joined_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (bookingError) {
      throw bookingError;
    }

    if (!booking) {
      return jsonError("No active booking found for this phone number", 404);
    }

    const position = await getPosition(supabaseServer, booking.id);

    const { data: cutting, error: cuttingError } = await supabaseServer
      .from("bookings")
      .select("booking_number")
      .eq("status", BOOKING_STATUS.CUTTING)
      .limit(1)
      .maybeSingle();

    if (cuttingError) {
      throw cuttingError;
    }

    return Response.json(
      {
        booking_number: booking.booking_number,
        name: customer.name,
        location: booking.locations?.name ?? null,
        position,
        status: booking.status,
        currently_serving: cutting?.booking_number ?? null,
        people_ahead: position == null ? null : position - 1,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Failed to look up booking", error);
    return jsonError("Something went wrong", 500);
  }
}
