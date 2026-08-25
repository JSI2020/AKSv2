import type { ReactNode } from "react";

/** Shared content width for storefront pages (hero stays full-bleed outside this). */
export function ShopPageContainer({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[1500px] px-[2.5rem] pt-28 max-[900px]:px-[1.4rem]">
      {children}
    </div>
  );
}
