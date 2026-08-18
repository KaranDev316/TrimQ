export const CANONICAL_LOCATIONS = [
  "G9 Hostel",
  "New NRI Hostel",
  "Customer Location",
];

export const LEGACY_LOCATION_RENAMES = {
  "Barber's Hostel": "G9 Hostel",
  "NRI Hostel": "New NRI Hostel",
};

export const CUSTOMER_LOCATION_NAME = "Customer Location";

export function normalizeLocationName(name) {
  return LEGACY_LOCATION_RENAMES[name] ?? name;
}

export function isCustomerLocation(name) {
  return normalizeLocationName(name) === CUSTOMER_LOCATION_NAME;
}

export function customerLocationName(name) {
  const normalizedName = normalizeLocationName(name);
  return normalizedName === CUSTOMER_LOCATION_NAME ? "My Location" : normalizedName;
}

export function formatLocationOption(location) {
  const name = normalizeLocationName(location.name);

  return {
    id: location.id,
    name,
    customer_name: customerLocationName(name),
  };
}

export function sortLocationOptions(locations) {
  return [...locations].sort((first, second) => {
    const firstIndex = CANONICAL_LOCATIONS.indexOf(first.name);
    const secondIndex = CANONICAL_LOCATIONS.indexOf(second.name);

    if (firstIndex !== -1 && secondIndex !== -1) {
      return firstIndex - secondIndex;
    }

    if (firstIndex !== -1) return -1;
    if (secondIndex !== -1) return 1;

    return first.name.localeCompare(second.name);
  });
}
