import { parsePhoneNumberFromString } from "libphonenumber-js/max";

// Fallback country for numbers that arrive without an explicit country code.
// The UI always sends E.164 (which includes the country code), so this fallback
// is only exercised by direct API callers passing a national-format number.
const DEFAULT_COUNTRY = "IN";

// Normalizes a phone string to E.164 (e.g. "+447911123456"), or returns null
// when the value can't be parsed as a valid phone number for the given country.
export function normalizePhone(value, defaultCountry = DEFAULT_COUNTRY) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const parsed = parsePhoneNumberFromString(trimmed, defaultCountry);

  if (!parsed || !parsed.isValid()) return null;

  return parsed.number;
}

export function isValidPhoneNumber(value) {
  return normalizePhone(value) !== null;
}
