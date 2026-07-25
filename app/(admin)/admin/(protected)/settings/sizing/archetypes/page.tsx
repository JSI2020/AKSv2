import Link from "next/link";
import { redirect } from "next/navigation";

import { formatModelDisclosure } from "@aks/shared";
import { Eyebrow } from "@/modules/ui";
import {
  PermissionDeniedError,
  UnauthenticatedError,
} from "@/modules/auth";
import { listHouseModels } from "@/modules/sizing/fabric-archetype-actions";

export default async function ArchetypesPage() {
  let models;
  try {
    models = await listHouseModels();
  } catch (e) {
    if (
      e instanceof PermissionDeniedError ||
      e instanceof UnauthenticatedError
    ) {
      redirect("/admin");
    }
    throw e;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Eyebrow>Settings · Sizing</Eyebrow>
          <h1 className="mt-1 font-display text-3xl text-greige">
            Archetypes
          </h1>
          <p className="mt-1 max-w-xl text-[13px] text-chalk">
            Authored house-model measurements — never inferred from a photo.
          </p>
        </div>
        <Link
          href="/admin/settings/sizing/archetypes/new"
          className="border border-zari px-3 py-1.5 text-[13px] text-zari"
        >
          New archetype
        </Link>
      </div>
      <ul className="divide-y divide-indigo-lift border border-indigo-lift">
        {models.map((m) => (
          <li key={m.id} className="px-3 py-3">
            <Link
              href={`/admin/settings/sizing/archetypes/${m.id}`}
              className="block hover:text-zari"
            >
              <p className="text-[13px] text-greige">
                {m.name}
                {m.isDefault ? " · default" : ""}
                {!m.isAiGenerated ? " · INVALID" : ""}
              </p>
              <p className="mt-1 text-[12px] text-chalk">
                {formatModelDisclosure(m)}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
