import { EmptyState, Eyebrow } from "@/modules/ui";

export default function AdminFabricPage() {
  return (
    <div>
      <Eyebrow>Fabric</Eyebrow>
      <h1 className="mt-1 font-display text-3xl text-greige">Fabric</h1>
      <div className="mt-6">
        <EmptyState
          title="No fabric records yet"
          description="Lots, stock, and suppliers will live here."
        />
      </div>
    </div>
  );
}
