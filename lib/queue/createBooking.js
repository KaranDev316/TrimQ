import { BOOKING_STATUS } from "../../constants/status";
import { generateBookingNumber } from "../bookingNumber";
import { isCustomerLocation } from "../locations";
import { normalizePhone } from "../phone";
import { getPosition } from "./position";

function isMissingAddressColumn(error) {
  return error?.code === "42703" && error?.message?.includes("bookings.address");
}

// Shared "create a booking" logic used by both the customer-facing join flow
// (Slice 1) and the barber-side manual add (Slice 2). Callers validate required
// fields and (for the customer flow only) the accepting_customers setting.
//
// Returns { invalid_phone: true } when the phone can't be normalized to a valid
// E.164 number, { invalid_location: true } when the location doesn't exist,
// { address_required: true } when the location is "Customer Location" and no
// apartment name was provided, { duplicate: true } when the customer already
// has an active booking, otherwise { duplicate: false, booking, position }.
export async function createBooking(
  supabaseServerClient,
  { name, phone, location_id, price, address }
) {
  const trimmedName = name.trim();
  const normalizedPhone = normalizePhone(phone);
  const trimmedLocationId = location_id.trim();
  const trimmedAddress = address?.trim();

  if (!normalizedPhone) {
    return { invalid_phone: true };
  }

  // Look up the location to know whether an apartment name is required.
  const { data: location, error: locationError } = await supabaseServerClient
    .from("locations")
    .select("name")
    .eq("id", trimmedLocationId)
    .maybeSingle();

  if (locationError) {
    throw locationError;
  }

  if (!location) {
    return { invalid_location: true };
  }

  if (isCustomerLocation(location.name) && !trimmedAddress) {
    return { address_required: true };
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

  if (trimmedAddress) {
    insertPayload.address = trimmedAddress;
  }

  if (price !== undefined && price !== null && price !== "") {
    insertPayload.price = price;
  }

  let { data: booking, error: bookingInsertError } = await supabaseServerClient
    .from("bookings")
    .insert(insertPayload)
    .select("id, booking_number")
    .single();

  if (isMissingAddressColumn(bookingInsertError) && "address" in insertPayload) {
    delete insertPayload.address;

    const retry = await supabaseServerClient
      .from("bookings")
      .insert(insertPayload)
      .select("id, booking_number")
      .single();

    booking = retry.data;
    bookingInsertError = retry.error;
  }

  if (bookingInsertError) {
    throw bookingInsertError;
  }

  const position = await getPosition(supabaseServerClient, booking.id);

  return { duplicate: false, booking, position };
}
