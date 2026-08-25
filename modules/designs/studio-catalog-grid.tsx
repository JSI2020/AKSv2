"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { ConfirmDialog, Money } from "@/modules/ui";

import {
  archiveDesign,
  publishDesign,
  unpublishDesign,
} from "./actions";
import type { StudioCatalogCard, StudioCatalogGroup } from "./studio-catalog";

function StatusPill({ active, status }: { active: boolean; status: string }) {
  return (
    <span
      className={
        active
          ? "bg-zari/15 px-2 py-0.5 font-sans text-[10px] uppercase tracking-[0.12em] text-zari"
          : "bg-ink/5 px-2 py-0.5 font-sans text-[10px] uppercase tracking-[0.12em] text-ink/45"
      }
    >
      {active ? "Active" : "Inactive"}
      <span className="ms-1 opacity-60">· {status.replaceAll("_", " ")}</span>
    </span>
  );
}

function editHref(design: StudioCatalogCard) {
  return `/admin/designs/${design.id}?tab=Preview`;
}

function StudioDesignCard({ design }: { design: StudioCatalogCard }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const href = editHref(design);
  const canPublish =
    design.status === "DRAFT" || design.status === "READY_TO_PUBLISH";
  const isPublished = design.status === "PUBLISHED";

  const sizes =
    design.availableSizeLabels.length > 0
      ? design.availableSizeLabels.join(" · ")
      : null;

  function onDelete() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", design.id);
      const res = await archiveDesign(fd);
      if (res.ok) router.refresh();
    });
  }

  function onPublish() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", design.id);
      const res = await publishDesign(fd);
      if (res.ok) router.refresh();
    });
  }

  function onUnpublish() {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", design.id);
      const res = await unpublishDesign(fd);
      if (res.ok) router.refresh();
    });
  }

  return (
    <article className="flex flex-col border border-ink/10 bg-milk">
      <Link href={href} className="relative aspect-[3/4] bg-ivory">
        {design.thumbnailUrl ? (
          <Image
            src={design.thumbnailUrl}
            alt={design.thumbnailAlt}
            fill
            sizes="(max-width:900px) 50vw, 25vw"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-full items-center justify-center px-4 text-center">
            <p className="font-sans text-[11px] uppercase tracking-[0.14em] text-ink/35">
              No photo
            </p>
          </div>
        )}
        <div className="absolute inset-inline-start-2 top-2">
          <StatusPill active={design.active} status={design.status} />
        </div>
        {design.compareAtPriceMinor != null &&
        design.compareAtPriceMinor > design.basePriceMinor ? (
          <span className="absolute inset-inline-end-2 top-2 bg-ink px-1.5 py-0.5 font-sans text-[10px] uppercase tracking-[0.1em] text-milk">
            −
            {Math.round(
              (1 - design.basePriceMinor / design.compareAtPriceMinor) * 100,
            )}
            %
          </span>
        ) : null}
      </Link>

      <div className="flex flex-1 flex-col gap-2 px-3 py-3">
        <Link href={href} className="block">
          <p className="font-display text-[1.15rem] leading-tight text-ink">
            {design.name}
          </p>
          {design.subtitle ? (
            <p className="mt-0.5 text-[12.5px] text-ink/55">{design.subtitle}</p>
          ) : null}
          <p className="mt-1 font-sans text-[10px] uppercase tracking-[0.1em] text-ink/40">
            {design.categoryName}
          </p>
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-2 pt-1">
          <div>
            {design.basePriceMinor > 0 ? (
              <p className="font-data text-[13px] text-ink">
                <Money value={design.basePriceMinor} />
                {design.compareAtPriceMinor != null &&
                design.compareAtPriceMinor > design.basePriceMinor ? (
                  <span className="ms-2 text-ink/40 line-through">
                    <Money value={design.compareAtPriceMinor} />
                  </span>
                ) : null}
              </p>
            ) : (
              <p className="font-sans text-[11px] uppercase tracking-[0.1em] text-ink/40">
                No price
              </p>
            )}
            <p className="mt-1 font-sans text-[10px] uppercase tracking-[0.1em] text-ink/40">
              {design.colourwayCount} colour
              {design.colourwayCount === 1 ? "" : "s"}
              {sizes ? ` · ${sizes}` : ""}
            </p>
          </div>
          {design.colourwayHexes.length > 0 ? (
            <div className="flex gap-1" aria-hidden>
              {design.colourwayHexes.map((hex) => (
                <span
                  key={hex}
                  className="size-3 border border-ink/15"
                  style={{ backgroundColor: hex }}
                />
              ))}
            </div>
          ) : null}
        </div>

        <div className="mt-auto flex flex-wrap gap-2 border-t border-ink/10 pt-3">
          {isPublished ? (
            <button
              type="button"
              disabled={pending}
              onClick={onUnpublish}
              className="flex-1 border border-ink/20 px-2 py-1.5 text-[12px] text-ink/55 disabled:opacity-50"
            >
              Unpublish
            </button>
          ) : canPublish ? (
            <button
              type="button"
              disabled={pending}
              onClick={onPublish}
              className="flex-1 border border-zari bg-zari px-2 py-1.5 text-[12px] text-indigo disabled:opacity-50"
            >
              Publish
            </button>
          ) : (
            <Link
              href={href}
              className="flex-1 border border-ink/15 px-2 py-1.5 text-center text-[12px] text-ink/55"
            >
              Open
            </Link>
          )}
          <ConfirmDialog
            title="Delete this design?"
            description={`“${design.name}” will be archived.`}
            confirmLabel="Delete"
            trigger={
              <button
                type="button"
                disabled={pending}
                className="flex-1 border border-madder/35 px-2 py-1.5 text-[12px] text-madder disabled:opacity-50"
              >
                Delete
              </button>
            }
            onConfirm={onDelete}
          />
        </div>
      </div>
    </article>
  );
}

export function StudioCatalogGrid({
  groups,
}: {
  groups: StudioCatalogGroup[];
}) {
  const total = groups.reduce((n, g) => n + g.designs.length, 0);

  if (total === 0) {
    return (
      <div className="border border-ink/10 bg-milk px-6 py-12 text-center">
        <p className="font-display text-xl text-ink">No designs yet</p>
        <p className="mt-2 text-[13px] text-ink/55">
          Add a design with photos, sizes, colours, and price — then publish when
          ready.
        </p>
        <Link
          href="/admin/designs/new"
          className="mt-5 inline-block border border-zari bg-zari px-4 py-2 text-[13px] text-indigo"
        >
          New design
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      {groups.map((group) => {
        if (group.designs.length === 0) return null;
        const active = group.designs.filter((d) => d.active).length;
        const inactive = group.designs.length - active;
        return (
          <section key={group.categoryKey} className="flex flex-col gap-4">
            <div className="flex flex-wrap items-end justify-between gap-2 border-b border-ink/10 pb-2">
              <div>
                <p className="font-sans text-[10px] uppercase tracking-[0.2em] text-ink/45">
                  {group.categoryKey}
                </p>
                <h2 className="font-display text-2xl font-light text-ink">
                  {group.categoryName}
                </h2>
              </div>
              <p className="font-sans text-[11px] uppercase tracking-[0.1em] text-ink/45">
                {group.designs.length} design
                {group.designs.length === 1 ? "" : "s"}
                <span className="ms-2 text-zari">{active} active</span>
                <span className="ms-2">{inactive} inactive</span>
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {group.designs.map((d) => (
                <StudioDesignCard key={d.id} design={d} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
