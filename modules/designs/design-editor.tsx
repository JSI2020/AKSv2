"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import { ConfirmDialog, Money } from "@/modules/ui";
import { DesignCostingPanel } from "@/modules/money/design-costing-panel";
import type { DesignCostingData } from "@/modules/money/queries";

import {
  archiveDesign,
  createDesign,
  publishDesign,
  unpublishDesign,
  updateDesignDetails,
  updateDesignPricing,
  updateDesignSizing,
  type DesignDetail,
} from "./actions";
import { DesignPhotosTab } from "./design-photos-tab";
import { DesignSizingTab } from "./design-sizing-tab";
import {
  PricingTab,
  PreviewPublishTab,
} from "./design-price-preview-tabs";
import { houseDoorOptions, isHouseDoorTag } from "./item-number";
import { tabReadiness } from "./tab-readiness";

type FormOptions = {
  categories: { id: string; key: string; name: string }[];
  fabrics: { id: string; name: string; swatchAssetId?: string | null }[];
  blocks: { id: string; name: string; categoryId: string }[];
  profiles: { id: string; name: string; categoryId: string }[];
  archetypes: { id: string; name: string }[];
};

const TABS = [
  "Details",
  "Photos",
  "Sizing",
  "Costing",
  "Price",
  "Preview",
] as const;
type Tab = (typeof TABS)[number];

type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

function fieldClass() {
  return "w-full border border-ink/12 bg-greige/40 px-3 py-2.5 text-[13px] text-ink outline-none focus:border-ink";
}

function Label({ children }: { children: ReactNode }) {
  return (
    <span className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/55">
      {children}
    </span>
  );
}

function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-4 border border-ink/12 bg-milk px-5 py-5">
      <h3 className="mb-4 font-sans text-[10px] uppercase tracking-[0.16em] text-ink/55">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Field({
  label,
  name,
  defaultValue = "",
  required,
  type = "text",
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="mb-4 flex flex-col gap-1.5 last:mb-0">
      <Label>{label}</Label>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        className={fieldClass()}
      />
    </label>
  );
}

function componentKeysOf(detail: DesignDetail): string[] {
  const fromDesign = detail.design.components ?? [];
  if (fromDesign.length > 0) return fromDesign;
  return detail.categoryKey ? [detail.categoryKey] : [];
}

function houseDoorFromTags(tags: DesignDetail["tags"]): string {
  const found = tags.find(
    (t) => t.kind === "FREE" && isHouseDoorTag(t.value),
  );
  return found?.value ?? "";
}

function houseDoorLabel(tag: string): string {
  return houseDoorOptions().find((o) => o.tag === tag)?.label ?? tag;
}

function piecesMeta(components: string[]): string {
  return components.map((c) => c.toUpperCase()).join(" + ");
}

function statusLabel(status: string, isArchived: boolean): string {
  if (isArchived) return "Deleted";
  if (status === "PUBLISHED") return "Published";
  return "Draft";
}

export function CreateDesignForm({ options }: { options: FormOptions }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex max-w-md flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(async () => {
          const res = await createDesign(fd);
          if (!res.ok) {
            setError(res.error);
            return;
          }
          router.push(`/admin/designs/${res.id}`);
          router.refresh();
        });
      }}
    >
      <label className="flex flex-col gap-1.5">
        <Label>Name</Label>
        <input name="name" required className={fieldClass()} />
      </label>
      <label className="flex flex-col gap-1.5">
        <Label>Category</Label>
        <select name="garmentTypeId" required className={fieldClass()}>
          {options.categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.key} — {c.name}
            </option>
          ))}
        </select>
      </label>
      {error ? (
        <p className="text-[13px] text-madder" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="border border-zari bg-zari px-3 py-1.5 text-[13px] text-indigo disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create draft"}
      </button>
    </form>
  );
}

export function DesignEditor({
  detail,
  options,
  costing = null,
  canViewMargin = false,
  canEditCosts = false,
  initialTab,
}: {
  detail: DesignDetail;
  options: FormOptions;
  costing?: DesignCostingData | null;
  canViewMargin?: boolean;
  canEditCosts?: boolean;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab ?? "Details");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const d = detail.design;
  const isArchived = d.status === "ARCHIVED";
  const canPublish = d.status === "DRAFT" || d.status === "READY_TO_PUBLISH";
  const components = componentKeysOf(detail);
  const houseDoor = houseDoorFromTags(detail.tags);
  const readiness = tabReadiness({
    design: {
      name: d.name,
      basePriceMinor: d.basePriceMinor,
      fabricConsumptionMeters: d.fabricConsumptionMeters,
      sizeBlockId: d.sizeBlockId,
      fitProfileIds: d.fitProfileIds,
    },
    colourways: detail.colourways.map((c) => ({ id: c.id, name: c.name })),
    renders: detail.renders.map((r) => ({
      colourwayId: r.colourwayId,
      angle: r.angle,
      altText: r.altText ?? "",
    })),
    tags: detail.tags,
  });

  function run(
    action: (fd: FormData) => Promise<ActionResult>,
    fd: FormData,
    nextTab?: Tab,
  ) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const res = await action(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setMessage("Saved");
      router.refresh();
      if (nextTab) setTab(nextTab);
    });
  }

  function onDelete() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", d.id);
      const res = await archiveDesign(fd);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.push("/admin/designs");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="mb-1">
        <p className="font-sans text-[10px] uppercase tracking-[0.24em] text-ink/55">
          <Link
            href="/admin/designs"
            className="underline decoration-ink/25 underline-offset-2 hover:text-ink"
          >
            All designs
          </Link>
          {" · Create"}
        </p>
        <h1 className="mt-2 font-display text-[2.2rem] font-light leading-none text-ink">
          {d.name}
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink/55">
          <span>{piecesMeta(components)}</span>
          <span aria-hidden>·</span>
          <span>{statusLabel(d.status, isArchived)}</span>
          {d.basePriceMinor > 0 ? (
            <>
              <span aria-hidden>·</span>
              <span className="font-data text-ink/70">
                <Money value={d.basePriceMinor} />
              </span>
            </>
          ) : null}
          <span aria-hidden>·</span>
          <span className="font-data text-[11px] text-ink/40">/{d.slug}</span>
        </div>
        <div className="mt-3.5 flex flex-wrap gap-2">
          {d.status === "PUBLISHED" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                const fd = new FormData();
                fd.set("id", d.id);
                run(unpublishDesign, fd);
              }}
              className="border border-zari bg-zari px-4 py-2 text-[12px] uppercase tracking-[0.06em] text-indigo disabled:opacity-50"
            >
              Unpublish
            </button>
          ) : canPublish ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                const fd = new FormData();
                fd.set("id", d.id);
                run(publishDesign, fd);
              }}
              className="border border-zari bg-zari px-4 py-2 text-[12px] uppercase tracking-[0.06em] text-indigo disabled:opacity-50"
            >
              Publish
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setTab("Preview")}
            className="border border-ink/15 px-4 py-2 text-[12px] text-ink/55 hover:border-ink hover:text-ink"
          >
            Preview live
          </button>
          {!isArchived ? (
            <ConfirmDialog
              title="Delete this design?"
              description="It will be archived and removed from the Designs catalogue. You can restore it later if needed."
              confirmLabel="Delete"
              trigger={
                <button
                  type="button"
                  disabled={pending}
                  className="border border-madder/35 px-4 py-2 text-[12px] text-madder disabled:opacity-50"
                >
                  Delete
                </button>
              }
              onConfirm={onDelete}
            />
          ) : null}
        </div>
      </header>

      <div
        className="flex flex-wrap gap-1 border-b border-ink/12"
        role="tablist"
        aria-label="Design editor tabs"
      >
        {TABS.map((t) => {
          const ok = readiness.tabOk[t];
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={
                tab === t
                  ? "-mb-px inline-flex items-center gap-1.5 border-b-2 border-zari px-4 py-2.5 text-[12.5px] text-ink"
                  : "-mb-px inline-flex items-center gap-1.5 border-b-2 border-transparent px-4 py-2.5 text-[12.5px] text-ink/55 hover:text-ink"
              }
            >
              <span
                className={
                  ok
                    ? "size-1.5 shrink-0 rounded-full bg-ink"
                    : "size-1.5 shrink-0 rounded-full bg-madder"
                }
                aria-hidden
              />
              <span>{t}</span>
              <span className="sr-only">
                {ok ? "ready" : "needs attention"}
              </span>
            </button>
          );
        })}
      </div>
      {!readiness.ready && !isArchived ? (
        <p className="border border-madder/30 bg-milk px-3 py-2 text-[12px] text-madder">
          Before publish: {readiness.missing.join(" · ")}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem] lg:items-start">
        <div className="min-w-0 flex flex-col gap-1">
          {error ? (
            <p className="mb-3 text-[13px] text-madder" role="alert">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="mb-3 text-[13px] text-zari">{message}</p>
          ) : null}

          {tab === "Details" ? (
            <DetailsTab
              detail={detail}
              options={options}
              pending={pending}
              onSave={(fd) => run(updateDesignDetails, fd, "Photos")}
            />
          ) : null}
          {tab === "Photos" ? (
            <DesignPhotosTab
              detail={detail}
              options={options}
              pending={pending}
              onRun={run}
              onRunSequence={(steps, thenAdvance) => {
                setError(null);
                setMessage(null);
                startTransition(async () => {
                  for (const { action, fd } of steps) {
                    const res = await action(fd);
                    if (!res.ok) {
                      setError(res.error);
                      return;
                    }
                  }
                  setMessage("Saved");
                  router.refresh();
                  if (thenAdvance) setTab("Sizing");
                });
              }}
              onSavedAdvance={() => setTab("Sizing")}
            />
          ) : null}
          {tab === "Sizing" ? (
            <DesignSizingTab
              detail={detail}
              options={options}
              pending={pending}
              onSave={(fd) => run(updateDesignSizing, fd, "Costing")}
            />
          ) : null}
          {tab === "Costing" ? (
            costing ? (
              <DesignCostingPanel
                data={costing}
                canViewMargin={canViewMargin}
                canEdit={canEditCosts}
                pieceKeys={components}
                onSavedAdvance={() => setTab("Price")}
              />
            ) : (
              <p className="text-[13px] text-ink/55">
                Costing requires the money.view permission. Ask an owner if you
                need access.
              </p>
            )
          ) : null}
          {tab === "Price" ? (
            <PricingTab
              detail={detail}
              costing={costing}
              pending={pending}
              onSave={(fd) => run(updateDesignPricing, fd, "Preview")}
            />
          ) : null}
          {tab === "Preview" ? (
            <PreviewPublishTab
              detail={detail}
              costing={costing}
              pending={pending}
              canPublish={canPublish}
              onPublish={() => {
                const fd = new FormData();
                fd.set("id", d.id);
                run(publishDesign, fd);
              }}
              onEditTab={setTab}
            />
          ) : null}
        </div>

        <PreviewColumn
          detail={detail}
          components={components}
          houseDoor={houseDoor}
        />
      </div>
    </div>
  );
}

function PreviewColumn({
  detail,
  components,
  houseDoor,
}: {
  detail: DesignDetail;
  components: string[];
  houseDoor: string;
}) {
  const d = detail.design;
  return (
    <aside className="h-fit border border-ink/12 bg-milk px-4 py-4 lg:sticky lg:top-20">
      <p className="font-sans text-[9.5px] uppercase tracking-[0.14em] text-ink/55">
        Preview
      </p>
      <p className="mt-2 font-display text-[1.3rem] font-light text-ink">
        {d.name}
      </p>
      <p className="mt-1 text-[11px] text-ink/55">{piecesMeta(components)}</p>
      {houseDoor ? (
        <p className="mt-0.5 text-[11px] text-ink/45">
          {houseDoorLabel(houseDoor)}
        </p>
      ) : null}
      <div className="mt-2 font-data text-[13px] text-ink">
        {d.basePriceMinor > 0 ? <Money value={d.basePriceMinor} /> : "—"}
        {d.compareAtPriceMinor != null &&
        d.compareAtPriceMinor > d.basePriceMinor ? (
          <span className="ms-2 text-ink/40 line-through">
            <Money value={d.compareAtPriceMinor} />
          </span>
        ) : null}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {detail.colourways.map((cw) => (
          <span
            key={cw.id}
            title={cw.name}
            className="size-3 border border-ink/15"
            style={{ backgroundColor: cw.hexApproximation ?? "#EAE1CF" }}
          />
        ))}
      </div>
    </aside>
  );
}

function DetailsTab({
  detail,
  options,
  pending,
  onSave,
}: {
  detail: DesignDetail;
  options: FormOptions;
  pending: boolean;
  onSave: (fd: FormData) => void;
}) {
  const d = detail.design;
  const initialComponents = componentKeysOf(detail);
  const [components, setComponents] = useState<string[]>(initialComponents);
  const [houseDoorTag, setHouseDoorTag] = useState(
    houseDoorFromTags(detail.tags),
  );

  function toggleComponent(key: string) {
    setComponents((prev) => {
      if (prev.includes(key)) {
        if (prev.length <= 1) return prev;
        return prev.filter((k) => k !== key);
      }
      return [...prev, key];
    });
  }

  return (
    <form
      className="flex flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        fd.set("id", d.id);
        fd.set("componentsJson", JSON.stringify(components));
        fd.set("houseDoorTag", houseDoorTag);
        onSave(fd);
      }}
    >
      <Panel title="Identity">
        <Field label="Design name" name="name" defaultValue={d.name} required />
        <Field
          label="Short text"
          name="subtitle"
          defaultValue={d.subtitle ?? ""}
        />
        <label className="flex flex-col gap-1.5">
          <Label>Description</Label>
          <textarea
            name="description"
            rows={3}
            defaultValue={d.description ?? ""}
            className={fieldClass()}
          />
        </label>
      </Panel>

      <Panel title="Pieces">
        <div className="flex flex-wrap gap-2">
          {options.categories.map((c) => {
            const on = components.includes(c.key);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleComponent(c.key)}
                className={
                  on
                    ? "bg-zari px-2.5 py-1.5 font-data text-[10.5px] text-indigo"
                    : "border border-ink/12 px-2.5 py-1.5 font-data text-[10.5px] text-ink/55"
                }
              >
                {c.key}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[12px] text-ink/45">
          One, two, or three pieces — the Sizing tab builds one table per piece
          selected here.
        </p>
      </Panel>

      <Panel title="Placement">
        <label className="mb-4 flex flex-col gap-1.5">
          <Label>House door</Label>
          <select
            value={houseDoorTag}
            onChange={(e) => setHouseDoorTag(e.target.value)}
            className={fieldClass()}
          >
            <option value="">Select…</option>
            {houseDoorOptions().map((o) => (
              <option key={o.tag} value={o.tag}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-col gap-1.5">
          <Label>Item number</Label>
          <p className="border border-ink/12 bg-greige/40 px-3 py-2.5 font-data text-[13px] text-ink/55">
            {d.itemNumber ?? "Assigned when house door is saved"}
          </p>
        </div>
      </Panel>

      <input type="hidden" name="nameUr" value={d.nameUr ?? ""} />
      <input
        type="hidden"
        name="silhouetteLabel"
        value={d.silhouetteLabel ?? ""}
      />
      <input type="hidden" name="storyCopy" value={d.storyCopy ?? ""} />
      <input type="hidden" name="seoTitle" value={d.seoTitle ?? ""} />
      <input
        type="hidden"
        name="seoDescription"
        value={d.seoDescription ?? ""}
      />
      <input type="hidden" name="modelInfo" value={d.modelInfo ?? ""} />

      <button
        type="submit"
        disabled={pending}
        className="self-start border border-zari bg-zari px-4 py-2 text-[13px] text-indigo disabled:opacity-50"
      >
        Save · continue to Photos
      </button>
    </form>
  );
}
