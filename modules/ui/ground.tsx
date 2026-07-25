import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type GroundProps = {
  variant?: "greige" | "indigo";
  className?: string;
  children?: ReactNode;
};

export function Ground({
  variant = "greige",
  className,
  children,
}: GroundProps) {
  return (
    <div
      className={cn(
        "min-block-size-full",
        variant === "greige" && "bg-greige text-ink",
        variant === "indigo" && "bg-indigo text-greige",
        className,
      )}
    >
      {children}
    </div>
  );
}
