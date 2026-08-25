"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { FabricStockDetail } from "@/modules/inventory";
import { Metres } from "@/modules/ui";
import type { FabricRow } from "@/modules/sizing/fabric-archetype-actions";
import {
  archiveFabric,
  createFabricSwatchAsset,
  recordFabricLot,
  saveFabric,
} from "@/modules/sizing/fabric-admin-actions";

type EditProps = {
  mode: "edit";
  fabric: FabricRow;
  stock: FabricStockDetail;
  designs: Array<{ designId: string; designName: string }>;
};

type Props = { mode: "new" } | EditProps;

const fieldClass =
  "w-full border border-ink/15 bg-milk px-3 py-2 text-[13px] text-ink outline-none placeholder:text-ink/40 focus:border-ink";

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/55">
      {children}
    </span>
  );
}

function Panel({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-[1.1rem] border border-ink/12 bg-milk px-[1.6rem] py-6">
      {title ? (
        <h3 className="mb-[1.1rem] font-sans text-[10px] font-normal uppercase tracking-[0.18em] text-ink/55">
          {title}
        </h3>
      ) : null}
      {children}
    </section>
  );
}

function DrapeButtons({ defaultValue = "MEDIUM" }: { defaultValue?: string }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <div className="flex overflow-hidden border border-ink/15">
      <input type="hidden" name="drapeClass" value={value} />
      {(["LIGHT", "MEDIUM", "HEAVY"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => setValue(option)}
          className={`flex-1 px-0 py-2.5 text-[12px] tracking-[0.04em] ${
            value === option
              ? "bg-ink text-milk"
              : "bg-greige text-ink hover:bg-milk"
          }`}
        >
          {option[0] + option.slice(1).toLowerCase()}
        </button>
      ))}
    </div>
  );
}

function SwatchUpload({
  url,
  onAsset,
  showThumbnails = false,
  isNew = false,
}: {
  url: string | null;
  onAsset: (assetId: string, previewUrl: string) => void;
  showThumbnails?: boolean;
  isNew?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function upload(file: File) {
    setStatus("uploading");
    setErrorMessage(null);
    try {
      const mime = file.type || "application/octet-stream";
      const presign = await fetch("/api/assets/presign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentType: mime }),
      });
      if (!presign.ok) {
        const body = (await presign.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? "Could not prepare upload.");
      }
      const { url: uploadUrl, key } = (await presign.json()) as {
        url: string;
        key: string;
      };
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: { "content-type": mime },
        body: file,
      });
      if (!put.ok) throw new Error("Could not upload swatch to storage.");
      const asset = await createFabricSwatchAsset({ key, mime });
      if (!asset.ok) throw new Error(asset.error);
      onAsset(asset.assetId, URL.createObjectURL(file));
      setStatus("idle");
    } catch (e) {
      setStatus("error");
      setErrorMessage(
        e instanceof Error ? e.message : "Swatch upload failed. Try again.",
      );
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => input.current?.click()}
        className={`group relative aspect-[4/5] w-full overflow-hidden border text-start ${
          url
            ? "border-ink/12 bg-greige"
            : "border-dashed border-ink/30 bg-milk hover:border-ink"
        }`}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt="Fabric swatch"
            className="size-full object-cover"
          />
        ) : (
          <span className="flex size-full flex-col items-center justify-center gap-2 px-6 text-center text-ink/60">
            <span className="text-[11px] uppercase tracking-[0.14em]">
              {isNew
                ? "Upload a swatch photo — real fabric, natural light"
                : "Upload a swatch photo"}
            </span>
          </span>
        )}
        {url ? (
          <span className="absolute bottom-[0.9rem] inset-inline-end-[0.9rem] bg-milk/90 px-3.5 py-2 text-[11px] uppercase tracking-[0.06em] text-ink">
            Replace photo
          </span>
        ) : null}
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
          event.target.value = "";
        }}
      />
      {showThumbnails ? (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="aspect-square flex-1 overflow-hidden border border-ink bg-chalk/30"
            aria-label="Current swatch"
          >
            {url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={url} alt="" className="size-full object-cover" />
            ) : null}
          </button>
          <button
            type="button"
            onClick={() => input.current?.click()}
            className="flex aspect-square flex-1 items-center justify-center border border-dashed border-ink/30 text-xl text-ink/55 hover:border-ink"
            aria-label="Add swatch photo"
          >
            +
          </button>
        </div>
      ) : null}
      {status === "uploading" ? (
        <p className="mt-2 text-[12px] text-ink/55">Uploading swatch…</p>
      ) : null}
      {status === "error" ? (
        <p className="mt-2 text-[12px] text-madder">
          {errorMessage ?? "Swatch upload failed. Try again."}
        </p>
      ) : null}
    </div>
  );
}

function UnitInput({
  label,
  name,
  defaultValue,
  unit,
  required = true,
}: {
  label: string;
  name: string;
  defaultValue?: string | number;
  unit: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <span className="flex border border-ink/15 bg-milk focus-within:border-ink">
        <input
          name={name}
          type="number"
          min="0"
          step="0.01"
          required={required}
          defaultValue={defaultValue}
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-[13px] text-ink outline-none"
        />
        <span className="flex items-center border-s border-ink/12 px-3 text-[12px] text-ink/55">
          {unit}
        </span>
      </span>
    </label>
  );
}

function EditFields({ fabric }: { fabric: FabricRow }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <Label>Name</Label>
        <input
          name="name"
          required
          defaultValue={fabric.name}
          className={fieldClass}
        />
      </label>
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <Label>Composition</Label>
        <input
          name="composition"
          required
          defaultValue={fabric.composition}
          className={fieldClass}
        />
      </label>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <Label>Weight</Label>
        <DrapeButtons defaultValue={fabric.drapeClass} />
      </div>
      <UnitInput
        label="Price per metre"
        name="costRupees"
        defaultValue={(fabric.costPerMeterMinor / 100).toFixed(2)}
        unit="PKR"
      />
      <UnitInput
        label="Width"
        name="widthInchesDisplay"
        defaultValue={(fabric.widthInches / 100).toString()}
        unit="in"
      />
      <UnitInput
        label="Stretch"
        name="stretchPercent"
        defaultValue={fabric.stretchPercent}
        unit="%"
      />
      <UnitInput
        label="Shrinkage allowance"
        name="shrinkageDisplay"
        defaultValue={(fabric.shrinkageAllowance / 100).toString()}
        unit="in"
      />
      <UnitInput
        label="Reorder point"
        name="reorderMetres"
        defaultValue={(fabric.reorderPointMeters / 100).toString()}
        unit="m"
      />
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <Label>Care</Label>
        <textarea
          name="careInstructions"
          rows={2}
          defaultValue={fabric.careInstructions ?? ""}
          className={fieldClass}
        />
      </label>
      <label className="flex flex-col gap-1.5 sm:col-span-2">
        <Label>Character</Label>
        <input
          name="drapeNotes"
          defaultValue={(fabric.drapeNotes ?? "").replace(
            /\s*\[pipe-demo\]\s*/gi,
            "",
          )}
          className={fieldClass}
        />
      </label>
    </div>
  );
}

export function FabricEditor(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showLotForm, setShowLotForm] = useState(false);
  const [swatchAssetId, setSwatchAssetId] = useState(
    props.mode === "edit" ? (props.fabric.swatchAssetId ?? "") : "",
  );
  const [swatchUrl, setSwatchUrl] = useState(
    props.mode === "edit" ? props.stock.swatchUrl : null,
  );

  function submit(form: HTMLFormElement) {
    setError(null);
    const data = new FormData(form);
    if (props.mode === "edit") data.set("id", props.fabric.id);
    data.set("swatchAssetId", swatchAssetId);
    startTransition(async () => {
      const result = await saveFabric(data);
      if (!result.ok) return setError(result.error);
      if (props.mode === "new") {
        router.push(`/admin/fabrics/${result.id}`);
      } else {
        setMessage("Fabric saved.");
        router.refresh();
      }
    });
  }

  function onLotSubmit(form: HTMLFormElement) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await recordFabricLot(new FormData(form));
      if (!result.ok) return setError(result.error);
      form.reset();
      setShowLotForm(false);
      setMessage("Lot recorded.");
      router.refresh();
    });
  }

  if (props.mode === "new") {
    return (
      <div className="mx-auto max-w-6xl">
        <nav className="mb-5 text-[12px] text-ink/55">
          <Link href="/admin/fabrics" className="hover:text-madder">
            Admin / Fabric
          </Link>{" "}
          / <span className="text-ink">New fabric</span>
        </nav>
        <p className="font-sans text-[10px] uppercase tracking-[0.16em] text-ink/55">
          Make · Fabric
        </p>
        <h1 className="mt-2 font-display text-[2.4rem] font-light leading-none text-ink">
          Add a fabric
        </h1>
        <p className="mt-3 text-[14px] text-ink/60">
          The photo matters most — this is how she&apos;ll picture it.
        </p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            submit(event.currentTarget);
          }}
          className="mt-8 grid items-start gap-8 lg:grid-cols-[1fr_1.15fr]"
        >
          <div>
            <SwatchUpload
              isNew
              url={swatchUrl}
              onAsset={(id, url) => {
                setSwatchAssetId(id);
                setSwatchUrl(url);
              }}
            />
            <p className="mt-3 text-[11.5px] leading-relaxed text-ink/55">
              A clean, flat, well-lit photo of the actual cloth. This appears
              everywhere the fabric is shown.
            </p>
          </div>
          <div className="flex flex-col">
            <Panel title="Identity">
              <div className="grid gap-4">
                <label className="flex flex-col gap-1.5">
                  <Label>Name</Label>
                  <input
                    name="name"
                    required
                    placeholder="e.g. Silk crepe"
                    className={fieldClass}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <Label>Composition</Label>
                  <input
                    name="composition"
                    required
                    placeholder="e.g. Pure silk, matte"
                    className={fieldClass}
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <Label>Character (one line, for the storefront)</Label>
                  <input
                    name="drapeNotes"
                    placeholder="e.g. Matte, fluid yet weighted; holds a clean line"
                    className={fieldClass}
                  />
                </label>
              </div>
            </Panel>
            <Panel title="Fit-affecting properties">
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <Label>Weight</Label>
                  <DrapeButtons />
                </div>
                <UnitInput
                  label="Stretch"
                  name="stretchPercent"
                  defaultValue={0}
                  unit="%"
                />
                <UnitInput
                  label="Shrinkage allowance"
                  name="shrinkageDisplay"
                  defaultValue={0.5}
                  unit="in"
                />
                <UnitInput
                  label="Width"
                  name="widthInchesDisplay"
                  defaultValue={44}
                  unit="in"
                />
              </div>
            </Panel>
            <Panel title="Cost & care">
              <div className="grid gap-4 sm:grid-cols-2">
                <UnitInput
                  label="Price per metre"
                  name="costRupees"
                  unit="PKR"
                />
                <UnitInput
                  label="Reorder point"
                  name="reorderMetres"
                  defaultValue={20}
                  unit="m"
                />
                <label className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label>Care instructions</Label>
                  <textarea
                    name="careInstructions"
                    rows={2}
                    placeholder="e.g. Machine wash cold, line dry, warm iron"
                    className={fieldClass}
                  />
                </label>
              </div>
            </Panel>
            <Panel title="Starting stock (optional)">
              <div className="grid gap-4 sm:grid-cols-2">
                <UnitInput
                  label="Metres received"
                  name="startingMetres"
                  unit="m"
                  required={false}
                />
                <label className="flex flex-col gap-1.5">
                  <Label>Lot / dye reference</Label>
                  <input
                    name="startingLotCode"
                    placeholder="e.g. LW-2026-04"
                    className={fieldClass}
                  />
                </label>
              </div>
              <p className="mt-3 text-[11.5px] text-ink/55">
                Leave blank to add stock later from the fabric&apos;s Lots panel.
              </p>
            </Panel>
            <input type="hidden" name="active" value="true" />
            <input type="hidden" name="swatchAssetId" value={swatchAssetId} />
            {error ? (
              <p role="alert" className="text-[13px] text-madder">
                {error}
              </p>
            ) : null}
            <div className="mt-2 flex items-center justify-end gap-3">
              <Link
                href="/admin/fabrics"
                className="border border-ink/15 px-5 py-2.5 text-[12px] uppercase tracking-[0.1em] text-ink"
              >
                Cancel
              </Link>
              <button
                disabled={pending}
                className="bg-ink px-5 py-2.5 text-[12px] uppercase tracking-[0.1em] text-milk disabled:opacity-50 hover:bg-madder"
              >
                {pending ? "Saving…" : "Save fabric"}
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  }

  const { fabric, stock, designs } = props;
  const weight =
    fabric.drapeClass[0] + fabric.drapeClass.slice(1).toLowerCase();
  const character =
    fabric.drapeNotes
      ?.replace(/\s*\[pipe-demo\]\s*/gi, "")
      .split(/[.,;]/)[0]
      ?.trim() || "—";

  return (
    <div className="mx-auto max-w-6xl">
      <nav className="mb-5 text-[12px] text-ink/55">
        <Link href="/admin/fabrics" className="hover:text-madder">
          Admin / Fabric
        </Link>{" "}
        / <span className="text-ink">{fabric.name}</span>
      </nav>
      <div className="grid items-start gap-[2.2rem] lg:grid-cols-[1fr_1.15fr]">
        <aside className="lg:sticky lg:top-8">
          <SwatchUpload
            showThumbnails
            url={swatchUrl}
            onAsset={(id, url) => {
              setSwatchAssetId(id);
              setSwatchUrl(url);
            }}
          />
        </aside>
        <div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              submit(event.currentTarget);
            }}
          >
            <Panel>
              <input type="hidden" name="swatchAssetId" value={swatchAssetId} />
              <input
                type="hidden"
                name="active"
                value={fabric.active ? "true" : "false"}
              />
              <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h1 className="font-display text-[2.3rem] font-light leading-none text-ink">
                    {fabric.name}
                  </h1>
                  <p className="mt-1.5 text-[13.5px] text-ink/55">
                    {fabric.composition} · {weight} · {character}
                  </p>
                </div>
                <div className="text-end">
                  <span
                    className={`inline-flex items-center justify-end gap-2 text-[11px] uppercase tracking-[0.08em] ${
                      fabric.active ? "text-chalk" : "text-madder"
                    }`}
                  >
                    <span
                      className={`size-1.5 rounded-full ${
                        fabric.active ? "bg-chalk" : "bg-madder"
                      }`}
                    />
                    {fabric.active ? "Active" : "Archived"}
                  </span>
                </div>
              </div>
              <EditFields fabric={fabric} />
            </Panel>
            {message ? (
              <p className="mb-4 border border-zari/40 px-3 py-2 text-[13px] text-zari">
                {message}
              </p>
            ) : null}
            {error ? (
              <p role="alert" className="mb-4 text-[13px] text-madder">
                {error}
              </p>
            ) : null}
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <button
                disabled={pending}
                className="bg-ink px-5 py-2.5 text-[12px] uppercase tracking-[0.1em] text-milk disabled:opacity-50 hover:bg-madder"
              >
                {pending ? "Saving…" : "Save changes"}
              </button>
              <Link
                href="/admin/fabrics"
                className="border border-ink/15 px-5 py-2.5 text-[12px] uppercase tracking-[0.1em] text-ink"
              >
                Cancel
              </Link>
              <button
                type="button"
                onClick={() => {
                  if (!window.confirm(`Archive ${fabric.name}?`)) return;
                  startTransition(async () => {
                    const result = await archiveFabric(fabric.id);
                    if (!result.ok) setError(result.error);
                    else {
                      router.push("/admin/fabrics");
                      router.refresh();
                    }
                  });
                }}
                className="ms-auto text-[12px] tracking-[0.06em] text-madder"
              >
                Archive fabric
              </button>
            </div>
          </form>

          <Panel title="Stock">
            <div className="flex flex-wrap items-center gap-6 py-1">
              {(
                [
                  ["On hand", stock.metersOnHand, stock.isLowStock],
                  ["Reserved", stock.metersReserved, false],
                  ["Available", stock.metersAvailable, false],
                  ["Reorder point", stock.reorderPointMeters, false],
                ] as const
              ).map(([label, value, low], index) => (
                <div key={label} className="flex items-center gap-6">
                  {index > 0 ? (
                    <span className="hidden h-11 w-px bg-ink/12 sm:block" />
                  ) : null}
                  <div className="text-center">
                    <Metres
                      value={value}
                      className={`block font-display text-[2.4rem] font-light leading-none ${
                        low ? "text-madder" : "text-ink"
                      }`}
                    />
                    <p className="mt-1.5 text-[10px] uppercase tracking-[0.1em] text-ink/55">
                      {label}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {stock.isLowStock ? (
              <p className="mt-4 flex items-center gap-2.5 border border-madder/20 bg-madder/[0.06] px-4 py-3 text-[12.5px] text-madder">
                ◆ Below reorder point — {designs.length} designs use this
                fabric. Consider a purchase order.
              </p>
            ) : null}
          </Panel>

          <Panel title="Lots">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-start text-[12.5px]">
                <thead>
                  <tr className="border-b border-ink text-ink/55">
                    {(
                      ["Lot", "Colour", "Received", "On hand", "Reserved"] as const
                    ).map((h) => (
                      <th
                        key={h}
                        className="px-1 py-2 text-start text-[9.5px] font-normal uppercase tracking-[0.1em]"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stock.lots.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-3 text-ink/55">
                        No lots yet.
                      </td>
                    </tr>
                  ) : (
                    stock.lots.map((lot) => (
                      <tr key={lot.id} className="border-b border-ink/12">
                        <td className="px-1 py-2.5 font-data">{lot.lotCode}</td>
                        <td className="px-1 py-2.5">
                          <span className="me-2 inline-block size-3.5 rounded-full border border-ink/12 bg-chalk align-middle" />
                          {lot.colourNotes ?? "—"}
                        </td>
                        <td className="px-1 py-2.5">
                          {lot.receivedAt.toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="px-1 py-2.5 font-data">
                          <Metres value={lot.metersOnHand} />
                        </td>
                        <td className="px-1 py-2.5 font-data">
                          <Metres value={lot.metersReserved} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setShowLotForm((shown) => !shown)}
                className="border border-ink/15 px-5 py-2.5 text-[12px] uppercase tracking-[0.1em] text-ink hover:border-ink"
              >
                + Record new lot
              </button>
            </div>
            {showLotForm ? (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  onLotSubmit(event.currentTarget);
                }}
                className="mt-4 grid gap-3 border-t border-ink/12 pt-4 sm:grid-cols-3"
              >
                <input type="hidden" name="fabricId" value={fabric.id} />
                <label className="flex flex-col gap-1">
                  <Label>Lot</Label>
                  <input required name="lotCode" className={fieldClass} />
                </label>
                <label className="flex flex-col gap-1">
                  <Label>Colour</Label>
                  <input name="colourNotes" className={fieldClass} />
                </label>
                <UnitInput label="Metres" name="metres" unit="m" />
                <button
                  disabled={pending}
                  className="border border-ink px-4 py-2 text-[13px] text-ink disabled:opacity-50 sm:col-start-3"
                >
                  Record lot
                </button>
              </form>
            ) : null}
          </Panel>

          <Panel title="Used in">
            {designs.length ? (
              <div className="flex gap-3 overflow-x-auto pb-1">
                {designs.map((design) => (
                  <Link
                    key={design.designId}
                    href={`/admin/designs/${design.designId}`}
                    className="w-[90px] shrink-0 text-center text-ink"
                  >
                    <span className="mb-2 block aspect-[3/4] overflow-hidden border border-ink/12 bg-greige" />
                    <span className="block font-display text-[1rem]">
                      {design.designName}
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="text-[13px] text-ink/55">
                No designs use this fabric yet.
              </p>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
