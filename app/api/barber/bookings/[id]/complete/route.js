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

    const { data: booking, error: updateError } = await supabaseServer
      .from("bookings")
      .update({
        status: BOOKING_STATUS.COMPLETED,
        completed_at: new Date().toISOString(),
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
    console.error("Failed to complete booking", error);
    return jsonError("Something went wrong", 500);
  }
}
