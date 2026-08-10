"use client";

import { useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

import { Money } from "@/modules/ui";
import { RENDER_ANGLES, type RenderAngle } from "@aks/shared";

import {
  saveManualStudioDesign,
  type StudioFormOptions,
} from "./studio-manual-actions";

type ColourRow = {
  key: string;
  name: string;
  hex: string;
  fabricId: string;
};

type PhotoRow = {
  key: string;
  assetId: string;
  previewUrl: string;
  angle: RenderAngle;
  altText: string;
};

const FASHION_SWATCHES = [
  { name: "Milk", hex: "#F4EEE1" },
  { name: "Ivory", hex: "#EAE1CF" },
  { name: "Bone", hex: "#DDD2BC" },
  { name: "Oyster", hex: "#CDC0A8" },
  { name: "Sand", hex: "#BFAA88" },
  { name: "Stone", hex: "#A89A80" },
  { name: "Taupe", hex: "#8D7E66" },
  { name: "Antique", hex: "#9A8A6B" },
] as const;

function fieldClass() {
  return "border border-ink/12 bg-milk px-3 py-2 text-[13px] text-ink outline-none focus:border-ink";
}

function Label({ children }: { children: ReactNode }) {
  return (
    <span className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/55">
      {children}
    </span>
  );
}

export function StudioManualForm({ options }: { options: StudioFormOptions }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<"details" | "costing" | "photos">("details");

  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [garmentTypeId, setGarmentTypeId] = useState(
    options.categories[0]?.id ?? "",
  );
  const [occasionTag, setOccasionTag] = useState(
    options.occasionTags[0] ?? "",
  );
  const [selectedSizes, setSelectedSizes] = useState<string[]>([
    ...options.sizeLabels.filter((l) => l !== "XXL"),
  ]);
  const [madeToMeasureOffered, setMadeToMeasureOffered] = useState(true);
  const [houseModelIds, setHouseModelIds] = useState<string[]>([]);
  const [colours, setColours] = useState<ColourRow[]>([
    {
      key: "c0",
      name: "Ivory",
      hex: "#EAE1CF",
      fabricId: options.fabrics[0]?.id ?? "",
    },
  ]);
  const [photos, setPhotos] = useState<PhotoRow[]>([]);
  const [uploadStatus, setUploadStatus] = useState("idle");

  const [basePricePkr, setBasePricePkr] = useState("");
  const [compareAtPricePkr, setCompareAtPricePkr] = useState("");
  const [fabricConsumptionMeters, setFabricConsumptionMeters] = useState("250");
  const [mtmSurchargePkr, setMtmSurchargePkr] = useState("0");

  const fabricById = useMemo(() => {
    const m = new Map(options.fabrics.map((f) => [f.id, f]));
    return m;
  }, [options.fabrics]);

  const materialCostMinor = useMemo(() => {
    const metresHundredths = Number.parseInt(fabricConsumptionMeters, 10);
    if (!Number.isInteger(metresHundredths) || metresHundredths < 0) return 0;
    // costPerMeterMinor × (hundredths / 100)
    let total = 0;
    const seen = new Set<string>();
    for (const c of colours) {
      if (seen.has(c.fabricId)) continue;
      seen.add(c.fabricId);
      const fabric = fabricById.get(c.fabricId);
      if (!fabric) continue;
      total += Math.round(
        (fabric.costPerMeterMinor * metresHundredths) / 100,
      );
    }
    return total;
  }, [colours, fabricById, fabricConsumptionMeters]);

  function toggleSize(label: string) {
    setSelectedSizes((prev) =>
      prev.includes(label)
        ? prev.filter((x) => x !== label)
        : [...prev, label],
    );
  }

  function toggleHouseModel(id: string) {
    setHouseModelIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

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
      const previewUrl = URL.createObjectURL(file);
      setPhotos((prev) => [
        ...prev,
        {
          key: `p-${data.asset.id}`,
          assetId: data.asset.id,
          previewUrl,
          angle: prev.length === 0 ? "FRONT" : "THREE_QUARTER",
          altText: name ? `${name} photo` : "",
        },
      ]);
      setUploadStatus("ready");
    } catch {
      setUploadStatus("error");
    }
  }

  function submit(intent: "draft" | "publish") {
    setError(null);
    const fd = new FormData();
    fd.set("intent", intent);
    fd.set("name", name);
    fd.set("subtitle", subtitle);
    fd.set("description", description);
    fd.set("garmentTypeId", garmentTypeId);
    fd.set("occasionTag", occasionTag);
    fd.set("basePricePkr", basePricePkr);
    fd.set("compareAtPricePkr", compareAtPricePkr);
    fd.set("fabricConsumptionMeters", fabricConsumptionMeters);
    fd.set("madeToMeasureSurchargePkr", mtmSurchargePkr);
    fd.set("madeToMeasureOffered", madeToMeasureOffered ? "true" : "false");
    for (const s of selectedSizes) fd.append("availableSize", s);
    for (const id of houseModelIds) fd.append("houseModelId", id);
    fd.set(
      "colourwaysJson",
      JSON.stringify(
        colours.map((c) => ({
          name: c.name,
          hex: c.hex,
          fabricId: c.fabricId,
        })),
      ),
    );
    fd.set(
      "photosJson",
      JSON.stringify(
        photos.map((p) => ({
          assetId: p.assetId,
          angle: p.angle,
          altText: p.altText,
        })),
      ),
    );

    startTransition(async () => {
      const res = await saveManualStudioDesign(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.warning) {
        setError(res.warning);
      }
      router.push(`/admin/designs/${res.id}`);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_16rem]">
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap gap-1 border-b border-ink/10 pb-2">
          {(
            [
              ["details", "Design"],
              ["costing", "Costing"],
              ["photos", "Photos"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={
                tab === id
                  ? "bg-zari px-3 py-1.5 text-[12px] text-indigo"
                  : "px-3 py-1.5 text-[12px] text-ink/55 hover:text-ink"
              }
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "details" ? (
          <div className="flex flex-col gap-5">
            <label className="flex flex-col gap-1.5">
              <Label>Design name</Label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className={fieldClass()}
                placeholder="e.g. Ivory panelled kameez"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <Label>Design short text</Label>
              <input
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className={fieldClass()}
                placeholder="Card line under the name"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <Label>Category</Label>
                <select
                  value={garmentTypeId}
                  onChange={(e) => setGarmentTypeId(e.target.value)}
                  className={fieldClass()}
                >
                  {options.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.key} — {c.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1.5">
                <Label>Occasion tag</Label>
                <select
                  value={occasionTag}
                  onChange={(e) => setOccasionTag(e.target.value)}
                  className={fieldClass()}
                >
                  {options.occasionTags.map((t) => (
                    <option key={t} value={t}>
                      {t.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <fieldset>
              <Legend>Available sizes</Legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {options.sizeLabels.map((label) => {
                  const on = selectedSizes.includes(label);
                  return (
                    <label
                      key={label}
                      className={
                        on
                          ? "cursor-pointer border border-zari bg-zari/10 px-3 py-1.5 text-[13px] text-ink"
                          : "cursor-pointer border border-ink/12 bg-milk px-3 py-1.5 text-[13px] text-ink/55"
                      }
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={on}
                        onChange={() => toggleSize(label)}
                      />
                      {label}
                    </label>
                  );
                })}
                <label
                  className={
                    madeToMeasureOffered
                      ? "cursor-pointer border border-zari bg-zari/10 px-3 py-1.5 text-[13px] text-ink"
                      : "cursor-pointer border border-ink/12 bg-milk px-3 py-1.5 text-[13px] text-ink/55"
                  }
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={madeToMeasureOffered}
                    onChange={(e) => setMadeToMeasureOffered(e.target.checked)}
                  />
                  Custom
                </label>
              </div>
            </fieldset>

            <fieldset>
              <Legend>House models</Legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {options.archetypes.length === 0 ? (
                  <p className="text-[13px] text-ink/45">
                    No house models yet — add them under Fabric / archetypes.
                  </p>
                ) : (
                  options.archetypes.map((a) => {
                    const on = houseModelIds.includes(a.id);
                    return (
                      <label
                        key={a.id}
                        className={
                          on
                            ? "cursor-pointer border border-zari bg-zari/10 px-3 py-1.5 text-[13px] text-ink"
                            : "cursor-pointer border border-ink/12 bg-milk px-3 py-1.5 text-[13px] text-ink/55"
                        }
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={on}
                          onChange={() => toggleHouseModel(a.id)}
                        />
                        {a.name}
                      </label>
                    );
                  })
                )}
              </div>
            </fieldset>

            <fieldset>
              <Legend>Colour selections</Legend>
              <div className="mt-2 flex flex-col gap-3">
                {colours.map((c, idx) => (
                  <div
                    key={c.key}
                    className="grid gap-2 border border-ink/10 bg-milk p-3 sm:grid-cols-[1fr_7rem_1fr_auto]"
                  >
                    <input
                      value={c.name}
                      onChange={(e) => {
                        const v = e.target.value;
                        setColours((prev) =>
                          prev.map((row) =>
                            row.key === c.key ? { ...row, name: v } : row,
                          ),
                        );
                      }}
                      className={fieldClass()}
                      placeholder="Colour name"
                    />
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={/^#[0-9A-Fa-f]{6}$/.test(c.hex) ? c.hex : "#EAE1CF"}
                        onChange={(e) => {
                          const v = e.target.value;
                          setColours((prev) =>
                            prev.map((row) =>
                              row.key === c.key ? { ...row, hex: v } : row,
                            ),
                          );
                        }}
                        className="h-9 w-10 cursor-pointer border border-ink/12 bg-transparent p-0"
                      />
                      <input
                        value={c.hex}
                        onChange={(e) => {
                          const v = e.target.value;
                          setColours((prev) =>
                            prev.map((row) =>
                              row.key === c.key ? { ...row, hex: v } : row,
                            ),
                          );
                        }}
                        className={`${fieldClass()} min-w-0 flex-1`}
                      />
                    </div>
                    <select
                      value={c.fabricId}
                      onChange={(e) => {
                        const v = e.target.value;
                        setColours((prev) =>
                          prev.map((row) =>
                            row.key === c.key ? { ...row, fabricId: v } : row,
                          ),
                        );
                      }}
                      className={fieldClass()}
                    >
                      {options.fabrics.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={colours.length <= 1}
                      onClick={() =>
                        setColours((prev) =>
                          prev.filter((row) => row.key !== c.key),
                        )
                      }
                      className="border border-ink/12 px-2 text-[12px] text-ink/45 disabled:opacity-40"
                    >
                      Remove
                    </button>
                    {idx === 0 ? (
                      <div className="sm:col-span-4">
                        <p className="mb-1.5 font-sans text-[10px] uppercase tracking-[0.12em] text-ink/40">
                          Quick swatches
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {FASHION_SWATCHES.map((s) => (
                            <button
                              key={s.hex}
                              type="button"
                              title={s.name}
                              onClick={() =>
                                setColours((prev) =>
                                  prev.map((row) =>
                                    row.key === c.key
                                      ? { ...row, name: s.name, hex: s.hex }
                                      : row,
                                  ),
                                )
                              }
                              className="size-6 border border-ink/15"
                              style={{ backgroundColor: s.hex }}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setColours((prev) => [
                      ...prev,
                      {
                        key: `c-${prev.length}-${Date.now()}`,
                        name: "",
                        hex: "#CDC0A8",
                        fabricId: options.fabrics[0]?.id ?? "",
                      },
                    ])
                  }
                  className="self-start border border-ink/20 px-3 py-1.5 text-[12px] text-ink/55 hover:border-ink hover:text-ink"
                >
                  Add colour
                </button>
              </div>
            </fieldset>

            <label className="flex flex-col gap-1.5">
              <Label>Description</Label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                className={fieldClass()}
                placeholder="Cut, cloth, drape — what she should know before measuring."
              />
            </label>

            <div className="border border-dashed border-ink/15 bg-milk/60 px-4 py-3">
              <p className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/45">
                Size & size mechanism
              </p>
              <p className="mt-1 text-[13px] text-ink/55">
                Linked automatically to the category’s default size block for
                now. Full size-mechanism editing lands in a separate module —
                instructions to follow.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <Label>Price (PKR)</Label>
                <input
                  value={basePricePkr}
                  onChange={(e) => setBasePricePkr(e.target.value)}
                  inputMode="numeric"
                  className={fieldClass()}
                  placeholder="18500"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <Label>Compare-at / offer was (PKR)</Label>
                <input
                  value={compareAtPricePkr}
                  onChange={(e) => setCompareAtPricePkr(e.target.value)}
                  inputMode="numeric"
                  className={fieldClass()}
                  placeholder="Optional strike-through"
                />
              </label>
            </div>
          </div>
        ) : null}

        {tab === "costing" ? (
          <div className="flex flex-col gap-5">
            <label className="flex max-w-xs flex-col gap-1.5">
              <Label>Fabric consumption (hundredths of metre)</Label>
              <input
                value={fabricConsumptionMeters}
                onChange={(e) => setFabricConsumptionMeters(e.target.value)}
                inputMode="numeric"
                className={fieldClass()}
              />
              <p className="text-[12px] text-ink/45">
                250 = 2.50 m. Used with each colour’s fabric cost.
              </p>
            </label>

            <label className="flex max-w-xs flex-col gap-1.5">
              <Label>Made-to-measure surcharge (PKR)</Label>
              <input
                value={mtmSurchargePkr}
                onChange={(e) => setMtmSurchargePkr(e.target.value)}
                inputMode="numeric"
                className={fieldClass()}
              />
            </label>

            <div className="border border-ink/10">
              <div className="border-b border-ink/10 px-4 py-2">
                <p className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/45">
                  Material cost by fabric
                </p>
              </div>
              <ul className="divide-y divide-ink/10">
                {colours.map((c) => {
                  const fabric = fabricById.get(c.fabricId);
                  const metresHundredths =
                    Number.parseInt(fabricConsumptionMeters, 10) || 0;
                  const line = fabric
                    ? Math.round(
                        (fabric.costPerMeterMinor * metresHundredths) / 100,
                      )
                    : 0;
                  return (
                    <li
                      key={c.key}
                      className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-[13px]"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="size-3 border border-ink/15"
                          style={{ backgroundColor: c.hex || "#EAE1CF" }}
                        />
                        <span className="text-ink">
                          {c.name || "Colour"} · {fabric?.name ?? "—"}
                        </span>
                      </div>
                      <span className="font-data text-ink">
                        <Money value={line} />
                      </span>
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-center justify-between border-t border-ink/10 bg-ivory/40 px-4 py-3">
                <span className="font-sans text-[11px] uppercase tracking-[0.12em] text-ink/55">
                  Unique fabrics total
                </span>
                <span className="font-data text-[15px] text-ink">
                  <Money value={materialCostMinor} />
                </span>
              </div>
            </div>
          </div>
        ) : null}

        {tab === "photos" ? (
          <div className="flex flex-col gap-4">
            <p className="text-[13px] text-ink/55">
              Upload your own product photos. They attach to the default colour
              for publish. No AI generation on this path.
            </p>
            <input
              type="file"
              accept="image/*"
              className="block text-[13px] text-ink/55"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
                e.target.value = "";
              }}
            />
            <p className="font-data text-[11px] text-ink/40">{uploadStatus}</p>

            <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {photos.map((p) => (
                <li
                  key={p.key}
                  className="border border-ink/10 bg-milk"
                >
                  <div className="relative aspect-[3/4] bg-ivory">
                    <Image
                      src={p.previewUrl}
                      alt={p.altText || "Upload"}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="flex flex-col gap-2 p-2">
                    <select
                      value={p.angle}
                      onChange={(e) => {
                        const v = e.target.value as RenderAngle;
                        setPhotos((prev) =>
                          prev.map((row) =>
                            row.key === p.key ? { ...row, angle: v } : row,
                          ),
                        );
                      }}
                      className={fieldClass()}
                    >
                      {RENDER_ANGLES.map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                    <input
                      value={p.altText}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPhotos((prev) =>
                          prev.map((row) =>
                            row.key === p.key ? { ...row, altText: v } : row,
                          ),
                        );
                      }}
                      className={fieldClass()}
                      placeholder="Alt text"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setPhotos((prev) =>
                          prev.filter((row) => row.key !== p.key),
                        )
                      }
                      className="text-start text-[12px] text-madder"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {error ? (
          <p className="text-[13px] text-madder" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 border-t border-ink/10 pt-4">
          <button
            type="button"
            disabled={pending}
            onClick={() => submit("draft")}
            className="border border-zari bg-zari px-4 py-2 text-[13px] text-indigo disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save draft"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => submit("publish")}
            className="border border-ink px-4 py-2 text-[13px] text-ink disabled:opacity-50"
          >
            Publish
          </button>
          <p className="text-[12px] text-ink/45">
            Publish needs photo, price, colour, size block, fit profile, and
            occasion.
          </p>
        </div>
      </div>

      <aside className="h-fit border border-ink/10 bg-milk px-4 py-4 lg:sticky lg:top-20">
        <p className="font-sans text-[10px] uppercase tracking-[0.16em] text-ink/45">
          Brief checklist
        </p>
        <ul className="mt-3 flex flex-col gap-2.5 text-[13px]">
          <Check ok={name.trim().length > 0} label="Design name" />
          <Check ok={subtitle.trim().length > 0} label="Short text" hint="Optional" />
          <Check
            ok={selectedSizes.length > 0 || madeToMeasureOffered}
            label="Sizes"
          />
          <Check
            ok={colours.every((c) => c.name && c.fabricId)}
            label="Colours"
          />
          <Check ok={Boolean(garmentTypeId)} label="Category" />
          <Check
            ok={houseModelIds.length > 0}
            label="House models"
            hint="Optional"
          />
          <Check ok={Boolean(description?.trim())} label="Description" hint="Optional" />
          <Check
            ok={Number.parseInt(basePricePkr, 10) > 0}
            label="Price"
          />
          <Check ok={photos.length > 0} label="Photos" />
        </ul>
      </aside>
    </div>
  );
}

function Legend({ children }: { children: ReactNode }) {
  return (
    <legend className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/55">
      {children}
    </legend>
  );
}

function Check({
  ok,
  label,
  hint,
}: {
  ok: boolean;
  label: string;
  hint?: string;
}) {
  return (
    <li className="flex items-start gap-2 text-ink/70">
      <span
        className={
          ok
            ? "mt-0.5 size-3.5 shrink-0 border border-zari bg-zari"
            : "mt-0.5 size-3.5 shrink-0 border border-ink/25"
        }
        aria-hidden
      />
      <span>
        {label}
        {hint ? (
          <span className="ms-1 text-[11px] text-ink/35">({hint})</span>
        ) : null}
      </span>
    </li>
  );
}
