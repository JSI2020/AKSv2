"use client";

import { useMemo, useState, type ReactNode } from "react";
import Image from "next/image";

import { STANDARD_SIZE_LABELS } from "@aks/shared";
import { Money, Measure } from "@/modules/ui";
import { getSizeBlock } from "@/modules/sizing/block-actions";
import { resolveChart } from "@/modules/sizing/engine";
import type { DesignCostingData } from "@/modules/money/queries";
import type { DesignDetail } from "./actions";

function Label({ children }: { children: ReactNode }) {
  return (
    <span className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/55">
      {children}
    </span>
  );
}

export function PricingTab({
  detail,
  costing,
  pending,
  onSave,
}: {
  detail: DesignDetail;
  costing: DesignCostingData | null | undefined;
  pending: boolean;
  onSave: (fd: FormData) => void;
}) {
  const d = detail.design;
  const displayCost = costing?.breakdown?.totalCostMinor ?? null;

  const [retailPkr, setRetailPkr] = useState(
    String(
      Math.round(
        (d.compareAtPriceMinor != null &&
        d.compareAtPriceMinor > d.basePriceMinor
          ? d.compareAtPriceMinor
          : d.basePriceMinor) / 100,
      ),
    ),
  );
  const [discountOn, setDiscountOn] = useState(
    d.compareAtPriceMinor != null && d.compareAtPriceMinor > d.basePriceMinor,
  );
  const [discountMode, setDiscountMode] = useState<"percent" | "pkr">(
    "percent",
  );
  const [discountValue, setDiscountValue] = useState(() => {
    if (
      d.compareAtPriceMinor != null &&
      d.compareAtPriceMinor > d.basePriceMinor &&
      d.basePriceMinor > 0
    ) {
      const was = d.compareAtPriceMinor;
      const base = d.basePriceMinor;
      const pct = Math.round((1 - base / was) * 100);
      return String(Math.max(0, pct));
    }
    return "10";
  });

  const retailMinor = (() => {
    const pkr = Number.parseInt(retailPkr, 10);
    return Number.isInteger(pkr) && pkr >= 0 ? pkr * 100 : d.basePriceMinor;
  })();

  const sellingMinor = (() => {
    if (!discountOn) return retailMinor;
    const v = Number.parseFloat(discountValue);
    if (!Number.isFinite(v) || v < 0) return retailMinor;
    if (discountMode === "percent") {
      if (v >= 100) return retailMinor;
      return Math.round(retailMinor * (1 - v / 100));
    }
    const discountPaisa = Math.round(v * 100);
    return Math.max(0, retailMinor - discountPaisa);
  })();

  const compareAtMinor =
    discountOn && sellingMinor < retailMinor ? retailMinor : null;

  const fieldClass =
    "border border-ink/12 bg-greige/40 px-3 py-2 text-[13px] text-ink outline-none focus:border-ink";

  const marginPct =
    displayCost != null && sellingMinor > 0
      ? Math.round(((sellingMinor - displayCost) / sellingMinor) * 1000) / 10
      : null;

  const discountPct =
    compareAtMinor != null && compareAtMinor > 0
      ? Math.round((1 - sellingMinor / compareAtMinor) * 100)
      : null;

  return (
    <form
      className="flex flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData();
        fd.set("id", d.id);
        fd.set("basePriceMinor", String(sellingMinor));
        fd.set(
          "madeToMeasureSurchargeMinor",
          String(d.madeToMeasureSurchargeMinor),
        );
        fd.set("fabricConsumptionMeters", String(d.fabricConsumptionMeters));
        if (d.leadTimeDaysOverride != null) {
          fd.set("leadTimeDaysOverride", String(d.leadTimeDaysOverride));
        }
        if (compareAtMinor != null) {
          fd.set("compareAtPriceMinor", String(compareAtMinor));
        } else {
          fd.set("compareAtPriceMinor", "");
        }
        onSave(fd);
      }}
    >
      <section className="mb-4 border border-ink/12 bg-milk px-5 py-5">
        <h3 className="mb-4 font-sans text-[10px] uppercase tracking-[0.16em] text-ink/55">
          Price
        </h3>

        <div className="mb-4 flex flex-wrap items-end gap-6">
          <div>
            <Label>Selling price</Label>
            <p className="mt-1 font-display text-[2.4rem] font-light leading-none text-ink">
              <Money value={sellingMinor} />
            </p>
          </div>
          {compareAtMinor != null ? (
            <div>
              <Label>Compare-at</Label>
              <p className="mt-1 font-data text-[14px] text-ink/45 line-through">
                <Money value={compareAtMinor} />
              </p>
            </div>
          ) : null}
          {discountPct != null && discountPct > 0 ? (
            <span className="bg-madder px-2.5 py-1 text-[11px] text-milk">
              -{discountPct}% off
            </span>
          ) : null}
        </div>

        <div className="flex justify-between border-b border-ink/10 py-2.5 text-[13px]">
          <span className="text-ink/55">Cost (from Costing tab)</span>
          <span className="font-data text-ink">
            {displayCost != null ? <Money value={displayCost} /> : "—"}
          </span>
        </div>
        {marginPct != null ? (
          <div className="flex justify-between py-2.5 text-[13px]">
            <span className="text-ink/55">Margin</span>
            <span
              className={
                marginPct >= 40
                  ? "bg-sage/20 px-2.5 py-1 font-data text-[12px] text-ink"
                  : "bg-madder/15 px-2.5 py-1 font-data text-[12px] text-madder"
              }
            >
              {marginPct}%
            </span>
          </div>
        ) : null}

        <div className="mt-5 flex max-w-md flex-col gap-4 border-t border-ink/10 pt-5">
          <label className="flex flex-col gap-1.5">
            <Label>Retail price (PKR)</Label>
            <input
              value={retailPkr}
              onChange={(e) => setRetailPkr(e.target.value)}
              inputMode="numeric"
              required
              className={fieldClass}
            />
          </label>

          <label className="flex items-center gap-2 text-[13px] text-ink">
            <input
              type="checkbox"
              checked={discountOn}
              onChange={(e) => setDiscountOn(e.target.checked)}
              className="accent-zari"
            />
            Design discount
          </label>

          {discountOn ? (
            <div className="flex flex-col gap-3 border border-ink/10 bg-greige/30 p-3">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDiscountMode("percent")}
                  className={
                    discountMode === "percent"
                      ? "bg-zari px-3 py-1.5 text-[12px] text-indigo"
                      : "border border-ink/12 px-3 py-1.5 text-[12px] text-ink/55"
                  }
                >
                  %
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountMode("pkr")}
                  className={
                    discountMode === "pkr"
                      ? "bg-zari px-3 py-1.5 text-[12px] text-indigo"
                      : "border border-ink/12 px-3 py-1.5 text-[12px] text-ink/55"
                  }
                >
                  PKR
                </button>
              </div>
              <label className="flex flex-col gap-1.5">
                <Label>
                  {discountMode === "percent"
                    ? "Discount %"
                    : "Discount amount (PKR)"}
                </Label>
                <input
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  inputMode="decimal"
                  className={fieldClass}
                />
              </label>
            </div>
          ) : null}
        </div>
      </section>

      <button
        type="submit"
        disabled={pending}
        className="self-start border border-zari bg-zari px-4 py-2 text-[13px] text-indigo disabled:opacity-50"
      >
        Save · continue to Preview
      </button>
    </form>
  );
}

/** Admin preview — storefront PDP look without MTM / bag / Reflection. */
export function PreviewPublishTab({
  detail,
  costing,
  pending,
  canPublish,
  onPublish,
  onEditTab,
}: {
  detail: DesignDetail;
  costing: DesignCostingData | null | undefined;
  pending: boolean;
  canPublish: boolean;
  onPublish: () => void;
  onEditTab: (
    tab: "Details" | "Photos" | "Sizing" | "Costing" | "Price" | "Preview",
  ) => void;
}) {
  const d = detail.design;
  const sizes =
    d.availableSizeLabels?.length > 0
      ? d.availableSizeLabels
      : [...STANDARD_SIZE_LABELS];

  const [colourwayId, setColourwayId] = useState(
    () =>
      detail.colourways.find((c) => c.isDefault)?.id ??
      detail.colourways[0]?.id ??
      "",
  );
  const [angle, setAngle] = useState<"FRONT" | "THREE_QUARTER" | "BACK">(
    "FRONT",
  );
  const [sizeLabel, setSizeLabel] = useState(sizes[2] ?? sizes[0] ?? "M");
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideRows, setGuideRows] = useState<
    {
      measurementKey: string;
      baseValue: number;
      gradeIncrement: number;
      gradeOverrides: Record<string, number>;
    }[]
  >([]);
  const [guideLabels, setGuideLabels] = useState<string[]>([
    ...STANDARD_SIZE_LABELS,
  ]);
  const [guideBase, setGuideBase] = useState("M");

  const selectedCw =
    detail.colourways.find((c) => c.id === colourwayId) ??
    detail.colourways[0];

  const imagesForCw = useMemo(() => {
    const shots = detail.renders.filter(
      (r) => !selectedCw || r.colourwayId === selectedCw.id || !r.isAiGenerated,
    );
    const byAngle = {
      FRONT: shots.find((r) => r.angle === "FRONT"),
      THREE_QUARTER: shots.find((r) => r.angle === "THREE_QUARTER"),
      BACK: shots.find((r) => r.angle === "BACK"),
    };
    return byAngle;
  }, [detail.renders, selectedCw]);

  const activeImage =
    imagesForCw[angle] ??
    imagesForCw.FRONT ??
    detail.renders.find((r) => r.previewUrl);

  async function openGuide() {
    setGuideOpen(true);
    if (!d.sizeBlockId || guideRows.length > 0) return;
    const block = await getSizeBlock(d.sizeBlockId);
    if (!block) return;
    setGuideLabels(block.sizeLabels);
    setGuideBase(block.baseSizeLabel);
    setGuideRows(
      block.rows.map((r) => ({
        measurementKey: r.measurementKey,
        baseValue: r.baseValue,
        gradeIncrement: r.gradeIncrement,
        gradeOverrides: r.gradeOverrides ?? {},
      })),
    );
  }

  const guideGrid =
    guideRows.length > 0
      ? resolveChart(
          { sizeLabels: guideLabels, baseSizeLabel: guideBase },
          guideRows,
          [],
        )
      : null;

  const offPct =
    d.compareAtPriceMinor != null &&
    d.compareAtPriceMinor > d.basePriceMinor &&
    d.compareAtPriceMinor > 0
      ? Math.round((1 - d.basePriceMinor / d.compareAtPriceMinor) * 100)
      : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-8 border border-ink/12 bg-milk p-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <div className="relative aspect-[3/4] max-h-[28rem] border border-ink/10 bg-greige/40">
            {activeImage?.previewUrl ? (
              <Image
                src={activeImage.previewUrl}
                alt={activeImage.altText || d.name}
                fill
                unoptimized
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-[12px] text-ink/35">
                No photo
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["FRONT", "Front"],
                ["THREE_QUARTER", "Three-quarter"],
                ["BACK", "Back"],
              ] as const
            ).map(([a, label]) => (
              <button
                key={a}
                type="button"
                onClick={() => setAngle(a)}
                className={
                  angle === a
                    ? "border-b-2 border-ink px-2 py-1 text-[12px] text-ink"
                    : "border-b-2 border-transparent px-2 py-1 text-[12px] text-ink/45 hover:text-ink"
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <span className="self-start border border-ink/15 px-2 py-0.5 font-sans text-[10px] uppercase tracking-[0.1em] text-ink/55">
            Standard size
          </span>
          <h2 className="font-display text-3xl font-light text-ink">{d.name}</h2>
          <div className="flex flex-wrap items-center gap-2 font-data text-[15px] text-ink">
            <Money value={d.basePriceMinor} />
            {d.compareAtPriceMinor != null &&
            d.compareAtPriceMinor > d.basePriceMinor ? (
              <span className="text-[12px] text-ink/40 line-through">
                <Money value={d.compareAtPriceMinor} />
              </span>
            ) : null}
            {offPct != null && offPct > 0 ? (
              <span className="bg-madder px-2 py-0.5 text-[11px] text-milk">
                -{offPct}%
              </span>
            ) : null}
          </div>

          {detail.colourways.length > 0 ? (
            <div>
              <Label>Shade</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {detail.colourways.map((cw) => (
                  <button
                    key={cw.id}
                    type="button"
                    title={cw.name}
                    onClick={() => setColourwayId(cw.id)}
                    className={
                      colourwayId === cw.id
                        ? "flex items-center gap-2 border border-ink px-2 py-1.5 text-[12px] text-ink"
                        : "flex items-center gap-2 border border-ink/15 px-2 py-1.5 text-[12px] text-ink/55"
                    }
                  >
                    <span
                      className="size-3 border border-ink/15"
                      style={{
                        backgroundColor: cw.hexApproximation ?? "#EAE1CF",
                      }}
                    />
                    {cw.name}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div>
            <Label>Size</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {sizes.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSizeLabel(s)}
                  className={
                    sizeLabel === s
                      ? "bg-zari px-3 py-1.5 text-[12px] text-indigo"
                      : "border border-ink/12 px-3 py-1.5 text-[12px] text-ink/55"
                  }
                >
                  {s}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => {
                onEditTab("Sizing");
              }}
              className="mt-2 text-[12px] text-ink/55 underline-offset-2 hover:text-ink hover:underline"
            >
              Size & fit guide →
            </button>
            <button
              type="button"
              onClick={() => void openGuide()}
              className="ms-3 mt-2 text-[12px] text-ink/40 underline-offset-2 hover:text-ink hover:underline"
            >
              Preview chart
            </button>
          </div>

          {guideOpen ? (
            <div className="border border-ink/10 bg-milk p-3">
              <div className="flex items-center justify-between gap-2">
                <Label>Size guide</Label>
                <button
                  type="button"
                  onClick={() => setGuideOpen(false)}
                  className="text-[11px] text-ink/45"
                >
                  Close
                </button>
              </div>
              {guideGrid ? (
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full min-w-[28rem] border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b border-ink/10">
                        <th className="px-1 py-1 text-start font-normal text-ink/45">
                          Measure
                        </th>
                        {guideLabels.map((s) => (
                          <th
                            key={s}
                            className="px-1 py-1 text-start font-normal text-ink/45"
                          >
                            {s}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {guideRows.map((row) => (
                        <tr
                          key={row.measurementKey}
                          className="border-b border-ink/8"
                        >
                          <td className="px-1 py-1 text-ink/60">
                            {row.measurementKey}
                          </td>
                          {guideLabels.map((s) => {
                            const cell = guideGrid[row.measurementKey]?.[s];
                            return (
                              <td key={s} className="px-1 py-1 font-data">
                                {cell ? <Measure value={cell.value} /> : "—"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-2 text-[12px] text-ink/40">
                  {d.sizeBlockId
                    ? "Loading…"
                    : "Assign a size block on the Sizing tab."}
                </p>
              )}
            </div>
          ) : null}

          <div className="divide-y divide-ink/10 border-y border-ink/10 text-[13px]">
            <div className="flex justify-between gap-4 py-2">
              <span className="text-ink/45">Fabric</span>
              <span className="text-ink">{selectedCw?.name ?? "—"}</span>
            </div>
            <div className="flex justify-between gap-4 py-2">
              <span className="text-ink/45">Cost</span>
              <span className="text-ink">
                {costing?.breakdown ? (
                  <Money value={costing.breakdown.totalCostMinor} />
                ) : (
                  "—"
                )}
              </span>
            </div>
            <div className="flex justify-between gap-4 py-2">
              <span className="text-ink/45">Status</span>
              <span className="text-ink">{d.status.replaceAll("_", " ")}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          ["Details", "Photos", "Sizing", "Costing", "Price"] as const
        ).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onEditTab(t)}
            className="border border-ink/15 px-3 py-1.5 text-[12px] text-ink/55 hover:border-ink hover:text-ink"
          >
            Edit {t}
          </button>
        ))}
      </div>

      {canPublish ? (
        <button
          type="button"
          disabled={pending}
          onClick={onPublish}
          className="self-start border border-zari bg-zari px-5 py-2.5 text-[13px] text-indigo disabled:opacity-50"
        >
          Publish to storefront
        </button>
      ) : (
        <p className="text-[13px] text-ink/45">
          {d.status === "PUBLISHED"
            ? "Published — edit anytime from any tab."
            : "Not ready to publish from this status."}
        </p>
      )}
    </div>
  );
}
