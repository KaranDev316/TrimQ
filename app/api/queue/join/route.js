import { createBooking } from "../../../../lib/queue/createBooking";
import { supabaseServer } from "../../../../lib/supabase/server";

function jsonError(message, status) {
  return Response.json({ error: message }, { status });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const name = body?.name?.trim();
    const phone = body?.phone?.trim();
    const locationId = body?.location_id?.trim();

    if (!name || !phone || !locationId) {
      return jsonError("Missing required fields", 400);
    }

    const { data: settings, error: settingsError } = await supabaseServer
      .from("barber_settings")
      .select("accepting_customers")
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      throw settingsError;
    }

    if (settings?.accepting_customers === false) {
      return jsonError("Queue is currently closed", 403);
    }

    const result = await createBooking(supabaseServer, {
      name,
      phone,
      location_id: locationId,
    });

    if (result.invalid_phone) {
      return jsonError("Enter a valid phone number", 400);
    }

    if (result.duplicate) {
      return jsonError("You already have a booking", 409);
    }

    return Response.json(
      {
        booking_number: result.booking.booking_number,
        position: result.position,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to join queue", error);
    return jsonError("Something went wrong", 500);
  }
}
