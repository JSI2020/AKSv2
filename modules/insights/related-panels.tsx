import Link from "next/link";
import type { ReactNode } from "react";

import { Money, Measure } from "@/modules/ui";
import { formatMarginPercent } from "@/modules/money";
import { formatMetres } from "@/modules/production";

import type {
  CustomerRelatedData,
  DesignRelatedData,
  FabricRelatedData,
  OrderFabricLotRow,
  StaffRelatedData,
} from "./queries-related";

function Panel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border border-indigo-lift p-4">
      <h2 className="font-sans text-[11px] uppercase tracking-[0.12em] text-chalk">
        Related · {title}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function EmptyNote({ children }: { children: ReactNode }) {
  return <p className="text-[13px] text-chalk">{children}</p>;
}

export function CustomerRelatedPanels({ data }: { data: CustomerRelatedData }) {
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Summary">
        <dl className="grid gap-2 text-[13px] sm:grid-cols-2">
          <div>
            <dt className="text-chalk">Lifetime value</dt>
            <dd className="text-greige">
              <Money value={data.lifetimeValueMinor} />
            </dd>
          </div>
          <div>
            <dt className="text-chalk">Orders</dt>
            <dd className="font-data text-greige">{data.totalOrdersCount}</dd>
          </div>
        </dl>
      </Panel>

      <Panel title="Orders">
        {data.orders.length === 0 ? (
          <EmptyNote>No orders yet.</EmptyNote>
        ) : (
          <ul className="divide-y divide-indigo-lift border border-indigo-lift">
            {data.orders.map((order) => (
              <li
                key={order.id}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[13px]"
              >
                <Link
                  href={`/admin/orders/${order.id}`}
                  className="text-zari hover:underline"
                >
                  {order.orderNumber}
                </Link>
                <span className="font-data text-[12px] text-chalk">
                  {order.placedAt
                    ? new Date(order.placedAt).toLocaleDateString()
                    : "—"}{" "}
                  · {order.status}
                </span>
                <Money value={order.totalMinor} className="text-[12px]" />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Measurement profiles">
        {data.measurementProfiles.length === 0 ? (
          <EmptyNote>No saved profiles.</EmptyNote>
        ) : (
          <ul className="divide-y divide-indigo-lift border border-indigo-lift">
            {data.measurementProfiles.map((profile) => (
              <li key={profile.id} className="px-3 py-2 text-[13px] text-greige">
                {profile.label}
                {profile.isDefault ? (
                  <span className="ms-2 text-[11px] text-zari">default</span>
                ) : null}
                <span className="block font-data text-[11px] text-chalk">
                  {profile.categoryName} · {profile.measurementCount} measurements
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Fabrics purchased">
        {data.fabricsPurchased.length === 0 ? (
          <EmptyNote>No fabric consumption yet.</EmptyNote>
        ) : (
          <ul className="divide-y divide-indigo-lift border border-indigo-lift">
            {data.fabricsPurchased.map((fabric) => (
              <li
                key={fabric.fabricId}
                className="flex justify-between gap-2 px-3 py-2 text-[13px]"
              >
                <Link
                  href={`/admin/fabrics/${fabric.fabricId}`}
                  className="text-zari hover:underline"
                >
                  {fabric.fabricName}
                </Link>
                <span className="font-data text-chalk">
                  {formatMetres(fabric.totalMetersConsumed)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Message log">
        {data.messages.length === 0 ? (
          <EmptyNote>No messages logged.</EmptyNote>
        ) : (
          <ul className="divide-y divide-indigo-lift border border-indigo-lift">
            {data.messages.map((msg) => (
              <li key={msg.id} className="px-3 py-2 text-[13px]">
                <p className="text-greige">{msg.templateKey}</p>
                <p className="font-data text-[11px] text-chalk">
                  {msg.orderNumber ?? "—"} · {msg.status} ·{" "}
                  {msg.sentAt
                    ? new Date(msg.sentAt).toLocaleString()
                    : new Date(msg.createdAt).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export function DesignRelatedPanels({ data }: { data: DesignRelatedData }) {
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Performance">
        <dl className="grid gap-2 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-chalk">Revenue</dt>
            <dd className="text-greige">
              <Money value={data.revenueMinor} />
            </dd>
          </div>
          <div>
            <dt className="text-chalk">Margin</dt>
            <dd className="font-data text-greige">
              {data.marginPercent !== null
                ? formatMarginPercent(data.marginPercent)
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-chalk">Units sold</dt>
            <dd className="font-data text-greige">{data.unitsSold}</dd>
          </div>
          <div>
            <dt className="text-chalk">Fabric consumed</dt>
            <dd className="font-data text-greige">
              {formatMetres(data.fabricConsumedMeters)}
              {data.fabricName ? (
                <span className="block text-[11px] text-chalk">
                  {data.fabricName} (planned {formatMetres(data.plannedFabricMeters)})
                </span>
              ) : null}
            </dd>
          </div>
        </dl>
      </Panel>

      <Panel title="Orders">
        {data.orders.length === 0 ? (
          <EmptyNote>No orders yet.</EmptyNote>
        ) : (
          <ul className="divide-y divide-indigo-lift border border-indigo-lift">
            {data.orders.map((order) => (
              <li
                key={order.orderId}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[13px]"
              >
                <Link
                  href={`/admin/orders/${order.orderId}`}
                  className="text-zari hover:underline"
                >
                  {order.orderNumber}
                </Link>
                <span className="text-chalk">{order.customerName}</span>
                <Money value={order.lineTotalMinor} className="text-[12px]" />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Customers who bought">
        {data.customers.length === 0 ? (
          <EmptyNote>No registered customers yet.</EmptyNote>
        ) : (
          <ul className="divide-y divide-indigo-lift border border-indigo-lift">
            {data.customers.map((customer) => (
              <li
                key={customer.userId}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[13px]"
              >
                <Link
                  href={`/admin/customers/${customer.userId}`}
                  className="text-zari hover:underline"
                >
                  {customer.name ?? customer.userId}
                </Link>
                <span className="font-data text-[11px] text-chalk">
                  {customer.orderCount} orders
                </span>
                <Money value={customer.revenueMinor} className="text-[12px]" />
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export function FabricRelatedPanels({ data }: { data: FabricRelatedData }) {
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Stock">
        <dl className="grid gap-2 text-[13px] sm:grid-cols-2">
          <div>
            <dt className="text-chalk">Metres remaining</dt>
            <dd className="font-data text-greige">
              {formatMetres(data.metresRemaining)}
            </dd>
          </div>
          <div>
            <dt className="text-chalk">Supplier</dt>
            <dd className="text-greige">{data.supplierName ?? "—"}</dd>
          </div>
        </dl>
      </Panel>

      <Panel title="Designs using this fabric">
        {data.designs.length === 0 ? (
          <EmptyNote>No designs linked in costing.</EmptyNote>
        ) : (
          <ul className="divide-y divide-indigo-lift border border-indigo-lift">
            {data.designs.map((design) => (
              <li
                key={design.designId}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[13px]"
              >
                <Link
                  href={`/admin/designs/${design.designId}`}
                  className="text-zari hover:underline"
                >
                  {design.designName}
                </Link>
                <span className="font-data text-[11px] text-chalk">
                  {formatMetres(design.fabricMeters)}/unit ·{" "}
                  {formatMarginPercent(design.marginPercent)} margin
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Orders consuming">
        {data.orders.length === 0 ? (
          <EmptyNote>No consumption yet.</EmptyNote>
        ) : (
          <ul className="divide-y divide-indigo-lift border border-indigo-lift">
            {data.orders.map((order, i) => (
              <li
                key={`${order.orderId}-${i}`}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[13px]"
              >
                <Link
                  href={`/admin/orders/${order.orderId}`}
                  className="text-zari hover:underline"
                >
                  {order.orderNumber}
                </Link>
                <span className="font-data text-[11px] text-chalk">
                  Lot {order.lotCode} · {formatMetres(order.metersConsumed)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Cost history">
        {data.costHistory.length === 0 ? (
          <EmptyNote>No lots received yet.</EmptyNote>
        ) : (
          <ul className="divide-y divide-indigo-lift border border-indigo-lift">
            {data.costHistory.map((lot) => (
              <li
                key={lot.lotCode}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[13px] text-greige"
              >
                <span>{lot.lotCode}</span>
                <span className="font-data text-[11px] text-chalk">
                  {new Date(lot.receivedAt).toLocaleDateString()} ·{" "}
                  <Money value={lot.costPerMeterMinor} />/m ·{" "}
                  {formatMetres(lot.metersReceived)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export function OrderFabricLotsPanel({ lots }: { lots: OrderFabricLotRow[] }) {
  return (
    <Panel title="Fabric lots">
      {lots.length === 0 ? (
        <EmptyNote>No fabric reservations yet.</EmptyNote>
      ) : (
        <ul className="divide-y divide-indigo-lift border border-indigo-lift">
          {lots.map((lot) => (
            <li
              key={`${lot.orderItemId}-${lot.lotCode}`}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[13px]"
            >
              <div>
                <p className="text-greige">{lot.designName}</p>
                <Link
                  href={`/admin/fabrics/${lot.fabricId}`}
                  className="text-[12px] text-zari hover:underline"
                >
                  {lot.fabricName} · {lot.lotCode}
                </Link>
              </div>
              <span className="font-data text-[11px] text-chalk">
                {formatMetres(
                  lot.actualMetersConsumed ?? lot.metersReserved,
                )}{" "}
                · {lot.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

export function StaffRelatedPanels({ data }: { data: StaffRelatedData }) {
  if (!data.linkedKarigarId) {
    return (
      <Panel title="Production workload">
        <EmptyNote>
          No workshop karigar linked to this account — production assignment
          panels appear when a staff.user_id link exists.
        </EmptyNote>
      </Panel>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Throughput">
        <dl className="grid gap-2 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="text-chalk">Karigar</dt>
            <dd className="text-greige">{data.karigarName}</dd>
          </div>
          <div>
            <dt className="text-chalk">Completed this month</dt>
            <dd className="font-data text-greige">{data.completedThisMonth}</dd>
          </div>
          <div>
            <dt className="text-chalk">Active jobs</dt>
            <dd className="font-data text-greige">{data.activeJobs}</dd>
          </div>
          <div>
            <dt className="text-chalk">This week</dt>
            <dd className="font-data text-greige">
              {data.assignedThisWeek} / {data.capacityPerWeek} capacity
            </dd>
          </div>
        </dl>
      </Panel>

      <Panel title="Assigned jobs">
        {data.assignedJobs.length === 0 ? (
          <EmptyNote>No active assignments.</EmptyNote>
        ) : (
          <ul className="divide-y divide-indigo-lift border border-indigo-lift">
            {data.assignedJobs.map((job) => (
              <li
                key={job.jobId}
                className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-[13px]"
              >
                <span className="text-greige">
                  {job.orderNumber} · {job.designName}
                </span>
                <span className="font-data text-[11px] text-chalk">
                  {job.stage} · {job.status}
                  {job.dueAt
                    ? ` · due ${new Date(job.dueAt).toLocaleDateString()}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

export function SizeDistributionHighlight({
  rows,
}: {
  rows: Array<{ sizeLabel: string; sizeMode: string; unitsSold: number }>;
}) {
  if (rows.length === 0) {
    return <EmptyNote>No size sales yet.</EmptyNote>;
  }

  const max = Math.max(...rows.map((r) => r.unitsSold), 1);

  return (
    <ul className="flex flex-col gap-2">
      {rows.slice(0, 12).map((row) => (
        <li key={`${row.sizeMode}-${row.sizeLabel}`} className="text-[13px]">
          <div className="flex justify-between gap-2 text-greige">
            <span>
              {row.sizeLabel}{" "}
              <span className="text-[11px] text-chalk">{row.sizeMode}</span>
            </span>
            <span className="font-data">{row.unitsSold}</span>
          </div>
          <div
            className="mt-1 h-1 bg-zari"
            style={{ width: `${Math.round((row.unitsSold / max) * 100)}%` }}
          />
        </li>
      ))}
    </ul>
  );
}

export function AvgMeasurementsTable({
  rows,
}: {
  rows: Array<{ measurementKey: string; avgValueInches: number; sampleCount: number }>;
}) {
  if (rows.length === 0) {
    return <EmptyNote>No MTM measurement samples yet.</EmptyNote>;
  }

  return (
    <table className="w-full border-collapse text-[13px]">
      <thead>
        <tr className="border-b border-indigo-lift text-chalk">
          <th className="px-2 py-1 text-start font-normal">Measurement</th>
          <th className="px-2 py-1 text-end font-normal">Average</th>
          <th className="px-2 py-1 text-end font-normal">Samples</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.measurementKey} className="border-b border-indigo-lift/50">
            <td className="px-2 py-1 text-greige">{row.measurementKey}</td>
            <td className="px-2 py-1 text-end">
              <Measure value={row.avgValueInches} />
            </td>
            <td className="px-2 py-1 text-end font-data text-chalk">
              {row.sampleCount}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
