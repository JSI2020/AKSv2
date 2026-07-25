import { EmptyState, Eyebrow } from "@/modules/ui";

export default function AdminInsightsPage() {
  return (
    <div>
      <Eyebrow>Insights</Eyebrow>
      <h1 className="mt-1 font-display text-3xl text-greige">Insights</h1>
      <div className="mt-6">
        <EmptyState
          title="No insights yet"
          description="Related panels and derived metrics will live here."
        />
      </div>
    </div>
  );
}
