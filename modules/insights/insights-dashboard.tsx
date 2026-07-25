"use client";

import { Money, Measure } from "@/modules/ui";
import { formatMetres } from "@/modules/production";

import type { InsightsReportData } from "./queries-reports";
import { ReportTable } from "./report-table";
import {
  AvgMeasurementsTable,
  SizeDistributionHighlight,
} from "./related-panels";

export function InsightsDashboard({ data }: { data: InsightsReportData }) {
  return (
    <div className="flex flex-col gap-8">
      <section className="border border-indigo-lift p-4">
        <h2 className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
          Repeat customer rate
        </h2>
        <p className="mt-2 font-display text-2xl text-greige">
          {data.repeatCustomerRate.ratePercent}%
        </p>
        <p className="mt-1 text-[13px] text-chalk">
          {data.repeatCustomerRate.repeatCustomers} of{" "}
          {data.repeatCustomerRate.totalCustomers} customers ordered more than
          once
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="border border-indigo-lift p-4">
          <h2 className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
            Which sizes actually sell
          </h2>
          <div className="mt-3">
            <SizeDistributionHighlight rows={data.sizeDistribution} />
          </div>
        </section>

        <section className="border border-indigo-lift p-4">
          <h2 className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
            Average customer measurements (MTM)
          </h2>
          <p className="mt-1 text-[12px] text-chalk">
            Tunes pattern blocks from real orders.
          </p>
          <div className="mt-3">
            <AvgMeasurementsTable rows={data.avgMeasurements} />
          </div>
        </section>
      </div>

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
        title="Sales by category"
        rows={data.salesByCategory}
        exportFilename="sales-by-category.csv"
        filterKeys={["categoryName"]}
        columns={[
          { key: "categoryName", header: "Category" },
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
        title="Size distribution"
        rows={data.sizeDistribution}
        exportFilename="size-distribution.csv"
        filterKeys={["sizeLabel", "sizeMode"]}
        columns={[
          { key: "sizeLabel", header: "Size" },
          { key: "sizeMode", header: "Mode" },
          { key: "unitsSold", header: "Units sold" },
          { key: "orderCount", header: "Orders" },
        ]}
      />

      <ReportTable
        title="Made-to-measure vs standard"
        rows={data.sizeModeSplit}
        exportFilename="size-mode-split.csv"
        filterKeys={["sizeMode"]}
        columns={[
          { key: "sizeMode", header: "Mode" },
          { key: "unitsSold", header: "Units" },
          {
            key: "percentUnits",
            header: "% of units",
            render: (row) => `${row.percentUnits}%`,
            csv: (row) => String(row.percentUnits),
          },
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

      <ReportTable
        title="Average measurements (export)"
        rows={data.avgMeasurements}
        exportFilename="avg-measurements.csv"
        filterKeys={["measurementKey"]}
        columns={[
          { key: "measurementKey", header: "Measurement" },
          {
            key: "avgValueInches",
            header: "Average (hundredths in)",
            render: (row) => <Measure value={row.avgValueInches} />,
            csv: (row) => String(row.avgValueInches),
          },
          { key: "sampleCount", header: "Samples" },
        ]}
      />
    </div>
  );
}
