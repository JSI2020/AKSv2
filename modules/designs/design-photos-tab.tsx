"use client";

import { useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

import {
  COMMERCIAL_POSES,
  resolveStudioPosePicks,
  type CommercialPose,
} from "@/modules/photoreal/commercial-poses";
import type { DesignDetail } from "./actions";
import {
  attachReferencePhoto,
  generateStudioAngles,
  saveStudioAnglePicks,
  syncStudioColourways,
} from "./studio-photo-actions";

type FormOptions = {
  fabrics: { id: string; name: string; swatchAssetId?: string | null }[];
};

type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

type ColourSet = {
  id: string;
  /** fabric id per component key from Details */
  fabrics: Record<string, string>;
};

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

function componentKeysOf(detail: DesignDetail): string[] {
  const fromDesign = detail.design.components ?? [];
  if (fromDesign.length > 0) return fromDesign;
  return detail.categoryKey ? [detail.categoryKey] : [];
}

function emptySet(components: string[], defaultFabricId: string): ColourSet {
  const fabrics: Record<string, string> = {};
  for (const c of components) fabrics[c] = defaultFabricId;
  return { id: crypto.randomUUID(), fabrics };
}

function initSets(
  detail: DesignDetail,
  components: string[],
  defaultFabricId: string,
): ColourSet[] {
  if (detail.colourways.length === 0) {
    return [emptySet(components, defaultFabricId)];
  }
  return detail.colourways.map((cw) => {
    const fabrics: Record<string, string> = {};
    const pieces =
      cw.pieceFabrics && Object.keys(cw.pieceFabrics).length > 0
        ? cw.pieceFabrics
        : { [components[0] ?? "PRIMARY"]: cw.fabricId };
    for (const c of components) {
      fabrics[c] = pieces[c] ?? cw.fabricId ?? defaultFabricId;
    }
    return { id: cw.id, fabrics };
  });
}

const POSE_GROUPS = (
  ["Standing", "Walking", "Seated", "Editorial", "Back", "Detail"] as const
).map((cat) => ({
  category: cat,
  poses: COMMERCIAL_POSES.filter((p) => p.category === cat),
}));

const SLOT_CAMERA = ["FRONT", "THREE_QUARTER", "BACK"] as const;

export function DesignPhotosTab({
  detail,
  options,
  pending,
  onRun,
  onRunSequence,
  onSavedAdvance,
}: {
  detail: DesignDetail;
  options: FormOptions;
  pending: boolean;
  onRun: (action: (fd: FormData) => Promise<ActionResult>, fd: FormData) => void;
  onRunSequence: (
    steps: {
      action: (fd: FormData) => Promise<ActionResult>;
      fd: FormData;
    }[],
    thenAdvance?: boolean,
  ) => void;
  onSavedAdvance: () => void;
}) {
  const components = componentKeysOf(detail);
  const defaultFabricId = options.fabrics[0]?.id ?? "";
  const [sets, setSets] = useState(() =>
    initSets(detail, components, defaultFabricId),
  );
  const [setCount, setSetCount] = useState(() => Math.max(1, sets.length));
  const initialPoses = resolveStudioPosePicks(detail.design.studioAnglePicks);
  const [poseIds, setPoseIds] = useState<string[]>(() =>
    initialPoses.map((p) => p.id),
  );
  const [previewLocal, setPreviewLocal] = useState<string | null>(null);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "ready" | "error"
  >("idle");
  const [genSlot, setGenSlot] = useState<number | null>(null);

  const fabricById = useMemo(() => {
    const m = new Map(options.fabrics.map((f) => [f.id, f]));
    return m;
  }, [options.fabrics]);

  const reference = detail.renders.find((r) => !r.isAiGenerated);

  function syncSetCount(n: number) {
    const count = Math.min(6, Math.max(1, n));
    setSetCount(count);
    setSets((prev) => {
      const next = [...prev];
      while (next.length < count) {
        next.push(emptySet(components, defaultFabricId));
      }
      return next.slice(0, count);
    });
  }

  function updateSetFabric(setIdx: number, comp: string, fabricId: string) {
    setSets((prev) =>
      prev.map((s, i) =>
        i === setIdx
          ? { ...s, fabrics: { ...s.fabrics, [comp]: fabricId } }
          : s,
      ),
    );
  }

  async function onFile(file: File) {
    setUploadStatus("uploading");
    const local = URL.createObjectURL(file);
    setPreviewLocal(local);
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
      setUploadStatus("ready");

      const fd = new FormData();
      fd.set("designId", detail.design.id);
      fd.set("assetId", data.asset.id);
      fd.set("altText", "Reference");
      fd.set("angle", "FRONT");
      onRun(attachReferencePhoto, fd);
    } catch {
      setUploadStatus("error");
    }
  }

  function buildColourwayRows() {
    const primary = components[0];
    if (!primary) return [];
    return sets.map((set, i) => {
      const primaryFabric = set.fabrics[primary] ?? defaultFabricId;
      const name =
        fabricById.get(primaryFabric)?.name ?? `Set ${i + 1}`;
      return {
        name,
        fabricId: primaryFabric,
        pieceFabrics: { ...set.fabrics },
      };
    });
  }

  function saveAndAdvance() {
    const rows = buildColourwayRows();
    const fd = new FormData();
    fd.set("designId", detail.design.id);
    fd.set("colourwaysJson", JSON.stringify(rows));

    const anglesFd = new FormData();
    anglesFd.set("id", detail.design.id);
    anglesFd.set("anglesJson", JSON.stringify(poseIds));

    onRunSequence(
      [
        { action: syncStudioColourways, fd },
        { action: saveStudioAnglePicks, fd: anglesFd },
      ],
      true,
    );
  }

  function generateSlot(idx: number) {
    if (!reference && !previewLocal) {
      // Soft client hint — server still enforces FRONT render
    }
    setGenSlot(idx);
    const rows = buildColourwayRows();
    const syncFd = new FormData();
    syncFd.set("designId", detail.design.id);
    syncFd.set("colourwaysJson", JSON.stringify(rows));

    const fd = new FormData();
    fd.set("designId", detail.design.id);
    fd.set("anglesJson", JSON.stringify(poseIds));
    fd.set("slotIndex", String(idx));
    fd.set("poseId", poseIds[idx] ?? "");

    onRunSequence([
      { action: syncStudioColourways, fd: syncFd },
      { action: generateStudioAngles, fd },
    ]);
  }

  const previewSrc = previewLocal ?? reference?.previewUrl ?? null;

  const rendersByAngle = useMemo(() => {
    const map: Record<string, typeof detail.renders> = {
      FRONT: [],
      THREE_QUARTER: [],
      BACK: [],
      DETAIL: [],
    };
    for (const r of detail.renders) {
      const list = map[r.angle] ?? (map[r.angle] = []);
      list.push(r);
    }
    return map;
  }, [detail.renders]);

  return (
    <div className="flex flex-col gap-8">
      <section className="border border-ink/10 bg-milk">
        <div className="border-b border-ink/10 px-4 py-3">
          <p className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/45">
            Reference photo
          </p>
        </div>
        <div className="grid gap-0 md:grid-cols-[minmax(0,14rem)_1fr]">
          <label className="relative flex min-h-[200px] cursor-pointer flex-col items-center justify-center gap-2 border-b border-ink/10 bg-greige/40 p-4 md:border-b-0 md:border-e">
            {previewSrc ? (
              <Image
                src={previewSrc}
                alt="Reference"
                width={280}
                height={360}
                unoptimized
                className="h-full max-h-[260px] w-auto object-contain"
              />
            ) : (
              <span className="text-center text-[12px] text-ink/45">
                Drop or choose image
              </span>
            )}
            <input
              type="file"
              accept="image/*"
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
            />
          </label>
          <div className="flex flex-col justify-center gap-2 p-4">
            <p className="font-data text-[11px] uppercase tracking-[0.12em] text-ink/40">
              Status · {uploadStatus}
              {reference ? " · FRONT attached" : " · upload FRONT first"}
            </p>
            <p className="max-w-sm text-[13px] text-ink/55">
              Upload a clear front photo first — Generate will fail until it is
              attached. Model and design stay fixed; only fabric colour and pose
              change per angle.
            </p>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/45">
              Colour sets · fabric per piece
            </p>
            <p className="mt-1 text-[12px] text-ink/45">
              Pieces come from Details ({components.join(" · ") || "—"}). Each
              set is one storefront colourway.
            </p>
          </div>
          <label className="flex items-center gap-2 text-[13px] text-ink">
            <span className="font-sans text-[10px] uppercase tracking-[0.12em] text-ink/45">
              Sets
            </span>
            <select
              value={setCount}
              onChange={(e) => syncSetCount(Number(e.target.value))}
              className={fieldClass()}
            >
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex flex-col gap-4">
          {sets.map((set, setIdx) => (
            <div key={set.id} className="border border-ink/10 bg-milk p-4">
              <p className="font-data text-[11px] uppercase tracking-[0.12em] text-ink/45">
                Set {setIdx + 1}
              </p>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {components.map((comp) => (
                  <label key={comp} className="flex flex-col gap-1.5">
                    <Label>{comp}</Label>
                    <select
                      value={set.fabrics[comp] ?? defaultFabricId}
                      onChange={(e) =>
                        updateSetFabric(setIdx, comp, e.target.value)
                      }
                      className={fieldClass()}
                    >
                      {options.fabrics.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                    {(set.fabrics[comp] ?? defaultFabricId) ? (
                      <Link
                        href={`/admin/fabrics/${set.fabrics[comp] ?? defaultFabricId}`}
                        className="text-[11px] text-ink hover:text-zari"
                      >
                        Open fabric
                      </Link>
                    ) : null}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <p className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/45">
          Angles · generate one at a time
        </p>
        <p className="text-[12px] text-ink/45">
          Change pose, then Generate for that angle only (same model, same
          design — fabric colours from the sets above).
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((idx) => {
            const pose = COMMERCIAL_POSES.find((p) => p.id === poseIds[idx]);
            return (
              <div key={idx} className="flex flex-col gap-2 border border-ink/10 bg-milk p-3">
                <Label>Angle {idx + 1}</Label>
                <select
                  value={poseIds[idx]}
                  onChange={(e) => {
                    const next = [...poseIds];
                    next[idx] = e.target.value;
                    setPoseIds(next);
                  }}
                  className={fieldClass()}
                >
                  {POSE_GROUPS.map((g) => (
                    <optgroup key={g.category} label={g.category}>
                      {g.poses.map((p: CommercialPose) => (
                        <option key={p.id} value={p.id}>
                          {p.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <span className="font-data text-[10px] text-ink/35">
                  Camera · {SLOT_CAMERA[idx]} · pose drives stance only
                </span>
                <button
                  type="button"
                  disabled={pending || (!reference && uploadStatus !== "ready")}
                  onClick={() => generateSlot(idx)}
                  className="border border-zari bg-zari px-3 py-2 text-[12px] text-indigo disabled:opacity-50"
                >
                  {pending && genSlot === idx
                    ? "Generating…"
                    : `Generate angle ${idx + 1}`}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <p className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/45">
          Generated gallery
        </p>
          {[0, 1, 2].map((idx) => {
          const pose = COMMERCIAL_POSES.find((p) => p.id === poseIds[idx]);
          const cam = SLOT_CAMERA[idx]!;
          const shots = rendersByAngle[cam] ?? [];
          return (
            <div key={idx} className="border border-ink/10 bg-milk p-3">
              <p className="font-data text-[11px] uppercase tracking-[0.12em] text-ink/45">
                Angle {idx + 1} · {pose?.label ?? cam} · {cam}
              </p>
              {shots.length === 0 ? (
                <p className="mt-3 text-[12px] text-ink/40">
                  No photos for this angle yet.
                </p>
              ) : (
                <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {shots.map((r) => {
                    const cw = detail.colourways.find(
                      (c) => c.id === r.colourwayId,
                    );
                    return (
                      <li key={r.id} className="flex flex-col border border-ink/10">
                        <div className="relative aspect-[3/4] bg-greige/50">
                          {r.previewUrl ? (
                            <Image
                              src={r.previewUrl}
                              alt={r.altText || r.angle}
                              fill
                              unoptimized
                              className="object-cover"
                            />
                          ) : null}
                        </div>
                        <div className="flex items-center justify-between gap-2 p-2">
                          <span className="text-[12px] text-ink">
                            {cw?.name ?? "Colour"}
                          </span>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => generateSlot(idx)}
                            className="border border-ink/15 px-2 py-1 text-[11px] text-ink/55 hover:border-ink hover:text-ink disabled:opacity-50"
                          >
                            Regenerate
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </section>

      <div className="flex flex-wrap gap-2 border-t border-ink/10 pt-4">
        <button
          type="button"
          disabled={pending}
          onClick={saveAndAdvance}
          className="border border-zari bg-zari px-4 py-2 text-[13px] text-indigo disabled:opacity-50"
        >
          Save · continue to Sizing
        </button>
      </div>
    </div>
  );
}
