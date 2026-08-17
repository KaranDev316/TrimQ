import { BOOKING_STATUS } from "../../constants/status";
import { generateBookingNumber } from "../bookingNumber";
import { getPosition } from "./position";

// Shared "create a booking" logic used by both the customer-facing join flow
// (Slice 1) and the barber-side manual add (Slice 2). Callers validate required
// fields and (for the customer flow only) the accepting_customers setting.
//
// Returns { duplicate: true } when the customer already has an active booking,
// otherwise { duplicate: false, booking, position }.
export async function createBooking(
  supabaseServerClient,
  { name, phone, location_id, price }
) {
  const trimmedName = name.trim();
  const trimmedPhone = phone.trim();
  const trimmedLocationId = location_id.trim();

  // Find-or-create the customer by phone.
  const { data: existingCustomer, error: customerLookupError } =
    await supabaseServerClient
      .from("customers")
      .select("id")
      .eq("phone", trimmedPhone)
      .maybeSingle();

  if (customerLookupError) {
    throw customerLookupError;
  }

  let customerId = existingCustomer?.id;

  if (!customerId) {
    const { data: newCustomer, error: customerInsertError } =
      await supabaseServerClient
        .from("customers")
        .insert({ name: trimmedName, phone: trimmedPhone })
        .select("id")
        .single();

    if (customerInsertError) {
      throw customerInsertError;
    }

    customerId = newCustomer.id;
  }

  // Reject if the customer already has an active booking.
  const { data: activeBooking, error: activeBookingError } =
    await supabaseServerClient
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
    return { duplicate: true };
  }

  const bookingNumber = await generateBookingNumber(supabaseServerClient);

  const insertPayload = {
    booking_number: bookingNumber,
    customer_id: customerId,
    location_id: trimmedLocationId,
    status: BOOKING_STATUS.WAITING,
  };

  if (price !== undefined && price !== null && price !== "") {
    insertPayload.price = price;
  }

  const { data: booking, error: bookingInsertError } = await supabaseServerClient
    .from("bookings")
    .insert(insertPayload)
    .select("id, booking_number")
    .single();

  if (bookingInsertError) {
    throw bookingInsertError;
  }

  const position = await getPosition(supabaseServerClient, booking.id);

  return { duplicate: false, booking, position };
}
