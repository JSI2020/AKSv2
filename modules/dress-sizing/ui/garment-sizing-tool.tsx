"use client";

import { useRef, useState, useTransition } from "react";

import { Measure } from "@/modules/ui";
import {
  measureGarmentStandalone,
  type StandaloneSizingResult,
} from "../service/standalone-actions";

type Success = Extract<StandaloneSizingResult, { ok: true }>;

/**
 * Standalone garment sizing — upload any photo, get the measured XS–XXL chart
 * and the ghost mannequin. Nothing is written to a design, so this is the
 * place to try the engine and judge its accuracy before trusting it on a
 * product.
 */
export function GarmentSizingTool() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [result, setResult] = useState<Success | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function choose(next: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(next);
    setPreview(next ? URL.createObjectURL(next) : null);
    setResult(null);
    setError(null);
  }

  function run() {
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("image", file);
      const res = await measureGarmentStandalone(fd);
      if (!res.ok) {
        setError(res.error);
        setResult(null);
        return;
      }
      setResult(res);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => choose(e.target.files?.[0] ?? null)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex aspect-[3/4] w-full items-center justify-center border border-dashed border-indigo-lift text-[13px] text-chalk hover:border-zari hover:text-zari"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element -- local object URL
              <img
                src={preview}
                alt="Selected garment"
                className="size-full object-contain"
              />
            ) : (
              "Choose a garment photo"
            )}
          </button>
          <p className="text-[12px] text-chalk">
            Lay the garment flat and shoot straight down for the most accurate
            result — a flat photo measures girths exactly, a photo on a model
            has to estimate them.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!file || pending}
              onClick={run}
              className="border border-zari bg-zari/20 px-4 py-2 text-[12px] uppercase tracking-[0.08em] text-milk disabled:opacity-40"
            >
              {pending ? "Measuring…" : "Measure garment"}
            </button>
            {file ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => choose(null)}
                className="border border-indigo-lift px-3 py-2 text-[12px] text-chalk"
              >
                Clear
              </button>
            ) : null}
          </div>
          {error ? (
            <p className="text-[12px] text-madder" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-4">
          {!result ? (
            <p className="border border-indigo-lift px-3 py-2 text-[13px] text-chalk">
              Upload a photo to see the measured size chart. The engine detects
              the garment&apos;s landmarks, converts them to inches, and fuses
              the result with the house style template — nothing is saved to a
              design here.
            </p>
          ) : (
            <>
              <div className="border border-indigo-lift px-3 py-2 text-[13px]">
                {result.measured ? (
                  <p className="text-greige">
                    <span className="text-zari">Measured from photo</span> ·{" "}
                    {result.measured.captureContext.replace("_", " ")} · scaled on{" "}
                    {result.measured.anchor === "person_height"
                      ? "model height"
                      : "garment length"}{" "}
                    · {result.measured.corrected} measurement
                    {result.measured.corrected === 1 ? "" : "s"} corrected
                    {result.measured.flagged > 0
                      ? ` · ${result.measured.flagged} flagged for review`
                      : ""}
                  </p>
                ) : (
                  <p className="text-greige">
                    <span className="text-madder">
                      Photo could not be measured
                    </span>{" "}
                    — chart came from the style template alone.
                  </p>
                )}
                <p className="mt-1 text-[12px] text-chalk">
                  Recognised as {result.template.replace("_", " ")} ·{" "}
                  {Math.round(result.confidence * 100)}% style confidence
                  {result.lowConfidence ? " · low confidence, check it" : ""}
                </p>
                {result.measured?.warnings.length ? (
                  <ul className="mt-1 list-disc ps-4 text-[12px] text-zari">
                    {result.measured.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="overflow-x-auto border border-indigo-lift">
                <table className="w-full min-w-[520px] border-collapse text-[12.5px]">
                  <thead>
                    <tr className="border-b border-indigo-lift">
                      <th className="px-3 py-2 text-start font-sans text-[10px] uppercase tracking-[0.1em] text-chalk">
                        Measurement
                      </th>
                      {result.sizeLabels.map((s) => (
                        <th
                          key={s}
                          className="px-2 py-2 text-center font-data text-[11px] text-chalk"
                        >
                          {s}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row) => (
                      <tr
                        key={row.pomKey}
                        className="border-b border-indigo-lift/60 last:border-b-0"
                      >
                        <td className="px-3 py-2 text-greige">{row.label}</td>
                        {result.sizeLabels.map((s) => (
                          <td
                            key={s}
                            className="px-2 py-2 text-center font-data text-greige"
                          >
                            {row.valuesBySize[s] != null ? (
                              <Measure value={row.valuesBySize[s]!} />
                            ) : (
                              "—"
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {result.ghostUrl ? (
                <div className="flex flex-col gap-2">
                  <p className="font-sans text-[10px] uppercase tracking-[0.12em] text-chalk">
                    Ghost mannequin
                  </p>
                  {/* eslint-disable-next-line @next/next/no-img-element -- external generated image */}
                  <img
                    src={result.ghostUrl}
                    alt="Ghost mannequin of the measured garment"
                    className="max-h-[52dvh] w-auto self-start border border-indigo-lift object-contain"
                  />
                </div>
              ) : (
                <p className="text-[12px] text-chalk">
                  Ghost mannequin unavailable for this photo.
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
