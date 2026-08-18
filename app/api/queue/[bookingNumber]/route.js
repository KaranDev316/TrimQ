import { BOOKING_STATUS } from "../../../../constants/status";
import { normalizePhone } from "../../../../lib/phone";
import { getPosition } from "../../../../lib/queue/position";
import { estimateWaitMinutes } from "../../../../lib/queue/waitTime";
import { supabaseServer } from "../../../../lib/supabase/server";
import { customerLocationName } from "../../../../lib/locations";

function jsonError(message, status) {
  return Response.json({ error: message }, { status });
}

function isMissingAddressColumn(error) {
  return error?.code === "42703" && error?.message?.includes("bookings.address");
}

async function loadBooking(bookingNumber) {
  const result = await supabaseServer
    .from("bookings")
    .select("id, booking_number, status, address, customers(name), locations(name)")
    .eq("booking_number", bookingNumber)
    .maybeSingle();

  if (!isMissingAddressColumn(result.error)) {
    return result;
  }

  return supabaseServer
    .from("bookings")
    .select("id, booking_number, status, customers(name), locations(name)")
    .eq("booking_number", bookingNumber)
    .maybeSingle();
}

export async function GET(request, { params }) {
  try {
    const { bookingNumber } = await params;

    const { data: booking, error } = await loadBooking(bookingNumber);

    if (error) {
      throw error;
    }

    if (!booking) {
      return jsonError("Booking not found", 404);
    }

    const response = {
      booking_number: booking.booking_number,
      name: booking.customers?.name ?? null,
      location: customerLocationName(booking.locations?.name ?? null),
      address: booking.address ?? null,
      status: booking.status,
    };

    if (
      booking.status === BOOKING_STATUS.WAITING ||
      booking.status === BOOKING_STATUS.CUTTING
    ) {
      const position = await getPosition(supabaseServer, booking.id);

      response.position = position;
      response.estimated_wait_minutes = estimateWaitMinutes(position - 1);
    }

    return Response.json(response, { status: 200 });
  } catch (error) {
    console.error("Failed to get booking", error);
    return jsonError("Something went wrong", 500);
  }
}

export async function PATCH(request, { params }) {
  try {
    const { bookingNumber } = await params;
    const body = await request.json();
    const phone = body?.phone?.trim();

    if (!phone) {
      return jsonError("Missing phone", 400);
    }

    const normalizedPhone = normalizePhone(phone);

    if (!normalizedPhone) {
      return jsonError("Enter a valid phone number", 400);
    }

    const { data: booking, error } = await supabaseServer
      .from("bookings")
      .select("status, customers(phone)")
      .eq("booking_number", bookingNumber)
      .maybeSingle();

    if (error) {
      throw error;
    }

    if (!booking) {
      return jsonError("Booking not found", 404);
    }

    if (normalizePhone(booking.customers?.phone) !== normalizedPhone) {
      return jsonError("Not your booking", 403);
    }

    if (booking.status !== BOOKING_STATUS.WAITING) {
      return jsonError("Booking can no longer be cancelled", 400);
    }

    const { error: updateError } = await supabaseServer
      .from("bookings")
      .update({ status: BOOKING_STATUS.CANCELLED })
      .eq("booking_number", bookingNumber);

    if (updateError) {
      throw updateError;
    }

    return Response.json({ status: "cancelled" }, { status: 200 });
  } catch (error) {
    console.error("Failed to cancel booking", error);
    return jsonError("Something went wrong", 500);
  }
}
