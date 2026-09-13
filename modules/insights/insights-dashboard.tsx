"use client";

import Link from "next/link";
import {
  Camera,
  Clock,
  Globe,
  MapPin,
  MessageCircle,
  Palette,
  Phone,
  Repeat,
  Ruler,
  ShoppingBag,
  Store,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import { Money } from "@/modules/ui";
import { formatMetres } from "@/modules/production/format-metres";
import { AdminTimeFilter } from "@/modules/admin/time-filter";
import { cn } from "@/lib/utils";

import type { InsightsReportData } from "./queries-reports";
import { ReportTable } from "./report-table";
import {
  ChartCard,
  Donut,
  HBars,
  PROVINCE_LABELS,
  ProgressRail,
  SparkBars,
  StatTile,
  VBars,
} from "./insight-charts";

const ic = "size-4";

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"] as const;

const SOURCE_META: Record<
  string,
  { label: string; icon: LucideIcon; accent: string }
> = {
  WEB: { label: "Website", icon: Globe, accent: "border-s-chalk" },
  WHATSAPP: { label: "WhatsApp", icon: MessageCircle, accent: "border-s-zari" },
  INSTAGRAM: { label: "Instagram", icon: Camera, accent: "border-s-madder" },
  PHONE: { label: "Phone", icon: Phone, accent: "border-s-chalk" },
  WALK_IN: { label: "Walk-in", icon: Store, accent: "border-s-zari" },
};

function sizeModeLabel(mode: string): string {
  if (mode === "STANDARD") return "Standard";
  if (mode === "MADE_TO_MEASURE") return "Custom";
  return mode.replaceAll("_", " ");
}

function formatPkrShort(minor: number): string {
  const rupees = minor / 100;
  if (rupees >= 100_000) return `PKR ${(rupees / 1000).toFixed(0)}k`;
  if (rupees >= 1_000) return `PKR ${(rupees / 1000).toFixed(1)}k`;
  return `PKR ${Math.round(rupees).toLocaleString("en-PK")}`;
}

type InsightCard = {
  id: string;
  title: string;
  body: string;
  href: string;
  linkLabel: string;
  icon: LucideIcon;
  tone?: "madder" | "zari" | "chalk";
};

function InsightCards({ cards }: { cards: InsightCard[] }) {
  if (cards.length === 0) return null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.id}
            className={cn(
              "flex flex-col gap-3 border border-indigo-lift bg-indigo-lift/20 p-4",
              card.tone === "madder" && "border-s-[3px] border-s-madder",
              card.tone === "zari" && "border-s-[3px] border-s-zari",
              card.tone === "chalk" && "border-s-[3px] border-s-chalk",
            )}
          >
            <Icon
              className={cn(
                "size-4",
                card.tone === "madder"
                  ? "text-madder"
                  : card.tone === "zari"
                    ? "text-zari"
                    : "text-chalk",
              )}
            />
            <div>
              <p className="text-[13px] font-medium text-greige">{card.title}</p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-chalk">
                {card.body}
              </p>
            </div>
            <Link
              href={card.href}
              className="mt-auto text-[12px] text-zari hover:underline"
            >
              {card.linkLabel} →
            </Link>
          </div>
        );
      })}
    </div>
  );
}

export function InsightsDashboard({ data }: { data: InsightsReportData }) {
  const totalRevenue = data.salesByCity.reduce((s, r) => s + r.revenueMinor, 0);
  const totalOrders = data.salesByCity.reduce((s, r) => s + r.orderCount, 0);
  const totalUnits = data.salesByDesign.reduce((s, r) => s + r.unitsSold, 0);
  const aov = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

  const sizeUnits = new Map<string, number>();
  for (const r of data.sizeDistribution) {
    if (r.sizeLabel === "MTM") continue;
    sizeUnits.set(r.sizeLabel, (sizeUnits.get(r.sizeLabel) ?? 0) + r.unitsSold);
  }
  const sizeBars = SIZE_ORDER.map((label) => ({
    label,
    value: sizeUnits.get(label) ?? 0,
    highlight: label === "M",
  }));
  const topSize = [...sizeBars].sort((a, b) => b.value - a.value)[0];

  const topDesigns = data.salesByDesign.slice(0, 6).map((r) => ({
    name: r.designName || "Untitled",
    value: r.revenueMinor,
    sub: `${r.unitsSold} unit${r.unitsSold === 1 ? "" : "s"}`,
  }));
  const bestseller = data.salesByDesign[0] ?? null;

  const topCities = data.salesByCity.slice(0, 8).map((r) => ({
    name: r.city,
    value: r.revenueMinor,
    sub: `${r.orderCount} order${r.orderCount === 1 ? "" : "s"}`,
  }));
  const topCity = data.salesByCity[0] ?? null;

  const modeSegments = data.sizeModeSplit.map((r) => ({
    label: sizeModeLabel(r.sizeMode),
    value: r.unitsSold,
  }));
  const modeOrderTotal = data.sizeModeSplit.reduce((s, r) => s + r.unitsSold, 0);

  const trendPoints = data.dailyTrend.map((d) => ({
    key: d.day,
    label: d.day.slice(8),
    value: d.revenueMinor,
    title: `${d.day}: ${formatPkrShort(d.revenueMinor)} · ${d.orders} orders`,
  }));

  const leadWithDelta = data.leadTimes.filter((r) => r.deltaDays !== null);
  const leadOnTrack = leadWithDelta.filter((r) => (r.deltaDays ?? 0) <= 0).length;
  const leadLate = leadWithDelta.filter((r) => (r.deltaDays ?? 0) > 0).length;
  const onTimePct =
    leadWithDelta.length > 0
      ? Math.round((leadOnTrack / leadWithDelta.length) * 100)
      : 0;

  const wastageTotal = data.fabricWastage.reduce((s, r) => s + r.wastageMeters, 0);
  const plannedTotal = data.fabricWastage.reduce((s, r) => s + r.plannedMeters, 0);
  const utilPct =
    plannedTotal > 0
      ? Math.max(
          0,
          Math.min(
            100,
            Math.round(((plannedTotal - wastageTotal) / plannedTotal) * 100),
          ),
        )
      : 0;

  const provinceBars = data.salesByProvince.slice(0, 7).map((r) => ({
    name: PROVINCE_LABELS[r.province] ?? r.province,
    value: r.revenueMinor,
    sub: `${r.orderCount} orders`,
  }));

  const oneTimeCustomers = Math.max(
    0,
    data.repeatCustomerRate.totalCustomers -
      data.repeatCustomerRate.repeatCustomers,
  );

  const insightCards: InsightCard[] = [];
  if (bestseller) {
    insightCards.push({
      id: "bestseller",
      title: "Your bestseller",
      body: `${bestseller.designName} drives ${formatPkrShort(bestseller.revenueMinor)} across ${bestseller.unitsSold} unit${bestseller.unitsSold === 1 ? "" : "s"}.`,
      href: `/admin/designs/${bestseller.designId}`,
      linkLabel: "View design",
      icon: TrendingUp,
      tone: "zari",
    });
  }
  if (topCity) {
    insightCards.push({
      id: "top-market",
      title: "Your top market",
      body: `${topCity.city} generates ${formatPkrShort(topCity.revenueMinor)} — ${topCity.orderCount} order${topCity.orderCount === 1 ? "" : "s"} from this city alone.`,
      href: "/admin/customers",
      linkLabel: "View customers",
      icon: MapPin,
      tone: "chalk",
    });
  }
  if (topSize && topSize.value > 0) {
    insightCards.push({
      id: "size",
      title: "Size insight",
      body: `Size ${topSize.label} is your most ordered size (${topSize.value} unit${topSize.value === 1 ? "" : "s"}). Stock more ${topSize.label} pattern blocks.`,
      href: "/admin/settings/sizing",
      linkLabel: "View sizing",
      icon: Ruler,
      tone: "zari",
    });
  }
  if (oneTimeCustomers > 0) {
    insightCards.push({
      id: "loyalty",
      title: "Loyalty opportunity",
      body: `${oneTimeCustomers} customer${oneTimeCustomers === 1 ? " hasn’t" : "s haven’t"} returned yet. A quiet win-back offer can help.`,
      href: "/admin/discounts",
      linkLabel: "View discounts",
      icon: Repeat,
      tone: "chalk",
    });
  }
  if (leadWithDelta.length > 0) {
    insightCards.push({
      id: "lead",
      title: "Lead time health",
      body:
        leadLate > 0
          ? `${leadOnTrack} of ${leadWithDelta.length} deliveries on track. ${leadLate} overdue vs promise.`
          : `${leadOnTrack} of ${leadWithDelta.length} deliveries on track.`,
      href: "/admin/production",
      linkLabel: "View production",
      icon: Clock,
      tone: leadLate > 0 ? "madder" : "zari",
    });
  }
  const highWaste = [...data.fabricWastage]
    .filter((r) => r.wastagePercent > 0)
    .sort((a, b) => b.wastagePercent - a.wastagePercent)[0];
  if (highWaste) {
    insightCards.push({
      id: "waste",
      title: "Fabric watch",
      body: `${highWaste.designName} shows ${highWaste.wastagePercent}% wastage (${formatMetres(highWaste.wastageMeters)}). Review cutting plan.`,
      href: `/admin/designs/${highWaste.designId}`,
      linkLabel: "View design",
      icon: TrendingDown,
      tone: "madder",
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <AdminTimeFilter />

      {/* KPI strip — simple tiles */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Total revenue"
          value={<Money value={totalRevenue} />}
          sub={`${totalOrders} order${totalOrders === 1 ? "" : "s"}`}
          accent="zari"
        />
        <StatTile
          label="Avg order value"
          value={<Money value={aov} />}
          sub="Revenue ÷ orders"
        />
        <StatTile
          label="Repeat rate"
          value={`${data.repeatCustomerRate.ratePercent}%`}
          sub={`${data.repeatCustomerRate.repeatCustomers} of ${data.repeatCustomerRate.totalCustomers} customers`}
          accent="chalk"
        />
        <StatTile
          label="Units sold"
          value={totalUnits}
          sub="Across all designs"
        />
      </div>

      {/* Revenue trend — easy spark bars */}
      <ChartCard
        title="Revenue trend"
        hint="Selected range"
        icon={<TrendingUp className={ic} />}
      >
        <SparkBars points={trendPoints} />
      </ChartCard>

      {/* Ranked designs + cities — easy HBars only */}
      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard
          title="Sales by design — ranked"
          icon={<Palette className={ic} />}
        >
          <HBars rows={topDesigns} format={(v) => <Money value={v} />} />
        </ChartCard>
        <ChartCard
          title="Sales by city"
          hint="Simple ranking — no map"
          icon={<MapPin className={ic} />}
        >
          <HBars
            rows={topCities}
            format={(v) => <Money value={v} />}
            emptyLabel="No city sales in this range."
          />
        </ChartCard>
      </div>

      {/* Donut + channels — easy */}
      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard
          title="Custom vs standard"
          hint="Units by size mode"
          icon={<ShoppingBag className={ic} />}
        >
          <Donut
            segments={modeSegments}
            centerValue={modeOrderTotal}
            centerLabel="units"
          />
        </ChartCard>
        <ChartCard title="Channel performance" icon={<Globe className={ic} />}>
          {data.salesBySource.length === 0 ? (
            <p className="py-6 text-center text-[12px] text-chalk">
              No channel data in this range.
            </p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {data.salesBySource.map((row) => {
                const meta = SOURCE_META[row.source] ?? {
                  label: row.source,
                  icon: Store,
                  accent: "border-s-chalk",
                };
                const Icon = meta.icon;
                const avg =
                  row.orderCount > 0
                    ? Math.round(row.revenueMinor / row.orderCount)
                    : 0;
                return (
                  <div
                    key={row.source}
                    className={cn(
                      "flex items-center gap-3 border border-indigo-lift bg-indigo px-3 py-3 border-s-[3px]",
                      meta.accent,
                    )}
                  >
                    <Icon className="size-4 shrink-0 text-chalk" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[12.5px] text-greige">{meta.label}</p>
                      <p className="font-data text-[11px] text-chalk">
                        Avg <Money value={avg} />
                      </p>
                    </div>
                    <div className="text-end">
                      <p className="font-data text-[13px] text-greige">
                        <Money value={row.revenueMinor} />
                      </p>
                      <p className="text-[11px] text-chalk">
                        {row.orderCount} order
                        {row.orderCount === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ChartCard>
      </div>

      {/* Size mix — easy VBars */}
      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard
          title="Which sizes sell"
          hint="Units · M is base"
          icon={<Ruler className={ic} />}
        >
          <VBars rows={sizeBars} />
        </ChartCard>
        <ChartCard
          title="Sales by province"
          hint="Simple list"
          icon={<MapPin className={ic} />}
        >
          <HBars
            rows={provinceBars}
            format={(v) => <Money value={v} />}
            emptyLabel="No provincial sales yet."
          />
        </ChartCard>
      </div>

      {/* Ops progress rails — easy */}
      <ChartCard title="Production health" icon={<Clock className={ic} />}>
        <div className="flex flex-col gap-4">
          <ProgressRail
            label="On-time delivery"
            percent={onTimePct}
            hint={`Target 70% · ${leadOnTrack}/${leadWithDelta.length || 0} on track`}
            tone={onTimePct >= 70 ? "zari" : "madder"}
          />
          <ProgressRail
            label="Fabric utilization"
            percent={utilPct}
            hint="Consumed vs planned metres"
            tone={utilPct >= 80 ? "zari" : "madder"}
          />
        </div>
      </ChartCard>

      {/* Actionable insight cards */}
      {insightCards.length > 0 ? (
        <section className="flex flex-col gap-3">
          <h2 className="font-sans text-[10px] uppercase tracking-[0.2em] text-chalk">
            What to do next
          </h2>
          <InsightCards cards={insightCards} />
        </section>
      ) : null}

      {/* Drill-down tables */}
      <section className="flex flex-col gap-3">
        <h2 className="font-sans text-[10px] uppercase tracking-[0.2em] text-chalk">
          Detailed reports · export CSV
        </h2>

        <ReportTable
          title="Sales by design"
          rows={data.salesByDesign}
          exportFilename="sales-by-design.csv"
          filterKeys={["designName"]}
          getRowHref={(row) => `/admin/designs/${row.designId}`}
          columns={[
            { key: "designName", header: "Design" },
            { key: "unitsSold", header: "Units" },
            {
              key: "revenueMinor",
              header: "Revenue",
              render: (row) => <Money value={row.revenueMinor} />,
              csv: (row) => String(row.revenueMinor / 100),
            },
          ]}
        />

        <ReportTable
          title="Sales by city"
          rows={data.salesByCity}
          exportFilename="sales-by-city.csv"
          filterKeys={["city", "province"]}
          columns={[
            { key: "city", header: "City" },
            {
              key: "province",
              header: "Province",
              render: (row) =>
                row.province
                  ? (PROVINCE_LABELS[row.province] ?? row.province)
                  : "—",
              csv: (row) => row.province ?? "",
            },
            { key: "orderCount", header: "Orders" },
            {
              key: "revenueMinor",
              header: "Revenue",
              render: (row) => <Money value={row.revenueMinor} />,
              csv: (row) => String(row.revenueMinor / 100),
            },
          ]}
        />

        <ReportTable
          title="Lead times"
          rows={data.leadTimes}
          exportFilename="lead-times.csv"
          filterKeys={["orderNumber"]}
          getRowHref={(row) => `/admin/orders/${row.orderId}`}
          columns={[
            { key: "orderNumber", header: "Order" },
            {
              key: "promisedDays",
              header: "Promised",
              render: (row) => row.promisedDays ?? "—",
            },
            {
              key: "actualDays",
              header: "Actual",
              render: (row) => row.actualDays ?? "—",
            },
            {
              key: "deltaDays",
              header: "Delta",
              render: (row) =>
                row.deltaDays === null
                  ? "—"
                  : row.deltaDays > 0
                    ? `+${row.deltaDays}`
                    : String(row.deltaDays),
            },
          ]}
        />

        <ReportTable
          title="Fabric wastage"
          rows={data.fabricWastage}
          exportFilename="fabric-wastage.csv"
          filterKeys={["designName"]}
          getRowHref={(row) => `/admin/designs/${row.designId}`}
          columns={[
            { key: "designName", header: "Design" },
            {
              key: "plannedMeters",
              header: "Planned",
              render: (row) => formatMetres(row.plannedMeters),
              csv: (row) => String(row.plannedMeters / 100),
            },
            {
              key: "actualMeters",
              header: "Actual",
              render: (row) => formatMetres(row.actualMeters),
              csv: (row) => String(row.actualMeters / 100),
            },
            {
              key: "wastagePercent",
              header: "Wastage %",
              render: (row) => `${row.wastagePercent}%`,
            },
          ]}
        />
      </section>
    </div>
  );
}
