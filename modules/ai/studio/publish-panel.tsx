"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { DESIGN_TAG_VALUES } from "@aks/shared";

import { publishStudioDesign, type PublishPageData } from "./publish-actions";
import { StudioCostMeter } from "./cost-meter";

export function PublishPanel({ data }: { data: PublishPageData }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const allPassed = data.checklist.allPassed;
  const isPublished = data.status === "PUBLISHED";

  return (
    <div className="flex flex-col gap-4">
      <StudioCostMeter
        designSpendUsdMicros={data.designSpendUsdMicros}
        attemptCount={data.attemptCount}
        monthlySpendUsdMicros={data.monthlySpendUsdMicros}
        monthlyCapUsdMicros={data.monthlyCapUsdMicros}
      />

      {data.externalReferencesFlagged ? (
        <p className="border border-madder bg-indigo px-3 py-2 text-[13px] text-madder">
          This design used external references — confirm IP attestation before publishing.
        </p>
      ) : null}

      <div className="border border-indigo-lift bg-indigo p-4">
        <p className="mb-3 text-[11px] uppercase tracking-[0.12em] text-chalk">
          Publish checklist
        </p>
        <ul className="flex flex-col gap-2">
          {data.checklist.items.map((item) => (
            <li
              key={item.id}
              className="flex flex-wrap items-baseline gap-2 text-[13px]"
            >
              <span
                className={
                  item.passed ? "text-zari" : "text-madder"
                }
                aria-hidden
              >
                {item.passed ? "✓" : "○"}
              </span>
              <span className={item.passed ? "text-greige" : "text-chalk"}>
                {item.label}
              </span>
              {item.detail ? (
                <span className="text-[11px] text-chalk">— {item.detail}</span>
              ) : null}
            </li>
          ))}
        </ul>
      </div>

      {data.checklist.modelDisclosure ? (
        <div className="border border-indigo-lift bg-indigo p-4">
          <p className="mb-2 text-[11px] uppercase tracking-[0.12em] text-chalk">
            Model disclosure (storefront)
          </p>
          <p className="text-[13px] leading-relaxed text-greige">
            {data.checklist.modelDisclosure}
          </p>
        </div>
      ) : null}

      <p className="text-[12px] text-chalk">
        Commercial fields (price, metres, lead time, tags) can be set on{" "}
        <a
          href={`/admin/designs/${data.designId}`}
          className="border-b border-zari text-zari"
        >
          the design editor
        </a>
        . Required tag values include occasion (
        {DESIGN_TAG_VALUES.OCCASION.slice(0, 3).join(", ")}…), season, and work.
      </p>

      {error ? (
        <p className="text-[13px] text-madder" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="text-[13px] text-zari" role="status">
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!isPublished && data.status === "READY_TO_PUBLISH" ? (
          <button
            type="button"
            disabled={pending || !allPassed}
            className="border border-zari bg-zari px-4 py-2 text-[13px] text-indigo disabled:opacity-50"
            onClick={() => {
              setError(null);
              setMessage(null);
              startTransition(async () => {
                const res = await publishStudioDesign(data.designId);
                if (!res.ok) {
                  setError(res.error);
                  return;
                }
                setMessage("Published — live on storefront.");
                router.refresh();
              });
            }}
          >
            {allPassed ? "Publish design" : "Complete checklist to publish"}
          </button>
        ) : null}

        {isPublished ? (
          <a
            href={`/designs/${data.slug}`}
            className="border border-zari bg-zari px-4 py-2 text-[13px] text-indigo"
          >
            View on storefront
          </a>
        ) : null}

        <a
          href={`/admin/studio/${data.designId}/colourways`}
          className="border border-indigo-lift px-3 py-1.5 text-[13px] text-chalk"
        >
          ← Colourways
        </a>
      </div>
    </div>
  );
}
