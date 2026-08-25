import { cn } from "@/lib/utils";

import { formatMetres } from "./format";

type MetresProps = {
  value: number;
  className?: string;
};

export function Metres({ value, className }: MetresProps) {
  return (
    <span className={cn("font-data tabular-nums", className)}>
      {formatMetres(value)}
    </span>
  );
}

export { formatMetres, parseMetresInput } from "./format";
