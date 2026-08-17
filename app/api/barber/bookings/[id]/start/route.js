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

    const { data: currentlyCutting, error: cuttingLookupError } =
      await supabaseServer
        .from("bookings")
        .select("id")
        .eq("status", BOOKING_STATUS.CUTTING)
        .limit(1)
        .maybeSingle();

    if (cuttingLookupError) {
      throw cuttingLookupError;
    }

    if (currentlyCutting) {
      return jsonError("Finish the current haircut first", 409);
    }

    const { data: booking, error: updateError } = await supabaseServer
      .from("bookings")
      .update({
        status: BOOKING_STATUS.CUTTING,
        started_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .maybeSingle();

    if (updateError) {
      throw updateError;
    }

    if (!booking) {
      return jsonError("Booking not found", 404);
    }

    return Response.json(booking, { status: 200 });
  } catch (error) {
    console.error("Failed to start booking", error);
    return jsonError("Something went wrong", 500);
  }
}
