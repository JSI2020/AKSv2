"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";

import {
  addDesignInput,
  removeDesignInput,
  resetDesignOriginToInferred,
  setDesignOriginOverride,
  updateDesignInput,
  type DesignInputRow,
  type DesignInputsPageData,
} from "./input-actions";
import {
  inferPromptProfileOrigin,
  ORIGIN_HINTS,
  ORIGIN_LABELS,
  type PromptProfileOrigin,
} from "./infer-origin";
import { buildInputSummary } from "./input-summary";
import {
  DESIGN_INPUT_ROLE_LABELS,
  DESIGN_INPUT_ROLES,
  EXTERNAL_ATTESTATION_STATEMENT,
  inferRoleFromFilename,
  type DesignInputRole,
} from "./input-roles";

const fieldClass =
  "border border-indigo-lift bg-indigo px-2 py-1.5 text-[13px] text-greige outline-none focus:border-zari w-full";

type PendingExternal = {
  file: File;
  assetId?: string;
  role: DesignInputRole;
};

async function uploadAsset(file: File): Promise<string> {
  const presignRes = await fetch("/api/assets/presign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contentType: file.type || "application/octet-stream",
    }),
  });
  if (!presignRes.ok) throw new Error("Could not prepare upload.");
  const { url, key } = (await presignRes.json()) as { url: string; key: string };

  const put = await fetch(url, {
    method: "PUT",
    headers: { "content-type": file.type || "application/octet-stream" },
    body: file,
  });
  if (!put.ok) throw new Error(`Upload failed (${put.status}).`);

  const completeRes = await fetch("/api/assets/complete", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      key,
      mime: file.type || "application/octet-stream",
    }),
  });
  if (!completeRes.ok) throw new Error("Could not finalize upload.");
  const data = (await completeRes.json()) as { asset: { id: string } };
  return data.asset.id;
}

function InputCard({
  row,
  pending,
  onRoleChange,
  onWeightChange,
  onRemove,
  onAttestRoleChange,
}: {
  row: DesignInputRow;
  pending: boolean;
  onRoleChange: (role: DesignInputRole) => void;
  onWeightChange: (weight: number) => void;
  onRemove: () => void;
  onAttestRoleChange: (role: DesignInputRole) => void;
}) {
  return (
    <article className="border border-indigo-lift p-3">
      <div className="flex gap-3">
        <div className="relative h-24 w-20 shrink-0 border border-indigo-lift bg-indigo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={row.derivedReadUrl ?? row.assetReadUrl}
            alt=""
            className="h-full w-full object-contain"
          />
          {row.derivedReadUrl ? (
            <span className="absolute inset-inline-end-0 top-0 bg-indigo px-1 text-[10px] text-chalk">
              lineart
            </span>
          ) : null}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <p className="truncate text-[12px] text-chalk">{row.filenameHint}</p>
          <select
            className={fieldClass}
            value={row.role}
            disabled={pending}
            onChange={(e) => {
              const role = e.target.value as DesignInputRole;
              if (role === "REFERENCE_EXTERNAL" && !row.attestationId) {
                onAttestRoleChange(role);
                return;
              }
              onRoleChange(role);
            }}
          >
            {DESIGN_INPUT_ROLES.map((r) => (
              <option key={r} value={r}>
                {DESIGN_INPUT_ROLE_LABELS[r]}
              </option>
            ))}
          </select>
          <label className="flex flex-col gap-1 text-[12px] text-chalk">
            Weight {(row.weight / 100).toFixed(2)}
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={row.weight}
              disabled={pending}
              className="accent-zari"
              onChange={(e) => onWeightChange(Number(e.target.value))}
            />
          </label>
          {row.role === "REFERENCE_EXTERNAL" ? (
            <p className="text-[11px] text-madder">
              External · purged on schedule · publish review required
            </p>
          ) : null}
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={onRemove}
          className="self-start border border-indigo-lift px-2 py-1 text-[12px] text-chalk hover:border-madder hover:text-madder disabled:opacity-50"
        >
          Remove
        </button>
      </div>
    </article>
  );
}

function ExternalAttestationDialog({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [checked, setChecked] = useState(false);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 p-4">
      <div
        role="dialog"
        aria-labelledby="attestation-title"
        className="max-w-md border border-indigo-lift bg-indigo p-4"
      >
        <h2 id="attestation-title" className="font-display text-xl text-greige">
          External reference
        </h2>
        <p className="mt-2 text-[13px] text-chalk">
          Use references for mood, not to reproduce someone else&apos;s design.
        </p>
        <label className="mt-4 flex items-start gap-2 text-[13px] text-greige">
          <input
            type="checkbox"
            checked={checked}
            onChange={(e) => setChecked(e.target.checked)}
            className="mt-0.5 accent-zari"
          />
          <span>{EXTERNAL_ATTESTATION_STATEMENT}</span>
        </label>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="border border-indigo-lift px-3 py-1.5 text-[13px] text-chalk"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!checked}
            onClick={onConfirm}
            className="border border-zari bg-zari px-3 py-1.5 text-[13px] text-indigo disabled:opacity-50"
          >
            Confirm attestation
          </button>
        </div>
      </div>
    </div>
  );
}

export function DesignInputsPanel({ data }: { data: DesignInputsPageData }) {
  const router = useRouter();
  const [inputs, setInputs] = useState(data.inputs);
  const [origin, setOrigin] = useState(data.origin);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pendingExternal, setPendingExternal] = useState<PendingExternal | null>(
    null,
  );
  const [attestForInputId, setAttestForInputId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setInputs(data.inputs);
    setOrigin(data.origin);
  }, [data.inputs, data.origin]);

  const inferredOrigin = useMemo(
    () => inferPromptProfileOrigin(inputs.map((i) => i.role)),
    [inputs],
  );

  const summary = useMemo(
    () => buildInputSummary(inputs.map((i) => ({ role: i.role }))),
    [inputs],
  );

  const refresh = useCallback(() => {
    router.refresh();
  }, [router]);

  const processFiles = useCallback(
    async (files: FileList | File[]) => {
      setError(null);
      setUploading(true);
      try {
        for (const file of Array.from(files)) {
          if (!file.type.startsWith("image/")) {
            setError("Only image files are supported.");
            continue;
          }

          const role = inferRoleFromFilename(file.name);
          const assetId = await uploadAsset(file);

          if (role === "REFERENCE_EXTERNAL") {
            setPendingExternal({ file, assetId, role });
            setUploading(false);
            return;
          }

          const res = await addDesignInput({
            designId: data.designId,
            assetId,
            role,
            weight: 100,
          });
          if (!res.ok) {
            setError(res.error);
            continue;
          }
        }
        refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading(false);
      }
    },
    [data.designId, refresh],
  );

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) void processFiles(e.dataTransfer.files);
  }

  function confirmExternalAttestation() {
    if (!pendingExternal?.assetId) return;
    startTransition(async () => {
      const res = await addDesignInput({
        designId: data.designId,
        assetId: pendingExternal.assetId!,
        role: "REFERENCE_EXTERNAL",
        weight: 100,
        externalAttestationConfirmed: true,
      });
      setPendingExternal(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      refresh();
    });
  }

  function confirmAttestForExistingInput() {
    if (!attestForInputId) return;
    startTransition(async () => {
      const res = await updateDesignInput({
        inputId: attestForInputId,
        role: "REFERENCE_EXTERNAL",
        externalAttestationConfirmed: true,
      });
      setAttestForInputId(null);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <ExternalAttestationDialog
        open={Boolean(pendingExternal)}
        onCancel={() => setPendingExternal(null)}
        onConfirm={confirmExternalAttestation}
      />
      <ExternalAttestationDialog
        open={Boolean(attestForInputId)}
        onCancel={() => setAttestForInputId(null)}
        onConfirm={confirmAttestForExistingInput}
      />

      {data.externalReferencesFlagged ? (
        <p className="border border-madder px-3 py-2 text-[13px] text-madder">
          This design uses external references — publish review cannot be skipped.
          References are shown at the publish gate and purged on schedule.
        </p>
      ) : null}

      <section className="border border-indigo-lift p-4">
        <p className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          Mode
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <select
            className={cn(fieldClass, "max-w-xs")}
            value={origin}
            disabled={pending}
            onChange={(e) => {
              const next = e.target.value as PromptProfileOrigin;
              setOrigin(next);
              startTransition(async () => {
                const res = await setDesignOriginOverride({
                  designId: data.designId,
                  origin: next,
                });
                if (!res.ok) setError(res.error);
                else refresh();
              });
            }}
          >
            {(Object.keys(ORIGIN_LABELS) as PromptProfileOrigin[]).map((o) => (
              <option key={o} value={o}>
                {ORIGIN_LABELS[o]}
                {o === inferredOrigin ? " (inferred)" : ""}
              </option>
            ))}
          </select>
          {origin !== inferredOrigin ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                startTransition(async () => {
                  const res = await resetDesignOriginToInferred(data.designId);
                  if (!res.ok) setError(res.error);
                  else {
                    setOrigin(inferredOrigin);
                    refresh();
                  }
                });
              }}
              className="border border-indigo-lift px-2 py-1 text-[12px] text-chalk"
            >
              Reset to inferred ({ORIGIN_LABELS[inferredOrigin]})
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-[13px] text-chalk">{ORIGIN_HINTS[origin]}</p>
      </section>

      <section
        className={cn(
          "border border-dashed border-indigo-lift p-8 text-center transition-colors",
          dragOver && "border-zari bg-indigo-lift/30",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <p className="text-[13px] text-greige">
          Drop sketches, fabric swatches, or references here
        </p>
        <p className="mt-1 text-[12px] text-chalk">
          Use references for mood, not to reproduce someone else&apos;s design.
        </p>
        <label className="mt-4 inline-block cursor-pointer border border-zari bg-zari px-3 py-1.5 text-[13px] text-indigo">
          Choose files
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            disabled={uploading || pending}
            onChange={(e) => {
              const files = e.target.files;
              if (files?.length) void processFiles(files);
              e.target.value = "";
            }}
          />
        </label>
        {uploading ? (
          <p className="mt-2 text-[12px] text-chalk">Uploading…</p>
        ) : null}
      </section>

      <p className="text-[13px] text-greige">{summary}</p>

      {error ? (
        <p className="text-[13px] text-madder" role="alert">
          {error}
        </p>
      ) : null}

      <div className="grid gap-3">
        {inputs.map((row) => (
          <InputCard
            key={row.id}
            row={row}
            pending={pending}
            onRoleChange={(role) => {
              startTransition(async () => {
                const res = await updateDesignInput({ inputId: row.id, role });
                if (!res.ok) setError(res.error);
                else refresh();
              });
            }}
            onWeightChange={(weight) => {
              setInputs((prev) =>
                prev.map((i) => (i.id === row.id ? { ...i, weight } : i)),
              );
              startTransition(async () => {
                const res = await updateDesignInput({
                  inputId: row.id,
                  weight,
                });
                if (!res.ok) setError(res.error);
              });
            }}
            onRemove={() => {
              startTransition(async () => {
                const res = await removeDesignInput(row.id);
                if (!res.ok) setError(res.error);
                else {
                  setInputs((prev) => prev.filter((i) => i.id !== row.id));
                  refresh();
                }
              });
            }}
            onAttestRoleChange={() => setAttestForInputId(row.id)}
          />
        ))}
      </div>

      {inputs.length > 0 ? (
        <div className="flex gap-3">
          <a
            href={`/admin/studio/${data.designId}`}
            className="border border-zari bg-zari px-4 py-2 text-[13px] text-indigo"
          >
            Continue to hero
          </a>
        </div>
      ) : null}
    </div>
  );
}
