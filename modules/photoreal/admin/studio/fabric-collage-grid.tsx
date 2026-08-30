"use client";

import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

export type FabricCollageTile = {
  id: string;
  imageUrl: string;
  label?: string;
};

/** Thumb positions in a 4×4 grid while the centre 2×2 is the hero. */
const THUMB_CELLS = [
  { col: 1, row: 1 },
  { col: 2, row: 1 },
  { col: 3, row: 1 },
  { col: 4, row: 1 },
  { col: 1, row: 2 },
  { col: 4, row: 2 },
  { col: 1, row: 3 },
  { col: 4, row: 3 },
  { col: 1, row: 4 },
  { col: 2, row: 4 },
  { col: 3, row: 4 },
  { col: 4, row: 4 },
] as const;

type FabricCollageGridProps = {
  tiles: FabricCollageTile[];
  heroId?: string;
  onSelect?: (id: string) => void;
  className?: string;
};

export function FabricCollageGrid({
  tiles,
  heroId,
  onSelect,
  className,
}: FabricCollageGridProps) {
  const hero =
    tiles.find((t) => t.id === heroId) ??
    tiles[Math.floor(tiles.length / 2)] ??
    tiles[0];
  const thumbs = tiles.filter((t) => t.id !== hero?.id);

  return (
    <div
      className={cn(
        "relative grid grid-cols-4 grid-rows-4 gap-1 bg-greige/15 p-1 rounded-[2px]",
        className,
      )}
    >
      {hero && (
        <CollageTile
          tile={hero}
          large
          onSelect={onSelect}
          className="col-start-2 col-end-4 row-start-2 row-end-4"
        />
      )}

      {THUMB_CELLS.map((cell, i) => (
        <CollageTile
          key={`${cell.col}-${cell.row}`}
          tile={thumbs[i] ?? null}
          onSelect={onSelect}
          style={{ gridColumn: cell.col, gridRow: cell.row }}
        />
      ))}
    </div>
  );
}

function CollageTile({
  tile,
  large,
  onSelect,
  className,
  style,
}: {
  tile: FabricCollageTile | null;
  large?: boolean;
  onSelect?: (id: string) => void;
  className?: string;
  style?: CSSProperties;
}) {
  if (!tile) {
    return (
      <div
        style={style}
        className={cn(
          "aspect-square border border-indigo-lift/40 bg-indigo/30",
          className,
        )}
      />
    );
  }

  return (
    <button
      type="button"
      style={style}
      onClick={() => onSelect?.(tile.id)}
      className={cn(
        "group relative overflow-hidden border border-indigo-lift bg-indigo-lift focus-visible:outline focus-visible:outline-2 focus-visible:outline-zari",
        large ? "min-h-0" : "aspect-square",
        className,
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={tile.imageUrl}
        alt={tile.label ?? "Fabric photograph"}
        className="size-full object-cover transition duration-200 group-hover:scale-[1.02]"
      />
      {tile.label && (
        <span className="absolute inset-inline-start-0 inset-inline-end-0 bottom-0 bg-gradient-to-t from-ink/55 to-transparent px-1.5 py-1 font-mono text-[9px] uppercase tracking-wide text-greige/90">
          {tile.label}
        </span>
      )}
    </button>
  );
}
