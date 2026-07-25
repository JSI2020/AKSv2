import { EmptyState, Eyebrow } from "@/modules/ui";

export default function AdminOrdersPage() {
  return (
    <div>
      <Eyebrow>Orders</Eyebrow>
      <h1 className="mt-1 font-display text-3xl text-greige">Orders</h1>
      <div className="mt-6">
        <EmptyState
          title="No orders yet"
          description="The order list and pipeline will live here."
        />
      </div>
    </div>
  );
}
