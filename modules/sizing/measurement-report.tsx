"use client";

import { POM_LABELS } from "@/modules/dress-sizing/ui/labels";
import { cn } from "@/lib/utils";

/**
 * One report of what a photo actually measured — shared by every sizing
 * surface so Designs and AI Studio explain themselves identically.
 *
 * It answers the three questions a person asks after pressing "recognise":
 * did it measure my photo or fall back to the template, what did it read for
 * each row, and how far does this piece sit from the house standard.
 */

export type MeasurementDetailRow = {
  pomKey: string;
  measured: number | null;
  prior: number;
  delta: number;
  flagged: boolean;
};

export type MeasurementReportData = {
  /** Which image the spans were read from. */
  measuredOn?: "ghost" | "photo";
  captureContext: string;
  anchor: string;
  corrected: number;
  flagged: number;
  warnings: string[];
  detail: MeasurementDetailRow[];
};

function label(pomKey: string): string {
  return POM_LABELS[pomKey as keyof typeof POM_LABELS] ?? pomKey;
}

function inches(hundredths: number): string {
  return (hundredths / 100).toFixed(2);
}

export function MeasurementReport({
  data,
  tone = "dark",
  className,
}: {
  /** Null when the photo could not be measured at all. */
  data: MeasurementReportData | null;
  tone?: "light" | "dark";
  className?: string;
}) {
  const dark = tone === "dark";
  const muted = dark ? "text-chalk" : "text-ink/55";
  const body = dark ? "text-greige" : "text-ink";
  const line = dark ? "border-indigo-lift" : "border-ink/12";

  if (!data) {
    return (
      <p className={cn("border px-3 py-2 text-[12px]", line, muted, className)}>
        <span className="text-madder">Photo could not be measured</span> — the
        chart came from the house style template alone. Nothing was invented.
      </p>
    );
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <p className={cn("border px-3 py-2 text-[12px]", line, muted)}>
        <span className="text-zari">
          {data.measuredOn === "ghost"
            ? "Measured on the ghost mannequin"
            : "Measured from the photo"}
        </span>{" "}
        ({data.captureContext.replace("_", " ")}, scaled on{" "}
        {data.anchor === "person_height" ? "model height" : "garment length"}) —{" "}
        {data.corrected} measurement{data.corrected === 1 ? "" : "s"} corrected
        against the house template
        {data.flagged > 0 ? `, ${data.flagged} rejected as implausible` : ""}.
      </p>

      {data.warnings.map((w) => (
        <p
          key={w}
          className="border border-madder/40 px-3 py-2 text-[12px] text-madder"
        >
          {w}
        </p>
      ))}

      {data.detail.length > 0 ? (
        <details className={cn("border px-3 py-2 text-[12px]", line, muted)}>
          <summary className={cn("cursor-pointer", body)}>
            What the photo measured, row by row
          </summary>
          <table className="mt-2 w-full border-collapse text-[11.5px]">
            <thead>
              <tr className={muted}>
                <th className="py-1 text-start font-normal">Row</th>
                <th className="py-1 text-end font-normal">Photo</th>
                <th className="py-1 text-end font-normal">Template</th>
                <th className="py-1 text-end font-normal">Applied</th>
              </tr>
            </thead>
            <tbody className="font-data">
              {data.detail.map((d) => (
                <tr key={d.pomKey} className={cn("border-t", line)}>
                  <td className={cn("py-1", body)}>{label(d.pomKey)}</td>
                  <td className="py-1 text-end">
                    {d.measured == null ? "not measured" : inches(d.measured)}
                  </td>
                  <td className="py-1 text-end">{inches(d.prior)}</td>
                  <td className="py-1 text-end">
                    {d.flagged ? (
                      <span className="text-madder">rejected · 3σ</span>
                    ) : d.delta === 0 ? (
                      "—"
                    ) : (
                      <span className="text-zari">
                        {d.delta > 0 ? "+" : ""}
                        {inches(d.delta)}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ) : null}
    </div>
  );
}
