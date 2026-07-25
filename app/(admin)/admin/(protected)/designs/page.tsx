import { EmptyState, Eyebrow } from "@/modules/ui";

export default function AdminDesignsPage() {
  return (
    <div>
      <Eyebrow>Designs</Eyebrow>
      <h1 className="mt-1 font-display text-3xl text-greige">Designs</h1>
      <div className="mt-6">
        <EmptyState
          title="No designs yet"
          description="Catalogue, costing, and colourways will live here."
        />
      </div>
    </div>
  );
}
