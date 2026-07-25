import type { ReactNode } from "react";

/** Shared content width for storefront pages (hero stays full-bleed outside this). */
export function ShopPageContainer({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 md:px-10">{children}</div>
  );
}
