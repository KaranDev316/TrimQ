import { supabaseServer } from "../../../lib/supabase/server";
import {
  CANONICAL_LOCATIONS,
  LEGACY_LOCATION_RENAMES,
  formatLocationOption,
  sortLocationOptions,
} from "../../../lib/locations";

function jsonError(message, status) {
  return Response.json({ error: message }, { status });
}

function dedupeLocations(locations) {
  const optionsByName = new Map();

  for (const location of locations) {
    const option = formatLocationOption(location);
    const existing = optionsByName.get(option.name);
    const isCanonical = location.name === option.name;

    if (!existing || isCanonical) {
      optionsByName.set(option.name, option);
    }
  }

  return sortLocationOptions([...optionsByName.values()]);
}

export async function GET() {
  try {
    const readableLocationNames = [
      ...CANONICAL_LOCATIONS,
      ...Object.keys(LEGACY_LOCATION_RENAMES),
    ];

    const { data: locations, error } = await supabaseServer
      .from("locations")
      .select("id, name")
      .eq("active", true)
      .in("name", readableLocationNames);

    if (error) {
      throw error;
    }

    return Response.json({
      locations: dedupeLocations(locations ?? []),
    });
  } catch (error) {
    console.error("Failed to load locations", error);
    return jsonError("Could not load locations", 500);
  }
}
