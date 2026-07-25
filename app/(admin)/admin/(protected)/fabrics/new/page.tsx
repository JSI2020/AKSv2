import { Eyebrow } from "@/modules/ui";
import { FabricForm } from "@/modules/sizing/fabric-archetype-ui";

export default function NewFabricPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow>Fabric</Eyebrow>
        <h1 className="mt-1 font-display text-3xl text-greige">New fabric</h1>
      </div>
      <FabricForm fabric={null} />
    </div>
  );
}
