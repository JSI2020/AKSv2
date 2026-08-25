"use client";

import { useState } from "react";

import type { PakistanProvince } from "@aks/db";

import { PAKISTAN_PROVINCES } from "./payment-plans";
import { validateCheckoutAddress } from "./schemas";
import type { CheckoutAddressInput } from "./types";

type Props = {
  initial: CheckoutAddressInput;
  isSignedIn: boolean;
  onContinue: (address: CheckoutAddressInput) => void;
};

const inputClass =
  "w-full border border-greige-deep bg-greige px-3 py-2.5 text-[15px] text-ink outline-none focus:border-ink";

const labelClass =
  "mb-1.5 block text-[12px] uppercase tracking-[0.06em] text-ink/55";

export function AddressStep({ initial, isSignedIn, onContinue }: Props) {
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof CheckoutAddressInput>(
    key: K,
    value: CheckoutAddressInput[K],
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const result = validateCheckoutAddress(form);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(null);
    onContinue(result.data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="font-display text-[20px] text-ink">Delivery address</h2>
        <p className="mt-1 text-[14px] leading-relaxed text-ink/65">
          Pakistani format — province, area, and landmark help the courier find
          you.
        </p>
      </div>

      <div>
        <label htmlFor="recipientName" className={labelClass}>
          Recipient name
        </label>
        <input
          id="recipientName"
          name="recipientName"
          autoComplete="name"
          className={inputClass}
          value={form.recipientName}
          onChange={(e) => update("recipientName", e.target.value)}
          required
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="phone" className={labelClass}>
            Phone
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            className={inputClass}
            value={form.phone}
            onChange={(e) => update("phone", e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="whatsappNumber" className={labelClass}>
            WhatsApp for order updates
          </label>
          <input
            id="whatsappNumber"
            name="whatsappNumber"
            type="tel"
            className={inputClass}
            value={form.whatsappNumber}
            onChange={(e) => update("whatsappNumber", e.target.value)}
            required
          />
          <p className="mt-1.5 text-[13px] text-ink/60">
            This is where we send production updates — cutting, stitching, and
            dispatch.
          </p>
        </div>
      </div>

      {!isSignedIn ? (
        <div>
          <label htmlFor="guestEmail" className={labelClass}>
            Email (optional)
          </label>
          <input
            id="guestEmail"
            name="guestEmail"
            type="email"
            autoComplete="email"
            className={inputClass}
            value={form.guestEmail ?? ""}
            onChange={(e) => update("guestEmail", e.target.value)}
          />
        </div>
      ) : null}

      <div>
        <label htmlFor="addressLine1" className={labelClass}>
          House / flat, street
        </label>
        <input
          id="addressLine1"
          name="addressLine1"
          autoComplete="address-line1"
          className={inputClass}
          value={form.addressLine1}
          onChange={(e) => update("addressLine1", e.target.value)}
          required
        />
      </div>

      <div>
        <label htmlFor="addressLine2" className={labelClass}>
          Area, block, sector
        </label>
        <input
          id="addressLine2"
          name="addressLine2"
          autoComplete="address-line2"
          className={inputClass}
          value={form.addressLine2 ?? ""}
          onChange={(e) => update("addressLine2", e.target.value)}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="city" className={labelClass}>
            City
          </label>
          <input
            id="city"
            name="city"
            autoComplete="address-level2"
            className={inputClass}
            value={form.city}
            onChange={(e) => update("city", e.target.value)}
            required
          />
        </div>
        <div>
          <label htmlFor="province" className={labelClass}>
            Province
          </label>
          <select
            id="province"
            name="province"
            className={inputClass}
            value={form.province}
            onChange={(e) =>
              update("province", e.target.value as PakistanProvince)
            }
            required
          >
            {PAKISTAN_PROVINCES.map((province) => (
              <option key={province.value} value={province.value}>
                {province.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="postalCode" className={labelClass}>
            Postal code (optional)
          </label>
          <input
            id="postalCode"
            name="postalCode"
            autoComplete="postal-code"
            className={inputClass}
            value={form.postalCode ?? ""}
            onChange={(e) => update("postalCode", e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="landmark" className={labelClass}>
            Landmark
          </label>
          <input
            id="landmark"
            name="landmark"
            className={inputClass}
            value={form.landmark ?? ""}
            onChange={(e) => update("landmark", e.target.value)}
            placeholder="Near masjid, park, or shop"
          />
        </div>
      </div>

      {isSignedIn ? (
        <label className="flex items-start gap-3 text-[14px] text-ink/75">
          <input
            type="checkbox"
            checked={Boolean(form.saveAddress)}
            onChange={(e) => update("saveAddress", e.target.checked)}
            className="mt-1"
          />
          <span>Save this address to my account for next time.</span>
        </label>
      ) : null}

      {error ? (
        <p className="text-[14px] text-madder" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        className="btn-primary"
      >
        Continue to payment
      </button>
    </form>
  );
}
