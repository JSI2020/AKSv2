"use client";

import { useState, useTransition } from "react";
import { signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";

import { PAKISTAN_PROVINCES } from "@/modules/checkout/payment-plans";
import type { AuthChannelState } from "@/modules/auth/social-providers";

import {
  beginOAuthLinkAction,
  confirmEmailChangeAction,
  deleteOwnAccountAction,
  disconnectProviderAction,
  removeAddressAction,
  requestEmailChangeAction,
  saveAddressAction,
  updateNameAction,
  updatePhoneAction,
} from "./actions";
import type { AccountAddress } from "./profile-store";

type Props = {
  name: string;
  email: string | null;
  phone: string | null;
  providers: string[];
  addresses: AccountAddress[];
  channels: AuthChannelState[];
  canClearPhone: boolean;
  disconnectable: string[];
};

const EMPTY_ADDRESS = {
  label: "",
  recipientName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  province: "PUNJAB",
  postalCode: "",
  landmark: "",
  isDefault: true,
};

export function AccountEditor(props: Props) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(task: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      const result = await task();
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      setNotice("Saved.");
      router.refresh();
    });
  }

  return (
    <div className="account-stack">
      {notice ? <p className="auth-message">{notice}</p> : null}
      {error ? (
        <p className="auth-error" role="alert">
          {error}
        </p>
      ) : null}
      <NameForm
        name={props.name}
        pending={pending}
        onSave={(name) => run(() => updateNameAction(name))}
      />
      <PhoneForm
        phone={props.phone ?? ""}
        pending={pending}
        canClear={props.canClearPhone}
        onSave={(phone) => run(() => updatePhoneAction(phone))}
      />
      <EmailForm
        email={props.email}
        pending={pending}
        onError={setError}
        onNotice={setNotice}
      />
      <AddressList
        addresses={props.addresses}
        pending={pending}
        onSave={(input, id) =>
          run(async () => {
            const saved = await saveAddressAction(input, id);
            return saved;
          })
        }
        onRemove={(id) => run(() => removeAddressAction(id))}
      />
      <Connections
        channels={props.channels}
        providers={props.providers}
        disconnectable={props.disconnectable}
        pending={pending}
        onDisconnect={(provider) =>
          run(() => disconnectProviderAction(provider))
        }
        onError={setError}
      />
      <DeleteAccount
        pending={pending}
        onError={(message) => {
          setNotice(null);
          setError(message);
        }}
      />
    </div>
  );
}

function NameForm({
  name,
  pending,
  onSave,
}: {
  name: string;
  pending: boolean;
  onSave: (name: string) => void;
}) {
  const [value, setValue] = useState(name);
  return (
    <form
      className="account-card"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(value);
      }}
    >
      <h2 className="serif">Your name</h2>
      <div className="auth-field">
        <label htmlFor="account-name">Name</label>
        <input
          id="account-name"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          autoComplete="name"
          required
          disabled={pending}
        />
      </div>
      <button type="submit" className="btn-primary" disabled={pending}>
        Save name
      </button>
    </form>
  );
}

function PhoneForm({
  phone,
  pending,
  canClear,
  onSave,
}: {
  phone: string;
  pending: boolean;
  canClear: boolean;
  onSave: (phone: string) => void;
}) {
  const [value, setValue] = useState(phone);
  return (
    <form
      className="account-card"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(value);
      }}
    >
      <h2 className="serif">Phone</h2>
      <p className="auth-hint">
        Used for order updates and WhatsApp sign-in. Pakistan numbers can start
        with 03.
      </p>
      <div className="auth-field">
        <label htmlFor="account-phone">Phone / WhatsApp</label>
        <input
          id="account-phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          disabled={pending}
          placeholder="03001234567"
        />
      </div>
      {!canClear ? (
        <p className="auth-hint">
          This number is your only way back in. Add an email before clearing it.
        </p>
      ) : null}
      <button type="submit" className="btn-primary" disabled={pending}>
        Save phone
      </button>
    </form>
  );
}

function EmailForm({
  email,
  pending,
  onError,
  onNotice,
}: {
  email: string | null;
  pending: boolean;
  onError: (message: string | null) => void;
  onNotice: (message: string | null) => void;
}) {
  const router = useRouter();
  const [value, setValue] = useState(email ?? "");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [localPending, startTransition] = useTransition();
  const busy = pending || localPending;

  return (
    <form
      className="account-card"
      onSubmit={(event) => {
        event.preventDefault();
        onError(null);
        onNotice(null);
        startTransition(async () => {
          if (!sent) {
            const result = await requestEmailChangeAction(value);
            if (!result.ok) {
              onError(result.error);
              return;
            }
            if (result.devCode) setCode(result.devCode);
            setSent(true);
            onNotice(
              result.devCode
                ? "Dev code filled below."
                : "Check that inbox for a code.",
            );
            return;
          }
          const result = await confirmEmailChangeAction(value, code);
          if (!result.ok) {
            onError(result.error);
            return;
          }
          setSent(false);
          setCode("");
          onNotice("Email updated.");
          router.refresh();
        });
      }}
    >
      <h2 className="serif">Email</h2>
      <p className="auth-hint">
        {email
          ? "A code to the new address confirms it. There is no password to reset."
          : "This sign-in has no inbox yet. Add an email you can read. There is no password to reset."}
      </p>
      <div className="auth-field">
        <label htmlFor="account-email">Email</label>
        <input
          id="account-email"
          type="email"
          autoComplete="email"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setSent(false);
          }}
          disabled={busy}
          required
        />
      </div>
      {sent ? (
        <div className="auth-field">
          <label htmlFor="account-email-code">One-time code</label>
          <input
            id="account-email-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(event) =>
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            disabled={busy}
            required
            className="auth-code"
          />
        </div>
      ) : null}
      <button type="submit" className="btn-primary" disabled={busy}>
        {sent ? "Confirm email" : "Email me a code"}
      </button>
    </form>
  );
}

function AddressList({
  addresses,
  pending,
  onSave,
  onRemove,
}: {
  addresses: AccountAddress[];
  pending: boolean;
  onSave: (
    input: {
      label: string;
      recipientName: string;
      phone: string;
      addressLine1: string;
      addressLine2: string;
      city: string;
      province: string;
      postalCode: string;
      landmark: string;
      isDefault: boolean;
    },
    id?: string,
  ) => void;
  onRemove: (id: string) => void;
}) {
  const [draft, setDraft] = useState(EMPTY_ADDRESS);
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <section className="account-card">
      <h2 className="serif">Addresses</h2>
      <p className="auth-hint">
        Pakistan only. The courier uses this inside the country.
      </p>
      {addresses.length === 0 ? (
        <p className="auth-hint">No saved address yet.</p>
      ) : (
        <ul className="account-address-list">
          {addresses.map((address) => (
            <li key={address.id}>
              <p>
                {address.recipientName}
                {address.isDefault ? " · default" : ""}
              </p>
              <p>
                {address.addressLine1}, {address.city}
              </p>
              <div className="account-row-actions">
                <button
                  type="button"
                  className="auth-back"
                  disabled={pending}
                  onClick={() => {
                    setEditing(address.id);
                    setDraft({
                      label: address.label ?? "",
                      recipientName: address.recipientName,
                      phone: address.phone,
                      addressLine1: address.addressLine1,
                      addressLine2: address.addressLine2 ?? "",
                      city: address.city,
                      province: address.province,
                      postalCode: address.postalCode ?? "",
                      landmark: address.landmark ?? "",
                      isDefault: address.isDefault,
                    });
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="auth-back"
                  disabled={pending}
                  onClick={() => onRemove(address.id)}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <form
        className="account-address-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave(draft, editing ?? undefined);
          if (!editing) setDraft(EMPTY_ADDRESS);
        }}
      >
        <div className="auth-field">
          <label htmlFor="addr-name">Recipient</label>
          <input
            id="addr-name"
            value={draft.recipientName}
            onChange={(event) =>
              setDraft({ ...draft, recipientName: event.target.value })
            }
            required
            disabled={pending}
            autoComplete="name"
          />
        </div>
        <div className="auth-field">
          <label htmlFor="addr-phone">Phone</label>
          <input
            id="addr-phone"
            value={draft.phone}
            onChange={(event) =>
              setDraft({ ...draft, phone: event.target.value })
            }
            required
            disabled={pending}
            autoComplete="tel"
          />
        </div>
        <div className="auth-field">
          <label htmlFor="addr-line">Street</label>
          <input
            id="addr-line"
            value={draft.addressLine1}
            onChange={(event) =>
              setDraft({ ...draft, addressLine1: event.target.value })
            }
            required
            disabled={pending}
            autoComplete="address-line1"
          />
        </div>
        <div className="auth-field">
          <label htmlFor="addr-city">City</label>
          <input
            id="addr-city"
            value={draft.city}
            onChange={(event) =>
              setDraft({ ...draft, city: event.target.value })
            }
            required
            disabled={pending}
            autoComplete="address-level2"
          />
        </div>
        <div className="auth-field">
          <label htmlFor="addr-province">Province</label>
          <select
            id="addr-province"
            value={draft.province}
            onChange={(event) =>
              setDraft({ ...draft, province: event.target.value })
            }
            disabled={pending}
          >
            {PAKISTAN_PROVINCES.map((province) => (
              <option key={province.value} value={province.value}>
                {province.label}
              </option>
            ))}
          </select>
        </div>
        <label className="auth-check">
          <input
            type="checkbox"
            checked={draft.isDefault}
            onChange={(event) =>
              setDraft({ ...draft, isDefault: event.target.checked })
            }
            disabled={pending}
          />
          <span>Default delivery address</span>
        </label>
        <button type="submit" className="btn-primary" disabled={pending}>
          {editing ? "Update address" : "Save address"}
        </button>
      </form>
    </section>
  );
}

function Connections({
  channels,
  providers,
  disconnectable,
  pending,
  onDisconnect,
  onError,
}: {
  channels: AuthChannelState[];
  providers: string[];
  disconnectable: string[];
  pending: boolean;
  onDisconnect: (provider: string) => void;
  onError: (message: string | null) => void;
}) {
  const [busy, startTransition] = useTransition();
  return (
    <section className="account-card">
      <h2 className="serif">Connected sign-ins</h2>
      <ul className="account-address-list">
        {channels.map((channel) => {
          const connected =
            channel.key === "whatsapp"
              ? false
              : providers.includes(channel.key);
          const label =
            channel.key === "whatsapp"
              ? "WhatsApp uses the phone number above"
              : channel.key;
          return (
            <li key={channel.key}>
              <p>
                {label}
                {channel.key !== "whatsapp"
                  ? connected
                    ? " · connected"
                    : channel.status === "live"
                      ? " · not connected"
                      : " · not available yet"
                  : ""}
              </p>
              {channel.key !== "whatsapp" && channel.status === "live" ? (
                <div className="account-row-actions">
                  {connected ? (
                    <button
                      type="button"
                      className="auth-back"
                      disabled={
                        pending || !disconnectable.includes(channel.key)
                      }
                      onClick={() => onDisconnect(channel.key)}
                    >
                      Disconnect
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="auth-back"
                      disabled={pending || busy}
                      onClick={() => {
                        onError(null);
                        startTransition(async () => {
                          const ready = await beginOAuthLinkAction();
                          if (!ready.ok) {
                            onError(ready.error);
                            return;
                          }
                          await signIn(channel.key, {
                            callbackUrl: "/account",
                          });
                        });
                      }}
                    >
                      Connect
                    </button>
                  )}
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function DeleteAccount({
  pending,
  onError,
}: {
  pending: boolean;
  onError: (message: string) => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [busy, startTransition] = useTransition();

  return (
    <form
      className="account-card account-danger"
      onSubmit={(event) => {
        event.preventDefault();
        if (!accepted) {
          onError("Confirm that order records stay.");
          return;
        }
        startTransition(async () => {
          const result = await deleteOwnAccountAction(confirmation);
          if (!result.ok) {
            onError(result.error);
            return;
          }
          await signOut({ callbackUrl: "/data-deletion" });
        });
      }}
    >
      <h2 className="serif">Delete my account</h2>
      <p className="auth-hint">
        This clears your name, email, phone, saved addresses, and linked
        Facebook, Instagram, TikTok, and other sign-ins, then signs you out. The
        copy of each order stays so it can still be delivered. The same removal
        runs when Meta asks us to delete a Facebook or Instagram login. Read the
        steps on the data deletion page if you are not signed in.
      </p>
      <label className="auth-check">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          disabled={pending || busy}
        />
        <span>I understand order records stay.</span>
      </label>
      <div className="auth-field">
        <label htmlFor="delete-confirm">Type DELETE</label>
        <input
          id="delete-confirm"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          autoComplete="off"
          disabled={pending || busy}
          required
        />
      </div>
      <button
        type="submit"
        className="account-delete"
        disabled={pending || busy || confirmation !== "DELETE" || !accepted}
      >
        Delete my account
      </button>
    </form>
  );
}
