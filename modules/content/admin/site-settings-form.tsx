"use client";

import { useState, useTransition } from "react";

import type { SiteSettingsPublic } from "@/modules/content/types";
import { saveSiteSettingsAction } from "@/modules/content/actions";

export function SiteSettingsForm({
  initial,
}: {
  initial: SiteSettingsPublic;
}) {
  const [form, setForm] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="mt-6 max-w-2xl border border-ink/12 bg-milk p-5"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const res = await saveSiteSettingsAction(form);
          setMsg(
            res.ok
              ? "Saved — storefront will use these values."
              : res.error,
          );
        });
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-[10px] uppercase tracking-[0.1em] text-ink/55">
            Lead-time promise
          </span>
          <input
            className="border border-ink/12 bg-greige px-3 py-2 text-[13px] text-ink outline-none focus:border-ink"
            value={form.leadTimePromise}
            onChange={(e) =>
              setForm((f) => ({ ...f, leadTimePromise: e.target.value }))
            }
          />
          <p className="mt-1 text-[11.5px] text-ink/55">
            Shown on PDP and cart when a design has no day override.
          </p>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.1em] text-ink/55">
            Lead days (min)
          </span>
          <input
            type="number"
            min={1}
            className="border border-ink/12 bg-greige px-3 py-2 text-[13px] text-ink outline-none focus:border-ink"
            value={form.leadTimeDaysMin}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                leadTimeDaysMin: Math.max(1, Number(e.target.value) || 1),
              }))
            }
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.1em] text-ink/55">
            Lead days (max)
          </span>
          <input
            type="number"
            min={1}
            className="border border-ink/12 bg-greige px-3 py-2 text-[13px] text-ink outline-none focus:border-ink"
            value={form.leadTimeDaysMax}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                leadTimeDaysMax: Math.max(1, Number(e.target.value) || 1),
              }))
            }
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-[10px] uppercase tracking-[0.1em] text-ink/55">
            Shipping promise (checkout label)
          </span>
          <input
            className="border border-ink/12 bg-greige px-3 py-2 text-[13px] text-ink outline-none focus:border-ink"
            value={form.shippingPromise}
            onChange={(e) =>
              setForm((f) => ({ ...f, shippingPromise: e.target.value }))
            }
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.1em] text-ink/55">
            Shipping mode
          </span>
          <select
            className="border border-ink/12 bg-greige px-3 py-2 text-[13px] text-ink outline-none focus:border-ink"
            value={form.shippingMode}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                shippingMode: e.target.value as SiteSettingsPublic["shippingMode"],
              }))
            }
          >
            <option value="FREE_PAKISTAN">Free within Pakistan</option>
            <option value="FLAT_PAKISTAN">Flat fee (Pakistan)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.1em] text-ink/55">
            Flat fee (PKR)
          </span>
          <input
            type="number"
            min={0}
            step={1}
            disabled={form.shippingMode !== "FLAT_PAKISTAN"}
            className="border border-ink/12 bg-greige px-3 py-2 text-[13px] text-ink outline-none focus:border-ink disabled:opacity-40"
            value={Math.round(form.shippingFlatMinor / 100)}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                shippingFlatMinor: Math.max(
                  0,
                  Math.trunc(Number(e.target.value) || 0) * 100,
                ),
              }))
            }
          />
          <p className="mt-1 text-[11.5px] text-ink/55">
            Soft launch ships Pakistan only. Free = honest zero, not a stub.
          </p>
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="text-[10px] uppercase tracking-[0.1em] text-ink/55">
            Storefront banner
          </span>
          <input
            className="border border-ink/12 bg-greige px-3 py-2 text-[13px] text-ink outline-none focus:border-ink"
            value={form.announcementFallback}
            onChange={(e) =>
              setForm((f) => ({ ...f, announcementFallback: e.target.value }))
            }
            placeholder="Shown when no announcement is active"
          />
          <p className="mt-1 text-[11.5px] text-ink/55">
            Use the same promise as lead time. If pieces ship, don&apos;t say
            the collection is still being prepared. Active announcements on
            the Announcements tab replace this line.
          </p>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.1em] text-ink/55">
            Currency
          </span>
          <select
            className="border border-ink/12 bg-greige px-3 py-2 text-[13px] text-ink outline-none focus:border-ink"
            value={form.currencyCode}
            onChange={(e) =>
              setForm((f) => ({ ...f, currencyCode: e.target.value }))
            }
          >
            <option value="PKR">PKR</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.1em] text-ink/55">
            WhatsApp number
          </span>
          <input
            className="border border-ink/12 bg-greige px-3 py-2 text-[13px] text-ink outline-none focus:border-ink"
            value={form.whatsappUrl}
            onChange={(e) =>
              setForm((f) => ({ ...f, whatsappUrl: e.target.value }))
            }
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.1em] text-ink/55">
            Instagram
          </span>
          <input
            className="border border-ink/12 bg-greige px-3 py-2 text-[13px] text-ink outline-none focus:border-ink"
            value={form.instagramUrl}
            onChange={(e) =>
              setForm((f) => ({ ...f, instagramUrl: e.target.value }))
            }
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.1em] text-ink/55">
            Facebook
          </span>
          <input
            className="border border-ink/12 bg-greige px-3 py-2 text-[13px] text-ink outline-none focus:border-ink"
            value={form.facebookUrl}
            onChange={(e) =>
              setForm((f) => ({ ...f, facebookUrl: e.target.value }))
            }
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.1em] text-ink/55">
            TikTok
          </span>
          <input
            className="border border-ink/12 bg-greige px-3 py-2 text-[13px] text-ink outline-none focus:border-ink"
            value={form.tiktokUrl}
            onChange={(e) =>
              setForm((f) => ({ ...f, tiktokUrl: e.target.value }))
            }
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.1em] text-ink/55">
            Newsletter signup
          </span>
          <label className="mt-2 flex items-center gap-2 text-[13px] text-ink">
            <input
              type="checkbox"
              checked={form.newsletterEnabled}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  newsletterEnabled: e.target.checked,
                }))
              }
            />
            Enabled
          </label>
          <p className="mt-1 text-[11.5px] text-ink/55">
            Shows an email box in the footer. Off hides the box; no emails go
            out either way unless this is on.
          </p>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.1em] text-ink/55">
            Brand name
          </span>
          <input
            className="border border-ink/12 bg-greige px-3 py-2 text-[13px] text-ink outline-none focus:border-ink"
            value={form.brandName}
            onChange={(e) =>
              setForm((f) => ({ ...f, brandName: e.target.value }))
            }
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={pending}
        className="mt-6 bg-ink px-5 py-3 text-[12px] uppercase tracking-[0.1em] text-milk hover:bg-madder disabled:opacity-40"
      >
        {pending ? "Saving…" : "Save settings"}
      </button>
      {msg ? <p className="mt-3 text-[12px] text-ink/55">{msg}</p> : null}
    </form>
  );
}
