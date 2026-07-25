"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import {
  generateTryOnShareCard,
  getTryOnAvailability,
  getTryOnSessionStatus,
  markTryOnConversion,
  startTryOnSession,
  switchTryOnColourway,
  type TryOnAngleResult,
  type TryOnAvailability,
} from "@/modules/tryon/actions";
import { TRYON_GALLERY_ANGLES } from "@/modules/tryon/types";

type Props = {
  designId: string;
  designName: string;
  colourwayId: string;
  archetypeId: string | null;
  colourways: { id: string; name: string }[];
  onColourwayChange?: (colourwayId: string) => void;
  onAddToCart?: () => void;
};

const ANGLE_LABELS: Record<(typeof TRYON_GALLERY_ANGLES)[number], string> = {
  FRONT: "Front",
  THREE_QUARTER: "Three-quarter",
  BACK: "Back",
};

export function ReflectionPanel({
  designId,
  designName,
  colourwayId,
  archetypeId,
  colourways,
  onColourwayChange,
  onAddToCart,
}: Props) {
  const [open, setOpen] = useState(false);
  const [availability, setAvailability] = useState<TryOnAvailability | null>(
    null,
  );
  const [consentChecked, setConsentChecked] = useState(false);
  const [attestationChecked, setAttestationChecked] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [results, setResults] = useState<TryOnAngleResult[]>([]);
  const [activeAngle, setActiveAngle] = useState<
    (typeof TRYON_GALLERY_ANGLES)[number]
  >("FRONT");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void getTryOnAvailability().then(setAvailability);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const pollSession = useCallback((id: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      void getTryOnSessionStatus(id).then((status) => {
        if (status.status === "SUCCEEDED" || status.status === "FAILED") {
          if (pollRef.current) clearInterval(pollRef.current);
        }
        setResults(status.results);
        if (status.error) setError(status.error);
      });
    }, 1500);
  }, []);

  function handleUpload(file: File) {
    setError(null);
    startTransition(async () => {
      const presignRes = await fetch("/api/assets/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type }),
      });
      if (!presignRes.ok) {
        setError("Upload failed — please try again.");
        return;
      }
      const { url, key } = (await presignRes.json()) as {
        url: string;
        key: string;
      };

      const putRes = await fetch(url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) {
        setError("Upload failed — please try again.");
        return;
      }

      const result = await startTryOnSession({
        designId,
        colourwayId,
        archetypeId,
        assetKey: key,
        mime: file.type,
        consentGranted: consentChecked,
        attestationConfirmed: attestationChecked,
        consentVersion: availability?.consentVersion ?? 1,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setSessionId(result.sessionId);
      setResults(result.results);
      if (process.env.NODE_ENV !== "test") {
        pollSession(result.sessionId);
      }
    });
  }

  function handleColourSwitch(nextColourwayId: string) {
    if (!sessionId) {
      onColourwayChange?.(nextColourwayId);
      return;
    }
    startTransition(async () => {
      const result = await switchTryOnColourway({
        sessionId,
        colourwayId: nextColourwayId,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSessionId(result.sessionId);
      setResults(result.results);
      onColourwayChange?.(nextColourwayId);
    });
  }

  function handleShare() {
    if (!sessionId) return;
    startTransition(async () => {
      const result = await generateTryOnShareCard({
        sessionId,
        angle: activeAngle,
        designName,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      window.open(result.url, "_blank");
    });
  }

  function handleAddToCartClick() {
    if (sessionId) void markTryOnConversion(sessionId);
    onAddToCart?.();
  }

  const activeResult = results.find((r) => r.angle === activeAngle);
  const unavailable = availability && !availability.available;

  return (
    <div className="mt-8 border border-greige-deep">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-start"
      >
        <span>
          <span className="block font-display text-[18px] text-ink">
            Reflection
          </span>
          <span className="text-[13px] text-ink/60">
            Try it on — see yourself in this design
          </span>
        </span>
        <span className="text-[13px] text-madder">{open ? "−" : "+"}</span>
      </button>

      {open ? (
        <div className="border-t border-greige-deep px-4 py-5">
          {unavailable ? (
            <p className="text-[14px] text-ink/70">
              {availability.message ?? "Reflection is resting — back shortly."}
            </p>
          ) : (
            <>
              {!sessionId ? (
                <div className="flex flex-col gap-4">
                  {availability?.consentCopy.body.map((line) => (
                    <p key={line} className="text-[13px] leading-relaxed text-ink/70">
                      {line}
                    </p>
                  ))}
                  <label className="flex items-start gap-2 text-[13px] text-ink">
                    <input
                      type="checkbox"
                      checked={consentChecked}
                      onChange={(e) => setConsentChecked(e.target.checked)}
                      className="mt-0.5"
                    />
                    {availability?.consentCopy.checkbox}
                  </label>
                  <label className="flex items-start gap-2 text-[13px] text-ink">
                    <input
                      type="checkbox"
                      checked={attestationChecked}
                      onChange={(e) => setAttestationChecked(e.target.checked)}
                      className="mt-0.5"
                    />
                    {availability?.consentCopy.attestation}
                  </label>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(file);
                    }}
                  />
                  <button
                    type="button"
                    disabled={
                      pending || !consentChecked || !attestationChecked
                    }
                    onClick={() => fileRef.current?.click()}
                    className="self-start border border-indigo bg-indigo px-4 py-2 text-[13px] text-greige"
                  >
                    {pending ? "Personalising…" : "Upload selfie"}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {activeResult?.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={activeResult.url}
                      alt={`${designName} — ${ANGLE_LABELS[activeAngle]}`}
                      className="mx-auto max-h-[480px] w-full max-w-md object-contain"
                    />
                  ) : (
                    <p className="text-[13px] text-ink/60">Generating…</p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {TRYON_GALLERY_ANGLES.map((angle) => (
                      <button
                        key={angle}
                        type="button"
                        onClick={() => setActiveAngle(angle)}
                        className={`border px-3 py-1 text-[12px] ${
                          activeAngle === angle
                            ? "border-indigo bg-indigo text-greige"
                            : "border-greige-deep text-ink"
                        }`}
                      >
                        {ANGLE_LABELS[angle]}
                        {results.find((r) => r.angle === angle)?.fromCache
                          ? " · cached"
                          : ""}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {colourways.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        disabled={pending}
                        onClick={() => handleColourSwitch(c.id)}
                        className={`border px-2 py-1 text-[12px] ${
                          c.id === colourwayId
                            ? "border-zari text-zari"
                            : "border-greige-deep text-ink/70"
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleShare}
                      disabled={pending || !activeResult?.url}
                      className="border border-greige-deep px-3 py-1.5 text-[13px] text-ink"
                    >
                      Share on WhatsApp
                    </button>
                    <button
                      type="button"
                      onClick={handleAddToCartClick}
                      className="border border-indigo bg-indigo px-3 py-1.5 text-[13px] text-greige"
                    >
                      Add to cart
                    </button>
                  </div>
                </div>
              )}

              {error ? (
                <p className="mt-3 text-[13px] text-madder">{error}</p>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
