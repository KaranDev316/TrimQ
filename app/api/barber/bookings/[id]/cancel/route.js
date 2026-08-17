import { BOOKING_STATUS } from "../../../../../../constants/status";
import { requireBarberSession } from "../../../../../../lib/supabase/authCheck";
import { supabaseServer } from "../../../../../../lib/supabase/server";

function jsonError(message, status) {
  return Response.json({ error: message }, { status });
}

export async function POST(request, { params }) {
  try {
    const user = await requireBarberSession(request);

    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const { id } = await params;

    const { data: booking, error: lookupError } = await supabaseServer
      .from("bookings")
      .select("status")
      .eq("id", id)
      .maybeSingle();

    if (lookupError) {
      throw lookupError;
    }

    if (!booking) {
      return jsonError("Booking not found", 404);
    }

    if (
      booking.status === BOOKING_STATUS.COMPLETED ||
      booking.status === BOOKING_STATUS.CANCELLED
    ) {
      return jsonError("Booking can no longer be cancelled", 400);
    }

    const { error: updateError } = await supabaseServer
      .from("bookings")
      .update({
        status: BOOKING_STATUS.CANCELLED,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateError) {
      throw updateError;
    }

    return Response.json({ status: "cancelled" }, { status: 200 });
  } catch (error) {
    console.error("Failed to cancel booking", error);
    return jsonError("Something went wrong", 500);
  }
}
