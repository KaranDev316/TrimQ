import { createBooking } from "../../../../../lib/queue/createBooking";
import { requireBarberSession } from "../../../../../lib/supabase/authCheck";
import { supabaseServer } from "../../../../../lib/supabase/server";

function jsonError(message, status) {
  return Response.json({ error: message }, { status });
}

export async function POST(request) {
  try {
    const user = await requireBarberSession(request);

    if (!user) {
      return jsonError("Unauthorized", 401);
    }

    const body = await request.json();
    const name = body?.name?.trim();
    const phone = body?.phone?.trim();
    const locationId = body?.location_id?.trim();
    const price = body?.price;
    const address = body?.address?.trim();

    if (!name || !phone || !locationId) {
      return jsonError("Missing required fields", 400);
    }

    const result = await createBooking(supabaseServer, {
      name,
      phone,
      location_id: locationId,
      price,
      address,
    });

    if (result.invalid_phone) {
      return jsonError("Enter a valid phone number", 400);
    }

    if (result.invalid_location) {
      return jsonError("Invalid location", 400);
    }

    if (result.address_required) {
      return jsonError("Enter your apartment name", 400);
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
    console.error("Failed to add booking", error);
    return jsonError("Something went wrong", 500);
  }
}
