"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

import {
  addColourway,
  approveColourwaySet,
  generateColourways,
  pollColourwaysLoop,
  proceedToPublish,
  skipToPublish,
  type ColourwayRow,
  type ColourwaysPageData,
} from "./colourway-actions";
import { StudioCostMeter } from "./cost-meter";

const fieldClass =
  "border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige outline-none focus:border-zari w-full";

const ANGLE_LABELS: Record<string, string> = {
  FRONT: "Front",
  THREE_QUARTER: "Three-quarter",
  BACK: "Back",
};

function ColourwayGridRow({
  row,
  readOnly,
  pending,
  onApprove,
}: {
  row: ColourwayRow;
  readOnly: boolean;
  pending: boolean;
  onApprove: () => void;
}) {
  const allSucceeded = row.cells.every(
    (c) => c.status === "SUCCEEDED" || row.usesLockedAngles,
  );
  const canApprove =
    !readOnly && !row.isApproved && allSucceeded && !row.cells.some((c) => c.error);

  return (
    <div className="border border-indigo-lift bg-indigo p-3">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-[13px] text-greige">{row.name}</p>
          <p className="text-[11px] text-chalk">
            {row.fabricName}
            {row.hexApproximation ? ` · ${row.hexApproximation}` : ""}
            {row.isDefault ? " · Base colourway" : ""}
          </p>
        </div>
        {row.isApproved ? (
          <span className="text-[11px] text-zari">Approved</span>
        ) : canApprove ? (
          <button
            type="button"
            disabled={pending}
            className="border border-zari bg-zari px-3 py-1.5 text-[13px] text-indigo"
            onClick={onApprove}
          >
            Approve set
          </button>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {row.cells.map((cell) => (
          <div key={cell.angle} className="flex flex-col gap-1">
            <p className="text-[10px] uppercase tracking-[0.12em] text-chalk">
              {ANGLE_LABELS[cell.angle] ?? cell.angle}
            </p>
            <div className="relative aspect-[3/4] border border-indigo-lift bg-indigo-lift">
              {cell.outputReadUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cell.outputReadUrl}
                  alt={`${row.name} ${ANGLE_LABELS[cell.angle] ?? cell.angle}`}
                  className="size-full object-contain"
                />
              ) : cell.status === "PENDING" || cell.status === "RUNNING" ? (
                <p className="flex size-full items-center justify-center text-[12px] text-chalk">
                  Generating…
                </p>
              ) : (
                <p className="flex size-full items-center justify-center text-[12px] text-chalk">
                  —
                </p>
              )}
              {cell.error ? (
                <p className="absolute inset-inline-start-0 bottom-0 bg-indigo/90 p-1 text-[10px] text-madder">
                  {cell.error}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ColourwaysPanel({ data: initial }: { data: ColourwaysPageData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [fabricId, setFabricId] = useState(initial.fabrics[0]?.id ?? "");
  const [hex, setHex] = useState("");

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (!data.isGenerating) return;
    const id = window.setInterval(() => {
      void pollColourwaysLoop(data.designId).then((res) => {
        if (!res.ok) return;
        setData((prev) => ({
          ...prev,
          status: res.data.status,
          isGenerating: res.data.isGenerating,
          rows: res.data.rows,
          canProceedToPublish: res.data.canProceedToPublish,
        }));
        if (!res.data.isGenerating) refresh();
      });
    }, 2500);
    return () => window.clearInterval(id);
  }, [data.designId, data.isGenerating, refresh]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error ?? "Action failed");
        return;
      }
      refresh();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <StudioCostMeter
        designSpendUsdMicros={data.designSpendUsdMicros}
        attemptCount={data.attemptCount}
        monthlySpendUsdMicros={data.monthlySpendUsdMicros}
        monthlyCapUsdMicros={data.monthlyCapUsdMicros}
      />

      <p className="text-[13px] text-chalk">
        Rows are colourways, columns are angles. Approve each colourway as a complete
        set — the storefront reads cached <code className="text-zari">design_renders</code> only.
      </p>

      {error ? (
        <p className="text-[13px] text-madder" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3">
        {data.rows.map((row) => (
          <ColourwayGridRow
            key={row.id}
            row={row}
            readOnly={data.readOnly}
            pending={pending}
            onApprove={() =>
              run(async () =>
                approveColourwaySet({
                  designId: data.designId,
                  colourwayId: row.id,
                }),
              )
            }
          />
        ))}
      </div>

      {!data.readOnly && data.status !== "READY_TO_PUBLISH" ? (
        <div className="border border-indigo-lift bg-indigo p-4">
          <p className="mb-3 text-[11px] uppercase tracking-[0.12em] text-chalk">
            Add colourway
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-[12px] text-chalk">
              Name
              <input
                className={fieldClass}
                value={name}
                disabled={pending}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-chalk">
              Fabric
              <select
                className={fieldClass}
                value={fabricId}
                disabled={pending}
                onChange={(e) => setFabricId(e.target.value)}
              >
                {data.fabrics.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-[12px] text-chalk">
              Target colour (hex)
              <input
                className={fieldClass}
                value={hex}
                disabled={pending}
                placeholder="#8C2F39"
                onChange={(e) => setHex(e.target.value)}
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending || !name.trim() || !fabricId}
              className="border border-indigo-lift px-3 py-1.5 text-[13px] text-greige disabled:opacity-50"
              onClick={() =>
                run(async () => {
                  const res = await addColourway({
                    designId: data.designId,
                    name,
                    fabricId,
                    hexApproximation: hex || null,
                  });
                  if (res.ok) {
                    setName("");
                    setHex("");
                  }
                  return res;
                })
              }
            >
              Add colourway
            </button>

            {data.pendingColourwayIds.length > 0 ? (
              <>
                {data.costPreview ? (
                  <p className="self-center text-[12px] text-chalk">
                    {data.costPreview}
                  </p>
                ) : null}
                <button
                  type="button"
                  disabled={pending || data.isGenerating}
                  className="border border-zari bg-zari px-3 py-1.5 text-[13px] text-indigo disabled:opacity-50"
                  onClick={() =>
                    run(async () =>
                      generateColourways({
                        designId: data.designId,
                        colourwayIds: data.pendingColourwayIds,
                      }),
                    )
                  }
                >
                  Generate pending colourways
                </button>
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {data.status === "ANGLES_LOCKED" && !data.readOnly ? (
          <button
            type="button"
            disabled={pending}
            className="border border-indigo-lift px-3 py-1.5 text-[13px] text-greige"
            onClick={() => run(async () => skipToPublish(data.designId))}
          >
            Skip colourways → publish
          </button>
        ) : null}

        {data.canProceedToPublish && data.status !== "READY_TO_PUBLISH" ? (
          <button
            type="button"
            disabled={pending}
            className="border border-zari bg-zari px-4 py-2 text-[13px] text-indigo"
            onClick={() => run(async () => proceedToPublish(data.designId))}
          >
            Proceed to publish
          </button>
        ) : null}

        {data.status === "READY_TO_PUBLISH" || data.canProceedToPublish ? (
          <a
            href={`/admin/studio/${data.designId}/publish`}
            className={cn(
              "border px-3 py-1.5 text-[13px]",
              data.status === "READY_TO_PUBLISH"
                ? "border-zari bg-zari text-indigo"
                : "border-indigo-lift text-chalk",
            )}
          >
            Publish checklist →
          </a>
        ) : null}

        <a
          href={`/admin/studio/${data.designId}/angles`}
          className="border border-indigo-lift px-3 py-1.5 text-[13px] text-chalk"
        >
          ← Angles
        </a>
      </div>
    </div>
  );
}
