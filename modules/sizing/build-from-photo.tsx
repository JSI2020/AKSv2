"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { recognizeDesignSizing } from "@/modules/designs/recognize-sizing-action";

/**
 * "Build from garment photo" — one control, every sizing surface.
 *
 * Wraps the shared garment-sizing engine so Designs → Sizing and AI Studio →
 * Sizing behave identically: same upload, same measurement, same wording. Any
 * future surface renders this instead of reimplementing the flow.
 */
export type BuildFromPhotoProps = {
  designId: string;
  /** Size block to fill (the design's own or the category default). */
  blockId: string;
  /** Garment category of that block — decides which rows get filled. */
  pieceKey: string;
  disabled?: boolean;
  /** Dark studio rail vs light design editor. */
  tone?: "light" | "dark";
  /** Fired after a successful build (blockId may change when it forks). */
  onBuilt?: (result: { blockId: string; ghostUrl: string | null }) => void;
};

export function BuildFromPhoto({
  designId,
  blockId,
  pieceKey,
  disabled = false,
  tone = "light",
  onBuilt,
}: BuildFromPhotoProps) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const dark = tone === "dark";

  function run() {
    if (!file || !blockId) return;
    setError(null);
    setMessage("Reading the photo · measuring · building the chart…");
    startTransition(async () => {
      try {
        const fd = new FormData();
        fd.set("designId", designId);
        fd.set("blockId", blockId);
        fd.set("pieceKey", pieceKey);
        fd.set("image", file);
        const res = await recognizeDesignSizing(fd);
        if (!res.ok) {
          setMessage(null);
          setError(res.error);
          return;
        }
        setMessage(describeOutcome(res));
        onBuilt?.({ blockId: res.blockId, ghostUrl: res.ghostUrl });
        router.refresh();
      } catch (e) {
        setMessage(null);
        setError(e instanceof Error ? e.message : "Recognition failed.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <p
        className={cn(
          "font-sans text-[11px] uppercase tracking-[0.12em]",
          dark ? "text-chalk" : "text-ink/55",
        )}
      >
        Build from garment photo
      </p>
      <p className={cn("text-[12px]", dark ? "text-chalk" : "text-ink/55")}>
        Lay the garment flat and shoot straight down for the most accurate
        measurements.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            setMessage(null);
            setError(null);
          }}
        />
        <button
          type="button"
          disabled={disabled || pending}
          onClick={() => fileRef.current?.click()}
          className={cn(
            "border px-3 py-2 text-[12px] disabled:opacity-40",
            dark
              ? "border-milk/25 text-milk hover:border-zari"
              : "border-ink/15 text-ink hover:border-ink",
          )}
        >
          {file ? "Change photo" : "Choose photo"}
        </button>
        <button
          type="button"
          disabled={disabled || pending || !file}
          onClick={run}
          className={cn(
            "px-4 py-2 text-[12px] uppercase tracking-[0.08em] disabled:opacity-40",
            dark
              ? "border border-zari bg-zari/20 text-milk"
              : "bg-ink text-milk hover:bg-indigo",
          )}
        >
          {pending ? "Measuring…" : "Recognise"}
        </button>
        {file ? (
          <span
            className={cn(
              "truncate text-[11px]",
              dark ? "text-chalk" : "text-ink/50",
            )}
          >
            {file.name}
          </span>
        ) : null}
      </div>
      {message ? (
        <p className={cn("text-[12px]", dark ? "text-zari" : "text-ink/70")}>
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="text-[12px] text-madder" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Say plainly whether the photo was measured or the chart came from the style
 * template alone — a silent fallback otherwise looks like a real measurement.
 */
function describeOutcome(res: {
  filled: string[];
  ghostUrl: string | null;
  measurement: {
    landmarks: { captureContext: string };
    applied: unknown[];
    conflicts: unknown[];
    anchor: string;
  } | null;
}): string {
  const m = res.measurement;
  const source = m
    ? `measured from photo (${m.landmarks.captureContext.replace("_", " ")}, scaled on ${
        m.anchor === "person_height" ? "model height" : "garment length"
      })${
        m.applied.length
          ? ` · ${m.applied.length} corrected`
          : " · matched the template"
      }${m.conflicts.length ? ` · ${m.conflicts.length} flagged for review` : ""}`
    : "from style template only — photo could not be measured";
  return `Chart built · ${res.filled.length} measurements · ${source} · ${
    res.ghostUrl ? "ghost saved" : "ghost unavailable"
  }`;
}
