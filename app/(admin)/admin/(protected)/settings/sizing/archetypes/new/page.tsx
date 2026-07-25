import { Eyebrow } from "@/modules/ui";
import { HouseModelForm } from "@/modules/sizing/fabric-archetype-ui";

export default function NewArchetypePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Eyebrow>Settings · Sizing · Archetypes</Eyebrow>
        <h1 className="mt-1 font-display text-3xl text-greige">
          New archetype
        </h1>
      </div>
      <HouseModelForm model={null} />
    </div>
  );
}
