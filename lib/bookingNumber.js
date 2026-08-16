const BOOKING_NUMBER_PREFIX = "HQ";
const FIRST_BOOKING_NUMBER = 1001;

export async function generateBookingNumber(supabaseServerClient) {
  const { data, error } = await supabaseServerClient
    .from("bookings")
    .select("booking_number")
    .like("booking_number", `${BOOKING_NUMBER_PREFIX}-%`);

  if (error) {
    throw error;
  }

  const highestNumber = data.reduce((highest, booking) => {
    const numericSuffix = Number(
      booking.booking_number.replace(`${BOOKING_NUMBER_PREFIX}-`, "")
    );

    return Number.isFinite(numericSuffix)
      ? Math.max(highest, numericSuffix)
      : highest;
  }, FIRST_BOOKING_NUMBER - 1);

  const nextNumber = highestNumber + 1;

  return `${BOOKING_NUMBER_PREFIX}-${String(nextNumber).padStart(4, "0")}`;
}
