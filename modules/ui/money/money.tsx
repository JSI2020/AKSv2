import { cn } from "@/lib/utils";

import { formatMoney } from "./format";

type MoneyProps = {
  value: number;
  currency?: "PKR";
  className?: string;
};

export function Money({ value, currency = "PKR", className }: MoneyProps) {
  return (
    <span className={cn("font-data tabular-nums", className)}>
      {formatMoney(value, currency)}
    </span>
  );
}

export { formatMoney };
