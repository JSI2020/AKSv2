"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

import {
  approveAngleAttempt,
  lockAngles,
  pollAnglesLoop,
  regenerateAngleWithNotes,
  rejectAngleAttempt,
  type AngleSlot,
  type AnglesPageData,
} from "./angle-actions";
import type { AngleTarget } from "./angle-prompt";
import { StudioCostMeter } from "./cost-meter";

const fieldClass =
  "border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige outline-none focus:border-zari w-full";

const ANGLE_DISPLAY: Record<string, string> = {
  FRONT: "Front",
  THREE_QUARTER: "Three-quarter",
  BACK: "Back",
};

function AngleCard({
  slot,
  readOnly,
  pending,
  notes,
  onNotesChange,
  onApprove,
  onReject,
  onRegenerate,
}: {
  slot: AngleSlot;
  readOnly: boolean;
  pending: boolean;
  notes: string;
  onNotesChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
  onRegenerate: () => void;
}) {
  const isDerived = slot.angle !== "FRONT";
  const canAct =
    isDerived &&
    !readOnly &&
    slot.status === "SUCCEEDED" &&
    slot.generationId;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          {ANGLE_DISPLAY[slot.angle] ?? slot.angle}
        </p>
        {slot.isMaster ? (
          <span className="border border-zari px-2 py-0.5 text-[10px] text-zari">
            Master
          </span>
        ) : null}
      </div>

      {slot.sourceLabel ? (
        <p className="text-[11px] text-chalk">{slot.sourceLabel}</p>
      ) : null}

      <div className="relative aspect-[3/4] min-h-[280px] border border-indigo-lift bg-indigo-lift">
        {slot.outputReadUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={slot.outputReadUrl}
            alt={ANGLE_DISPLAY[slot.angle] ?? slot.angle}
            className="size-full object-contain"
          />
        ) : slot.status === "PENDING" || slot.status === "RUNNING" ? (
          <p className="flex size-full items-center justify-center text-[13px] text-chalk">
            Generating…
          </p>
        ) : (
          <p className="flex size-full items-center justify-center text-[13px] text-chalk">
            Waiting for generation
          </p>
        )}
        {slot.error ? (
          <p className="absolute inset-inline-start-0 bottom-0 bg-indigo/90 p-2 text-[11px] text-madder">
            {slot.error}
          </p>
        ) : null}
      </div>

      {slot.decision === "APPROVED" ? (
        <span className="text-[11px] text-zari">Approved</span>
      ) : slot.decision === "REJECTED" ? (
        <span className="text-[11px] text-madder">Rejected</span>
      ) : null}

      {canAct ? (
        <div className="flex flex-col gap-2 border-t border-indigo-lift pt-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              className="border border-zari bg-zari px-3 py-1.5 text-[13px] text-indigo"
              onClick={onApprove}
            >
              Approve
            </button>
            <button
              type="button"
              disabled={pending}
              className="border border-indigo-lift px-3 py-1.5 text-[13px] text-greige"
              onClick={onReject}
            >
              Reject
            </button>
          </div>
          <label className="text-[12px] text-chalk">
            Regenerate with notes
            <input
              className={cn(fieldClass, "mt-1")}
              value={notes}
              disabled={pending}
              placeholder="Embroidery placement, hem length…"
              onChange={(e) => onNotesChange(e.target.value)}
            />
          </label>
          <button
            type="button"
            disabled={pending || !notes.trim()}
            className="border border-indigo-lift px-3 py-1.5 text-[13px] text-greige disabled:opacity-50"
            onClick={onRegenerate}
          >
            Regenerate from hero
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function AnglesPanel({ data: initial }: { data: AnglesPageData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [data, setData] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [notesByAngle, setNotesByAngle] = useState<Record<string, string>>({
    THREE_QUARTER: "",
    BACK: "",
  });

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  useEffect(() => {
    if (!data.isGenerating) return;
    const id = window.setInterval(() => {
      void pollAnglesLoop(data.designId).then((res) => {
        if (!res.ok) return;
        setData((prev) => ({
          ...prev,
          status: res.data.status,
          isGenerating: res.data.isGenerating,
          slots: res.data.slots,
          canLock: res.data.canLock,
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

      <div className="flex flex-wrap items-center gap-2 text-[12px] text-chalk">
        <span>Status: {data.status.replaceAll("_", " ")}</span>
        {data.readOnly ? (
          <span className="border border-zari px-2 py-0.5 text-zari">
            Angles locked
          </span>
        ) : null}
      </div>

      {error ? (
        <p className="text-[13px] text-madder" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {data.slots.map((slot) => (
          <AngleCard
            key={slot.angle}
            slot={slot}
            readOnly={data.readOnly}
            pending={pending}
            notes={notesByAngle[slot.angle] ?? ""}
            onNotesChange={(value) =>
              setNotesByAngle((prev) => ({ ...prev, [slot.angle]: value }))
            }
            onApprove={() =>
              run(async () =>
                approveAngleAttempt({
                  designId: data.designId,
                  generationId: slot.generationId!,
                }),
              )
            }
            onReject={() =>
              run(async () =>
                rejectAngleAttempt({
                  designId: data.designId,
                  generationId: slot.generationId!,
                }),
              )
            }
            onRegenerate={() =>
              run(async () =>
                regenerateAngleWithNotes({
                  designId: data.designId,
                  angle: slot.angle as AngleTarget,
                  notes: notesByAngle[slot.angle] ?? "",
                }),
              )
            }
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {data.canLock && !data.readOnly ? (
          <button
            type="button"
            disabled={pending}
            className="border border-zari bg-zari px-4 py-2 text-[13px] text-indigo"
            onClick={() => run(async () => lockAngles(data.designId))}
          >
            Lock all angles
          </button>
        ) : null}

        <a
          href={`/admin/studio/${data.designId}/sizing`}
          className="border border-indigo-lift px-3 py-1.5 text-[13px] text-chalk"
        >
          ← Sizing
        </a>
      </div>
    </div>
  );
}
