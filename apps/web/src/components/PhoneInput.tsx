"use client";

import { useState } from "react";
import { COUNTRIES, commonCountries, countryLabel } from "../lib/countryCodes";

interface PhoneInputProps {
  /** Selected country ISO 3166-1 alpha-2 code (e.g. "IL"). */
  countryIso: string;
  onCountryChange: (iso: string) => void;
  /** Local (national) phone number as typed by the user. */
  phone: string;
  onPhoneChange: (value: string) => void;
  /** id for the phone <input>, so an external <label htmlFor> can target it. */
  id?: string;
  phoneAriaLabel?: string;
  countryAriaLabel?: string;
  placeholder?: string;
  autoComplete?: string;
  disabled?: boolean;
  /** Mark the field invalid for assistive tech + error styling. */
  invalid?: boolean;
  /**
   * id of an external element (usually the error text) that describes the phone
   * field, wired as `aria-describedby` so a screen reader reads the error while
   * the field has focus (WCAG 3.3.1). Pass `undefined` when there is no such
   * element - a dangling idref announces nothing.
   */
  describedById?: string;
}

/**
 * Shared phone field: a full country-code selector on the LEFT and the
 * phone-number input on the RIGHT (matching the login design). RTL-aware —
 * the input column is `1fr` and renders on the right; the selector is fixed
 * width on the left. Used by both the login screen and the add-member form.
 */
export function PhoneInput({
  countryIso,
  onCountryChange,
  phone,
  onPhoneChange,
  id,
  phoneAriaLabel = "מספר טלפון",
  countryAriaLabel = "קידומת מדינה",
  placeholder = "050-123-4567",
  autoComplete = "tel-national",
  disabled = false,
  invalid = false,
  describedById,
}: PhoneInputProps) {
  // PERF-006: render only the common countries until the user opens the selector;
  // the full list is swapped in on first focus / pointer-down (before the native
  // dropdown paints), so ~190 <option>s never enter the initial DOM.
  const [expanded, setExpanded] = useState(false);
  const countryOptions = expanded ? COUNTRIES : commonCountries(countryIso);
  return (
    <div className="phone-field">
      <input
        id={id}
        className={`phone-field__num${invalid ? " is-invalid" : ""}`}
        dir="ltr"
        type="tel"
        inputMode="tel"
        value={phone}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-label={phoneAriaLabel}
        aria-invalid={invalid || undefined}
        aria-describedby={describedById}
        disabled={disabled}
        onChange={(e) => onPhoneChange(e.target.value)}
      />
      <select
        className="phone-field__cc"
        value={countryIso}
        aria-label={countryAriaLabel}
        disabled={disabled}
        onFocus={() => setExpanded(true)}
        onMouseDown={() => setExpanded(true)}
        onChange={(e) => onCountryChange(e.target.value)}
      >
        {countryOptions.map((c) => (
          <option key={c.iso2} value={c.iso2}>
            {countryLabel(c)}
          </option>
        ))}
      </select>
    </div>
  );
}
