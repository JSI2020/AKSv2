"use client";

import { shadeDisplayName } from "./shade-utils";

// Only the id and name are read here, so accept any colourway-shaped row —
// the full design colourway and the costing panel's slimmer row both fit.
type Shade = { id: string; name: string };

export function DesignShadeSelect({
  colourways,
  colourwayId,
  onSelect,
  label = "Shade",
}: {
  colourways: Shade[];
  colourwayId: string;
  onSelect: (id: string) => void;
  label?: string;
}) {
  if (colourways.length === 0) {
    return (
      <p className="text-[13px] text-ink/55">
        Add shades in Photos first — each fabric set becomes a shade.
      </p>
    );
  }

  const selected =
    colourways.find((c) => c.id === colourwayId) ?? colourways[0]!;

  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-sans text-[10px] uppercase tracking-[0.14em] text-ink/55">
        {label}
      </span>
      <select
        value={selected.id}
        onChange={(e) => onSelect(e.target.value)}
        className="border border-ink/12 bg-milk px-3 py-2 text-[13px] text-ink outline-none focus:border-ink"
      >
        {colourways.map((cw, i) => (
          <option key={cw.id} value={cw.id}>
            {shadeDisplayName(cw, i)}
          </option>
        ))}
      </select>
    </label>
  );
}
