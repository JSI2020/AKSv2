import { Link } from "@/i18n/routing";
import { Measure } from "@/modules/ui";
import { ShopPageContainer } from "@/modules/shop/shell/page-container";

import type { SizeGuideChartPublic } from "./queries";

type Props = {
  charts: SizeGuideChartPublic[];
  copy: {
    title: string;
    lead: string;
    customPrimary: string;
    customCta: string;
    standardNote: string;
    empty: string;
    baseSize: string;
  };
};

export function SizeGuidePageView({ charts, copy }: Props) {
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
          <p className="mt-4 text-[15px] leading-relaxed text-ink/70">
            {copy.customPrimary}{" "}
            <Link
              href="/collections"
              className="border-b border-madder text-ink"
            >
              {copy.customCta}
            </Link>
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-ink/55">
            {copy.standardNote}
          </p>
        </header>

        {charts.length === 0 ? (
          <p className="text-[15px] text-ink/60">{copy.empty}</p>
        ) : (
          <div className="flex flex-col gap-14">
            {charts.map((chart) => (
              <section key={chart.blockId} className="min-w-0">
                <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-display text-[22px] font-medium text-ink">
                    {chart.categoryName}
                  </h2>
                  <p className="text-[12px] uppercase tracking-[0.08em] text-ink/50">
                    {copy.baseSize} {chart.baseSizeLabel}
                  </p>
                </div>
                <div className="overflow-x-auto border border-greige-deep">
                  <table className="w-full min-w-[520px] border-collapse text-start text-[13px]">
                    <thead>
                      <tr className="border-b border-greige-deep bg-greige-deep/40">
                        <th className="px-3 py-2.5 text-start font-medium text-ink/70">
                          &nbsp;
                        </th>
                        {chart.sizeLabels.map((label) => (
                          <th
                            key={label}
                            className="px-3 py-2.5 text-center font-display text-[12px] font-medium uppercase tracking-[0.06em] text-ink"
                          >
                            {label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {chart.rows.map((row) => (
                        <tr
                          key={row.measurementKey}
                          className="border-b border-greige-deep/80 last:border-b-0"
                        >
                          <th
                            scope="row"
                            className="whitespace-nowrap px-3 py-2.5 text-start font-medium text-ink/80"
                          >
                            {row.label}
                          </th>
                          {chart.sizeLabels.map((label) => (
                            <td
                              key={label}
                              className="px-3 py-2.5 text-center text-ink"
                            >
                              <Measure value={row.values[label] ?? 0} />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}
      </article>
    </ShopPageContainer>
  );
}
