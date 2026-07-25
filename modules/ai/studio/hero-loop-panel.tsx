"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

import {
  approveHeroAttempt,
  pollHeroLoop,
  regenerateHeroSameSeed,
  regenerateHeroWithNotes,
  rejectHeroAttempt,
  startHeroGeneration,
  switchModelAndRegenerate,
  type HeroAttemptRow,
  type HeroLoopPageData,
} from "./hero-actions";
import { StudioCostMeter } from "./cost-meter";

const fieldClass =
  "border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige outline-none focus:border-zari w-full";

function formatUsd(micros: number | null): string {
  if (micros == null) return "—";
  return `$${(micros / 1_000_000).toFixed(2)}`;
}

function AttemptThumb({
  attempt,
  selected,
  onSelect,
}: {
  attempt: HeroAttemptRow;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative aspect-square w-24 shrink-0 overflow-hidden border bg-indigo-lift transition-colors",
        selected ? "border-zari" : "border-indigo-lift hover:border-chalk",
      )}
    >
      {attempt.outputReadUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={attempt.outputReadUrl}
          alt=""
          className="size-full object-cover"
        />
      ) : (
        <span className="flex size-full items-center justify-center text-[11px] text-chalk">
          {attempt.status === "PENDING" || attempt.status === "RUNNING"
            ? "…"
            : "—"}
        </span>
      )}
      {attempt.decision === "APPROVED" ? (
        <span className="absolute inset-inline-end-0 top-0 bg-zari px-1 text-[10px] text-indigo">
          ✓
        </span>
      ) : null}
    </button>
  );
}

export function HeroLoopPanel({ data: initial }: { data: HeroLoopPageData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState(initial);
  const [selectedId, setSelectedId] = useState(initial.selectedAttemptId);
  const [prompt, setPrompt] = useState(initial.prompt);
  const [notes, setNotes] = useState("");
  const [modelId, setModelId] = useState(initial.modelId);
  const [controlsOpen, setControlsOpen] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoomSketch, setZoomSketch] = useState(false);

  const stripAttempts = useMemo(
    () => data.attempts.slice(0, 4),
    [data.attempts],
  );

  const selected = useMemo(
    () => data.attempts.find((a) => a.id === selectedId) ?? data.attempts[0],
    [data.attempts, selectedId],
  );

  useEffect(() => {
    if (selected) {
      setPrompt(selected.prompt);
      setModelId(selected.modelId);
    }
  }, [selected]);

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (!data.isGenerating) return;
    const id = window.setInterval(() => {
      void pollHeroLoop(data.designId).then((res) => {
        if (!res.ok) return;
        setData((prev) => ({
          ...prev,
          status: res.data.status,
          isGenerating: res.data.isGenerating,
          attempts: res.data.attempts,
          designSpendUsdMicros: res.data.designSpendUsdMicros,
          attemptCount: res.data.attemptCount,
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

  const hasAttempts = data.attempts.length > 0;
  const canAct = selected && !data.heroLocked && selected.status === "SUCCEEDED";

  return (
    <div className="flex flex-col gap-4">
      <StudioCostMeter
        designSpendUsdMicros={data.designSpendUsdMicros}
        attemptCount={data.attemptCount}
        monthlySpendUsdMicros={data.monthlySpendUsdMicros}
        monthlyCapUsdMicros={data.monthlyCapUsdMicros}
      />

      <div className="flex flex-wrap items-center gap-2 text-[12px] text-chalk">
        <span>Status: {data.status.replaceAll("_", " ")}</span>
        {data.heroLocked ? (
          <span className="border border-zari px-2 py-0.5 text-zari">Hero locked</span>
        ) : null}
      </div>

      {error ? (
        <p className="text-[13px] text-madder" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(200px,280px)_1fr_auto]">
        {/* Sketch — pinned left 1:1 with hover zoom */}
        <div
          className="relative aspect-square overflow-hidden border border-indigo-lift bg-indigo-lift"
          onMouseEnter={() => setZoomSketch(true)}
          onMouseLeave={() => setZoomSketch(false)}
        >
          {data.sketchReadUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.sketchReadUrl}
              alt="Front sketch"
              className={cn(
                "size-full object-contain transition-transform duration-200",
                zoomSketch && "scale-150",
              )}
            />
          ) : (
            <p className="flex size-full items-center justify-center p-4 text-center text-[12px] text-chalk">
              No sketch — upload inputs first
            </p>
          )}
        </div>

        {/* Generated hero — large right */}
        <div className="relative min-h-[320px] border border-indigo-lift bg-indigo-lift">
          {selected?.outputReadUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={selected.outputReadUrl}
              alt="Generated hero"
              className="size-full object-contain"
            />
          ) : selected?.status === "PENDING" || selected?.status === "RUNNING" ? (
            <p className="flex size-full items-center justify-center text-[13px] text-chalk">
              Generating hero…
            </p>
          ) : (
            <p className="flex size-full items-center justify-center text-[13px] text-chalk">
              {hasAttempts ? "Generation failed or pending" : "Generate your first hero"}
            </p>
          )}
          {selected?.error ? (
            <p className="absolute inset-inline-start-0 bottom-0 bg-indigo/90 p-2 text-[11px] text-madder">
              {selected.error}
            </p>
          ) : null}
        </div>

        {/* Collapsible prompt rail */}
        <aside
          className={cn(
            "border border-indigo-lift bg-indigo transition-[width]",
            controlsOpen ? "w-72" : "w-10",
          )}
        >
          <button
            type="button"
            className="w-full border-b border-indigo-lift px-2 py-2 text-[12px] text-chalk"
            onClick={() => setControlsOpen((o) => !o)}
          >
            {controlsOpen ? "Hide controls" : "▸"}
          </button>
          {controlsOpen ? (
            <div className="flex flex-col gap-3 p-3">
              <label className="flex flex-col gap-1 text-[12px] text-chalk">
                Model
                <select
                  className={fieldClass}
                  value={modelId}
                  disabled={data.heroLocked || pending}
                  onChange={(e) => setModelId(e.target.value)}
                >
                  {data.modelOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-[12px] text-chalk">
                Prompt
                <textarea
                  className={cn(fieldClass, "min-h-32 resize-y font-mono text-[11px]")}
                  value={prompt}
                  disabled={data.heroLocked || pending}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </label>
              {selected?.seed != null ? (
                <p className="text-[11px] text-chalk">Seed: {selected.seed}</p>
              ) : null}
              {selected ? (
                <p className="text-[11px] text-chalk">
                  Cost: {formatUsd(selected.costUsdMicros)}
                </p>
              ) : null}
            </div>
          ) : null}
        </aside>
      </div>

      {/* Last 4 attempts strip */}
      {stripAttempts.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {stripAttempts.map((a) => (
            <AttemptThumb
              key={a.id}
              attempt={a}
              selected={a.id === selectedId}
              onSelect={() => setSelectedId(a.id)}
            />
          ))}
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {!hasAttempts && !data.heroLocked ? (
          <button
            type="button"
            disabled={pending || !data.sketchReadUrl}
            className="border border-zari bg-zari px-4 py-2 text-[13px] text-indigo disabled:opacity-50"
            onClick={() =>
              run(async () => startHeroGeneration(data.designId))
            }
          >
            Generate hero
          </button>
        ) : null}

        {canAct ? (
          <>
            <button
              type="button"
              disabled={pending}
              className="border border-zari bg-zari px-3 py-1.5 text-[13px] text-indigo"
              onClick={() =>
                run(async () =>
                  approveHeroAttempt({
                    designId: data.designId,
                    attemptId: selected!.id,
                  }),
                )
              }
            >
              Approve
            </button>
            <button
              type="button"
              disabled={pending}
              className="border border-indigo-lift px-3 py-1.5 text-[13px] text-greige"
              onClick={() =>
                run(async () =>
                  rejectHeroAttempt({
                    designId: data.designId,
                    attemptId: selected!.id,
                  }),
                )
              }
            >
              Reject
            </button>
          </>
        ) : null}

        {!data.heroLocked && hasAttempts && selected ? (
          <>
            <div className="flex w-full flex-wrap items-end gap-2 border-t border-indigo-lift pt-3">
              <label className="min-w-[200px] flex-1 text-[12px] text-chalk">
                Regenerate with notes
                <input
                  className={cn(fieldClass, "mt-1")}
                  value={notes}
                  disabled={pending}
                  placeholder="Sleeves too short, embroidery too high…"
                  onChange={(e) => setNotes(e.target.value)}
                />
              </label>
              <button
                type="button"
                disabled={pending || !notes.trim()}
                className="border border-indigo-lift px-3 py-1.5 text-[13px] text-greige disabled:opacity-50"
                onClick={() =>
                  run(async () =>
                    regenerateHeroWithNotes({
                      designId: data.designId,
                      attemptId: selected.id,
                      notes,
                      modelId,
                    }),
                  )
                }
              >
                Regenerate with notes
              </button>
              <button
                type="button"
                disabled={pending}
                className="border border-indigo-lift px-3 py-1.5 text-[13px] text-greige"
                onClick={() =>
                  run(async () =>
                    regenerateHeroSameSeed({
                      designId: data.designId,
                      attemptId: selected.id,
                      prompt,
                      modelId,
                    }),
                  )
                }
              >
                Same seed, edited prompt
              </button>
              <button
                type="button"
                disabled={pending || modelId === selected.modelId}
                className="border border-indigo-lift px-3 py-1.5 text-[13px] text-greige disabled:opacity-50"
                onClick={() =>
                  run(async () =>
                    switchModelAndRegenerate({
                      designId: data.designId,
                      attemptId: selected.id,
                      modelId,
                    }),
                  )
                }
              >
                Switch model
              </button>
            </div>
          </>
        ) : null}

        <a
          href={`/admin/studio/${data.designId}/inputs`}
          className="ms-auto border border-indigo-lift px-3 py-1.5 text-[13px] text-chalk"
        >
          ← Inputs
        </a>
      </div>
    </div>
  );
}
