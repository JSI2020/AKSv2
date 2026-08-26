"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";

import { HOUSE_COLLECTIONS } from "@/modules/catalog/house-collections";
import { DEFAULT_SECTIONS_ORDER } from "@/modules/content/types";
import {
  deleteCategoryGateAction,
  deleteHeroSlideAction,
  publishCategoryGateAction,
  publishHeroSlideAction,
  saveFeaturedOrderAction,
  saveHomepageSectionsAction,
} from "@/modules/content/actions";
import type { PublishedDesignOption } from "@/modules/content/types";

type Hero = {
  id: string;
  eyebrow: string;
  headline: string;
  subtext: string;
  sortOrder: number;
  active: boolean;
  desktopImageAssetId: string | null;
  linkedDesignId: string | null;
};

type Tile = {
  id: string;
  categoryKey: string;
  displayName: string;
  caption: string;
  sortOrder: number;
  active: boolean;
  imageAssetId: string | null;
  publishedDesignCount: number;
};

type Block = {
  id: string;
  kind: "EDIT" | "LOOK" | "STATEMENT";
  payload: Record<string, unknown>;
};

type Draft = {
  id: string;
  sectionsOrder: string[];
  sectionsEnabled: Record<string, boolean>;
};

type SlideDraft = {
  id?: string;
  mode: "design" | "photo";
  linkedDesignId: string | null;
  headline: string;
  eyebrow: string;
  subtext: string;
  desktopImageAssetId: string | null;
  sortOrder: number;
};

type GateDraft = {
  id?: string;
  categoryKey: string;
  displayName: string;
  caption: string;
  imageAssetId: string | null;
  sortOrder: number;
  publishedDesignCount: number;
};

export function HomepageAdmin({
  draft,
  heroes: initialHeroes,
  tiles: initialTiles,
  blocks,
  publishedDesigns,
}: {
  draft: Draft;
  heroes: Hero[];
  tiles: Tile[];
  blocks: Block[];
  publishedDesigns: PublishedDesignOption[];
}) {
  const [slides, setSlides] = useState<SlideDraft[]>(
    initialHeroes.map((h) => ({
      id: h.id,
      mode: h.linkedDesignId ? "design" : "photo",
      linkedDesignId: h.linkedDesignId,
      headline: h.headline,
      eyebrow: h.eyebrow,
      subtext: h.subtext,
      desktopImageAssetId: h.desktopImageAssetId,
      sortOrder: h.sortOrder,
    })),
  );
  const [gates, setGates] = useState<GateDraft[]>(
    initialTiles.map((t) => ({
      id: t.id,
      categoryKey: t.categoryKey,
      displayName: t.displayName,
      caption: t.caption,
      imageAssetId: t.imageAssetId,
      sortOrder: t.sortOrder,
      publishedDesignCount: t.publishedDesignCount,
    })),
  );

  const editBlock = blocks.find((b) => b.kind === "EDIT");
  const statementBlock = blocks.find((b) => b.kind === "STATEMENT");
  const [featuredIds, setFeaturedIds] = useState<string[]>(
    Array.isArray(editBlock?.payload.designIds)
      ? (editBlock!.payload.designIds as string[])
      : [],
  );
  const [order, setOrder] = useState(
    draft.sectionsOrder?.length
      ? draft.sectionsOrder
      : [...DEFAULT_SECTIONS_ORDER],
  );
  const [enabled, setEnabled] = useState(draft.sectionsEnabled ?? {});
  const [statement, setStatement] = useState(
    String(statementBlock?.payload.text ?? ""),
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const designById = useMemo(() => {
    const m = new Map(publishedDesigns.map((d) => [d.id, d]));
    return m;
  }, [publishedDesigns]);

  function addSlide() {
    setSlides((s) => [
      ...s,
      {
        mode: "photo",
        linkedDesignId: null,
        headline: "New photo",
        eyebrow: "",
        subtext: "",
        desktopImageAssetId: null,
        sortOrder: s.length,
      },
    ]);
  }

  function addGate() {
    setGates((g) => [
      ...g,
      {
        categoryKey: "ESSENTIALS",
        displayName: "New gate",
        caption: "Caption",
        imageAssetId: null,
        sortOrder: g.length,
        publishedDesignCount: 0,
      },
    ]);
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_17rem] lg:items-start">
      <div className="flex flex-col gap-4">
      {msg ? (
        <p className="text-[13px] text-ink/70" role="status">
          {msg}
        </p>
      ) : null}

      <aside className="border border-ink/12 bg-[#F4EEE1] p-4 lg:hidden">
        <HomepageLivePreview
          slides={slides}
          gates={gates}
          statement={statement}
          featuredCount={featuredIds.length}
        />
      </aside>
      <section className="border border-ink/12 bg-milk p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[10px] uppercase tracking-[0.16em] text-ink/55">
            Welcome screen
          </h2>
          <button
            type="button"
            onClick={addSlide}
            className="border border-ink/20 px-3 py-1.5 text-[11px] uppercase tracking-[0.06em] text-ink hover:border-ink"
          >
            + Add photo
          </button>
        </div>
        <p className="mb-4 text-[11.5px] text-ink/55">
          One or more photos. Each can link to a published style, or stand alone
          with no link.
        </p>
        <div className="flex flex-col gap-4">
          {slides.map((slide, i) => (
            <div
              key={slide.id ?? `new-${i}`}
              className="border border-ink/12 bg-greige p-4"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10px] uppercase tracking-[0.14em] text-ink/55">
                  Photo {i + 1}
                </span>
                <div className="flex overflow-hidden border border-ink/12">
                  {(
                    [
                      ["design", "Linked to a style"],
                      ["photo", "Standalone photo"],
                    ] as const
                  ).map(([mode, label]) => (
                    <button
                      key={mode}
                      type="button"
                      className={[
                        "px-3 py-1.5 text-[12px]",
                        slide.mode === mode
                          ? "bg-ink text-milk"
                          : "bg-milk text-ink/70",
                      ].join(" ")}
                      onClick={() =>
                        setSlides((all) =>
                          all.map((s, idx) =>
                            idx === i
                              ? {
                                  ...s,
                                  mode,
                                  linkedDesignId:
                                    mode === "design"
                                      ? s.linkedDesignId ??
                                        publishedDesigns[0]?.id ??
                                        null
                                      : null,
                                }
                              : s,
                          ),
                        )
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative mb-3 flex aspect-[16/7] items-center border border-ink/12 bg-greige-deep/40 px-4">
                {slide.mode === "design" && slide.linkedDesignId ? (
                  <span className="absolute end-2 top-2 bg-milk/90 px-2 py-0.5 text-[8.5px] uppercase tracking-[0.08em] text-ink">
                    Links to:{" "}
                    {designById.get(slide.linkedDesignId)?.name ?? "style"}
                  </span>
                ) : null}
                <div>
                  <div className="text-[8px] uppercase tracking-[0.16em] text-ink/55">
                    {slide.mode === "design"
                      ? "From a published style"
                      : "Photo only"}
                  </div>
                  <div className="font-display text-[1.3rem] text-ink">
                    {slide.headline || "Headline"}
                  </div>
                </div>
              </div>

              {slide.mode === "design" ? (
                <label className="mb-3 flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-[0.1em] text-ink/55">
                    Published style
                  </span>
                  <select
                    className="border border-ink/12 bg-milk px-3 py-2 text-[13px] text-ink"
                    value={slide.linkedDesignId ?? ""}
                    onChange={(e) =>
                      setSlides((all) =>
                        all.map((s, idx) =>
                          idx === i
                            ? {
                                ...s,
                                linkedDesignId: e.target.value || null,
                                headline:
                                  designById.get(e.target.value)?.name ??
                                  s.headline,
                              }
                            : s,
                        ),
                      )
                    }
                  >
                    <option value="">Select a design…</option>
                    {publishedDesigns.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                        {d.houseDoor ? ` · ${d.houseDoor}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <p className="mb-3 text-[11.5px] text-ink/55">
                  Standalone image — paste an existing asset id below (upload
                  pipeline unchanged). This slide won&apos;t link anywhere.
                </p>
              )}

              {slide.mode === "photo" ? (
                <label className="mb-3 flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-[0.1em] text-ink/55">
                    Image asset id
                  </span>
                  <input
                    className="border border-ink/12 bg-milk px-3 py-2 font-data text-[12px] text-ink"
                    value={slide.desktopImageAssetId ?? ""}
                    onChange={(e) =>
                      setSlides((all) =>
                        all.map((s, idx) =>
                          idx === i
                            ? {
                                ...s,
                                desktopImageAssetId: e.target.value || null,
                              }
                            : s,
                        ),
                      )
                    }
                  />
                </label>
              ) : null}

              <label className="mb-3 flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-[0.1em] text-ink/55">
                  Headline
                </span>
                <input
                  className="border border-ink/12 bg-milk px-3 py-2 text-[13px] text-ink"
                  value={slide.headline}
                  onChange={(e) =>
                    setSlides((all) =>
                      all.map((s, idx) =>
                        idx === i ? { ...s, headline: e.target.value } : s,
                      ),
                    )
                  }
                />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <button
                  type="button"
                  className="text-[12px] text-madder"
                  disabled={pending}
                  onClick={() => {
                    if (!slide.id) {
                      setSlides((all) => all.filter((_, idx) => idx !== i));
                      return;
                    }
                    start(async () => {
                      const res = await deleteHeroSlideAction(slide.id!);
                      setMsg(res.ok ? "Photo removed." : res.error);
                      if (res.ok) {
                        setSlides((all) => all.filter((_, idx) => idx !== i));
                      }
                    });
                  }}
                >
                  Remove
                </button>
                <button
                  type="button"
                  disabled={pending}
                  className="bg-zari px-4 py-2 text-[11px] uppercase tracking-[0.08em] text-indigo disabled:opacity-40"
                  onClick={() => {
                    start(async () => {
                      const res = await publishHeroSlideAction({
                        id: slide.id,
                        mode: slide.mode,
                        linkedDesignId: slide.linkedDesignId,
                        headline: slide.headline,
                        eyebrow: slide.eyebrow,
                        subtext: slide.subtext,
                        desktopImageAssetId: slide.desktopImageAssetId,
                        sortOrder: i,
                      });
                      setMsg(
                        res.ok
                          ? `Photo ${i + 1} updated and published.`
                          : res.error,
                      );
                      if (res.ok && res.id) {
                        setSlides((all) =>
                          all.map((s, idx) =>
                            idx === i ? { ...s, id: res.id } : s,
                          ),
                        );
                      }
                    });
                  }}
                >
                  Update & publish
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Gates */}
      <section className="border border-ink/12 bg-milk p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[10px] uppercase tracking-[0.16em] text-ink/55">
            Gates
          </h2>
          <button
            type="button"
            onClick={addGate}
            className="border border-ink/20 px-3 py-1.5 text-[11px] uppercase tracking-[0.06em] text-ink hover:border-ink"
          >
            + Add gate
          </button>
        </div>
        <p className="mb-4 text-[11.5px] text-ink/55">
          Currently {gates.length} — add or remove any time. Each gate needs at
          least one published design in that category before it can go live.
        </p>
        <div className="flex flex-col gap-3">
          {gates.map((gate, i) => {
            const canPublish = gate.publishedDesignCount > 0;
            return (
              <div
                key={gate.id ?? `gate-${i}`}
                className="overflow-hidden border border-ink/12 bg-greige"
              >
                <div className="flex gap-4 p-4">
                  <div className="size-[76px] shrink-0 bg-greige-deep/50" />
                  <div className="min-w-0 flex-1">
                    <input
                      className="mb-1 w-full border-0 bg-transparent font-display text-[1.3rem] text-ink outline-none"
                      value={gate.displayName}
                      onChange={(e) =>
                        setGates((all) =>
                          all.map((g, idx) =>
                            idx === i
                              ? { ...g, displayName: e.target.value }
                              : g,
                          ),
                        )
                      }
                    />
                    <input
                      className="mb-2 w-full border border-ink/12 bg-milk px-2 py-1.5 text-[12px] text-ink"
                      value={gate.caption}
                      onChange={(e) =>
                        setGates((all) =>
                          all.map((g, idx) =>
                            idx === i ? { ...g, caption: e.target.value } : g,
                          ),
                        )
                      }
                    />
                    <label className="mb-2 flex flex-col gap-1">
                      <span className="text-[10px] uppercase text-ink/55">
                        Category (house door)
                      </span>
                      <select
                        className="border border-ink/12 bg-milk px-2 py-1.5 text-[13px] text-ink"
                        value={gate.categoryKey}
                        onChange={(e) => {
                          const key = e.target.value;
                          const count = publishedDesigns.filter(
                            (d) => d.houseDoor === key.toUpperCase(),
                          ).length;
                          setGates((all) =>
                            all.map((g, idx) =>
                              idx === i
                                ? {
                                    ...g,
                                    categoryKey: key,
                                    publishedDesignCount: count,
                                  }
                                : g,
                            ),
                          );
                        }}
                      >
                        {HOUSE_COLLECTIONS.map((c) => (
                          <option key={c.tag} value={c.tag}>
                            {c.navLabel}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div
                      className={
                        canPublish
                          ? "text-[11px] text-ink/70"
                          : "text-[11px] text-madder"
                      }
                    >
                      {canPublish
                        ? `✓ ${gate.publishedDesignCount} published design${gate.publishedDesignCount === 1 ? "" : "s"} linked`
                        : "⚠ No published design yet — link one before publishing"}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-ink/10 px-4 py-2.5">
                  <div className="flex gap-1">
                    {Array.from({
                      length: Math.min(gate.publishedDesignCount, 6),
                    }).map((_, ti) => (
                      <div
                        key={ti}
                        className="h-[34px] w-[26px] border border-ink/12 bg-greige-deep/40"
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="border border-ink/20 px-3 py-1.5 text-[11px] uppercase text-ink"
                      disabled={pending}
                      onClick={() => {
                        if (!gate.id) {
                          setGates((all) => all.filter((_, idx) => idx !== i));
                          return;
                        }
                        start(async () => {
                          const res = await deleteCategoryGateAction(gate.id!);
                          setMsg(res.ok ? "Gate removed." : res.error);
                          if (res.ok) {
                            setGates((all) =>
                              all.filter((_, idx) => idx !== i),
                            );
                          }
                        });
                      }}
                    >
                      Remove gate
                    </button>
                    <button
                      type="button"
                      disabled={pending || !canPublish}
                      className="bg-zari px-4 py-2 text-[11px] uppercase tracking-[0.08em] text-indigo disabled:opacity-40"
                      onClick={() => {
                        start(async () => {
                          const res = await publishCategoryGateAction({
                            id: gate.id,
                            categoryKey: gate.categoryKey,
                            displayName: gate.displayName,
                            caption: gate.caption,
                            imageAssetId: gate.imageAssetId,
                            sortOrder: i,
                          });
                          setMsg(
                            res.ok
                              ? `${gate.displayName} updated and published.`
                              : res.error,
                          );
                          if (res.ok && res.id) {
                            setGates((all) =>
                              all.map((g, idx) =>
                                idx === i ? { ...g, id: res.id } : g,
                              ),
                            );
                          }
                        });
                      }}
                    >
                      Update & publish
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Featured */}
      <section className="border border-ink/12 bg-milk p-5">
        <h2 className="mb-4 text-[10px] uppercase tracking-[0.16em] text-ink/55">
          Featured below the gates
        </h2>
        <div>
          {featuredIds.map((id, i) => {
            const d = designById.get(id);
            return (
              <div
                key={`${id}-${i}`}
                className="flex items-center gap-3 border-b border-ink/10 py-2.5 last:border-b-0"
              >
                <div className="h-12 w-[38px] bg-greige-deep/40" />
                <span className="flex-1 font-display text-[1.1rem] text-ink">
                  {d?.name ?? id}
                </span>
                <div className="flex flex-col">
                  <button
                    type="button"
                    className="text-[9px] text-ink/55 hover:text-ink"
                    onClick={() => {
                      if (i === 0) return;
                      setFeaturedIds((ids) => {
                        const next = [...ids];
                        [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
                        return next;
                      });
                    }}
                  >
                    ▲
                  </button>
                  <button
                    type="button"
                    className="text-[9px] text-ink/55 hover:text-ink"
                    onClick={() => {
                      if (i >= featuredIds.length - 1) return;
                      setFeaturedIds((ids) => {
                        const next = [...ids];
                        [next[i], next[i + 1]] = [next[i + 1]!, next[i]!];
                        return next;
                      });
                    }}
                  >
                    ▼
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-[10px] uppercase text-ink/55">
            Add published design
          </span>
          <select
            className="border border-ink/12 bg-greige px-3 py-2 text-[13px] text-ink"
            defaultValue=""
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              setFeaturedIds((ids) =>
                ids.includes(id) ? ids : [...ids, id],
              );
              e.target.value = "";
            }}
          >
            <option value="">Select…</option>
            {publishedDesigns.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <p className="mt-2 text-[11.5px] text-ink/55">
          Order here decides order on the storefront. This only selects and
          orders — designs themselves are edited in{" "}
          <Link href="/admin/designs" className="text-zari hover:underline">
            Designs
          </Link>
          .
        </p>
        <button
          type="button"
          disabled={pending}
          className="mt-4 bg-ink px-5 py-3 text-[12px] uppercase tracking-[0.1em] text-milk hover:bg-madder disabled:opacity-40"
          onClick={() => {
            start(async () => {
              const res = await saveFeaturedOrderAction({
                designIds: featuredIds,
                editBlockId: editBlock?.id,
              });
              setMsg(res.ok ? "Featured order saved." : res.error);
            });
          }}
        >
          Save order
        </button>
      </section>

      {/* Section order */}
      <section className="border border-ink/12 bg-milk p-5">
        <h2 className="mb-4 text-[10px] uppercase tracking-[0.16em] text-ink/55">
          Section order
        </h2>
        {order.map((key, i) => (
          <div
            key={key}
            className="flex items-center gap-3 border-b border-ink/10 py-2 text-[13px] last:border-b-0"
          >
            <span className="flex-1 capitalize text-ink">{key}</span>
            {key === "hero" ? (
              <span className="text-[10px] italic text-ink/55">Always on</span>
            ) : (
              <button
                type="button"
                className={[
                  "h-[19px] w-[34px] rounded-full",
                  enabled[key] === false ? "bg-ink/20" : "bg-ink/50",
                ].join(" ")}
                onClick={() =>
                  setEnabled((e) => ({
                    ...e,
                    [key]: e[key] === false,
                  }))
                }
                aria-label={`Toggle ${key}`}
              />
            )}
            <div className="flex flex-col">
              <button
                type="button"
                className="text-[9px] text-ink/55"
                onClick={() => {
                  if (i === 0) return;
                  setOrder((o) => {
                    const next = [...o];
                    [next[i - 1], next[i]] = [next[i]!, next[i - 1]!];
                    return next;
                  });
                }}
              >
                ▲
              </button>
              <button
                type="button"
                className="text-[9px] text-ink/55"
                onClick={() => {
                  if (i >= order.length - 1) return;
                  setOrder((o) => {
                    const next = [...o];
                    [next[i], next[i + 1]] = [next[i + 1]!, next[i]!];
                    return next;
                  });
                }}
              >
                ▼
              </button>
            </div>
          </div>
        ))}
        <label className="mt-3 flex flex-col gap-1">
          <span className="text-[10px] uppercase text-ink/55">Statement</span>
          <textarea
            className="min-h-[72px] border border-ink/12 bg-greige px-3 py-2 text-[13px] text-ink"
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
          />
        </label>
        <button
          type="button"
          disabled={pending}
          className="mt-4 bg-ink px-5 py-3 text-[12px] uppercase tracking-[0.1em] text-milk hover:bg-madder disabled:opacity-40"
          onClick={() => {
            start(async () => {
              const res = await saveHomepageSectionsAction({
                sectionsOrder: order,
                sectionsEnabled: enabled,
                statement,
                editMode: "handpicked",
                editDesignIds: featuredIds.join(","),
              });
              setMsg(res.ok ? "Section order saved." : res.error);
            });
          }}
        >
          Save order
        </button>
      </section>
      </div>

      <aside className="sticky top-4 hidden border border-ink/12 bg-[#F4EEE1] p-4 lg:block">
        <HomepageLivePreview
          slides={slides}
          gates={gates}
          statement={statement}
          featuredCount={featuredIds.length}
        />
      </aside>
    </div>
  );
}

function HomepageLivePreview({
  slides,
  gates,
  statement,
  featuredCount,
}: {
  slides: SlideDraft[];
  gates: GateDraft[];
  statement: string;
  featuredCount: number;
}) {
  const hero = slides[0];
  return (
    <div className="flex flex-col gap-3">
      <p className="font-sans text-[9px] uppercase tracking-[0.18em] text-[#2B2926]/70">
        Live preview · draft
      </p>
      <div className="border border-[#2B2926]/15 bg-[#2B2926] px-3 py-6 text-[#F4EEE1]">
        <p className="text-[8px] uppercase tracking-[0.16em] opacity-70">
          {hero?.eyebrow || "Quiet luxury"}
        </p>
        <p className="mt-2 font-display text-[1.15rem] font-light leading-snug">
          {hero?.headline || "Headline"}
        </p>
        <p className="mt-2 line-clamp-2 text-[10px] opacity-75">
          {hero?.subtext || "Supporting line"}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {gates.slice(0, 4).map((g, i) => (
          <div
            key={g.id ?? `gate-prev-${i}`}
            className="border border-[#2B2926]/12 bg-[#EAE1CF] px-2 py-2"
          >
            <p className="text-[9px] font-medium text-[#2B2926]">
              {g.displayName || "Door"}
            </p>
            <p className="mt-0.5 text-[8px] text-[#2B2926]/60">
              {g.publishedDesignCount} live
            </p>
          </div>
        ))}
      </div>
      {statement.trim() ? (
        <p className="border border-[#2B2926]/10 bg-white/50 px-2 py-2 font-display text-[11px] italic leading-snug text-[#2B2926]">
          {statement}
        </p>
      ) : null}
      <p className="font-data text-[9px] uppercase tracking-[0.08em] text-[#2B2926]/55">
        The Edit · {featuredCount} look{featuredCount === 1 ? "" : "s"}
      </p>
    </div>
  );
}
