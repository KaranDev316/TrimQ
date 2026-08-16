import { BOOKING_STATUS } from "../../../../constants/status";
import { generateBookingNumber } from "../../../../lib/bookingNumber";
import { getPosition } from "../../../../lib/queue/position";
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

    const { data: existingCustomer, error: customerLookupError } =
      await supabaseServer
        .from("customers")
        .select("id")
        .eq("phone", phone)
        .maybeSingle();

    if (customerLookupError) {
      throw customerLookupError;
    }

    let customerId = existingCustomer?.id;

    if (!customerId) {
      const { data: newCustomer, error: customerInsertError } =
        await supabaseServer
          .from("customers")
          .insert({ name, phone })
          .select("id")
          .single();

      if (customerInsertError) {
        throw customerInsertError;
      }

      customerId = newCustomer.id;
    }

    const { data: activeBooking, error: activeBookingError } =
      await supabaseServer
        .from("bookings")
        .select("id")
        .eq("customer_id", customerId)
        .in("status", [BOOKING_STATUS.WAITING, BOOKING_STATUS.CUTTING])
        .limit(1)
        .maybeSingle();

    if (activeBookingError) {
      throw activeBookingError;
    }

    if (activeBooking) {
      return jsonError("You already have a booking", 409);
    }

    const bookingNumber = await generateBookingNumber(supabaseServer);

    const { data: booking, error: bookingInsertError } = await supabaseServer
      .from("bookings")
      .insert({
        booking_number: bookingNumber,
        customer_id: customerId,
        location_id: locationId,
        status: BOOKING_STATUS.WAITING,
      })
      .select("id, booking_number")
      .single();

    if (bookingInsertError) {
      throw bookingInsertError;
    }

    const position = await getPosition(supabaseServer, booking.id);

    return Response.json(
      {
        booking_number: booking.booking_number,
        position,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to join queue", error);
    return jsonError("Something went wrong", 500);
  }
}
