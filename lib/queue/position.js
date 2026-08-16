import { BOOKING_STATUS } from "../../constants/status";

export async function getPosition(supabaseServerClient, bookingId) {
  const { data, error } = await supabaseServerClient
    .from("bookings")
    .select("id")
    .in("status", [BOOKING_STATUS.WAITING, BOOKING_STATUS.CUTTING])
    .order("joined_at", { ascending: true });

  if (error) {
    throw error;
  }

  const index = data.findIndex((booking) => booking.id === bookingId);

  return index === -1 ? null : index + 1;
}
