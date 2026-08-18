"use client";

import { useEffect, useRef, useState } from "react";
import PhoneInput, {
  getCountries,
  getCountryCallingCode,
  isSupportedCountry,
} from "react-phone-number-input/input-max";

function detectDefaultCountry() {
  if (typeof navigator === "undefined") return "IN";
  const locale = navigator.language || navigator.languages?.[0] || "";
  const region = (locale.split("-")[1] || "").toUpperCase();
  if (region && /^[A-Z]{2}$/.test(region) && isSupportedCountry(region)) {
    return region;
  }
  return "IN";
}

function countryFlagEmoji(country) {
  if (!country) return "🌐";
  return Array.from(country.toUpperCase())
    .map((char) => String.fromCodePoint(0x1f1e6 + char.charCodeAt(0) - 65))
    .join("");
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

function countryName(code) {
  try {
    return regionNames.of(code) || code;
  } catch {
    return code;
  }
}

const COUNTRIES = getCountries()
  .map((code) => ({
    code,
    name: countryName(code),
    callingCode: getCountryCallingCode(code),
  }))
  .sort((a, b) => a.name.localeCompare(b.name));

function CountrySelect({ country, onCountryChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(event) {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const selected = COUNTRIES.find((c) => c.code === country);

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex h-full items-center gap-1.5 rounded-l-md border-r border-zinc-200 px-3 text-sm text-zinc-700 transition hover:bg-zinc-50"
        aria-label="Select country"
      >
        <span className="text-base leading-none">{countryFlagEmoji(country)}</span>
        <span className="font-medium">
          +{selected ? selected.callingCode : ""}
        </span>
        <svg
          aria-hidden="true"
          className="h-3 w-3 text-zinc-400"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M5.23 7.21a.75.75 0 011.06.02L10 10.94l3.71-3.71a.75.75 0 111.06 1.06l-4.24 4.24a.75.75 0 01-1.06 0L5.21 8.29a.75.75 0 01.02-1.08z"
            clipRule="evenodd"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 w-72 max-w-[85vw] overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-lg">
          <ul className="max-h-64 overflow-y-auto py-1">
            {COUNTRIES.map((c) => (
              <li key={c.code}>
                <button
                  type="button"
                  onClick={() => {
                    onCountryChange(c.code);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-800 transition hover:bg-zinc-50"
                >
                  <span className="text-base leading-none">
                    {countryFlagEmoji(c.code)}
                  </span>
                  <span className="flex-1">{c.name}</span>
                  <span className="text-zinc-400">+{c.callingCode}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function PhoneField({ value, onChange, placeholder = "Enter WhatsApp number" }) {
  const [country, setCountry] = useState("IN");

  useEffect(() => {
    setCountry(detectDefaultCountry());
  }, []);

  return (
    <div className="flex items-stretch rounded-md border border-zinc-300 bg-white transition focus-within:border-zinc-950">
      <CountrySelect country={country} onCountryChange={setCountry} />
      <PhoneInput
        country={country}
        value={value || undefined}
        onChange={(nextValue) => onChange(nextValue || "")}
        placeholder={placeholder}
        type="tel"
        className="min-w-0 flex-1 bg-transparent px-3 py-2 text-sm text-zinc-950 outline-none placeholder:text-zinc-400"
      />
    </div>
  );
}

export { isValidPhoneNumber } from "react-phone-number-input/input-max";
