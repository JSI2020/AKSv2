import { EmptyState, Eyebrow } from "@/modules/ui";

export default function AdminTodayPage() {
  return (
    <div>
      <Eyebrow>AKS · admin</Eyebrow>
      <h1 className="mt-1 font-display text-3xl text-greige">Today</h1>
      <div className="mt-6">
        <EmptyState
          title="Nothing on the board yet"
          description="Live cards for promises, production, and attention will appear here once orders and fabric are live."
        />
      </div>
    </div>
  );
}
