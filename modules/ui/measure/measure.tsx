import { cn } from "@/lib/utils";

import { formatMeasure } from "./format";

type MeasureProps = {
  value: number;
  unit?: "in";
  className?: string;
};

export function Measure({ value, unit = "in", className }: MeasureProps) {
  return (
    <span className={cn("font-data tabular-nums", className)}>
      {formatMeasure(value, unit)}
    </span>
  );
}

export { formatMeasure };
