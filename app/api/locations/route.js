import { supabaseServer } from "../../../lib/supabase/server";

const DEFAULT_LOCATIONS = ["Barber's Hostel", "NRI Hostel", "Customer Location"];

function jsonError(message, status) {
  return Response.json({ error: message }, { status });
}

async function ensureDefaultLocations() {
  const { data: existingLocations, error: lookupError } = await supabaseServer
    .from("locations")
    .select("name")
    .in("name", DEFAULT_LOCATIONS);

  if (lookupError) {
    throw lookupError;
  }

  const existingNames = new Set((existingLocations ?? []).map((location) => location.name));
  const missingLocations = DEFAULT_LOCATIONS.filter((name) => !existingNames.has(name)).map(
    (name) => ({ name, active: true })
  );

  if (missingLocations.length === 0) {
    const { error: updateError } = await supabaseServer
      .from("locations")
      .update({ active: true })
      .in("name", DEFAULT_LOCATIONS);

    if (updateError) {
      throw updateError;
    }

    return;
  }

  const { error: insertError } = await supabaseServer.from("locations").insert(missingLocations);

  if (insertError) {
    throw insertError;
  }

  const { error: updateError } = await supabaseServer
    .from("locations")
    .update({ active: true })
    .in("name", DEFAULT_LOCATIONS);

  if (updateError) {
    throw updateError;
  }
}

export async function GET() {
  try {
    await ensureDefaultLocations();

    const { data: locations, error } = await supabaseServer
      .from("locations")
      .select("id, name")
      .eq("active", true)
      .order("name");

    if (error) {
      throw error;
    }

    return Response.json({ locations: locations ?? [] });
  } catch (error) {
    console.error("Failed to load locations", error);
    return jsonError("Could not load locations", 500);
  }
}
