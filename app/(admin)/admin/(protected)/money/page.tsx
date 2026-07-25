import { EmptyState, Eyebrow } from "@/modules/ui";

export default function AdminMoneyPage() {
  return (
    <div>
      <Eyebrow>Money</Eyebrow>
      <h1 className="mt-1 font-display text-3xl text-greige">Money</h1>
      <div className="mt-6">
        <EmptyState
          title="No financials yet"
          description="Costs, revenue, margin, and break-even will live here."
        />
      </div>
    </div>
  );
}
