import { ShopPageContainer } from "@/modules/shop/shell/page-container";

import type { FabricLibraryRow } from "./queries";

type Props = {
  fabrics: FabricLibraryRow[];
  copy: {
    title: string;
    lead: string;
    empty: string;
    care: string;
    drape: string;
  };
};

export function FabricsPageView({ fabrics, copy }: Props) {
  return (
    <ShopPageContainer>
      <article className="py-12 md:py-16">
        <header className="mb-12 max-w-2xl">
          <h1 className="font-display text-[clamp(32px,4vw,48px)] font-medium leading-tight text-ink">
            {copy.title}
          </h1>
          <p className="mt-4 text-[16px] leading-relaxed text-ink/75">
            {copy.lead}
          </p>
        </header>

        {fabrics.length === 0 ? (
          <p className="text-[15px] text-ink/60">{copy.empty}</p>
        ) : (
          <ul className="grid gap-0 border-t border-greige-deep sm:grid-cols-2">
            {fabrics.map((fabric) => (
              <li
                key={fabric.id}
                className="border-b border-e border-greige-deep p-6 md:p-8"
              >
                <h2 className="font-display text-[22px] font-medium text-ink">
                  {fabric.name}
                </h2>
                <p className="mt-1 text-[13px] uppercase tracking-[0.06em] text-ink/50">
                  {fabric.composition}
                </p>
                {fabric.drapeNotes ? (
                  <p className="mt-4 text-[15px] leading-relaxed text-ink/75">
                    <span className="text-[12px] uppercase tracking-[0.08em] text-ink/45">
                      {copy.drape}
                    </span>
                    <br />
                    {fabric.drapeNotes}
                  </p>
                ) : null}
                {fabric.careInstructions ? (
                  <p className="mt-3 text-[14px] leading-relaxed text-ink/60">
                    <span className="text-[12px] uppercase tracking-[0.08em] text-ink/45">
                      {copy.care}
                    </span>
                    <br />
                    {fabric.careInstructions}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </article>
    </ShopPageContainer>
  );
}
