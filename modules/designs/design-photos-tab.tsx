"use client";

import { useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

import type { RenderAngle } from "@aks/shared";
import {
  deleteDesignRender,
  upsertDesignRender,
} from "./actions";
import type { DesignDetail } from "./actions";
import { syncStudioColourways } from "./studio-photo-actions";

type FormOptions = {
  fabrics: { id: string; name: string; swatchAssetId?: string | null }[];
};

type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

type ColourSet = {
  id: string;
  fabrics: Record<string, string>;
};

type DesignRender = DesignDetail["renders"][number];

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

function savedComponentKeys(detail: DesignDetail): string[] {
  return detail.design.components ?? [];
}

function emptySet(components: string[]): ColourSet {
  const fabrics: Record<string, string> = {};
  for (const c of components) fabrics[c] = "";
  return { id: crypto.randomUUID(), fabrics };
}

function initSets(detail: DesignDetail, components: string[]): ColourSet[] {
  if (detail.colourways.length === 0) {
    return [emptySet(components)];
  }
  return detail.colourways.map((cw) => {
    const fabrics: Record<string, string> = {};
    const pieces =
      cw.pieceFabrics && Object.keys(cw.pieceFabrics).length > 0
        ? cw.pieceFabrics
        : { [components[0] ?? "PRIMARY"]: cw.fabricId };
    for (const c of components) {
      fabrics[c] = pieces[c] ?? cw.fabricId ?? "";
    }
    return { id: cw.id, fabrics };
  });
}

function allFabricsChosen(sets: ColourSet[], components: string[]): boolean {
  if (components.length === 0) return false;
  return sets.every((set) =>
    components.every((comp) => Boolean(set.fabrics[comp]?.trim())),
  );
}

function photosForColourway(
  renders: DesignRender[],
  colourwayId: string,
): DesignRender[] {
  return renders
    .filter((r) => r.colourwayId === colourwayId && !r.isAiGenerated)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.angle.localeCompare(b.angle));
}

/** First slots map to storefront gallery angles; extras are DETAIL. */
function suggestAngle(renders: DesignRender[], colourwayId: string): RenderAngle {
  const used = new Set(
    photosForColourway(renders, colourwayId).map((r) => r.angle),
  );
  if (!used.has("FRONT")) return "FRONT";
  if (!used.has("THREE_QUARTER")) return "THREE_QUARTER";
  if (!used.has("BACK")) return "BACK";
  return "DETAIL";
}

export function DesignPhotosTab({
  detail,
  options,
  pending,
  onRun,
  onRunSequence,
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
  const components = savedComponentKeys(detail);
  const [sets, setSets] = useState(() => initSets(detail, components));
  const [setCount, setSetCount] = useState(() => Math.max(1, sets.length));
  const [uploadingSetIdx, setUploadingSetIdx] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [altByRenderId, setAltByRenderId] = useState<Record<string, string>>(
    () => {
      const initial: Record<string, string> = {};
      for (const r of detail.renders) {
        initial[r.id] = r.altText ?? "";
      }
      return initial;
    },
  );

  const fabricsReady = allFabricsChosen(sets, components);

  const fabricById = useMemo(() => {
    return new Map(options.fabrics.map((f) => [f.id, f]));
  }, [options.fabrics]);

  function syncSetCount(n: number) {
    const count = Math.min(6, Math.max(1, n));
    setSetCount(count);
    setSets((prev) => {
      const next = [...prev];
      while (next.length < count) {
        next.push(emptySet(components));
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

  function buildColourwayRows() {
    const primary = components[0];
    if (!primary || !fabricsReady) return [];
    return sets.map((set, i) => {
      const primaryFabric = set.fabrics[primary] ?? "";
      const name = fabricById.get(primaryFabric)?.name ?? `Set ${i + 1}`;
      return {
        name,
        fabricId: primaryFabric,
        pieceFabrics: { ...set.fabrics },
      };
    });
  }

  function defaultAlt(setIdx: number, photoN: number): string {
    const primary = components[0];
    const fabricName =
      primary && sets[setIdx]
        ? fabricById.get(sets[setIdx]!.fabrics[primary] ?? "")?.name
        : null;
    const parts = [detail.design.name, fabricName].filter(Boolean);
    if (photoN > 1) parts.push(`Photo ${photoN}`);
    return parts.join(" — ");
  }

  async function syncColourways(): Promise<string[] | null> {
    const rows = buildColourwayRows();
    const syncFd = new FormData();
    syncFd.set("designId", detail.design.id);
    syncFd.set("colourwaysJson", JSON.stringify(rows));
    const syncRes = await syncStudioColourways(syncFd);
    if (!syncRes.ok) {
      setUploadError(syncRes.error);
      return null;
    }
    const ids = syncRes.colourwayIds ?? [];
    if (ids.length > 0) {
      setSets((prev) =>
        prev.map((set, i) => ({ ...set, id: ids[i] ?? set.id })),
      );
    }
    return ids;
  }

  async function uploadAsset(file: File): Promise<string> {
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
    if (!put.ok) throw new Error(`Upload failed (${put.status})`);

    const completeRes = await fetch("/api/assets/complete", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        key,
        mime: file.type || "application/octet-stream",
      }),
    });
    if (!completeRes.ok) throw new Error(await completeRes.text());
    const data = (await completeRes.json()) as { asset: { id: string } };
    return data.asset.id;
  }

  async function addPhoto(setIdx: number, file: File): Promise<void> {
    if (!fabricsReady) return;
    setUploadingSetIdx(setIdx);
    setUploadError(null);
    try {
      const colourwayIds = await syncColourways();
      if (!colourwayIds) return;

      const colourwayId = colourwayIds[setIdx];
      if (!colourwayId) {
        setUploadError("Could not save colour set — try again.");
        return;
      }

      const assetId = await uploadAsset(file);
      const existing = photosForColourway(detail.renders, colourwayId);
      const angle = suggestAngle(detail.renders, colourwayId);
      const altText = defaultAlt(setIdx, existing.length + 1);

      const fd = new FormData();
      fd.set("designId", detail.design.id);
      fd.set("colourwayId", colourwayId);
      fd.set("angle", angle);
      fd.set("assetId", assetId);
      fd.set("altText", altText);
      onRun(upsertDesignRender, fd);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploadingSetIdx(null);
    }
  }

  function saveAltText(render: DesignRender, altText: string) {
    setAltByRenderId((prev) => ({ ...prev, [render.id]: altText }));
    const fd = new FormData();
    fd.set("id", render.id);
    fd.set("designId", detail.design.id);
    fd.set("colourwayId", render.colourwayId);
    fd.set("angle", render.angle);
    fd.set("assetId", render.assetId);
    fd.set("altText", altText);
    fd.set("sortOrder", String(render.sortOrder));
    onRun(upsertDesignRender, fd);
  }

  function removePhoto(render: DesignRender) {
    const fd = new FormData();
    fd.set("id", render.id);
    fd.set("designId", detail.design.id);
    onRun(deleteDesignRender, fd);
  }

  function saveAndAdvance() {
    if (!fabricsReady) return;
    const fd = new FormData();
    fd.set("designId", detail.design.id);
    fd.set("colourwaysJson", JSON.stringify(buildColourwayRows()));
    onRunSequence([{ action: syncStudioColourways, fd }], true);
  }

  if (components.length === 0) {
    return (
      <p className="text-[13px] text-ink/55">
        Save at least one article type on the Details tab before choosing
        fabrics and photos.
      </p>
    );
  }

  if (options.fabrics.length === 0) {
    return (
      <p className="text-[13px] text-ink/55">
        No fabrics in inventory yet.{" "}
        <Link href="/admin/fabrics" className="text-zari underline">
          Add a fabric
        </Link>{" "}
        before continuing.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/45">
              Colour sets · fabric per piece
            </p>
            <p className="mt-1 text-[12px] text-ink/45">
              Each set is one storefront colourway. Add as many photos as you
              need — one is enough to publish.
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

        <div className="flex flex-col gap-6">
          {sets.map((set, setIdx) => {
            const primary = components[0];
            const setName =
              primary && set.fabrics[primary]
                ? (fabricById.get(set.fabrics[primary]!)?.name ??
                  `Set ${setIdx + 1}`)
                : `Set ${setIdx + 1}`;
            const photos = photosForColourway(detail.renders, set.id);
            const busy = uploadingSetIdx === setIdx || pending;

            return (
              <div key={set.id} className="border border-ink/10 bg-milk p-4">
                <p className="font-data text-[11px] uppercase tracking-[0.12em] text-ink/45">
                  Set {setIdx + 1} · {setName}
                </p>

                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {components.map((comp) => (
                    <label key={comp} className="flex flex-col gap-1.5">
                      <Label>{comp}</Label>
                      <select
                        value={set.fabrics[comp] ?? ""}
                        onChange={(e) =>
                          updateSetFabric(setIdx, comp, e.target.value)
                        }
                        className={fieldClass()}
                      >
                        <option value="">Select fabric…</option>
                        {options.fabrics.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>

                {fabricsReady ? (
                  <div className="mt-5 border-t border-ink/10 pt-4">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/45">
                          Photos
                        </p>
                        <p className="mt-1 text-[12px] text-ink/45">
                          {photos.length === 0
                            ? "No photos yet — add one or more."
                            : `${photos.length} photo${photos.length === 1 ? "" : "s"}`}
                        </p>
                      </div>
                      <label className="border border-zari bg-zari px-3 py-2 text-[12px] text-indigo has-[:disabled]:opacity-50">
                        {busy ? "Uploading…" : "Add photo"}
                        <input
                          type="file"
                          accept="image/*"
                          disabled={busy}
                          className="sr-only"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void addPhoto(setIdx, file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    </div>

                    {photos.length > 0 ? (
                      <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {photos.map((render, photoIdx) => (
                          <li
                            key={render.id}
                            className="flex flex-col gap-2 border border-ink/10 bg-greige/20 p-3"
                          >
                            <div className="relative aspect-[3/4] bg-milk">
                              {render.previewUrl ? (
                                <Image
                                  src={render.previewUrl}
                                  alt={
                                    altByRenderId[render.id] ??
                                    render.altText ??
                                    `Photo ${photoIdx + 1}`
                                  }
                                  fill
                                  unoptimized
                                  className="object-cover"
                                />
                              ) : null}
                            </div>
                            <label className="flex flex-col gap-1">
                              <span className="text-[10px] uppercase tracking-[0.1em] text-ink/40">
                                Alt text
                              </span>
                              <input
                                value={
                                  altByRenderId[render.id] ??
                                  render.altText ??
                                  ""
                                }
                                onChange={(e) =>
                                  setAltByRenderId((prev) => ({
                                    ...prev,
                                    [render.id]: e.target.value,
                                  }))
                                }
                                onBlur={(e) =>
                                  saveAltText(
                                    render,
                                    e.target.value.trim() ||
                                      defaultAlt(setIdx, photoIdx + 1),
                                  )
                                }
                                className={fieldClass()}
                              />
                            </label>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => removePhoto(render)}
                              className="self-start border border-madder/35 px-2 py-1 text-[11px] text-madder disabled:opacity-50"
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <label className="relative mt-4 flex min-h-[160px] cursor-pointer flex-col items-center justify-center gap-2 border border-dashed border-ink/15 bg-greige/30 p-6 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50">
                        <span className="text-[13px] text-ink/55">
                          {busy ? "Uploading…" : "Drop a photo here or click to choose"}
                        </span>
                        <span className="text-[11px] text-ink/40">
                          JPG or PNG
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={busy}
                          className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-not-allowed"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void addPhoto(setIdx, file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    )}
                  </div>
                ) : (
                  <p className="mt-4 text-[12px] text-ink/45">
                    Pick a fabric for each piece before adding photos.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {uploadError ? (
        <p className="text-[13px] text-madder">{uploadError}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-ink/10 pt-4">
        <button
          type="button"
          disabled={pending || !fabricsReady}
          onClick={saveAndAdvance}
          className="border border-zari bg-zari px-4 py-2 text-[13px] text-indigo disabled:opacity-50"
        >
          Save · continue to Sizing
        </button>
        <p className="text-[12px] text-ink/45">
          Photos save as soon as you add them. At least one photo per colour set
          before publish.
        </p>
      </div>
    </div>
  );
}
