import { BOOKING_STATUS } from "../../constants/status";
import { generateBookingNumber } from "../bookingNumber";
import { normalizePhone } from "../phone";
import { getPosition } from "./position";

// Shared "create a booking" logic used by both the customer-facing join flow
// (Slice 1) and the barber-side manual add (Slice 2). Callers validate required
// fields and (for the customer flow only) the accepting_customers setting.
//
// Returns { invalid_phone: true } when the phone can't be normalized to a valid
// E.164 number, { duplicate: true } when the customer already has an active
// booking, otherwise { duplicate: false, booking, position }.
export async function createBooking(
  supabaseServerClient,
  { name, phone, location_id, price }
) {
  const trimmedName = name.trim();
  const normalizedPhone = normalizePhone(phone);
  const trimmedLocationId = location_id.trim();

  if (!normalizedPhone) {
    return { invalid_phone: true };
  }

  // Find-or-create the customer by normalized (E.164) phone.
  const { data: existingCustomer, error: customerLookupError } =
    await supabaseServerClient
      .from("customers")
      .select("id")
      .eq("phone", normalizedPhone)
      .maybeSingle();

  if (customerLookupError) {
    throw customerLookupError;
  }

  let customerId = existingCustomer?.id;

  if (!customerId) {
    const { data: newCustomer, error: customerInsertError } =
      await supabaseServerClient
        .from("customers")
        .insert({ name: trimmedName, phone: normalizedPhone })
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
