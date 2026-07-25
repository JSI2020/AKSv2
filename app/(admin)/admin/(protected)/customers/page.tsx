import { EmptyState, Eyebrow } from "@/modules/ui";

export default function AdminCustomersPage() {
  return (
    <div>
      <Eyebrow>Customers</Eyebrow>
      <h1 className="mt-1 font-display text-3xl text-greige">Customers</h1>
      <div className="mt-6">
        <EmptyState
          title="No customers yet"
          description="Profiles, measurements, and order history will live here."
        />
      </div>
    </div>
  );
}
