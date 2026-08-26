"use client";

import {
  MapPin,
  Palette,
  PieChart,
  Repeat,
  Ruler,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from "lucide-react";

import { Money } from "@/modules/ui";
import { formatMetres } from "@/modules/production/format-metres";
import { AdminTimeFilter } from "@/modules/admin/time-filter";
import { StatTile } from "@/modules/admin/ui";

import type { InsightsReportData } from "./queries-reports";
import { ReportTable } from "./report-table";
import { ChartCard, Donut, HBars, VBars } from "./insight-charts";

const ic = "size-4";

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL"] as const;

export function InsightsDashboard({ data }: { data: InsightsReportData }) {
  // Top-line KPIs derived from the report data.
  const totalRevenue = data.salesByCity.reduce((s, r) => s + r.revenueMinor, 0);
  const totalOrders = data.salesByCity.reduce((s, r) => s + r.orderCount, 0);
  const totalUnits = data.salesByDesign.reduce((s, r) => s + r.unitsSold, 0);
  const aov = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

  // Size mix (standard sizes only) aggregated for the bar chart.
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

  const topDesigns = data.salesByDesign.slice(0, 8).map((r) => ({
    name: r.designName || "Untitled",
    value: r.revenueMinor,
  }));
  const topCities = data.salesByCity.slice(0, 8).map((r) => ({
    name: r.city,
    value: r.revenueMinor,
  }));
  const categorySegments = data.salesByCategory.slice(0, 6).map((r) => ({
    label: r.categoryName,
    value: r.revenueMinor,
  }));

  return (
    <div className="flex flex-col gap-8">
      <AdminTimeFilter />

      {/* KPI row */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Revenue"
          icon={<TrendingUp className={ic} />}
          value={<Money value={totalRevenue} />}
          hint={`${totalOrders} order${totalOrders === 1 ? "" : "s"}`}
        />
        <StatTile
          label="Units sold"
          icon={<ShoppingBag className={ic} />}
          value={totalUnits}
          hint="across all designs"
        />
        <StatTile
          label="Avg order value"
          icon={<Wallet className={ic} />}
          value={<Money value={aov} />}
          hint="revenue ÷ orders"
        />
        <StatTile
          label="Repeat customers"
          icon={<Repeat className={ic} />}
          value={`${data.repeatCustomerRate.ratePercent}%`}
          hint={`${data.repeatCustomerRate.repeatCustomers} of ${data.repeatCustomerRate.totalCustomers} ordered again`}
        />
      </div>

      {/* Visual row 1 */}
      <div className="grid gap-3 lg:grid-cols-[1fr_1.3fr]">
        <ChartCard title="Revenue by category" icon={<PieChart className={ic} />}>
          <Donut
            segments={categorySegments}
            centerValue={<Money value={totalRevenue} />}
            centerLabel="total"
          />
        </ChartCard>
        <ChartCard title="Top designs by revenue" icon={<Palette className={ic} />}>
          <HBars rows={topDesigns} format={(v) => <Money value={v} />} />
        </ChartCard>
      </div>

      {/* Visual row 2 */}
      <div className="grid gap-3 lg:grid-cols-2">
        <ChartCard
          title="Which sizes sell"
          hint="units · M is the base size"
          icon={<Ruler className={ic} />}
        >
          <VBars rows={sizeBars} />
        </ChartCard>
        <ChartCard title="Revenue by city" icon={<MapPin className={ic} />}>
          <HBars rows={topCities} format={(v) => <Money value={v} />} />
        </ChartCard>
      </div>

      {/* Detailed tables (drill-down + CSV export) */}
      <div className="flex flex-col gap-3">
        <h2 className="font-sans text-[10px] uppercase tracking-[0.2em] text-chalk">
          Detailed reports · export as CSV
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
          filterKeys={["city"]}
          columns={[
            { key: "city", header: "City" },
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
          title="Promised vs actual lead time (days)"
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
          title="Fabric wastage by design"
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
              key: "wastageMeters",
              header: "Wastage",
              render: (row) => formatMetres(row.wastageMeters),
              csv: (row) => String(row.wastageMeters / 100),
            },
            {
              key: "wastagePercent",
              header: "Wastage %",
              render: (row) => `${row.wastagePercent}%`,
            },
          ]}
        />
      </div>
    </div>
  );
}
