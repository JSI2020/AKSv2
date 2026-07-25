"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  DESIGN_TAG_VALUES,
  RENDER_ANGLES,
  type DesignTagKind,
} from "@aks/shared";
import { Money } from "@/modules/ui";

import {
  addCustomizationValue,
  createDesign,
  publishDesign,
  setDesignTags,
  updateDesignDetails,
  updateDesignPricing,
  updateDesignSizing,
  upsertColourway,
  upsertCustomizationOption,
  upsertDesignRender,
  type DesignDetail,
} from "./actions";

type FormOptions = {
  categories: { id: string; key: string; name: string }[];
  fabrics: { id: string; name: string }[];
  blocks: { id: string; name: string; categoryId: string }[];
  profiles: { id: string; name: string; categoryId: string }[];
  archetypes: { id: string; name: string }[];
};

const TABS = [
  "Details",
  "Media",
  "Colourways",
  "Pricing",
  "Sizing",
  "Customization",
] as const;

type Tab = (typeof TABS)[number];

export function CreateDesignForm({ options }: { options: FormOptions }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex max-w-md flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const res = await createDesign(fd);
          if (!res.ok) {
            setError(res.error);
            return;
          }
          router.push(`/admin/designs/${res.id}`);
          router.refresh();
        });
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          Name
        </span>
        <input
          name="name"
          required
          className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige outline-none focus:border-zari"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          Name (Urdu)
        </span>
        <input
          name="nameUr"
          dir="rtl"
          className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige outline-none focus:border-zari"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          Category
        </span>
        <select
          name="garmentTypeId"
          required
          className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige outline-none focus:border-zari"
        >
          {options.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.key} — {c.name}
            </option>
          ))}
        </select>
      </label>
      {error ? (
        <p className="text-[13px] text-madder" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="border border-zari bg-zari px-3 py-1.5 text-[13px] text-indigo disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create draft"}
      </button>
    </form>
  );
}

export function DesignEditor({
  detail,
  options,
}: {
  detail: DesignDetail;
  options: FormOptions;
}) {
  const [tab, setTab] = useState<Tab>("Details");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const d = detail.design;

  function run(
    action: (fd: FormData) => Promise<{ ok: true; id?: string } | { ok: false; error: string }>,
    fd: FormData,
  ) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await action(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage("Saved");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-data text-[12px] text-chalk">
          {d.status} · /{d.slug}
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            const fd = new FormData();
            fd.set("id", d.id);
            run(publishDesign, fd);
          }}
          className="border border-zari px-3 py-1.5 text-[13px] text-zari disabled:opacity-50"
        >
          Publish
        </button>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-indigo-lift pb-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-2 py-1 text-[12px] ${
              tab === t ? "bg-zari text-indigo" : "text-chalk"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error ? (
        <p className="text-[13px] text-madder" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-[13px] text-zari">{message}</p>
      ) : null}

      {tab === "Details" ? (
        <DetailsTab
          detail={detail}
          options={options}
          pending={pending}
          onSave={(fd) => run(updateDesignDetails, fd)}
          onTags={(fd) => run(setDesignTags, fd)}
        />
      ) : null}
      {tab === "Pricing" ? (
        <PricingTab
          detail={detail}
          pending={pending}
          onSave={(fd) => run(updateDesignPricing, fd)}
        />
      ) : null}
      {tab === "Sizing" ? (
        <SizingTab
          detail={detail}
          options={options}
          pending={pending}
          onSave={(fd) => run(updateDesignSizing, fd)}
        />
      ) : null}
      {tab === "Colourways" ? (
        <ColourwaysTab
          detail={detail}
          options={options}
          pending={pending}
          onSave={(fd) => run(upsertColourway, fd)}
        />
      ) : null}
      {tab === "Media" ? (
        <MediaTab
          detail={detail}
          options={options}
          pending={pending}
          onSave={(fd) => run(upsertDesignRender, fd)}
        />
      ) : null}
      {tab === "Customization" ? (
        <CustomizationTab
          detail={detail}
          pending={pending}
          onOption={(fd) => run(upsertCustomizationOption, fd)}
          onValue={(fd) => run(addCustomizationValue, fd)}
        />
      ) : null}
    </div>
  );
}

function DetailsTab({
  detail,
  options,
  pending,
  onSave,
  onTags,
}: {
  detail: DesignDetail;
  options: FormOptions;
  pending: boolean;
  onSave: (fd: FormData) => void;
  onTags: (fd: FormData) => void;
}) {
  const d = detail.design;
  const [tags, setTags] = useState(detail.tags);

  function toggleTag(kind: DesignTagKind, value: string) {
    setTags((prev) => {
      const exists = prev.some((t) => t.kind === kind && t.value === value);
      if (exists) return prev.filter((t) => !(t.kind === kind && t.value === value));
      return [...prev, { kind, value }];
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          fd.set("id", d.id);
          onSave(fd);
        }}
      >
        <Field label="Name" name="name" defaultValue={d.name} required />
        <Field label="Name (Urdu)" name="nameUr" defaultValue={d.nameUr} />
        <label className="flex flex-col gap-1">
          <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
            Category
          </span>
          <select
            name="garmentTypeId"
            defaultValue={d.garmentTypeId}
            className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
          >
            {options.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.key} — {c.name}
              </option>
            ))}
          </select>
        </label>
        <Field
          label="Description"
          name="description"
          defaultValue={d.description ?? ""}
        />
        <Field
          label="Story"
          name="storyCopy"
          defaultValue={d.storyCopy ?? ""}
        />
        <Field label="SEO title" name="seoTitle" defaultValue={d.seoTitle ?? ""} />
        <Field
          label="SEO description"
          name="seoDescription"
          defaultValue={d.seoDescription ?? ""}
        />
        <label className="flex items-center gap-2 text-[13px] text-greige">
          <input
            type="checkbox"
            name="featured"
            value="true"
            defaultChecked={d.featured}
            className="accent-zari"
          />
          Featured (Shahneela&apos;s pick)
        </label>
        <button
          type="submit"
          disabled={pending}
          className="border border-zari bg-zari px-3 py-1.5 text-[13px] text-indigo disabled:opacity-50"
        >
          Save details
        </button>
      </form>

      <div>
        <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          Tags (dropdown catalogue)
        </p>
        {(Object.keys(DESIGN_TAG_VALUES) as (keyof typeof DESIGN_TAG_VALUES)[]).map(
          (kind) => (
            <div key={kind} className="mt-3">
              <p className="font-data text-[11px] text-zari">{kind}</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {DESIGN_TAG_VALUES[kind].map((value) => {
                  const on = tags.some(
                    (t) => t.kind === kind && t.value === value,
                  );
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleTag(kind, value)}
                      className={`px-1.5 py-0.5 font-data text-[10px] ${
                        on
                          ? "bg-zari text-indigo"
                          : "border border-indigo-lift text-chalk"
                      }`}
                    >
                      {value}
                    </button>
                  );
                })}
              </div>
            </div>
          ),
        )}
        <button
          type="button"
          disabled={pending}
          className="mt-4 border border-zari px-3 py-1.5 text-[13px] text-zari disabled:opacity-50"
          onClick={() => {
            const fd = new FormData();
            fd.set("id", d.id);
            fd.set("tags", JSON.stringify(tags));
            onTags(fd);
          }}
        >
          Save tags
        </button>
      </div>
    </div>
  );
}

function PricingTab({
  detail,
  pending,
  onSave,
}: {
  detail: DesignDetail;
  pending: boolean;
  onSave: (fd: FormData) => void;
}) {
  const d = detail.design;
  return (
    <form
      className="flex max-w-md flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("id", d.id);
        onSave(fd);
      }}
    >
      <Field
        label="Base price (paisa)"
        name="basePriceMinor"
        type="number"
        defaultValue={String(d.basePriceMinor)}
        required
      />
      <p className="text-[12px] text-chalk">
        Current: <Money value={d.basePriceMinor} />
      </p>
      <Field
        label="Made-to-measure surcharge (paisa)"
        name="madeToMeasureSurchargeMinor"
        type="number"
        defaultValue={String(d.madeToMeasureSurchargeMinor)}
      />
      <Field
        label="Fabric consumption (hundredths of metre)"
        name="fabricConsumptionMeters"
        type="number"
        defaultValue={String(d.fabricConsumptionMeters)}
      />
      <Field
        label="Lead time override (days)"
        name="leadTimeDaysOverride"
        type="number"
        defaultValue={
          d.leadTimeDaysOverride != null ? String(d.leadTimeDaysOverride) : ""
        }
      />
      <button
        type="submit"
        disabled={pending}
        className="border border-zari bg-zari px-3 py-1.5 text-[13px] text-indigo disabled:opacity-50"
      >
        Save pricing
      </button>
    </form>
  );
}

function SizingTab({
  detail,
  options,
  pending,
  onSave,
}: {
  detail: DesignDetail;
  options: FormOptions;
  pending: boolean;
  onSave: (fd: FormData) => void;
}) {
  const d = detail.design;
  const blocks = useMemo(
    () => options.blocks.filter((b) => b.categoryId === d.garmentTypeId),
    [options.blocks, d.garmentTypeId],
  );
  const profiles = useMemo(
    () => options.profiles.filter((p) => p.categoryId === d.garmentTypeId),
    [options.profiles, d.garmentTypeId],
  );
  const currentFit = Object.values(d.fitProfileIds ?? {})[0] ?? "";

  return (
    <form
      className="flex max-w-md flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("id", d.id);
        onSave(fd);
      }}
    >
      <label className="flex flex-col gap-1">
        <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          Size block
        </span>
        <select
          name="sizeBlockId"
          defaultValue={d.sizeBlockId ?? ""}
          className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
        >
          <option value="">Select…</option>
          {blocks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          Fit profile
        </span>
        <select
          name="fitProfileId"
          defaultValue={currentFit}
          className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
        >
          <option value="">Select…</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={pending}
        className="border border-zari bg-zari px-3 py-1.5 text-[13px] text-indigo disabled:opacity-50"
      >
        Save sizing
      </button>
    </form>
  );
}

function ColourwaysTab({
  detail,
  options,
  pending,
  onSave,
}: {
  detail: DesignDetail;
  options: FormOptions;
  pending: boolean;
  onSave: (fd: FormData) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <ul className="divide-y divide-indigo-lift border border-indigo-lift">
        {detail.colourways.map((cw) => (
          <li key={cw.id} className="px-3 py-2 text-[13px] text-greige">
            {cw.name} · {cw.slug}
            {cw.isDefault ? " · default" : ""} · Δ{" "}
            <Money value={cw.priceDeltaMinor} />
          </li>
        ))}
      </ul>
      <form
        className="flex max-w-md flex-col gap-3 border border-indigo-lift p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          fd.set("designId", detail.design.id);
          onSave(fd);
          e.currentTarget.reset();
        }}
      >
        <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          Add colourway
        </p>
        <Field label="Name" name="name" required />
        <Field label="Name (Urdu)" name="nameUr" />
        <label className="flex flex-col gap-1">
          <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
            Fabric
          </span>
          <select
            name="fabricId"
            required
            className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
          >
            {options.fabrics.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </select>
        </label>
        <Field label="Hex" name="hexApproximation" defaultValue="#8C2F39" />
        <Field
          label="Price delta (paisa)"
          name="priceDeltaMinor"
          type="number"
          defaultValue="0"
        />
        <label className="flex items-center gap-2 text-[13px] text-greige">
          <input type="checkbox" name="isDefault" value="true" className="accent-zari" />
          Default colourway
        </label>
        <button
          type="submit"
          disabled={pending}
          className="border border-zari bg-zari px-3 py-1.5 text-[13px] text-indigo disabled:opacity-50"
        >
          Add colourway
        </button>
      </form>
    </div>
  );
}

function MediaTab({
  detail,
  options,
  pending,
  onSave,
}: {
  detail: DesignDetail;
  options: FormOptions;
  pending: boolean;
  onSave: (fd: FormData) => void;
}) {
  const [assetId, setAssetId] = useState("");
  const [uploadStatus, setUploadStatus] = useState("idle");

  async function onFile(file: File) {
    setUploadStatus("uploading");
    try {
      const presignRes = await fetch("/api/assets/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contentType: file.type || "application/octet-stream",
        }),
      });
      if (!presignRes.ok) throw new Error(await presignRes.text());
      const { url, key } = (await presignRes.json()) as {
        url: string;
        key: string;
      };
      const put = await fetch(url, {
        method: "PUT",
        headers: { "content-type": file.type || "application/octet-stream" },
        body: file,
      });
      if (!put.ok) throw new Error(`upload ${put.status}`);
      const completeRes = await fetch("/api/assets/complete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          key,
          mime: file.type || "application/octet-stream",
        }),
      });
      if (!completeRes.ok) throw new Error(await completeRes.text());
      const data = (await completeRes.json()) as {
        asset: { id: string };
      };
      setAssetId(data.asset.id);
      setUploadStatus("ready");
    } catch {
      setUploadStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <ul className="divide-y divide-indigo-lift border border-indigo-lift">
        {detail.renders.map((r) => {
          const cw = detail.colourways.find((c) => c.id === r.colourwayId);
          return (
            <li key={r.id} className="px-3 py-2 text-[13px] text-greige">
              {cw?.name ?? "?"} · {r.angle} · alt:{" "}
              {r.altText || "(missing)"} · asset {r.assetId.slice(0, 8)}…
            </li>
          );
        })}
      </ul>

      <div className="border border-indigo-lift p-3">
        <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          Upload image (Step 9 assets)
        </p>
        <input
          type="file"
          accept="image/*"
          className="mt-2 block text-[13px] text-chalk"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFile(f);
          }}
        />
        <p className="mt-1 font-data text-[11px] text-chalk">
          {uploadStatus}
          {assetId ? ` · ${assetId}` : ""}
        </p>
      </div>

      <form
        className="flex max-w-md flex-col gap-3 border border-indigo-lift p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!assetId) return;
          const fd = new FormData(e.currentTarget);
          fd.set("designId", detail.design.id);
          fd.set("assetId", assetId);
          onSave(fd);
        }}
      >
        <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          Attach render
        </p>
        <label className="flex flex-col gap-1">
          <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
            Colourway
          </span>
          <select
            name="colourwayId"
            required
            className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
          >
            {detail.colourways.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
            Angle
          </span>
          <select
            name="angle"
            required
            className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
          >
            {RENDER_ANGLES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
            Archetype (optional)
          </span>
          <select
            name="archetypeId"
            className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
          >
            <option value="">None</option>
            {options.archetypes.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
        <Field label="Alt text (required before publish)" name="altText" required />
        <button
          type="submit"
          disabled={pending || !assetId}
          className="border border-zari bg-zari px-3 py-1.5 text-[13px] text-indigo disabled:opacity-50"
        >
          Save render
        </button>
      </form>
    </div>
  );
}

function CustomizationTab({
  detail,
  pending,
  onOption,
  onValue,
}: {
  detail: DesignDetail;
  pending: boolean;
  onOption: (fd: FormData) => void;
  onValue: (fd: FormData) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      {detail.options.map(({ option, values }) => (
        <div key={option.id} className="border border-indigo-lift p-3">
          <p className="text-[13px] text-greige">
            {option.label}{" "}
            <span className="font-data text-[11px] text-chalk">
              {option.key}
            </span>
          </p>
          <ul className="mt-2 text-[12px] text-chalk">
            {values.map((v) => (
              <li key={v.id}>
                {v.label} · Δ <Money value={v.priceDeltaMinor} />
              </li>
            ))}
          </ul>
          <form
            className="mt-3 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              fd.set("optionId", option.id);
              fd.set("designId", detail.design.id);
              onValue(fd);
              e.currentTarget.reset();
            }}
          >
            <input
              name="value"
              placeholder="value"
              required
              className="border border-indigo-lift bg-indigo px-2 py-1 font-data text-[12px] text-greige"
            />
            <input
              name="label"
              placeholder="label"
              required
              className="border border-indigo-lift bg-indigo px-2 py-1 text-[12px] text-greige"
            />
            <input
              name="priceDeltaMinor"
              type="number"
              defaultValue={0}
              className="w-24 border border-indigo-lift bg-indigo px-2 py-1 font-data text-[12px] text-greige"
            />
            <button
              type="submit"
              disabled={pending}
              className="border border-zari px-2 py-1 text-[12px] text-zari"
            >
              Add value
            </button>
          </form>
        </div>
      ))}

      <form
        className="flex max-w-md flex-col gap-3 border border-indigo-lift p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          fd.set("designId", detail.design.id);
          onOption(fd);
          e.currentTarget.reset();
        }}
      >
        <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          New option
        </p>
        <Field label="Key" name="key" required />
        <Field label="Label" name="label" required />
        <Field label="Label (Urdu)" name="labelUr" />
        <select
          name="inputType"
          className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige"
        >
          <option value="SELECT">SELECT</option>
          <option value="BOOLEAN">BOOLEAN</option>
        </select>
        <button
          type="submit"
          disabled={pending}
          className="border border-zari bg-zari px-3 py-1.5 text-[13px] text-indigo disabled:opacity-50"
        >
          Add option
        </button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  defaultValue = "",
  required,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
        {label}
      </span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className="border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige outline-none focus:border-zari"
      />
    </label>
  );
}
