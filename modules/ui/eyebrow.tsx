import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type EyebrowProps = {
  children: ReactNode;
  className?: string;
};

export function Eyebrow({ children, className }: EyebrowProps) {
  return (
    <p
      className={cn(
        "font-sans text-[12px] font-medium uppercase tracking-[0.12em] text-chalk",
        className,
      )}
    >
      {children}
    </p>
  );
}
